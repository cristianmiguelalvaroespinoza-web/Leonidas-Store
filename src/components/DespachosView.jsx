import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
// Generador de PDF con márgenes @page (12mm laterales) y paginación real para lotes grandes
import { generarPDFDesdeElemento } from "../utils/generarPDFDocumento";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { X, Printer, User, MapPin, CalendarDays, Search, Package, Truck, RotateCcw, PlusCircle, FileDown, QrCode, Trash2, FileText, ChevronDown, Tag } from 'lucide-react'; 
import logoFinpro from '../assets/logo-finpro.png'; // Logo oficial para el comprobante comercial
import { doc, setDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore"; // Importación necesaria
import { db } from "../firebase"; // Asegúrate que la ruta sea correcta
import './VentasView.css';

// Normaliza un serial para comparar: sin espacios, en mayúsculas.
const normalizarSerial = (serial) => String(serial || '').trim().toUpperCase().replace(/\s+/g, '');

const DespachosView = ({ laptops, usuarioLogueado, iniciarEscaneo }) => {
  const [busqueda, setBusqueda] = useState("");
  const [modoEliminar, setModoEliminar] = useState(false);
  const [filtroFecha, setFiltroFecha] = useState("");
  const [equipoDetalle, setEquipoDetalle] = useState(null);
  const [mostrarGuia, setMostrarGuia] = useState(false);
  // --- NUEVOS ESTADOS: COMPROBANTE COMERCIAL (BOLETA / NOTA DE VENTA) ---
  const [mostrarComprobante, setMostrarComprobante] = useState(false);
  const [equipoComprobante, setEquipoComprobante] = useState(null);
  const [tipoComprobante, setTipoComprobante] = useState("BOLETA"); // "BOLETA" o "NOTA" (misma lógica que en Ventas)
  const [mostrarModalVentaRapida, setMostrarModalVentaRapida] = useState(false);
  const [cargandoVentaRapida, setCargandoVentaRapida] = useState(false);
  // --- ESTADOS DEL MODAL DE SALIDA RÁPIDA CON ESCANEO MÚLTIPLE (LOTES) ---
  // ventaRapidaForm guarda SOLO los datos comunes a todo el lote (no repetibles)
  const [ventaRapidaForm, setVentaRapidaForm] = useState({
    fecha_venta: new Date().toISOString().split('T')[0], // Fecha actual por defecto
    cliente: '', // Ahora el campo cliente inicia vacío
    destino: '',
    precio_total: '', // Precio de venta TOTAL del lote (se reparte entre los equipos)
    responsable: '',
    dni: '', // DNI del responsable (opcional): se muestra en el comprobante
    despachador: '' // Persona que hace el despacho físico (distinto del responsable de envío)
  });
  const [cantidadEquiposLote, setCantidadEquiposLote] = useState(1); // Cantidad de equipos del lote
  const [equiposLote, setEquiposLote] = useState([{ serial: '', modelo: '' }]); // Una fila por equipo
  // --- MODO "PRECIO ESPECÍFICO" (solo disponible con 2 o más equipos) ---
  // Permite asignar un precio individual a cada laptop del lote. Cuando está activo,
  // el campo "Precio de Venta Total" queda deshabilitado y manda la suma de los precios
  // por equipo (que se muestra en vivo como "Total del lote").
  const [modoPrecioEspecifico, setModoPrecioEspecifico] = useState(false);
  const [preciosEquiposLote, setPreciosEquiposLote] = useState([]); // Precio por cada equipo del lote

  // --- ESTADOS DEL ACORDEÓN DE LOTES (TABLA DE HISTORIAL DE SALIDAS) ---
  const [lotesExpandidos, setLotesExpandidos] = useState({}); // clave del lote -> abierto / cerrado
  const [equiposGuiaLote, setEquiposGuiaLote] = useState([]); // equipos que se listan en la Guía de Envío
  const [equiposLoteComprobante, setEquiposLoteComprobante] = useState(null); // equipos del comprobante consolidado

  // --- FIX: Bloquea el scroll del fondo mientras el modal de Salida Rápida esté abierto ---
  useEffect(() => {
    if (mostrarModalVentaRapida) {
      const overflowPrevio = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = overflowPrevio; };
    }
  }, [mostrarModalVentaRapida]);

// Asegúrate de que esta línea diga "inventario"
const handlePrecioChange = async (id, nuevoPrecio) => {
  try {
    const docRef = doc(db, "inventario", id); // <--- AQUÍ ESTÁ EL CAMBIO
    await updateDoc(docRef, { precio: Number(nuevoPrecio) });
    console.log("Precio actualizado correctamente");
    // Actualizar el estado local si el modal de guía está abierto para este equipo
    if (equipoDetalle && equipoDetalle.fireId === id) {
      setEquipoDetalle(prev => ({ ...prev, precio: Number(nuevoPrecio) }));
    }
  } catch (error) {
    console.error("Error al actualizar:", error);
  }
};

  const limpiarFiltros = () => {
    setBusqueda("");
    setFiltroFecha("");
  };

  // Revierte un equipo a STOCK (sin diálogos: la confirmación la maneja cada botón)
  const aplicarReversionSalida = async (laptop) => {
    const laptopRef = doc(db, "inventario", laptop.fireId);
    await updateDoc(laptopRef, {
      estado: 'STOCK',
      estado_despacho: null,
      cliente: null,
      fecha_venta: null,
      fecha_despacho: null,
      destino: null,
      responsable_venta: null,
      responsable_despacho: null,
      despachador: null, // el despacho físico también se revierte
      vendedor_final: null,
      numero_boleta: null,
      utilidad: 0
    });
  };

  const handleRevertirSalida = async (laptop) => {
    if (!laptop || !laptop.fireId) {
        alert('❌ No se pudo identificar el equipo.');
        return;
    }

    if (window.confirm(`¿Estás seguro de revertir la salida del equipo con serial "${laptop.serial}"? Esta acción lo devolverá al STOCK.`)) {
        try {
            await aplicarReversionSalida(laptop);
            alert(`✅ La salida del equipo ${laptop.serial} ha sido revertida. Ahora está en STOCK.`);
        } catch (error) {
            console.error("Error al revertir la salida:", error);
            alert(`❌ Hubo un error al revertir la salida: ${error.message}`);
        }
    }
  };

  // Revierte TODOS los equipos de un lote (botón de la fila maestra del acordeón)
  const handleRevertirLote = async (lote) => {
    const equiposValidos = lote.equipos.filter(eq => eq.fireId);

    if (equiposValidos.length === 0) {
      alert('❌ No se pudo identificar ningún equipo del lote.');
      return;
    }

    if (window.confirm(`¿Estás seguro de revertir la salida del lote de ${equiposValidos.length} equipos (${lote.cliente || 'Sin cliente'})? Todos volverán a STOCK.`)) {
      try {
        await Promise.all(equiposValidos.map(eq => aplicarReversionSalida(eq)));
        alert(`✅ El lote de ${equiposValidos.length} equipos ha sido revertido. Ahora están en STOCK.`);
      } catch (error) {
        console.error("Error al revertir el lote:", error);
        alert(`❌ Hubo un error al revertir el lote: ${error.message}`);
      }
    }
  };

  const todosLosDespachos = useMemo(() => {
    return laptops.filter(lap => 
      lap.estado?.toUpperCase() === 'VENDIDO' && 
      lap.estado_despacho?.toUpperCase() === 'DESPACHADO'
    );
  }, [laptops]);

  const descargarExcelSalidas = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Historial de Salidas");

    // Función para parsear fechas en formato DD/MM/YYYY
    const obtenerFechaParaOrdenar = (item) => {
      const fechaStr = item.fecha_despacho || item.fecha_venta || "";
      if (!fechaStr || typeof fechaStr !== 'string') return new Date(0); // Fecha inválida va al final

      const partes = fechaStr.split('/');
      if (partes.length !== 3) return new Date(0);

      const dia = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1; // Mes es 0-indexado en JS
      const anio = parseInt(partes[2], 10);

      if (isNaN(dia) || isNaN(mes) || isNaN(anio)) return new Date(0);
      return new Date(anio, mes, dia);
    };

    worksheet.columns = [
      { header: 'Fecha Despacho', key: 'fecha_despacho', width: 16 },
      { header: 'N° Pedido', key: 'n_pedido', width: 14 },
      { header: 'Cliente', key: 'cliente', width: 18 },
      { header: 'Precio (S/)', key: 'precio', width: 14 },
      { header: 'Equipo', key: 'equipo', width: 30 },
      { header: 'Serial', key: 'serial', width: 18 },
      { header: 'Destino', key: 'destino', width: 18 },
      { header: 'Responsable Envío', key: 'responsable_despacho', width: 20 },
      { header: 'Despachador', key: 'despachador', width: 20 },
    ];

    // Configuración de página horizontal y ajuste a 1 página de ancho
    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0
    };

    // Estilo del encabezado (Blanco y Negro) — alto de fila 20 para que no se vea comprimido
    worksheet.getRow(1).height = 20;
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } }; // Fondo Negro
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true }; // Letra Blanca
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
    });

    // Ordenar los despachos por fecha, de más reciente a más antiguo
    const despachosOrdenados = [...todosLosDespachos].sort((a, b) => {
      const fechaA = obtenerFechaParaOrdenar(a);
      const fechaB = obtenerFechaParaOrdenar(b);
      return fechaB.getTime() - fechaA.getTime();
    });

    despachosOrdenados.forEach(laptop => {
      const row = worksheet.addRow({
        fecha_despacho: laptop.fecha_despacho || laptop.fecha_venta,
        n_pedido: laptop.n_pedido || '-',
        cliente: laptop.cliente,
        precio: laptop.precio,
        equipo: `${laptop.marca} ${laptop.modelo}`,
        serial: laptop.serial,
        destino: laptop.destino,
        responsable_despacho: laptop.responsable_despacho || 'N/A',
        despachador: laptop.despachador || 'N/A',
      });
      // Estilo de las filas (Blanco y Negro) — alto de fila 20 para que no se vea comprimido
      row.height = 20;
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Blanco
        cell.font = { color: { argb: 'FF000000' } }; // Negro
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Historial_Salidas_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
  };

  const handleVentaRapidaChange = (e) => {
    const { name, value } = e.target;
    setVentaRapidaForm(prev => ({ ...prev, [name]: value }));
  };

  // --- HELPERS DEL MODAL DE SALIDA RÁPIDA (ESCANEO MÚLTIPLE) ---
  // Deja el formulario listo para un nuevo lote
  const reiniciarVentaRapida = () => {
    // Se limpian los debounces pendientes para que no se autocomplete una fila vieja
    Object.values(temporizadoresDebounce.current).forEach(t => clearTimeout(t));
    temporizadoresDebounce.current = {};
    setEstadoSerialLote({});

    setVentaRapidaForm({
      fecha_venta: new Date().toISOString().split('T')[0],
      cliente: '',
      destino: '',
      precio_total: '',
      responsable: '',
      dni: '',
      despachador: ''
    });
    setCantidadEquiposLote(1);
    setEquiposLote([{ serial: '', modelo: '' }]);
    // El modo de precio específico y sus valores también se reinician
    setModoPrecioEspecifico(false);
    setPreciosEquiposLote([]);
  };

  // Reparte el total del lote entre los equipos (el último absorbe el redondeo)
  const repartirTotalEntreEquipos = (total, cantidad) => {
    const totalNum = Number(total) || 0;
    const n = Math.max(1, cantidad);
    const base = n > 0 ? Number((totalNum / n).toFixed(2)) : 0;
    return Array.from({ length: n }, (_, i) => (
      i === n - 1
        ? Number((totalNum - base * (n - 1)).toFixed(2))
        : base
    ));
  };

  // Redimensiona la lista de equipos conservando lo que ya se escaneó
  const cambiarCantidadEquiposLote = (valor) => {
    const parseado = parseInt(valor, 10);
    const nuevaCantidad = Number.isNaN(parseado) ? 1 : Math.max(1, parseado);
    setCantidadEquiposLote(nuevaCantidad);
    setEquiposLote(prev => {
      const copia = [...prev];
      if (nuevaCantidad > copia.length) {
        while (copia.length < nuevaCantidad) copia.push({ serial: '', modelo: '' });
      } else {
        copia.length = nuevaCantidad;
      }
      return copia;
    });
    // Si el modo precio específico está activo, se reajusta el reparto a la nueva cantidad
    setPreciosEquiposLote(prev => {
      if (prev.length === 0) return prev;
      return repartirTotalEntreEquipos(prev.reduce((acc, p) => acc + (Number(p) || 0), 0), nuevaCantidad);
    });
    // Con 1 solo equipo el precio específico deja de tener sentido
    if (nuevaCantidad < 2) setModoPrecioEspecifico(false);

    // Se limpian debounces e indicadores de las filas que ya no existen
    Object.keys(temporizadoresDebounce.current).forEach(k => {
      if (Number(k) >= nuevaCantidad) {
        clearTimeout(temporizadoresDebounce.current[k]);
        delete temporizadoresDebounce.current[k];
      }
    });
    setEstadoSerialLote(prev => {
      const filtrado = {};
      Object.entries(prev).forEach(([k, v]) => { if (Number(k) < nuevaCantidad) filtrado[k] = v; });
      return filtrado;
    });
  };

  // Activa / desactiva el desglose de precio individual por equipo
  const alternarPrecioEspecifico = () => {
    if (cantidadEquiposLote < 2) return;
    setModoPrecioEspecifico(prev => {
      const nuevoEstado = !prev;
      if (nuevoEstado) {
        // Al activarlo, sembramos el reparto del total actual para no empezar en cero
        setPreciosEquiposLote(repartirTotalEntreEquipos(ventaRapidaForm.precio_total, cantidadEquiposLote));
      }
      return nuevoEstado;
    });
  };

  // Suma en vivo de los precios por equipo (para mostrar el "Total del lote")
  const totalPreciosEspecificos = useMemo(
    () => preciosEquiposLote.reduce((acc, p) => acc + (Number(p) || 0), 0),
    [preciosEquiposLote]
  );

  // Edita el precio de un equipo concreto (solo en modo precio específico)
  const handlePrecioEquipoLoteChange = (index, valor) => {
    setPreciosEquiposLote(prev => {
      const copia = [...prev];
      while (copia.length < index + 1) copia.push('');
      copia[index] = valor;
      return copia;
    });
  };

  // Actualiza el serial o el modelo de una fila concreta (Equipo #N)
  const handleEquipoLoteChange = (e, index) => {
    const { name, value } = e.target;
    const campo = name.startsWith('serial') ? 'serial' : 'modelo';
    setEquiposLote(prev => prev.map((equipo, i) => (
      i === index ? { ...equipo, [campo]: value } : equipo
    )));
  };

  /* ============================================================================
     AUTOCOMPLETADO DE MODELO AL ESCANEAR EL NÚMERO DE SERIE
     Disparadores: Enter, onBlur y un debounce de 400 ms mientras se escribe.
     Cada búsqueda actualiza ÚNICAMENTE la fila del índice correspondiente.
     ============================================================================ */

  // Estado visual por fila: 'buscando' | 'encontrado' | 'no-encontrado'
  const [estadoSerialLote, setEstadoSerialLote] = useState({});
  // Temporizadores de debounce (uno por fila) para no consultar en cada tecla
  const temporizadoresDebounce = useRef({});
  // Espejo de equiposLote para leer el serial vigente dentro de los callbacks
  const equiposLoteRef = useRef(equiposLote);
  useEffect(() => {
    equiposLoteRef.current = equiposLote;
  }, [equiposLote]);

  // Al desmontar el componente se cancelan los debounces pendientes
  useEffect(() => () => {
    Object.values(temporizadoresDebounce.current).forEach(t => clearTimeout(t));
  }, []);

  const marcarEstadoSerial = useCallback((indice, estado) => {
    setEstadoSerialLote(prev => {
      if (prev[indice] === estado) return prev;
      const copia = { ...prev };
      if (estado === null) delete copia[indice];
      else copia[indice] = estado;
      return copia;
    });
  }, []);

  /**
   * Busca un equipo por número de serie.
   * 1) Primero en la lista local `laptops` (rápido, sin red).
   * 2) Si no aparece, consulta Firestore (por si no está en la lista cargada).
   * Devuelve el objeto del inventario o null.
   */
  const buscarEquipoPorSerial = useCallback(async (serial) => {
    const objetivo = normalizarSerial(serial);
    if (!objetivo) return null;

    const local = (laptops || []).find(l => normalizarSerial(l.serial) === objetivo);
    if (local) return local;

    try {
      const q = query(collection(db, "inventario"), where("serial", "==", String(serial).trim().toUpperCase()));
      const snap = await getDocs(q);
      if (!snap.empty) return { fireId: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (error) {
      console.warn("No se pudo consultar el inventario por serial:", error);
    }
    return null;
  }, [laptops]);

  /**
   * Autocompleta el MODELO (y datos vinculados) de la fila `indice`
   * a partir del serial capturado. No toca ninguna otra fila del lote.
   */
  const completarModeloDesdeSerial = useCallback(async (indice, serial) => {
    const limpio = String(serial || '').trim();
    if (!limpio) {
      marcarEstadoSerial(indice, null);
      return;
    }

    marcarEstadoSerial(indice, 'buscando');
    const equipo = await buscarEquipoPorSerial(limpio);

    // Si el usuario siguió escribiendo, la respuesta ya no corresponde: se descarta
    if (normalizarSerial(equiposLoteRef.current[indice]?.serial) !== normalizarSerial(limpio)) return;

    if (!equipo) {
      marcarEstadoSerial(indice, 'no-encontrado');
      return;
    }

    // Nombre exacto con el que está registrado en el inventario
    const modeloInventario = equipo.modelo || equipo.laptop_modelo || equipo.nombre || '';
    const marcaInventario = equipo.marca || '';

    setEquiposLote(prev => prev.map((equipoLote, i) => (
      i === indice
        ? {
            ...equipoLote,
            modelo: modeloInventario,
            marca: marcaInventario,
            fireId: equipo.fireId || null,
            precioBase: equipo.precio ?? null,
            costoBase: equipo.precio_costo ?? null,
            estadoInventario: equipo.estado || null
          }
        : equipoLote
    )));

    marcarEstadoSerial(indice, modeloInventario ? 'encontrado' : 'no-encontrado');
  }, [buscarEquipoPorSerial, marcarEstadoSerial]);

  // Dispara el autocompletado con debounce de 400 ms mientras se escribe
  const programarAutocompletado = (indice, serial) => {
    if (temporizadoresDebounce.current[indice]) {
      clearTimeout(temporizadoresDebounce.current[indice]);
    }
    temporizadoresDebounce.current[indice] = setTimeout(() => {
      completarModeloDesdeSerial(indice, serial);
    }, 400);
  };

  // Al editar el SERIAL: programa el debounce y limpia el modelo anterior de ESA fila
  const handleSerialEquipoLoteChange = (e, index) => {
    const valor = e.target.value;
    setEquiposLote(prev => prev.map((equipo, i) => (
      i === index ? { ...equipo, serial: valor, modelo: '' } : equipo
    )));
    marcarEstadoSerial(index, null);
    programarAutocompletado(index, valor);
  };

  // Enter: comportamiento estándar de las pistolas lectoras (busca de inmediato)
  const handleSerialEquipoLoteKeyDown = (e, index) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (temporizadoresDebounce.current[index]) {
      clearTimeout(temporizadoresDebounce.current[index]);
      temporizadoresDebounce.current[index] = null;
    }
    completarModeloDesdeSerial(index, e.target.value);
  };

  // onBlur: cierra el ciclo de búsqueda si el usuario ya no sigue escribiendo
  const handleSerialEquipoLoteBlur = (e, index) => {
    if (temporizadoresDebounce.current[index]) {
      clearTimeout(temporizadoresDebounce.current[index]);
      temporizadoresDebounce.current[index] = null;
    }
    completarModeloDesdeSerial(index, e.target.value);
  };

  // Escáner QR / código de barras dirigido a la fila exacta del lote:
  // escribe el serial Y dispara el autocompletado del modelo de esa fila.
  const escanearSerialEquipo = (index) => {
    if (typeof iniciarEscaneo !== 'function') return;
    iniciarEscaneo((valorEscaneado) => {
      const serial = String(valorEscaneado || '').toUpperCase();
      setEquiposLote(prev => prev.map((equipo, i) => (
        i === index ? { ...equipo, serial, modelo: '' } : equipo
      )));
      if (temporizadoresDebounce.current[index]) {
        clearTimeout(temporizadoresDebounce.current[index]);
        temporizadoresDebounce.current[index] = null;
      }
      completarModeloDesdeSerial(index, serial);
    });
  };

  const handleGuardarVentaRapida = async (e) => {
    e.preventDefault();
    setCargandoVentaRapida(true);

    const { fecha_venta, cliente, destino, precio_total, responsable, dni, despachador } = ventaRapidaForm;

    if (!fecha_venta || !responsable.trim()) {
      alert("Por favor, complete los campos requeridos: Fecha de Venta y Responsable.");
      setCargandoVentaRapida(false);
      return;
    }

    // 1. Normalizamos las filas del lote (escaneo múltiple)
    const equiposNormalizados = equiposLote.map((equipo, index) => ({
      indice: index,
      serial: (equipo.serial || '').trim().toUpperCase(),
      modelo: (equipo.modelo || '').trim().toUpperCase()
    }));

    const filaVacia = equiposNormalizados.find(eq => !eq.serial && !eq.modelo);
    if (filaVacia) {
      alert(`⚠️ Completa el Nº de Serie o el Modelo del Equipo #${filaVacia.indice + 1} del lote.`);
      setCargandoVentaRapida(false);
      return;
    }

    // 2. Evitamos seriales repetidos dentro del mismo lote
    const serialesDelLote = equiposNormalizados.map(eq => eq.serial).filter(Boolean);
    const serialRepetido = serialesDelLote.find((serial, i) => serialesDelLote.indexOf(serial) !== i);
    if (serialRepetido) {
      alert(`⚠️ El serial "${serialRepetido}" está repetido en el lote. Corrígelo antes de guardar.`);
      setCargandoVentaRapida(false);
      return;
    }

    // 3. En modo "Precio específico" cada equipo debe tener su propio importe
    if (modoPrecioEspecifico) {
      const precioVacio = equiposNormalizados.find((_, i) => !(Number(preciosEquiposLote[i]) > 0));
      if (precioVacio) {
        alert(`⚠️ Ingresa el precio específico del Equipo #${precioVacio.indice + 1} o desactiva el modo "Precio específico".`);
        setCargandoVentaRapida(false);
        return;
      }
    }

    const cantidadLote = equiposNormalizados.length;
    const vCosto = 0; // Costo es 0 para las salidas rápidas
    const precioTotalLote = Number(precio_total) || 0;

    // Precio por equipo:
    //  - Modo PRECIO ESPECÍFICO activo: se usa el importe capturado para cada laptop.
    //  - Modo normal: el Precio de Venta Total se reparte entre los equipos y el último
    //    absorbe el redondeo.
    const precioUnitarioBase = cantidadLote > 0 ? Number((precioTotalLote / cantidadLote).toFixed(2)) : 0;
    const precioDeEquipo = modoPrecioEspecifico
      ? (index) => Number(preciosEquiposLote[index]) || 0
      : (index) => index === cantidadLote - 1
        ? Number((precioTotalLote - precioUnitarioBase * (cantidadLote - 1)).toFixed(2))
        : precioUnitarioBase;

    const [y, m, d] = fecha_venta.split('-');
    const fechaFormateada = `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
    const clienteFinal = (cliente || '').trim().toUpperCase() || 'N/A'; // Si el cliente está vacío, se guarda como 'N/A'
    const destinoFinal = (destino || '').trim().toUpperCase() || 'LIMA';
    const responsableFinal = responsable.trim().toUpperCase();
    // DNI del responsable: campo opcional (sin espacios y en mayúsculas). Se guarda
    // junto a la venta para que aparezca en el comprobante comercial.
    const dniFinal = (dni || '').trim().toUpperCase();
    // Despachador: persona que realiza el despacho físico del pedido (opcional).
    // Si se deja vacío, por defecto es el mismo responsable de la venta.
    const despachadorFinal = (despachador || '').trim().toUpperCase() || responsableFinal;
    const numeroBoletaBase = `B${String(proximoNumeroBoleta).padStart(3, '0')}`;

    try {
      let actualizados = 0;
      let creados = 0;
      let numeroBoletaMostrado = '';

      for (let i = 0; i < equiposNormalizados.length; i++) {
        const { serial, modelo } = equiposNormalizados[i];
        const vVenta = precioDeEquipo(i);
        const serialFinal = serial || `EXT-${Date.now()}-${i + 1}`;

        // Buscamos si el serial ya existe en el inventario general
        let equipoExistente = null;
        if (serial) {
          const q = query(collection(db, "inventario"), where("serial", "==", serial));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) equipoExistente = querySnapshot.docs[0];
        }

        // La referencia se crea ANTES de escribir para poder numerar el documento igual que en Ventas
        const equipoRef = equipoExistente ? doc(db, "inventario", equipoExistente.id) : doc(collection(db, "inventario"));
        const numeroBoletaCompleto = cantidadLote > 1
          ? `${numeroBoletaBase}-LOTE-${cantidadLote}` // Un solo documento para todo el lote
          : `${numeroBoletaBase}-${equipoRef.id.substring(0, 6).toUpperCase()}`;
        if (i === 0) numeroBoletaMostrado = numeroBoletaCompleto;

        const baseVentaData = {
          precio: vVenta,
          precio_costo: vCosto,
          utilidad: vVenta - vCosto,
          cantidad: 1,
          fecha_venta: fechaFormateada,
          fecha_despacho: fechaFormateada,
          cliente: clienteFinal,
          dni: dniFinal, // DNI del responsable (opcional) -> sale en la Boleta / Nota de Venta
          despachador: despachadorFinal, // Persona que hace el despacho físico del pedido
          destino: destinoFinal,
          estado: 'VENDIDO',
          estado_despacho: 'DESPACHADO',
          responsable_venta: responsableFinal,
          responsable_despacho: responsableFinal,
          vendedor_final: responsableFinal,
          fecha: fechaFormateada,
          responsable: responsableFinal,
          numero_boleta: numeroBoletaCompleto,
          serial: serialFinal
        };

        if (equipoExistente) {
          // Laptop encontrada en el inventario general: se conservan sus datos técnicos
          const existingData = equipoExistente.data();
          await updateDoc(equipoRef, {
            ...existingData, // Mantener campos existentes como procesador, ram, etc.
            ...baseVentaData, // Sobrescribir con los nuevos datos de venta
            marca: existingData.marca || 'EXTERNO',
            // Solo se reemplaza el modelo si se escribió uno en la fila del equipo
            modelo: modelo || existingData.modelo || 'EXTERNO'
          });
          actualizados++;
        } else {
          // Serial nuevo (o sin serial): se registra como venta externa dentro del lote
          await setDoc(equipoRef, { ...baseVentaData, marca: 'EXTERNO', modelo: modelo || 'EXTERNO' });
          creados++;
        }
      }

      const totalVentaLote = equiposNormalizados.reduce(
        (acc, _, i) => acc + (precioDeEquipo(i) || 0), 0
      );

      alert(
        '✅ Salida rápida registrada con éxito.\n' +
        `• Equipos del lote: ${cantidadLote}\n` +
        `• Total vendido: S/ ${Number(totalVentaLote).toFixed(2)}${modoPrecioEspecifico ? ' (precios específicos)' : ''}\n` +
        `• Actualizados en inventario: ${actualizados}\n` +
        `• Nuevos registros externos: ${creados}\n` +
        `• Responsable: ${responsableFinal}\n` +
        `• Despachador: ${despachadorFinal}\n` +
        `• Documento: ${numeroBoletaMostrado}`
      );

      setMostrarModalVentaRapida(false);
      reiniciarVentaRapida();
    } catch (error) {
      console.error("Error al registrar venta rápida:", error);
      alert('❌ Hubo un error al registrar la venta: ' + error.message);
    } finally {
      setCargandoVentaRapida(false);
    }
  };

  const despachosHechos = useMemo(() => {
    // Función para parsear fechas en formato DD/MM/YYYY
    const obtenerFechaParaOrdenar = (item) => {
      const fechaStr = item.fecha_despacho || item.fecha_venta || "";
      if (!fechaStr || typeof fechaStr !== 'string') return new Date(0); // Fecha inválida va al final

      const partes = fechaStr.split('/');
      if (partes.length !== 3) return new Date(0);

      const dia = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1; // Mes es 0-indexado en JS
      const anio = parseInt(partes[2], 10);

      if (isNaN(dia) || isNaN(mes) || isNaN(anio)) return new Date(0);
      return new Date(anio, mes, dia);
    };

    const filtrados = laptops.filter(lap => 
      lap.estado?.toUpperCase() === 'VENDIDO' && 
      lap.estado_despacho?.toUpperCase() === 'DESPACHADO'
    ).filter(lap => {
      // Filtro por fecha
      if (filtroFecha) {
        const [year, month, day] = filtroFecha.split('-');
        const f1 = `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
        const pad = (num) => String(num).padStart(2, '0');
        const f2 = `${pad(day)}/${pad(month)}/${year}`;
        
        const fechaParaFiltrar = lap.fecha_despacho || lap.fecha_venta;

        if (fechaParaFiltrar !== f1 && fechaParaFiltrar !== f2) {
          return false;
        }
      }

      if (!busqueda) return true;
      const texto = busqueda.toLowerCase();
      return (
        lap.cliente?.toLowerCase().includes(texto) ||
        lap.destino?.toLowerCase().includes(texto) ||
        lap.serial?.toLowerCase().includes(texto) ||
        lap.marca?.toLowerCase().includes(texto)
      );
    });

    // Ordenar los resultados filtrados por fecha, de más reciente a más antiguo
    return filtrados.sort((a, b) => {
      const fechaA = obtenerFechaParaOrdenar(a);
      const fechaB = obtenerFechaParaOrdenar(b);
      return fechaB.getTime() - fechaA.getTime();
    });
  }, [laptops, busqueda, filtroFecha]);

  // --- AGRUPACIÓN POR LOTES (ACORDEÓN) ---
  // Cada venta por lote se convierte en UNA sola fila maestra. La agrupación usa el número
  // de documento (boleta / nota) cuando existe; para los registros antiguos sin documento se
  // agrupa por cliente + fecha de salida + destino, que son los datos comunes de la venta.
  const lotesDespachos = useMemo(() => {
    const mapa = new Map();

    despachosHechos.forEach(laptop => {
      const documento = String(laptop.numero_boleta || '').trim();
      const fechaLote = laptop.fecha_despacho || laptop.fecha_venta || '';
      const clienteLote = String(laptop.cliente || 'N/A').toUpperCase();
      const destinoLote = String(laptop.destino || '').toUpperCase();

      const clave = documento !== ''
        ? `DOC::${documento}`
        : `GRUPO::${clienteLote}::${fechaLote}::${destinoLote}`;

      if (!mapa.has(clave)) {
        mapa.set(clave, {
          clave,
          documento,
          fecha: fechaLote,
          cliente: laptop.cliente,
          destino: laptop.destino,
          n_pedido: laptop.n_pedido,
          responsable: laptop.responsable_despacho,
          despachador: laptop.despachador || '',
          equipos: [],
          precioTotal: 0
        });
      }

      const lote = mapa.get(clave);
      // Si el primer equipo del lote no traía despachador, tomamos el primero que exista
      if (!lote.despachador && laptop.despachador) lote.despachador = laptop.despachador;
      lote.equipos.push(laptop);
      lote.precioTotal += Number(laptop.precio) || 0;
    });

    return Array.from(mapa.values());
  }, [despachosHechos]);

  // Abre / cierra el detalle de un lote (efecto acordeón)
  const toggleLote = (clave) => {
    setLotesExpandidos(prev => ({ ...prev, [clave]: !prev[clave] }));
  };

  // Abre la Guía de Envío con TODOS los equipos del lote (un solo documento)
  const abrirGuiaEnvio = (laptop, equiposDelLote = null) => {
    setEquipoDetalle(laptop);
    setEquiposGuiaLote(equiposDelLote && equiposDelLote.length > 0 ? equiposDelLote : [laptop]);
    setMostrarGuia(true);
  };

  // Mismo cálculo de numeración que el módulo de Ventas (próximo número de boleta)
  const proximoNumeroBoleta = useMemo(() => {
    if (!laptops || laptops.length === 0) return 1;

    const numeros = laptops
      .filter(l => l.estado?.toUpperCase() === 'VENDIDO' && l.numero_boleta)
      .map(l => {
        const match = l.numero_boleta.match(/^B(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      });
    const maxNumero = numeros.length > 0 ? Math.max(...numeros) : 0;
    return maxNumero + 1;
  }, [laptops]);

  // --- Abre el modal del Comprobante Comercial con TODOS los equipos del lote ---
  // `equiposDelLote` llega desde la fila maestra del acordeón para emitir UN SOLO documento.
  const abrirComprobante = (laptop, equiposDelLote = null) => {
    setEquipoComprobante(laptop);
    setEquiposLoteComprobante(equiposDelLote && equiposDelLote.length > 1 ? equiposDelLote : null);
    setTipoComprobante("BOLETA"); // Cada apertura inicia como Boleta de Venta (igual que en Ventas)
    setMostrarComprobante(true);
  };

  // Equipos del comprobante: usa la lista del lote (si viene de la tabla) o todos los equipos
  // que comparten el mismo número de documento; si no, queda el equipo individual.
  const equiposComprobante = useMemo(() => {
    if (!equipoComprobante) return [];
    if (equiposLoteComprobante && equiposLoteComprobante.length > 0) return equiposLoteComprobante;
    if (equipoComprobante.numero_boleta) {
      const relacionados = laptops.filter(l => l.numero_boleta === equipoComprobante.numero_boleta);
      if (relacionados.length > 0) return relacionados;
    }
    return [equipoComprobante];
  }, [equipoComprobante, equiposLoteComprobante, laptops]);

  // Numeración mostrada: prioriza el número guardado en la venta; si no existe, lo genera como en Ventas
  const numeroComprobante = useMemo(() => {
    if (!equipoComprobante) return '';
    if (equipoComprobante.numero_boleta) return equipoComprobante.numero_boleta;
    // Lote antiguo (sin documento guardado): se numera como un solo documento consolidado
    if (equiposComprobante.length > 1) {
      return `B${String(proximoNumeroBoleta).padStart(3, '0')}-LOTE-${equiposComprobante.length}`;
    }
    const id = equipoComprobante.fireId || equipoComprobante.id;
    if (id) return `B${String(proximoNumeroBoleta).padStart(3, '0')}-${id.substring(0, 6).toUpperCase()}`;
    return `B${String(proximoNumeroBoleta).padStart(3, '0')}-N/A`;
  }, [equipoComprobante, equiposComprobante, proximoNumeroBoleta]);

  const descargarPDF = async () => {
    const elemento = document.querySelector(".contenedor-guia-envio");
    if(!elemento) return;

    const botones = document.querySelector(".grupo-botones-guia");
    const botonX = document.querySelector(".btn-cerrar-guia");
    
    if(botones) botones.style.display = 'none';
    if(botonX) botonX.style.display = 'none';

    try {
      // El generador respeta los márgenes @page y pagina el documento si no cabe en una hoja
      await generarPDFDesdeElemento(elemento, {
        nombreArchivo: `Guia_Envio_${equipoDetalle?.cliente?.replace(/\s+/g, '_') || 'Cliente'}.pdf`
      });
    } catch (error) {
      console.error("Error al generar PDF:", error);
    } finally {
      if(botones) botones.style.display = 'flex';
      if(botonX) botonX.style.display = 'block';
    }
  };

  // --- NUEVO: Descarga el Comprobante Comercial en PDF, independiente de la Guía de Envío ---
  const descargarPDFComprobante = async () => {
    const elemento = document.querySelector(".contenedor-comprobante-despacho");
    if(!elemento) return;

    const botones = elemento.querySelector(".grupo-botones-comprobante");
    const botonX = elemento.querySelector(".btn-cerrar-comprobante");
    const selectorTipoDoc = elemento.querySelector(".selector-tipo-doc-no-imprimir");

    if(botones) botones.style.display = 'none';
    if(botonX) botonX.style.display = 'none';
    if(selectorTipoDoc) selectorTipoDoc.style.display = 'none';

    try {
      // Un SOLO PDF con todos los equipos del lote.
      // ajustarUnaHoja: si el comprobante se pasa por poco de la caja imprimible,
      // se reduce levemente la escala para que quepa en UNA sola hoja.
      await generarPDFDesdeElemento(elemento, {
        nombreArchivo: `${tipoComprobante === 'BOLETA' ? 'Boleta' : 'Nota_de_Venta'}_FINPRO_${(equipoComprobante?.cliente || 'Cliente').replace(/\s+/g, '_')}.pdf`,
        ajustarUnaHoja: true
      });
    } catch (error) {
      console.error("Error al generar PDF del comprobante:", error);
    } finally {
      if(botones) botones.style.display = 'flex';
      if(botonX) botonX.style.display = 'block';
      if(selectorTipoDoc) selectorTipoDoc.style.display = 'flex';
    }
  };

  return (
    <div className="ventas-view-container fade-in">
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h2 style={{ color: '#fff', margin: 0 }}>📦 HISTORIAL DE SALIDAS</h2>
          <button
              onClick={() => setModoEliminar(!modoEliminar)}
              style={{
                  background: modoEliminar ? '#ef4444' : '#475569',
                  color: 'white',
                  border: 'none',
                  padding: '8px 15px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
              }}
          >
              <Trash2 size={16} />
              {modoEliminar ? 'Cancelar' : 'Eliminar Salida'}
          </button>
        </div>
        <div className="header-controls-ventas mobile-stack">
          <button className="btn-ver-todo-ventas" onClick={limpiarFiltros}>
            <RotateCcw size={16} /> Ver Todo
          </button>
          <button
            className="btn-ver-todo-ventas"
            onClick={() => setMostrarModalVentaRapida(true)}
            style={{ background: '#00ff7f', color: '#0f172a', borderColor: '#00ff7f' }}
          >
            <PlusCircle size={16} /> Salida Rápida
          </button>
          <button
            onClick={descargarExcelSalidas}
            className="btn-excel-download"
          >
            <FileDown size={16} /> Descargar Excel
          </button>
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            className="input-calendar-ventas"
          />
          <div className="search-box-ventas">
            {busqueda === "" && <Search size={18} className="search-icon" />}
            <input
              type="text"
              placeholder="Buscar por cliente, destino o serial..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className={`input-busqueda-ventas ${busqueda === "" ? "con-lupa" : "sin-lupa"}`}
            />
          </div>
        </div>
      </div>

      <div className="table-wrapper-global" style={{ width: '100%', overflowX: 'auto',              // <--- ESTO ACTIVA EL SCROLL HORIZONTAL
WebkitOverflowScrolling: 'touch' // <--- ESTO HACE QUE EL SCROLL SEA FLUIDO EN EL CELULAR
}}>
        <table className="excel-table" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #334155', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Fecha Despacho</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>N° Pedido</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Propietario / Cliente</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Precio (S/)</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Equipo</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Destino</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Responsable Envío</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8', textAlign: 'center' }}>Documento</th>
              {modoEliminar && <th style={{ padding: '8px 12px', color: '#ef4444', textAlign: 'center' }}>Acción</th>}
            </tr>
          </thead>
          <tbody>
            {lotesDespachos.length > 0 ? (
              lotesDespachos.map((lote) => {
                const esLote = lote.equipos.length > 1;
                const estaAbierto = !!lotesExpandidos[lote.clave];
                const equipoPrincipal = lote.equipos[0];
                const totalColumnas = modoEliminar ? 9 : 8;

                return (
                  <React.Fragment key={lote.clave}>
                    {/* ============ FILA MAESTRA: un solo registro por venta / lote ============ */}
                    <tr
                      className={esLote ? 'row-hover-simple lote-fila-maestra' : 'row-hover-simple'}
                      style={{ borderBottom: '1px solid #1e293b' }}
                      onClick={esLote ? () => toggleLote(lote.clave) : undefined}
                      title={esLote ? (estaAbierto ? 'Ocultar los equipos del lote' : 'Ver los equipos del lote') : undefined}
                    >
                      <td style={{ padding: '6px 12px', color: 'white', borderRadius: 0 }}>{lote.fecha}</td>
                      <td style={{ padding: '6px 12px', color: '#94a3b8', fontFamily: 'monospace' }}>{lote.n_pedido || '-'}</td>
                      <td style={{ padding: '6px 12px', color: 'white', fontWeight: 'bold' }}>{lote.cliente}</td>

                      {/* PRECIO: en un lote se muestra el TOTAL; en venta individual se edita aquí */}
                      <td style={{ padding: '6px 12px' }}>
                        {esLote ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ color: '#00ff7f', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>
                              S/ {lote.precioTotal.toFixed(2)}
                            </span>
                            <small style={{ color: '#64748b', fontSize: '10px' }}>TOTAL DEL LOTE ({lote.equipos.length})</small>
                          </div>
                        ) : (
                          <input 
                            type="number" 
                            defaultValue={equipoPrincipal.precio || ''} 
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => handlePrecioChange(equipoPrincipal.fireId, e.target.value)}
                            style={{ background: '#0f172a', border: '1px solid #334155', color: '#00ff7f', padding: '8px 4px', borderRadius: '4px', width: '100px', minWidth: '80px', height: '28px' , fontSize: '14px', boxSizing: 'border-box'}}
                          />
                        )}
                      </td>

                      {/* EQUIPO: aquí vive la flecha verde desplegable del lote */}
                      <td style={{ padding: '6px 12px', color: 'white' }}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {esLote && (
                        <button
                          type="button"
                          className={`btn-flecha-lote ${estaAbierto ? 'abierto' : ''}`}
                          aria-expanded={estaAbierto}
                          title={estaAbierto ? 'Ocultar los equipos del lote' : 'Ver los equipos del lote'}
                          onClick={(e) => { e.stopPropagation(); toggleLote(lote.clave); }}
                        >
                          <ChevronDown size={18} />
                        </button>
                      )}
                      <div>
                        {esLote ? (
                          <>
                            <span style={{ color: '#00ff7f', fontWeight: 'bold' }}>📦 Lote de {lote.equipos.length} equipos</span>
                            <br/>
                            <small style={{ color: '#94a3b8' }}>
                              {equipoPrincipal.marca} {equipoPrincipal.modelo} + {lote.equipos.length - 1} más
                            </small>
                          </>
                        ) : (
                          <>
                            {equipoPrincipal.marca} {equipoPrincipal.modelo} <br/>
                            <small style={{ color: '#94a3b8' }}>S/N: {equipoPrincipal.serial}</small>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '6px 12px', color: '#00ff7f', fontWeight: 'bold' }}>
                    <Truck size={14} style={{ display: 'inline', marginRight: '5px' }}/>
                    {lote.destino}
                  </td>
                  {/* RESPONSABLE DE ENVÍO (azul) + DESPACHADOR (estilo secundario debajo) */}
                  <td style={{ padding: '6px 12px' }}>
                    <div style={{ color: '#60a5fa' }}>{lote.responsable || 'N/A'}</div>
                    {lote.despachador && (
                      <small
                        title="Persona que realizó el despacho físico"
                        style={{ color: '#94a3b8', fontSize: '10px', display: 'block', marginTop: '2px', whiteSpace: 'nowrap' }}
                      >
                        Despacha: {lote.despachador}
                      </small>
                    )}
                  </td>

                  {/* DOCUMENTO: una sola guía y un solo comprobante para todo el lote */}
                  <td style={{ padding: '6px 12px', textAlign: 'center', borderRadius: 0 }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); abrirGuiaEnvio(equipoPrincipal, lote.equipos); }}
                        style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        <Package size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }}/>
                        Ver Guía
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); abrirComprobante(equipoPrincipal, lote.equipos); }}
                        title={esLote ? `Ver un solo comprobante con los ${lote.equipos.length} equipos del lote` : "Ver comprobante comercial (Boleta / Nota de Venta)"}
                        style={{ background: '#00ff7f', color: '#0f172a', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        <FileText size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }}/>
                        Ver Comprobante
                      </button>
                    </div>
                  </td>
                  {modoEliminar && (
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                        <button
                            onClick={(e) => {
                              e.stopPropagation();
                              esLote ? handleRevertirLote(lote) : handleRevertirSalida(equipoPrincipal);
                            }}
                            style={{
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                padding: '6px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {esLote ? `Revertir Lote (${lote.equipos.length})` : 'Revertir'}
                        </button>
                    </td>
                  )}
                    </tr>

                    {/* ============ FILA DE DETALLE (ACORDEÓN) ============ */}
                    {esLote && (
                      <tr className="fila-detalle-lote">
                        <td colSpan={totalColumnas} style={{ padding: 0, borderBottom: estaAbierto ? '1px solid #1e293b' : 'none' }}>
                          <div className={`contenedor-detalle-lote ${estaAbierto ? 'abierto' : ''}`}>
                            <div className="subtabla-detalle-lote">
                              <div className="cabecera-detalle-lote">
                                <span>🧾 Detalle del lote · {lote.equipos.length} equipos</span>
                                <span>Doc: {lote.documento || 'sin documento'}</span>
                              </div>
                              <table className="tabla-detalle-lote">
                                <thead>
                                  <tr>
                                    <th style={{ textAlign: 'center', width: '42px' }}>#</th>
                                    <th>Modelo / Características</th>
                                    <th>N° de Serie</th>
                                    <th style={{ textAlign: 'right', width: '150px' }}>Precio (S/)</th>
                                    {modoEliminar && <th style={{ textAlign: 'center', width: '110px' }}>Acción</th>}
                                  </tr>
                                </thead>
                                <tbody>
                                  {lote.equipos.map((equipo, indexEquipo) => (
                                    <tr key={equipo.fireId || indexEquipo}>
                                      <td style={{ textAlign: 'center', color: '#94a3b8' }}>{indexEquipo + 1}</td>
                                      <td>
                                        <strong style={{ color: '#ffffff' }}>{equipo.marca} {equipo.modelo}</strong>
                                        <small style={{ display: 'block', color: '#94a3b8' }}>
                                          {[equipo.procesador, equipo.generacion || equipo.gen, equipo.ram, equipo.almacenamiento || equipo.disco, equipo.gpu]
                                            .filter(Boolean)
                                            .join(' | ') || 'Sin características registradas'}
                                        </small>
                                      </td>
                                      <td style={{ fontFamily: 'monospace', color: '#cbd5e1' }}>{equipo.serial || 'N/A'}</td>
                                      <td style={{ textAlign: 'right' }}>
                                        <input
                                          type="number"
                                          defaultValue={equipo.precio || ''}
                                          onClick={(e) => e.stopPropagation()}
                                          onBlur={(e) => handlePrecioChange(equipo.fireId, e.target.value)}
                                          style={{ background: '#0f172a', border: '1px solid #334155', color: '#00ff7f', padding: '6px 4px', borderRadius: '4px', width: '110px', minWidth: '90px', height: '28px', fontSize: '13px', boxSizing: 'border-box' }}
                                        />
                                      </td>
                                      {modoEliminar && (
                                        <td style={{ textAlign: 'center' }}>
                                          <button
                                            onClick={() => handleRevertirSalida(equipo)}
                                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '5px 9px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                                          >
                                            Revertir
                                          </button>
                                        </td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={modoEliminar ? "9" : "8"} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  No se encontraron despachos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* GUÍA DE ENVÍO: se monta con createPortal en document.body por el mismo motivo
          que el comprobante comercial: el contenedor con transform (.fade-in) rompía el
          position:fixed y, al imprimir, aparecía una hoja en blanco delante del documento. */}
      {mostrarGuia && equipoDetalle && createPortal(
        <div className="overlay-informe-leonidas" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)', alignItems: 'flex-start', paddingTop: '5vh', paddingBottom: '20px', overflowY: 'auto', boxSizing: 'border-box' }}>
          <div className="contenedor-boleta-formal contenedor-guia-envio" style={{ backgroundColor: '#ffffff', borderRadius: '0px', border: '1px solid #000', color: '#000', padding: '25px', maxWidth: '700px' }}>
            <button className="btn-cerrar-guia" onClick={() => setMostrarGuia(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', color: '#000' }}>
              <X size={24} />
            </button>
            <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000', paddingBottom: '20px', marginBottom: '20px' }}>
              <div>
                <h1 style={{ color: '#000', margin: 0, fontSize: '24px', fontWeight: '900' }}>FINPRO STORE</h1>
                <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#000' }}><strong>ORIGEN:</strong> LIMA - PERÚ</p>
                <p style={{ margin: '1px 0 0 0', fontSize: '12px', color: '#000' }}>Logística y Despachos</p>
              </div>
              <div style={{ border: '1px solid #000', padding: '10px', textAlign: 'center', minWidth: '180px', borderRadius: '0px' }}>
                <h2 style={{ margin: 0, fontSize: '18px', color: '#000' }}>GUÍA DE ENVÍO</h2>
                <h3 style={{ margin: '3px 0 0 0', fontSize: '14px', color: '#000' }}>REMITENTE</h3>
                <p style={{ margin: '3px 0 0 0', fontWeight: 'bold', fontSize: '13px' }}>
                  N° {(equipoDetalle.fireId || equipoDetalle.id) ? `ENV-${(equipoDetalle.fireId || equipoDetalle.id).substring(0,6).toUpperCase()}` : "ENV-0001"}
                </p>
              </div>
            </header>
            <div style={{ marginBottom: '30px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderRadius: '0px' }}>
                    <td style={{ padding: '4px 8px', border: '1px solid #000', backgroundColor: '#fff', width: '120px', fontWeight: 'bold', fontSize: '12px', color: '#000' }}>DESTINATARIO:</td>
                    <td style={{ padding: '4px 8px', border: '1px solid #000', backgroundColor: '#fff', fontWeight: 'bold', fontSize: '14px', color: '#000' }}>{equipoDetalle.cliente}</td>
                  </tr>
                  <tr style={{ borderRadius: '0px' }}>
                    <td style={{ padding: '4px 8px', border: '1px solid #000', backgroundColor: '#fff', fontWeight: 'bold', fontSize: '12px', color: '#000' }}>DESTINO FINAL:</td>
                    <td style={{ padding: '4px 8px', border: '1px solid #000', backgroundColor: '#fff', fontWeight: 'bold', fontSize: '14px', color: '#000' }}>{equipoDetalle.destino}</td>
                  </tr>
                  <tr style={{ borderRadius: '0px' }}>
                    <td style={{ padding: '4px 8px', border: '1px solid #000', backgroundColor: '#fff', fontWeight: 'bold', fontSize: '12px', color: '#000' }}>FECHA ENVÍO:</td>
                    <td style={{ padding: '4px 8px', border: '1px solid #000', backgroundColor: '#fff', fontSize: '12px', color: '#000' }}>{equipoDetalle.fecha_despacho || new Date().toLocaleDateString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h3 style={{ borderBottom: '1px solid #000', paddingBottom: '5px', fontSize: '16px' }}>
              DETALLE DE LOS EQUIPOS {equiposGuiaLote.length > 1 ? `(${equiposGuiaLote.length})` : ''}
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
  <thead>
    {/* AGREGAMOS BACKGROUND BLANCO AQUÍ */}
    <tr style={{ backgroundColor: '#ffffff', color: '#000', borderRadius: '0px' }}>
      <th style={{ padding: '6px 8px', textAlign: 'center', width: '60px', border: '1px solid #000', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>CANT.</th>
      <th style={{ padding: '6px 8px', textAlign: 'left', border: '1px solid #000', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>DESCRIPCIÓN DEL ARTÍCULO</th>
      <th style={{ padding: '6px 8px', textAlign: 'center', width: '150px', border: '1px solid #000', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>N° DE SERIE</th>
      <th style={{ padding: '6px 8px', textAlign: 'right', width: '80px', border: '1px solid #000', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>PRECIO</th>
    </tr>
  </thead>
  <tbody>
    {(equiposGuiaLote.length > 0 ? equiposGuiaLote : [equipoDetalle]).filter(Boolean).map((equipo, indexEquipo) => (
      <tr key={equipo.fireId || indexEquipo} style={{ borderRadius: '0px', backgroundColor: '#ffffff' }}>
        <td style={{ padding: '4px 8px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>{indexEquipo + 1}</td>
        <td style={{ padding: '4px 8px', border: '1px solid #000', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>
          <strong>LAPTOP {equipo.marca?.toUpperCase()} {equipo.modelo?.toUpperCase()}</strong><br/>
          <small style={{ color: '#555', fontSize: '10px' }}>Procesador: {equipo.procesador} | RAM: {equipo.ram} | Disco: {equipo.almacenamiento || equipo.disco}</small>
        </td>
        <td style={{ padding: '4px 8px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>
          {equipo.serial}
        </td>
        <td style={{ padding: '4px 8px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>
          S/ {Number(equipo.precio || 0).toFixed(2)}
        </td>
      </tr>
    ))}
    {equiposGuiaLote.length > 1 && (
      <tr style={{ borderRadius: '0px', backgroundColor: '#ffffff' }}>
        <td colSpan="3" style={{ padding: '4px 8px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>
          TOTAL DEL LOTE ({equiposGuiaLote.length} EQUIPOS):
        </td>
        <td style={{ padding: '4px 8px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>
          S/ {equiposGuiaLote.reduce((acc, eq) => acc + (Number(eq.precio) || 0), 0).toFixed(2)}
        </td>
      </tr>
    )}
  </tbody>
              <tbody>
                
              </tbody>
            </table>
            <div className="grupo-botones-guia" style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '40px' }}>
              <button onClick={() => window.print()} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} /> IMPRIMIR GUÍA
              </button>
              <button onClick={descargarPDF} style={{ background: '#00c853', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Descargar PDF
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================ */}
      {/* NUEVO: MODAL DE COMPROBANTE COMERCIAL (BOLETA / NOTA DE VENTA) */}
      {/* Se renderiza con createPortal en document.body (mismo fix que Salida Rápida) */}
      {/* ============================================================ */}
      {mostrarComprobante && equipoComprobante && createPortal(
        <div 
          className="overlay-informe-leonidas"
          onClick={() => setMostrarComprobante(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            width: '100%', height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            zIndex: 9999,
            padding: '15px',
            overflowY: 'auto'
          }}
        >
          <div 
            className="contenedor-boleta-formal contenedor-comprobante-despacho"
            onClick={e => e.stopPropagation()}
            style={{ backgroundColor: '#ffffff', borderRadius: '0px', border: '1px solid #ccc', boxShadow: 'none', color: '#000000', width: '100%', maxWidth: '800px', margin: 'auto', position: 'relative' }}
          >
            <button className="btn-cerrar-comprobante" onClick={() => setMostrarComprobante(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: '#fff', color: '#000', border: '1px solid #ccc', cursor: 'pointer', padding: '5px' }}>
              <X size={24} />
            </button>

            {/* SELECTOR DE TIPO DE DOCUMENTO: BOLETA / NOTA DE VENTA (misma lógica y diseño que el módulo de Ventas) */}
            <div className="selector-tipo-doc-no-imprimir" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px 0', marginBottom: '8px', borderBottom: '1px dashed #ccc' }}>
              <button
                onClick={() => setTipoComprobante(prev => (prev === 'BOLETA' ? 'NOTA' : 'BOLETA'))}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: tipoComprobante === 'BOLETA' ? '#1d4ed8' : '#047857',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '6px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                <FileText size={16} />
                {tipoComprobante === 'BOLETA' ? 'Cambiar a NOTA DE VENTA' : 'Cambiar a BOLETA DE VENTA'}
              </button>
            </div>

            <header className="header-boleta-formal">
              <div className="info-empresa">
                <div 
                  className="logo-finpro-comprobante"
                  aria-label="Logo Finpro Store"
                  style={{ backgroundImage: `url(${logoFinpro})` }}>
                </div>
                <p style={{color: '#333', fontSize: '0.8rem', margin: '0 0 5px 0'}}>CEL: 926 890 803 / 998 333 397</p>
                <p style={{color: '#333', fontSize: '0.8rem', margin: '0 0 5px 0'}}>E-MAIL: percycuentas33@gmail.com</p>
                <p style={{color: '#333', fontSize: '0.8rem', fontWeight: 'bold', margin: '0 0 2px 0'}}>Av Jose Galvez #186 La Victoria</p>
                <p style={{color: '#333', fontSize: '0.8rem', margin: '0 0 5px 0'}}>Especialistas en Laptop & Equipos de Cómputo</p>
                <p style={{color: '#333'}}>Lima - Perú</p>
              </div>
              <div className="recuadro-tipo-doc" style={{ border: '1px solid #ccc', backgroundColor: '#f0f0f0', borderRadius: '0px', color: '#000' }}>
                <h2 style={{color: '#000'}}>{tipoComprobante === 'BOLETA' ? 'BOLETA DE VENTA' : 'NOTA DE VENTA'}</h2>
                <h3 style={{color: '#000'}}>ELECTRONICA</h3>
                <p className="numero-doc" style={{color: '#000'}}>
                  {numeroComprobante || 'B000-N/A'}
                </p>
              </div>
            </header>

            <div className="cuerpo-boleta-formal">
              {/* DATOS DEL CLIENTE */}
              <div className="seccion-datos-cliente" style={{ backgroundColor: '#f8f8f8', border: '1px solid #ddd' }}>
                <div className="dato-cliente-fila">
                  <User size={16} className="icono-dato" style={{ color: '#555' }} />
                  <label style={{ color: '#555' }}>CLIENTE:</label>
                  <span style={{color: '#000'}}>{equipoComprobante.cliente || 'N/A'}</span>
                </div>
                <div className="dato-cliente-fila">
                  <FileText size={16} className="icono-dato" style={{ color: '#555' }} />
                  <label style={{ color: '#555' }}>DNI:</label>
                  <span style={{color: '#000'}}>{equipoComprobante.dni || 'N/A'}</span>
                </div>
                <div className="dato-cliente-fila">
                  <MapPin size={16} className="icono-dato" style={{ color: '#555' }} />
                  <label style={{ color: '#555' }}>ORIGEN:</label>
                  <span style={{color: '#000'}}>LIMA</span>
                </div>
                <div className="dato-cliente-fila">
                  <CalendarDays size={16} className="icono-dato" style={{ color: '#555' }} />
                  <label style={{ color: '#555' }}>FECHA:</label>
                  <span style={{color: '#000'}}>{equipoComprobante.fecha_venta || equipoComprobante.fecha_despacho || 'N/A'}</span>
                </div>
                <div className="dato-cliente-fila">
                  <MapPin size={16} className="icono-dato" style={{ color: '#555' }} />
                  <label style={{ color: '#555' }}>DESTINO:</label>
                  <span style={{color: '#000'}}>{equipoComprobante.destino || 'N/A'}</span>
                </div>
              </div>

              {/* DETALLE DE LOS EQUIPOS DESPACHADOS */}
              <table className="tabla-items-boleta" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                <thead>
                  <tr>
                    <th style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '8px 10px', textAlign: 'center', width: '10%' }}>CANT.</th>
                    <th style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '8px 10px', textAlign: 'left', width: '45%' }}>DESCRIPCIÓN</th>
                    <th style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '8px 10px', textAlign: 'right', width: '22%' }}>P. UNIT</th>
                    <th style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '8px 10px', textAlign: 'right', width: '23%' }}>IMPORTE</th>
                  </tr>
                </thead>
                <tbody>
                  {equiposComprobante.map((item, index) => {
                    const cantidad = item.cantidad || 1;
                    const precioTotalItem = Number(item.precio || 0);
                    const precioUnitario = precioTotalItem / cantidad;
                    /* DESCRIPCIÓN en 3 líneas:
                       1) Modelo  2) Especificaciones (Proc | RAM | Disco | GPU)  3) S/N */
                    const especificaciones = [
                      item.procesador ? `Proc: ${item.procesador} ${item.generacion || item.gen || ''}`.trim() : '',
                      item.ram ? `RAM: ${item.ram}` : '',
                      (item.almacenamiento || item.disco) ? `Disco: ${item.almacenamiento || item.disco}` : '',
                      item.gpu ? `GPU: ${item.gpu}` : ''
                    ].filter(Boolean).join(' | ');
                    const serie = `S/N: ${item.serial || 'N/A'}`;
                    return (
                      <tr key={item.fireId || item.id || index}>
                        <td style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '8px 10px', verticalAlign: 'top', textAlign: 'center' }}>
                          {cantidad}
                          <br />
                          <span style={{ fontSize: '10px', color: '#444' }}>CÓDIGO: {(item.fireId || item.id || '').substring(0, 4).toUpperCase()}</span>
                        </td>
                        <td style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '8px 10px', verticalAlign: 'top' }}>
                          <strong style={{ fontSize: '12px', color: '#000' }}>{item.marca} {item.modelo}</strong>
                          {especificaciones ? (
                            <>
                              <br />
                              <span style={{ fontSize: '10px', color: '#333' }}>{especificaciones}</span>
                            </>
                          ) : null}
                          <br />
                          <span style={{ fontSize: '10px', color: '#333' }}>{serie}</span>
                        </td>
                        <td style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '8px 10px', verticalAlign: 'top', textAlign: 'right' }}>
                          S/ {precioUnitario.toFixed(2)}
                        </td>
                        <td style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '8px 10px', verticalAlign: 'top', textAlign: 'right', fontWeight: 'bold' }}>
                          S/ {precioTotalItem.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {(() => {
                    const sumaTotalGeneral = equiposComprobante.reduce((acc, item) => acc + Number(item.precio || 0), 0);
                    const subTotalGeneral = sumaTotalGeneral / 1.18;
                    const igvGeneral = sumaTotalGeneral - subTotalGeneral;
                    return (
                      <>
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold', color: '#000', border: '1px solid #ccc', padding: '6px 10px', backgroundColor: '#fff' }}>SUB - TOTAL:</td>
                          <td style={{ textAlign: 'right', color: '#000', border: '1px solid #ccc', padding: '6px 10px', backgroundColor: '#fff' }}>S/ {subTotalGeneral.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold', color: '#000', border: '1px solid #ccc', padding: '6px 10px', backgroundColor: '#fff' }}>I.G.V. 18%:</td>
                          <td style={{ textAlign: 'right', color: '#000', border: '1px solid #ccc', padding: '6px 10px', backgroundColor: '#fff' }}>S/ {igvGeneral.toFixed(2)}</td>
                        </tr>
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold', color: '#000', border: '1px solid #ccc', padding: '6px 10px', backgroundColor: '#fff' }}>TOTAL:</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#000', border: '1px solid #ccc', padding: '6px 10px', backgroundColor: '#fff' }}>S/ {sumaTotalGeneral.toFixed(2)}</td>
                        </tr>
                      </>
                    );
                  })()}
                </tfoot>
              </table>

              <footer className="pie-boleta-formal" style={{ color: '#555' }}>
                <p style={{ color: '#555' }}>Gracias por su compra en FINPRO STORE.</p>
              </footer>
            </div>

            {/* BOTONES: visualización y descarga independientes de la Guía de Envío */}
            <div className="grupo-botones-comprobante" style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '30px', paddingTop: '20px', borderTop: '1px dashed #ccc' }}>
              <button onClick={() => window.print()} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer size={18} /> IMPRIMIR COMPROBANTE
              </button>
              <button onClick={descargarPDFComprobante} style={{ background: '#00c853', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileDown size={18} /> Descargar PDF
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* FIX: El modal se renderiza con createPortal en document.body para que el
          position:fixed se ancle a la VENTANA visible y no al contenedor con
          transform (clase fade-in), que era lo que lo empujaba hacia abajo.
          SCROLL: el overlay (backdrop) sigue centrado con flex, pero el scroll real
          vive DENTRO del modal, en .cuerpo-scroll-lote (alto máximo relativo a la
          pantalla), así los campos largos y los botones Guardar/Cancelar siempre
          se pueden alcanzar. Es el ÚNICO scroll: la lista de equipos ya no tiene
          scroll propio (antes generaba un doble scroll incómodo). Ver VentasView.css. */}
      {mostrarModalVentaRapida && createPortal(
        <div 
          className="overlay-informe-leonidas" 
          onClick={() => setMostrarModalVentaRapida(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '15px',
            overflowY: 'auto',
            boxSizing: 'border-box',       /* el padding no desborda la pantalla */
            overscrollBehavior: 'contain', /* el scroll no "salta" al fondo */
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div 
            className="modal-panel-venta-rapida modal-venta-lote" 
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#1e293b',
              color: 'white',
              borderRadius: '12px',
              margin: 'auto',                /* centrado y, si no cabe, alineado arriba */
              boxSizing: 'border-box',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
              border: '1px solid #334155'
              /* El ANCHO (750px), la altura máxima relativa a la pantalla, el padding y el
                 layout flexible los define la clase .modal-panel-venta-rapida.modal-venta-lote
                 en VentasView.css (así funcionan también las media queries de móvil) */
            }}
          >
            <div className="cabecera-modal-lote">
              <h3>⚡ Registro de SALIDAS Rápida</h3>
              <p>Registra una venta externa para el control de ganancias.</p>
            </div>
            <form onSubmit={handleGuardarVentaRapida}>
              {/* ================= CUERPO DESPLAZABLE =================
                  Todo el formulario (cantidad, datos del lote y equipos) vive aquí:
                  si el contenido es más alto que la pantalla, esta zona hace scroll
                  y los botones del pie quedan siempre visibles. */}
              <div className="cuerpo-scroll-lote">
              {/* --- CANTIDAD DE EQUIPOS EN EL LOTE (INPUT NUMÉRICO LIBRE) ---
                  Antes era un <select> limitado a 20 opciones; ahora el usuario puede
                  escribir cualquier cantidad (1, 2, 5, 10...). El mínimo es 1 y la lista
                  de "DETALLES DE LOS EQUIPOS" se regenera sola al cambiar el número. */}
              <div className="form-campo-rapido">
                <label htmlFor="cantidad_lote">Cantidad de Equipos en el Lote</label>
                <input
                  id="cantidad_lote"
                  name="cantidad_lote"
                  type="number"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  placeholder="Ej: 1, 2, 5, 10..."
                  value={cantidadEquiposLote}
                  onChange={(e) => cambiarCantidadEquiposLote(e.target.value)}
                  onBlur={() => cambiarCantidadEquiposLote(cantidadEquiposLote)}
                />
              </div>

              {/* --- DATOS COMUNES DEL LOTE (CAMPOS NO REPETIBLES) --- */}
              <div className="seccion-datos-lote">
                <span className="titulo-seccion-rapida">📋 Datos comunes del lote</span>
                <div className="form-grid-rapido">
                  <div className="form-campo-rapido">
                    <label>Fecha de Venta</label>
                    <input name="fecha_venta" type="date" value={ventaRapidaForm.fecha_venta} onChange={handleVentaRapidaChange} required />
                  </div>
                  <div className="form-campo-rapido">
                    <label>Cliente</label>
                    <input name="cliente" placeholder="Nombre del cliente (Opcional)" value={ventaRapidaForm.cliente} onChange={handleVentaRapidaChange} />
                  </div>
                </div>
                <div className="form-grid-rapido">
                  {/* --- PRECIO DE VENTA TOTAL + BOTÓN "PRECIO ESPECÍFICO" ---
                      El botón SOLO se renderiza cuando hay 2 o más equipos en el lote.
                      Al activarlo, el input del total se deshabilita y cada equipo de la
                      lista inferior muestra su propio campo de precio. */}
                  <div className="form-campo-rapido campo-precio-total-lote">
                    <label htmlFor="precio_total">Precio de Venta Total (S/)</label>
                    <div className="fila-precio-total-lote">
                      <input
                        id="precio_total"
                        name="precio_total"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={modoPrecioEspecifico ? '' : ventaRapidaForm.precio_total}
                        onChange={handleVentaRapidaChange}
                        disabled={modoPrecioEspecifico}
                        title={modoPrecioEspecifico ? 'El total se calcula con los precios específicos de cada equipo' : 'Precio total del lote (se reparte entre los equipos)'}
                      />
                      {cantidadEquiposLote >= 2 && (
                        <button
                          type="button"
                          className={`btn-precio-especifico ${modoPrecioEspecifico ? 'activo' : ''}`}
                          onClick={alternarPrecioEspecifico}
                          title={modoPrecioEspecifico
                            ? 'Volver a un único precio total para todo el lote'
                            : 'Asignar un precio diferente a cada equipo del lote'}
                        >
                          <Tag size={14} />
                          <span>{modoPrecioEspecifico ? 'Precio total' : 'Precio específico'}</span>
                        </button>
                      )}
                    </div>
                    {modoPrecioEspecifico && (
                      <small className="texto-total-calculado">
                        Total del lote (suma de los precios por equipo): S/ {totalPreciosEspecificos.toFixed(2)}
                      </small>
                    )}
                  </div>
                  <div className="form-campo-rapido">
                    <label htmlFor="destino">Destino</label>
                    <input id="destino" name="destino" placeholder="Ej: AREQUIPA" value={ventaRapidaForm.destino} onChange={handleVentaRapidaChange} />
                  </div>
                </div>
                {/* RESPONSABLE + DNI + DESPACHADOR: 3 columnas de igual ancho */}
                <div className="form-grid-rapido-3">
                  <div className="form-campo-rapido">
                    <label>Responsable</label>
                    <input name="responsable" type="text" placeholder="Nombre del responsable" value={ventaRapidaForm.responsable} onChange={handleVentaRapidaChange} required />
                  </div>
                  <div className="form-campo-rapido">
                    <label>DNI (Opcional)</label>
                    <input
                      name="dni"
                      type="text"
                      inputMode="numeric"
                      maxLength={12}
                      placeholder="DNI del responsable"
                      value={ventaRapidaForm.dni}
                      onChange={handleVentaRapidaChange}
                    />
                  </div>
                  <div className="form-campo-rapido">
                    <label>Despachador</label>
                    <input
                      name="despachador"
                      type="text"
                      placeholder="Ej: Juan Pérez / Nombre del despachador"
                      value={ventaRapidaForm.despachador}
                      onChange={handleVentaRapidaChange}
                    />
                  </div>
                </div>
              </div>

              {/* --- DETALLES DE LOS EQUIPOS (ESCANEO MÚLTIPLE, REPETIBLE) --- */}
              <div className="seccion-equipos-lote">
                <div className="cabecera-seccion-equipos">
                  <span className="titulo-seccion-rapida">🔍 Detalles de los Equipos (Escaneo Múltiple)</span>
                  <span className="contador-equipos-lote">
                    {cantidadEquiposLote} {cantidadEquiposLote === 1 ? 'equipo' : 'equipos'}
                  </span>
                </div>

                <div className="scroll-equipos-lote">
                  {equiposLote.map((equipo, index) => {
                    const estadoSerial = estadoSerialLote[index];
                    return (
                    <div className="fila-equipo-lote" key={`equipo-lote-${index}`}>
                      <div className="cabecera-equipo-lote">
                        <span className="badge-equipo-lote">Equipo #{index + 1}</span>
                        {estadoSerial === 'encontrado' && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 'bold', color: '#00ff7f' }}>
                            ✓ Modelo autocompletado desde el inventario
                          </span>
                        )}
                      </div>
                      <div className={`grid-campos-equipo-lote ${modoPrecioEspecifico ? 'con-precio' : ''}`}>
                        <div className="form-campo-rapido">
                          <label>Número de Serie</label>
                          <div style={{ display: 'flex', gap: '5px' }}>
                            <input
                              name={`serial_${index}`}
                              placeholder="Escanear o ingresar serial"
                              value={equipo.serial}
                              onChange={(e) => handleSerialEquipoLoteChange(e, index)}
                              onKeyDown={(e) => handleSerialEquipoLoteKeyDown(e, index)}
                              onBlur={(e) => handleSerialEquipoLoteBlur(e, index)}
                              autoCapitalize="characters"
                              style={{
                                flex: 1,
                                minWidth: 0,
                                // Borde rojo + aviso cuando el serial no existe en el inventario
                                borderColor: estadoSerial === 'no-encontrado' ? '#ef4444' : undefined,
                                background: estadoSerial === 'no-encontrado' ? 'rgba(239, 68, 68, 0.08)' : undefined
                              }}
                            />
                            <button
                              type="button"
                              className="btn-scan-lote"
                              title="Escanear código de barras o QR (autocompleta el modelo)"
                              onClick={() => escanearSerialEquipo(index)}
                              style={{
                                background: '#3397d1', color: 'white', border: 'none', padding: '8px 12px',
                                borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >
                              <QrCode size={18} />
                            </button>
                          </div>
                          {estadoSerial === 'buscando' && (
                            <small style={{ fontSize: '0.7rem', color: '#94a3b8' }}>⏳ Buscando en inventario...</small>
                          )}
                          {estadoSerial === 'no-encontrado' && (
                            <small style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 'bold' }}>
                              ⚠ Número de serie no encontrado en inventario. Puedes escribir el modelo manualmente.
                            </small>
                          )}
                        </div>
                        <div className="form-campo-rapido">
                          <label htmlFor={`modelo_${index}`}>Modelo</label>
                          <input
                            id={`modelo_${index}`}
                            name={`modelo_${index}`}
                            placeholder="Ej: ThinkPad E14"
                            value={equipo.modelo}
                            onChange={(e) => handleEquipoLoteChange(e, index)}
                          />
                        </div>
                        {/* --- PRECIO INDIVIDUAL (solo en modo "Precio específico") --- */}
                        {modoPrecioEspecifico && (
                          <div className="form-campo-rapido campo-precio-equipo-lote">
                            <label htmlFor={`precio_${index}`}>Precio de este equipo (S/)</label>
                            <input
                              id={`precio_${index}`}
                              name={`precio_${index}`}
                              type="number"
                              step="0.01"
                              min="0"
                              inputMode="decimal"
                              placeholder="0.00"
                              value={preciosEquiposLote[index] ?? ''}
                              onChange={(e) => handlePrecioEquipoLoteChange(index, e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
              </div>{/* <-- FIN DEL CUERPO DESPLAZABLE (.cuerpo-scroll-lote) */}

              <div className="botones-rapido">
                <button type="button" className="btn-cancelar-rapido" onClick={() => setMostrarModalVentaRapida(false)}>Cancelar</button>
                <button type="submit" className="btn-guardar-rapido" disabled={cargandoVentaRapida}>
                  {cargandoVentaRapida ? 'Guardando...' : 'Guardar Venta'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DespachosView;