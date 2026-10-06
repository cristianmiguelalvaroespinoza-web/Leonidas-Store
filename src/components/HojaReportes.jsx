import React, { useState, useEffect, useMemo, useRef } from 'react'; 
import { createPortal } from 'react-dom';
import { suscribirseAInventario, eliminarProducto, actualizarProducto, eliminarProductosMasivo, guardarProducto } from '../services/api'; 
import {
  QrCode, Trash2, ChevronDown, Download, Search, AlertTriangle,
  CheckCircle2, XCircle, FileSpreadsheet, PlusCircle
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { db } from '../firebase'; // Firestore para la edición masiva
import { writeBatch, doc as fsDoc } from 'firebase/firestore';

// IMPORTACIÓN DEL CSS MODULE
import styles from './HojaReportes.module.css';
// --- COMENTARIOS / OBSERVACIONES DE LA FILA (marcador tipo Excel) ---
// El campo puede venir como "comentario" o como "observacion". Si está vacío
// o es null, la celda NO muestra ningún indicador visual.
const textoComentario = (item) => {
  if (!item) return '';
  const bruto = item.comentario ?? item.observacion ?? '';
  return typeof bruto === 'string' ? bruto.trim() : String(bruto).trim();
};

const obtenerMesYAnio = (fechaString) => {
  if (!fechaString) return 'FECHA DESCONOCIDA';
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const [dia, mes, anio] = fechaString.split('/');
  return `${meses[parseInt(mes) - 1]} ${anio}`;
};

// ✅ FECHA EFECTIVA DE VENTA: para equipos vendidos se prioriza la fecha de la salida
// (fecha_venta o fecha_despacho, igual que muestra el módulo de SALIDAS) sobre la fecha de registro.
const fechaVentaDe = (item) => {
  if (!item) return '';
  const esVendido = (item.estado || '').toString().toUpperCase().trim() === 'VENDIDO';
  if (esVendido) {
    return item.fecha_venta || item.fecha_despacho || item.fecha || '';
  }
  return item.fecha || '';
};

// --- COLORES DE MARCA (SOLO TABLA GENERAL) ---
// LENOVO = ROJO | ASUS = AZUL | DELL = VERDE | HP = AMARILLO | MAC = GRIS
const obtenerColorMarca = (marca) => {
  const marcaLimpia = marca ? String(marca).toUpperCase().trim() : '';
  if (marcaLimpia.includes('LENOVO')) return '#ef4444'; // ROJO
  if (marcaLimpia.includes('ASUS')) return '#60a5fa'; // AZUL
  if (marcaLimpia.includes('DELL')) return '#22c55e'; // VERDE
  if (marcaLimpia === 'HP' || marcaLimpia.startsWith('HP ')) return '#facc15'; // AMARILLO
  if (marcaLimpia.includes('MAC') || marcaLimpia.includes('APPLE')) return '#94a3b8'; // GRIS
  return ''; // Las demás marcas mantienen su color por defecto
};

// --- NOMBRES PARA MOSTRAR (SOLO VISUAL, NO AFECTA LOGIN NI DATOS) ---
// "RAY" se muestra como "TIENDA PRINCIPAL" | "LEONIDAS"/"JEFE" se muestra como "GENERAL"
const nombreVendedorVisible = (nombre) => {
  const limpio = String(nombre || '').toUpperCase().trim();
  if (limpio === 'RAY') return 'TIENDA PRINCIPAL';
  if (limpio === 'LEONIDAS' || limpio === 'JEFE' || limpio === 'SUPER ADMIN' || limpio === 'SUPER_ADMIN' || limpio.includes('PIA')) return 'GENERAL';
  return nombre;
};

// ✅ CORRECCIÓN DE ORDINALES DE GENERACIÓN (SOLO VISUAL, NO MODIFICA LA BD)
// "7va" → "7ma" (séptima) | "10va" → "10ma" (décima)
const corregirGeneracion = (texto) => {
  if (!texto) return '';
  return String(texto)
    .replace(/7va/gi, '7ma')
    .replace(/10va/gi, '10ma');
};

// Normaliza un serial para comparar (mayúsculas, sin espacios) - auditoría
const normalizarSerialAudit = (serial) => String(serial || '').trim().toUpperCase().replace(/\s+/g, '');

const HojaReportes = ({ laptops, usuarioLogueado, activarEdicion, setModalImagen, fechaFiltro, setFechaFiltro, tienePermiso, iniciarEscaneo }) => {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  
  // --- NUEVO ESTADO PARA FILTRAR POR VENDEDOR ---
  const [filtroVendedor, setFiltroVendedor] = useState("TODOS");
  const [filtroTiempo, setFiltroTiempo] = useState("TODAS"); // <-- AÑADE ESTA LÍNEA

const [diasExpandidos, setDiasExpandidos] = useState({});

  const toggleDia = (dia) => {
    setDiasExpandidos(prev => ({ 
      ...prev, 
      [dia]: prev[dia] !== false ? false : true 
    }));
  };
  const [modelosExpandidos, setModelosExpandidos] = useState({});

  // --- POPOVER DE COMENTARIOS ---
  // hoveredId: fila abierta por hover (se cierra al salir del cursor)
  // pinnedId: fila fijada por clic (se cierra al hacer clic fuera)
  const [comentarioHover, setComentarioHover] = useState(null); // { id, texto, x, y }
  const [comentarioFijado, setComentarioFijado] = useState(null); // { id, texto, x, y }
  // Ref (no estado) para que los handlers del <tbody> —que viven dentro de un useMemo—
  // siempre lean el valor actual y no uno congelado.
  const comentarioCerradoPorClick = useRef(false);
  const refContenedorPopover = useRef(null);

  const comentarioVisible = comentarioFijado || comentarioHover;

  // Cierra el popover si se hace clic fuera de él o en otra celda
  useEffect(() => {
    if (!comentarioFijado) return;
    const manejarClickFuera = (e) => {
      const enPopover = refContenedorPopover.current?.contains(e.target);
      const enMarcador = e.target?.closest?.('[data-comentario-marcador="true"]');
      if (!enPopover && !enMarcador) setComentarioFijado(null);
    };
    document.addEventListener('click', manejarClickFuera);
    return () => document.removeEventListener('click', manejarClickFuera);
  }, [comentarioFijado]);

  // Al pulsar ESC se cierra cualquier popover abierto
  useEffect(() => {
    const manejarEsc = (e) => {
      if (e.key === 'Escape') {
        setComentarioFijado(null);
        setComentarioHover(null);
      }
    };
    window.addEventListener('keydown', manejarEsc);
    return () => window.removeEventListener('keydown', manejarEsc);
  }, []);

  // Calcula la posición del popover a partir de la celda#L (arriba a la izquierda)
  const calcularPosicionPopover = (evento, texto) => {
    const celda = evento.currentTarget.closest('td');
    const rect = celda ? celda.getBoundingClientRect() : { left: 0, bottom: 0 };
    return {
      id: celda?.dataset?.filaId,
      texto,
      x: Math.max(10, rect.left),
      y: rect.bottom + 6
    };
  };

  const abrirComentarioHover = (evento, item) => {
    const texto = textoComentario(item);
    if (!texto) return;
    // Si el usuario acaba de hacer clic para fijar/cerrar, el hover no lo pisa
    if (comentarioCerradoPorClick.current) return;
    setComentarioHover(calcularPosicionPopover(evento, texto));
  };

  const alternarComentarioClick = (evento, item) => {
    const texto = textoComentario(item);
    if (!texto) return;
    const posicion = calcularPosicionPopover(evento, texto);
    setComentarioHover(null);
    setComentarioFijado(prev => (prev && prev.id === posicion.id ? null : posicion));
    comentarioCerradoPorClick.current = true;
    setTimeout(() => { comentarioCerradoPorClick.current = false; }, 0);
  };

  const cerrarComentarioHover = () => {
    if (!comentarioCerradoPorClick.current) setComentarioHover(null);
  };

const toggleModelo = (clave) => {
  setModelosExpandidos(prev => ({ ...prev, [clave]: !prev[clave] }));
};

  // --- MODO DE EDICIÓN MASIVA ---
  const [modoEdicion, setModoEdicion] = useState(false);
  const [seleccionadosMasivos, setSeleccionadosMasivos] = useState(new Set()); // IDs seleccionados
  const [nuevoUsuarioMasivo, setNuevoUsuarioMasivo] = useState(""); // Nuevo responsable (opcional)
  const [ubicacionMasiva, setUbicacionMasiva] = useState(""); // Ubicación: GENERAL ('Jefe') o TIENDA PRINCIPAL ('Ray')
  const [aplicandoMasivo, setAplicandoMasivo] = useState(false);

  /* ============================================================================
     🔍 MÓDULO DE AUDITORÍA / CONCILIACIÓN CON EXCEL
     Se abre desde el dropdown del botón "📥 Excel ▾". Compara la columna
     SERIAL del archivo subido contra el inventario aplicando filtros previos
     de ESTADO, MARCA y MODELO, y clasifica en 3 grupos.
     ============================================================================ */

  // Dropdown del botón Excel
  const [menuExcelAbierto, setMenuExcelAbierto] = useState(false);
  // Modal de auditoría
  const [modalAuditoria, setModalAuditoria] = useState(false);
  const [arrastrandoArchivo, setArrastrandoArchivo] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState('');
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);
  // Filtros previos
  const [filtroEstadoAuditoria, setFiltroEstadoAuditoria] = useState('TODOS');
  const [filtroMarcaAuditoria, setFiltroMarcaAuditoria] = useState('');
  const [filtroModeloAuditoria, setFiltroModeloAuditoria] = useState('');
  // Resultados del cruce
  const [pestanaAuditoria, setPestanaAuditoria] = useState('coincidentes');
  const [resultadosAuditoria, setResultadosAuditoria] = useState({ coincidentes: [], faltantesSistema: [], faltantesExcel: [] });
  const [seleccionFaltantes, setSeleccionFaltantes] = useState(new Set());
  const [registrandoFaltantes, setRegistrandoFaltantes] = useState(false);

  // Resalta en la tabla las filas cuyo S/N está repetido
  const [resaltarDuplicados, setResaltarDuplicados] = useState(false);

  // --- ELIMINACIÓN MASIVA (borrado múltiple) ---
  const [modalEliminarMasivo, setModalEliminarMasivo] = useState(false); // abre/cierra el modal
  const [eliminandoMasivo, setEliminandoMasivo] = useState(false);       // loading de la petición
  const [notificacionMasiva, setNotificacionMasiva] = useState(null);   // { tipo: 'exito'|'error', texto }

  // Sólo quien puede eliminar un equipo suelto puede usar el borrado masivo
  const puedeEliminarMasivo = () => {
    if (usuarioLogueado?.rol === 'super_admin') return true;
    return !!(tienePermiso && tienePermiso('ELIMINAR_REGISTRO'));
  };

  // Cierra la notificación de éxito/error tras unos segundos
  useEffect(() => {
    if (!notificacionMasiva) return;
    const timer = setTimeout(() => setNotificacionMasiva(null), 4000);
    return () => clearTimeout(timer);
  }, [notificacionMasiva]);

  /* ===================== AUDITORÍA: MEMOS Y FILTROS ===================== */

  // Marcas y modelos disponibles (para el autocompletado de los filtros)
  const marcasDisponibles = useMemo(() => {
    const set = new Set();
    (laptops || []).forEach(l => { if (l.marca) set.add(String(l.marca).toUpperCase().trim()); });
    return Array.from(set).sort();
  }, [laptops]);

  const modelosDisponibles = useMemo(() => {
    const set = new Set();
    (laptops || []).forEach(l => { if (l.modelo) set.add(String(l.modelo).toUpperCase().trim()); });
    return Array.from(set).sort();
  }, [laptops]);

  // S/N que aparecen más de una vez en el inventario (para el resaltado rápido)
  const serialesDuplicados = useMemo(() => {
    const conteo = new Map();
    (laptops || []).forEach(l => {
      const s = normalizarSerialAudit(l.serial);
      if (!s) return;
      conteo.set(s, (conteo.get(s) || 0) + 1);
    });
    const dup = new Set();
    conteo.forEach((n, s) => { if (n > 1) dup.add(s); });
    return dup;
  }, [laptops]);

  // Alterna el resaltado de duplicados en la tabla
  const alternarResaltadoDuplicados = () => {
    const nuevo = !resaltarDuplicados;
    setResaltarDuplicados(nuevo);
    setMenuExcelAbierto(false);
    setNotificacionMasiva({
      tipo: serialesDuplicados.size > 0 ? 'error' : 'exito',
      texto: serialesDuplicados.size > 0
        ? `⚠️ ${serialesDuplicados.size} número(s) de serie están REPETIDOS y se resaltan en rojo.`
        : '✔️ No se encontraron números de serie repetidos en el inventario.'
    });
  };

  const abrirModalAuditoria = () => {
    setMenuExcelAbierto(false);
    setModalAuditoria(true);
    setPestanaAuditoria('coincidentes');
    setSeleccionFaltantes(new Set());
    setNotificacionMasiva(null);
  };

  // Inventario filtrado por los filtros previos del modal
  const inventarioFiltradoAuditoria = useMemo(() => {
    const marcaBusqueda = filtroMarcaAuditoria.trim().toUpperCase();
    const modeloBusqueda = filtroModeloAuditoria.trim().toUpperCase();
    return (laptops || []).filter(l => {
      if (filtroEstadoAuditoria !== 'TODOS') {
        const estado = (l.estado || 'STOCK').toUpperCase().trim();
        if (filtroEstadoAuditoria === 'STOCK' && estado !== 'STOCK') return false;
        if (filtroEstadoAuditoria === 'VENDIDOS' && estado !== 'VENDIDO') return false;
      }
      if (marcaBusqueda && !String(l.marca || '').toUpperCase().includes(marcaBusqueda)) return false;
      if (modeloBusqueda && !String(l.modelo || '').toUpperCase().includes(modeloBusqueda)) return false;
      return true;
    });
  }, [laptops, filtroEstadoAuditoria, filtroMarcaAuditoria, filtroModeloAuditoria]);

  /* ===================== AUDITORÍA: CRUCE DE DATOS ===================== */

  /**
   * Lee el archivo .xlsx / .xls / .csv con SheetJS y cruza la columna SERIAL
   * contra el inventario (ya filtrado por estado/marca/modelo).
   * La columna serial se detecta por nombre: SERIAL, S/N, N/S, N° SERIE, etc.
   */
  const procesarArchivoAuditoria = async (archivo) => {
    if (!archivo) return;
    const extension = String(archivo.name || '').split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(extension)) {
      setNotificacionMasiva({ tipo: 'error', texto: '❌ Formato no válido. Sube un archivo .xlsx, .xls o .csv' });
      return;
    }

    setProcesandoArchivo(true);
    setNombreArchivo(archivo.name);
    try {
      const buffer = await archivo.arrayBuffer();
      const libro = XLSX.read(buffer, { type: 'array' });
      const hoja = libro.Sheets[libro.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(hoja, { defval: '' });

      const claves = filas.length ? Object.keys(filas[0]) : [];
      const claveSerial = claves.find(k => {
        const n = String(k).toUpperCase().trim();
        return n === 'SERIAL' || n.includes('SERIAL') || n === 'S/N' || n === 'N/S'
          || n.includes('N° SERIE') || n.includes('NUMERO DE SERIE') || n.includes('NÚMERO DE SERIE');
      });

      if (!claveSerial) {
        setResultadosAuditoria({ coincidentes: [], faltantesSistema: [], faltantesExcel: [] });
        setNotificacionMasiva({ tipo: 'error', texto: `⚠️ No se encontró una columna SERIAL en "${archivo.name}". Columnas: ${claves.slice(0, 8).join(', ')}` });
        return;
      }

      const filasExcel = filas
        .map((f, i) => ({
          _fila: i,
          serial: normalizarSerialAudit(f[claveSerial]),
          modelo: String(f.MODELO || f.Modelo || '').trim().toUpperCase(),
          marca: String(f.MARCA || f.Marca || '').trim().toUpperCase(),
          original: f
        }))
        .filter(f => f.serial);

      // Índice del inventario filtrado por serial normalizado
      const indiceBd = new Map();
      inventarioFiltradoAuditoria.forEach(l => {
        const s = normalizarSerialAudit(l.serial);
        if (s && !indiceBd.has(s)) indiceBd.set(s, l);
      });

      const indiceExcel = new Map();
      filasExcel.forEach(f => { if (!indiceExcel.has(f.serial)) indiceExcel.set(f.serial, f); });

      const coincidentes = [];
      const faltantesSistema = [];

      filasExcel.forEach(f => {
        const enBd = indiceBd.get(f.serial);
        if (enBd) {
          coincidentes.push({
            serial: f.serial,
            excel: f,
            bd: enBd,
            coincideModelo: normalizarSerialAudit(f.modelo) === normalizarSerialAudit(enBd.modelo)
          });
        } else {
          faltantesSistema.push({ serial: f.serial, excel: f });
        }
      });

      // Equipos de la BD filtrada que NO vienen en el Excel
      const faltantesExcel = Array.from(indiceBd.values())
        .filter(l => !indiceExcel.has(normalizarSerialAudit(l.serial)))
        .map(l => ({ serial: normalizarSerialAudit(l.serial), bd: l }));

      setResultadosAuditoria({ coincidentes, faltantesSistema, faltantesExcel });
      setPestanaAuditoria('coincidentes');
      setSeleccionFaltantes(new Set(faltantesSistema.map(f => f.serial)));
    } catch (error) {
      console.error('Error al procesar el archivo de auditoría:', error);
      setNotificacionMasiva({ tipo: 'error', texto: '❌ No se pudo leer el archivo: ' + error.message });
    } finally {
      setProcesandoArchivo(false);
      setArrastrandoArchivo(false);
    }
  };

  // Selecciona / deselecciona un registro de "Faltan en Sistema"
  const alternarSeleccionFaltante = (serial) => {
    setSeleccionFaltantes(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(serial)) nuevo.delete(serial);
      else nuevo.add(serial);
      return nuevo;
    });
  };

  // Botón "➕ Registrar Selección": da de alta lo que faltaba en el sistema
  const registrarFaltantesSeleccionados = async () => {
    if (seleccionFaltantes.size === 0) return;
    setRegistrandoFaltantes(true);
    try {
      let creados = 0;
      for (const serial of seleccionFaltantes) {
        const fila = resultadosAuditoria.faltantesSistema.find(f => f.serial === serial);
        if (!fila) continue;
        await guardarProducto({
          serial,
          marca: fila.excel.marca || 'EXTERNO',
          modelo: fila.excel.modelo || 'OTRO',
          estado: 'STOCK',
          fecha: new Date().toLocaleDateString('es-PE'),
          hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true }),
          responsable: usuarioLogueado?.nombre || 'Sistema',
          procedencia: 'AUDITORÍA EXCEL'
        });
        creados++;
      }
      setNotificacionMasiva({ tipo: 'exito', texto: `✅ Se registraron ${creados} equipo(s) que faltaban en el sistema.` });
      setSeleccionFaltantes(new Set());
    } catch (error) {
      console.error('Error registrando faltantes:', error);
      setNotificacionMasiva({ tipo: 'error', texto: '❌ Error al registrar: ' + error.message });
    } finally {
      setRegistrandoFaltantes(false);
    }
  };

  // Abre el modal de confirmación (nunca borra directamente desde la barra)
  const abrirConfirmacionEliminarMasivo = () => {
    if (seleccionadosMasivos.size === 0) return;
    setNotificacionMasiva(null);
    setModalEliminarMasivo(true);
  };

  // Confirma el borrado: envía el ARREGLO de IDs a la API, avisa y limpia
  const confirmarEliminarMasivo = async () => {
    const ids = Array.from(seleccionadosMasivos);
    if (ids.length === 0) {
      setModalEliminarMasivo(false);
      return;
    }

    setEliminandoMasivo(true);
    try {
      const { eliminados } = await eliminarProductosMasivo(ids);

      // Cerramos el modal, vaciamos la selección y salimos del modo edición.
      // La tabla se refresca sola: la suscripción es onSnapshot en tiempo real.
      setModalEliminarMasivo(false);
      setSeleccionadosMasivos(new Set());
      setNuevoUsuarioMasivo("");
      setUbicacionMasiva("");
      setModoEdicion(false);
      setNotificacionMasiva({
        tipo: 'exito',
        texto: `✅ Se eliminaron correctamente ${eliminados} equipo(s) del inventario.`
      });
    } catch (error) {
      console.error("Error en la eliminación masiva:", error);
      setModalEliminarMasivo(false);
      setNotificacionMasiva({
        tipo: 'error',
        texto: `❌ No se pudo completar la eliminación: ${error.message}`
      });
    } finally {
      setEliminandoMasivo(false);
    }
  };

  const alternarModoEdicion = () => {
    setModoEdicion(prev => !prev);
    setSeleccionadosMasivos(new Set()); // Vaciamos la selección al alternar
    setNuevoUsuarioMasivo("");
    setUbicacionMasiva("");
  };

  const toggleSeleccionMasiva = (id) => {
    if (!id) return;
    setSeleccionadosMasivos(prev => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const toggleSeleccionarTodoVisible = () => {
    setSeleccionadosMasivos(prev => {
      // Si ya están todos los visibles seleccionados, deseleccionamos todo
      const todosVisibles = datosFiltrados.map(d => d.fireId).filter(Boolean);
      const todosMarcados = todosVisibles.length > 0 && todosVisibles.every(id => prev.has(id));
      return todosMarcados ? new Set() : new Set(todosVisibles);
    });
  };

  // Aplica los cambios masivos con writeBatch (una sola escritura por documento, atómica)
  const aplicarEdicionMasiva = async () => {
    if (seleccionadosMasivos.size === 0) {
      alert("⚠️ No has seleccionado ningún equipo.");
      return;
    }

    // Prioridad: si se eligió ubicación, esa manda sobre el usuario individual
    const nuevoResponsable = ubicacionMasiva || nuevoUsuarioMasivo;
    if (!nuevoResponsable) {
      alert("⚠️ Elige primero el nuevo usuario o la nueva ubicación.");
      return;
    }

    const etiquetaUbicacion = nombreVendedorVisible(nuevoResponsable);
    if (!window.confirm(`¿Seguro que quieres reasignar ${seleccionadosMasivos.size} equipo(s) a "${etiquetaUbicacion}"? Esta acción modifica la base de datos.`)) {
      return;
    }

    setAplicandoMasivo(true);
    try {
      const batch = writeBatch(db);
      seleccionadosMasivos.forEach(id => {
        const ref = fsDoc(db, "inventario", id);
        batch.update(ref, { responsable: nuevoResponsable });
      });
      await batch.commit();

      alert(`✅ ¡Listo! ${seleccionadosMasivos.size} equipo(s) fueron reasignados a "${etiquetaUbicacion}" correctamente.`);
      // Cerramos el modo de edición y limpiamos al terminar
      setModoEdicion(false);
      setSeleccionadosMasivos(new Set());
      setNuevoUsuarioMasivo("");
      setUbicacionMasiva("");
    } catch (error) {
      console.error("Error en la edición masiva:", error);
      alert("❌ Hubo un error al aplicar los cambios: " + error.message);
    } finally {
      setAplicandoMasivo(false);
    }
  };
  const esVendedor = usuarioLogueado?.rol === 'vendedor';
  const esAdmin2 = usuarioLogueado?.rol === 'admin_2' || usuarioLogueado?.rol === 'super_admin'; 
  const stats2026 = useMemo(() => {
    const lista = laptops || [];
    const ventas2026 = lista.filter(l =>
      l && String(fechaVentaDe(l)).includes('2026') && (l.estado?.toUpperCase().trim() === 'VENDIDO')
    );

    const recaudado = ventas2026.reduce((acc, curr) => acc + (Number(curr.precio) || 0), 0);
    const vendidos = ventas2026.length;
    const enTienda = lista.filter(l => (l.estado || 'STOCK').toUpperCase().trim() === 'STOCK').length;
    const utilidadTotal = ventas2026.reduce((acc, curr) => acc + (Number(curr.utilidad) || 0), 0);

    return { recaudado, vendidos, enTienda, utilidadTotal };
  }, [laptops]);

  const limpiarFiltros = () => {
    setBusqueda("");
    setFechaFiltro(""); 
    setFiltroEstado('TODOS');
    setFiltroVendedor('TODOS'); // Limpiamos también el vendedor
    setFiltroTiempo('TODAS');
  };

 // --- LÓGICA DE FILTRADO ACTUALIZADA ---
  const datosFiltrados = (laptops || []).filter(d => {
    if (!d) return false;

    // 1. Filtro por Vendedor
    const nombreVendedor = String(d.responsable || d.vendedor || "").toUpperCase();
    const pasaVendedor = filtroVendedor === "TODOS" || nombreVendedor.includes(filtroVendedor);
    if (!pasaVendedor) return false;

    // 2. Filtro por Tiempo (CORREGIDO)
    if (filtroTiempo !== "TODAS") {
      const fechaStr = d.fecha_venta || d.fecha || "";
      if (!fechaStr) return false; // Si no hay fecha, no pasa filtros de tiempo

      // Lógica para "ELEGIR DIA"
      if (filtroTiempo === "ELEGIR_MES") {
        if (!fechaFiltro) return true; // Si no se ha elegido día, se muestran todos

        // Parseamos la fecha del filtro (formato YYYY-MM-DD) a números
        const [anioSeleccionado, mesSeleccionado, diaSeleccionado] = fechaFiltro.split('-').map(p => parseInt(p, 10));

        // Hacemos el parseo de fecha más robusto, aceptando "/" o "-" como separador.
        const separador = fechaStr.includes('/') ? '/' : '-';
        const partesFecha = fechaStr.split(separador);
        if (partesFecha.length !== 3) return false; // Si el formato en la BD es inesperado, no lo mostramos

        // Asumimos formato DD/MM/YYYY o DD-MM-YYYY
        const diaRegistro = parseInt(partesFecha[0], 10);
        const mesRegistro = parseInt(partesFecha[1], 10);
        const anioRegistro = parseInt(partesFecha[2], 10);
        
        // Añadimos una validación por si el parseo falla y da NaN
        if (isNaN(diaRegistro) || isNaN(mesRegistro) || isNaN(anioRegistro)) return false;

        if (diaRegistro !== diaSeleccionado || mesRegistro !== mesSeleccionado || anioRegistro !== anioSeleccionado) {
          return false;
        }
      } 
      // Lógica para "HOY" y "ESTE_ANIO"
      else {
        const separador = fechaStr.includes('/') ? '/' : '-';
        const partesFecha = fechaStr.split(separador);

        if (partesFecha.length === 3) {
          let dia, mes, anio;
          // Asumimos DD/MM/YYYY porque es el formato de `es-PE`
          if (partesFecha[2].length === 4) { 
            dia = parseInt(partesFecha[0], 10);
            mes = parseInt(partesFecha[1], 10);
            anio = parseInt(partesFecha[2], 10);
          } else {
            return false; // Formato no reconocido
          }

          const hoy = new Date();
          if (filtroTiempo === "HOY") {
            if (dia !== hoy.getDate() || mes !== (hoy.getMonth() + 1) || anio !== hoy.getFullYear()) return false;
          } 
          else if (filtroTiempo === "ESTE_ANIO") {
            if (anio !== 2026) return false;
          }
        } else {
          
          return false;
        }
      }
    }

    // 4. Filtro por Estado (TODOS, STOCK, VENDIDOS) — normalizado para no perder equipos por mayúsculas/espacios
    const estadoActual = (d.estado || "STOCK").toUpperCase().trim();
    if (filtroEstado !== 'TODOS' && estadoActual !== filtroEstado) return false;

    // 5. Filtro por Texto
    const texto = busqueda.toLowerCase().trim();
    if (!texto) return true;
    const caracteristicas = `${d.marca || ''} ${d.modelo || ''} ${d.serial || ''} ${d.procesador || ''} ${d.generacion || d.gen || ''} ${d.ram || ''} ${d.gpu || ''} ${d.almacenamiento || d.disco || ''} ${nombreVendedor} ${d.n_pedido || ''} ${textoComentario(d)}`.toLowerCase();
    return caracteristicas.includes(texto);
  });

  const exportarExcel = () => {
    if (esVendedor) return; 

    // --- INICIO: LÓGICA DE ORDENAMIENTO PARA EXCEL ---
    // Se replica el orden cronológico de la tabla visual para asegurar consistencia en el archivo exportado.
    const obtenerFechaEstandar = (item) => {
      // ✅ CORRECCIÓN: misma fecha efectiva que la tabla visual (fechaVentaDe)
      const stringFecha = String(fechaVentaDe(item) || '');
      const partes = stringFecha.split(/[-/]/);
      if (partes.length === 3) {
        let dia, mes, anio;
        if (partes[2].length === 4) { // Formato DD/MM/YYYY
          dia = partes[0]; mes = partes[1]; anio = partes[2];
        } else if (partes[0].length === 4) { // Formato YYYY-MM-DD
          anio = partes[0]; mes = partes[1]; dia = partes[2];
        }
        if (anio && mes && dia) {
          return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        }
      }
      return '1970-01-01'; // Fecha de respaldo para evitar errores con registros sin fecha.
    };

    const datosOrdenadosParaExportar = [...datosFiltrados].sort((a, b) => {
      const fechaA = obtenerFechaEstandar(a);
      const fechaB = obtenerFechaEstandar(b);
      if (fechaB !== fechaA) return fechaB.localeCompare(fechaA); // Ordena por día (más reciente primero)
      // Si el día es el mismo, desempata por hora de creación exacta.
      const tiempoA = a.fechaCreacion?.toDate ? a.fechaCreacion.toDate().getTime() : 0;
      const tiempoB = b.fechaCreacion?.toDate ? b.fechaCreacion.toDate().getTime() : 0;
      return tiempoB - tiempoA; // Ordena por hora (más reciente primero)
    });
    // --- FIN: LÓGICA DE ORDENAMIENTO ---
    const datosFormateados = datosOrdenadosParaExportar.map((item, i) => {
      const row = {
        'N°': i + 1,
        FECHA: fechaVentaDe(item),
        VENDEDOR: nombreVendedorVisible(item.responsable || item.vendedor),
        MARCA: item.marca,
        MODELO: item.modelo,
        PROCESADOR: `${item.procesador || ''} ${corregirGeneracion(item.generacion || item.gen)}`.trim() || 'N/A',
        RAM: item.ram || 'N/A',
        GPU: item.gpu || 'N/A',
        DISCO: item.almacenamiento || item.disco || 'N/A',
        SERIAL: item.serial,
      };

      const esVendido = (item.estado || "STOCK").toUpperCase() === 'VENDIDO';

      if (esAdmin2) row['COSTO'] = item.precio_costo || 0;
      row['PRECIO'] = item.precio;
      if (esAdmin2) {
        // ✅ CORRECCIÓN: La utilidad en el reporte es 0 si no está vendido.
        row['UTILIDAD'] = esVendido ? (item.utilidad || (Number(item.precio) - Number(item.precio_costo)) || 0) : 0;
      }
      row['ESTADO'] = item.estado || "STOCK";
      // NOTA: CLIENTE, TELEFONO y COMENTARIO ya no se exportan al Excel
      // (solo existen en la tabla visual).

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(datosFormateados);

    // 📅 FILA 0: TÍTULO DEL REPORTE + FECHA DE IMPRESIÓN.
    // El título refleja el filtro activo en la TABLA GENERAL
    // (TODOS / STOCK / VENDIDOS / PENDIENTES) y, si aplica, el usuario filtrado.
    // Para abrirla, todas las filas existentes (encabezado + datos) se corren una posición hacia abajo.
    const etiquetasEstado = {
      TODOS: 'EXCEL DE TODOS',
      STOCK: 'EXCEL DE STOCK',
      VENDIDO: 'EXCEL DE VENDIDOS',
      PENDIENTE: 'EXCEL DE PENDIENTES'
    };
    const tituloReporte = etiquetasEstado[filtroEstado] || `EXCEL DE ${filtroEstado}`;
    const tituloUsuario = (filtroVendedor && filtroVendedor !== 'TODOS')
      ? ` - USUARIO: ${filtroVendedor}`
      : '';
    const momentoImpresion = new Date();
    const textoFechaImpresion = `${tituloReporte}${tituloUsuario} | FECHA DE IMPRESIÓN: ${momentoImpresion.toLocaleDateString()} ${momentoImpresion.toLocaleTimeString()}`;
    const rangoDatos = ws['!ref']
      ? XLSX.utils.decode_range(ws['!ref'])
      : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };

    // Recorremos de abajo hacia arriba para no pisar celdas al desplazarlas
    for (let F = rangoDatos.e.r; F >= rangoDatos.s.r; F--) {
      for (let C = rangoDatos.e.c; C >= rangoDatos.s.c; C--) {
        const origen = XLSX.utils.encode_cell({ r: F, c: C });
        const celdaOrigen = ws[origen];
        if (!celdaOrigen) continue;
        delete ws[origen];
        ws[XLSX.utils.encode_cell({ r: F + 1, c: C })] = celdaOrigen;
      }
    }

    // Colocamos la fecha en la nueva fila 0 y ampliamos el rango de la hoja
    ws[XLSX.utils.encode_cell({ r: 0, c: 0 })] = { t: 's', v: textoFechaImpresion };
    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: rangoDatos.e.r + 1, c: rangoDatos.e.c }
    });
    // La fecha ocupa todo el ancho de la tabla (celdas combinadas)
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: rangoDatos.e.c } }];

    // --- INICIO: MAGIA DE COLORES PARA FINPRO STORE ---
    
    // 1. Definimos los colores (sin el símbolo #, usando códigos HEX puros)
    const estiloEncabezado = {
      font: { bold: true, color: { rgb: "FFFFFF" } }, // Letra Blanca
      fill: { fgColor: { rgb: "000000" } },          // Fondo Negro
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: { 
        top: {style: "thin", color: {rgb: "000000"}}, bottom: {style: "thin", color: {rgb: "000000"}}, 
        left: {style: "thin", color: {rgb: "000000"}}, right: {style: "thin", color: {rgb: "000000"}} 
      }
    };

    const estiloCuerpo = {
      font: { color: { rgb: "000000" } },            // Letra Negra
      fill: { fgColor: { rgb: "FFFFFF" } },          // Fondo Blanco
      alignment: { horizontal: "center", vertical: "center", wrapText: true }, // wrapText: el texto se ajusta y se ve completo en la casilla
      border: { 
        top: {style: "thin", color: {rgb: "000000"}}, bottom: {style: "thin", color: {rgb: "000000"}}, 
        left: {style: "thin", color: {rgb: "000000"}}, right: {style: "thin", color: {rgb: "000000"}} 
      }
    };

    // Fila 0 = FECHA DE IMPRESIÓN | Fila 1 = Encabezados | Filas siguientes = Datos
    const estiloTituloFecha = {
      font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } }, // Letra Blanca grande
      fill: { fgColor: { rgb: "166534" } },          // Fondo Verde (tono del botón de Excel)
      alignment: { horizontal: "center", vertical: "center" },
      border: { 
        top: {style: "thin", color: {rgb: "000000"}}, bottom: {style: "thin", color: {rgb: "000000"}}, 
        left: {style: "thin", color: {rgb: "000000"}}, right: {style: "thin", color: {rgb: "000000"}} 
      }
    };

    // 2. Recorremos celda por celda como un pintor
    const rango = XLSX.utils.decode_range(ws['!ref']);
    for (let F = rango.s.r; F <= rango.e.r; F++) {
      for (let C = rango.s.c; C <= rango.e.c; C++) {
        const celda = ws[XLSX.utils.encode_cell({ r: F, c: C })];
        if (!celda) continue;
        
        // Fila 0 = Fecha de impresión | Fila 1 (los títulos) = Encabezado | resto = Cuerpo
        celda.s = F === 0 ? estiloTituloFecha : (F === 1 ? estiloEncabezado : estiloCuerpo);
      }
    }

    // 2.5 SOLO la casilla MARCA se pinta con el color PASTEL de su marca
    // LENOVO = ROJO pastel | ASUS = AZUL pastel | DELL = VERDE pastel | HP = AMARILLO pastel | MAC = GRIS pastel
    // (Versiones suaves de los mismos colores usados en la tabla visual)
    const obtenerEstiloPastelMarca = (marca) => {
      const marcaLimpia = marca ? String(marca).toUpperCase().trim() : '';
      let rellenoPastel = null;
      if (marcaLimpia.includes('LENOVO')) rellenoPastel = "FECACA"; // ROJO pastel
      else if (marcaLimpia.includes('ASUS')) rellenoPastel = "BFDBFE"; // AZUL pastel
      else if (marcaLimpia.includes('DELL')) rellenoPastel = "BBF7D0"; // VERDE pastel
      else if (marcaLimpia === 'HP' || marcaLimpia.startsWith('HP ')) rellenoPastel = "FEF08A"; // AMARILLO pastel
      else if (marcaLimpia.includes('MAC') || marcaLimpia.includes('APPLE')) rellenoPastel = "E2E8F0"; // GRIS pastel
      if (!rellenoPastel) return null; // Otras marcas quedan con el estilo por defecto

      return {
        font: { bold: true, color: { rgb: "000000" } }, // Letra negra en negrita: la marca siempre se lee bien
        fill: { fgColor: { rgb: rellenoPastel } },      // Fondo pastel suave
        alignment: { horizontal: "center", vertical: "center" },
        border: { 
          top: {style: "thin", color: {rgb: "000000"}}, bottom: {style: "thin", color: {rgb: "000000"}}, 
          left: {style: "thin", color: {rgb: "000000"}}, right: {style: "thin", color: {rgb: "000000"}} 
        }
      };
    };

    // Ubicamos la columna MARCA por su encabezado (más robusto que asumir una posición fija)
    // OJO: la fila 0 es la FECHA DE IMPRESIÓN, por eso los encabezados están en la fila 1.
    let columnaMarca = -1;
    for (let C = rango.s.c; C <= rango.e.c; C++) {
      const celdaHeader = ws[XLSX.utils.encode_cell({ r: 1, c: C })];
      if (celdaHeader && String(celdaHeader.v || '').trim().toUpperCase() === 'MARCA') {
        columnaMarca = C;
        break;
      }
    }

    // Pintamos cada celda de la columna MARCA (saltándonos la fila de fecha y la de encabezado)
    if (columnaMarca !== -1) {
      for (let F = rango.s.r + 2; F <= rango.e.r; F++) {
        const celdaMarca = ws[XLSX.utils.encode_cell({ r: F, c: columnaMarca })];
        if (!celdaMarca) continue;
        const estiloPastel = obtenerEstiloPastelMarca(celdaMarca.v);
        if (estiloPastel) celdaMarca.s = estiloPastel;
      }
    }

    // Configuración de anchos de columna
    ws['!cols'] = [
      { wch: 10 }, // A: N°
      { wch: 13 }, // B: FECHA
      { wch: 13 }, // C: VENDEDOR
      { wch: 13 }, // D: MARCA
      { wch: 22 }, // E: MODELO
      { wch: 22 }, // F: PROCESADOR
      { wch: 10 }, // G: RAM
      { wch: 13 }, // H: GPU
      { wch: 13 }, // I: DISCO
      { wch: 13 }, // J: SERIAL
      { wch: 10 }, // K: COSTO
      { wch: 10 }, // L: PRECIO
      { wch: 10 }, // M: UTILIDAD
      { wch: 13 }  // N: ESTADO (FIN: antes seguían CLIENTE, TELÉFONO y COMENTARIO)
    ];

    // Configuración de altura de fila fija (31.00) para todas las filas
    ws['!rows'] = [];
    for (let F = rango.s.r; F <= rango.e.r; F++) {
      ws['!rows'].push({ hpt: 31 });
    }

    // Configuración de página horizontal y ajuste a 1 página de ancho
    ws['!pageSetup'] = {
      orientation: 'landscape',
      fitToWidth: 1,
      fitToHeight: 0
    };
    // --- FIN: MAGIA DE COLORES ---

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario Leonidas");
    
    // Al guardar, limpio las barras diagonales de la fecha para que Windows no marque error
    const fechaLimpia = new Date().toLocaleDateString().replace(/\//g, '-');
    XLSX.writeFile(wb, `Reporte_LeonidasStore_${fechaLimpia}.xlsx`);
  };

  const estiloCelda = { 
    fontSize: '13px', 
    fontWeight: '400', 
    verticalAlign: 'middle',
    padding: '0px 8px', 
    borderBottom: '1px solid #1e293b',
    color: '#e2e8f0',
    height: '28px', 
    lineHeight: '1.1'
  };

  const tienePermisoEstado = (item) => {
    if (esVendedor) return false;
    const tienePrecioAsignado = item.precio && Number(item.precio) > 0;
    if (!tienePrecioAsignado) return false;
    return esAdmin2 || item.responsable === usuarioLogueado?.nombre;
  };

  const puedeEditar = (item) => {
    if (usuarioLogueado?.rol === 'super_admin' || 
      usuarioLogueado?.rol === 'administrador_ventas') return true;
    if (usuarioLogueado?.nombre?.toUpperCase().includes('PIA')) return true; // Pia puede editar registros
    return tienePermiso && tienePermiso('EDITAR_REGISTRO');
  };

  const puedeEliminar = (item) => {
    return tienePermiso && tienePermiso('ELIMINAR_REGISTRO');
  };

  return (
    <div className={styles.reportesContainer}>
      
      {esAdmin2 && (
        <div className={styles.contenedorEstadisticasAnuales}>
          <div className={styles.tarjetaAnual} style={{ '--color-borde': '#10b981' }}>
            <div className={styles.infoTarjeta}>
              <span>💰 TOTAL RECAUDADO</span>
              <div className={styles.valorContainer}>
                <h3>S/ {stats2026.recaudado.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
              </div>
            </div>
          </div>

          <div className={styles.tarjetaAnual} style={{ '--color-borde': '#00ff7f' }}>
            <div className={styles.infoTarjeta}>
              <span>📈 GANANCIA REAL (UTILIDAD)</span>
              <div className={styles.valorContainer}>
                <h3>S/ {stats2026.utilidadTotal.toLocaleString('es-PE', { minimumFractionDigits: 2 })}</h3>
              </div>
            </div>
          </div>

          <div className={styles.tarjetaAnual} style={{ '--color-borde': '#3b82f6' }}>
            <div className={styles.infoTarjeta}>
              <span>📦 STOCK VENDIDO TOTAL</span>
              <div className={stats2026.valorContainer}>
                <h3>{stats2026.vendidos}</h3>
                <span className={styles.unidad}>Unds.</span>
              </div>
            </div>
          </div>

          <div className={styles.tarjetaAnual} style={{ '--color-borde': '#f59e0b' }}>
            <div className={styles.infoTarjeta}>
              <span>🏪 STOCK EN TIENDA</span>
              <div className={styles.valorContainer}>
                <h3>{stats2026.enTienda}</h3>
                <span className={styles.unidad}>Unds.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.reportesHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h2 className={styles.reportesTitle} style={{ margin: 0 }}>
            {esVendedor ? "🚀 Panel de Ventas Leonidas" : "📊 TABLA GENERAL"}
            </h2>

            {/* --- SELECTOR DE VENDEDOR (ESTILO ALINEADO) --- */}
            <select 
                value={filtroVendedor}
                onChange={(e) => setFiltroVendedor(e.target.value)}
                style={{
    backgroundColor: '#1e293b', // Fondo azul oscuro
    color: '#ffffff',           // Texto BLANCO puro para que se vea
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '0 35px 0 12px',
    fontSize: '13px',
    cursor: 'pointer',
    outline: 'none',
    height: '40px',
    width: '220px', // Achicamos el selector para darle más espacio al buscador
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '16px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    display: 'inline-block',
    visibility: 'visible'       // Forzamos visibilidad
  }}
            >
                <option value="TODOS">👤 TODOS LOS USUARIOS</option>
                <option value="CRISTOFER">CRISTOFER</option>
                <option value="DAVID">DAVID</option>
                <option value="YAEL">YAEL</option>
                <option value="RAY">🏪 TIENDA PRINCIPAL</option>
                <option value="JEFE">🏢 GENERAL</option>
                <option value="PERSONAL ADMINISTRADOR">ADMINISTRADOR</option>
            </select>
        </div>

        <div className={`${styles.reportesControls} mobile-stack`} style={{alignItems: 'center'}}>
          <div style={{display: 'flex', alignItems: 'center', flex: 1}}>
            <input
              type="text"
              placeholder="Buscar por marca, modelo, serial o N/Pedido..."
              className={styles.inputBusqueda}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              style={{ flex: 1, height: '40px', borderRadius: '6px 0 0 6px', padding: '0 15px', borderRight: 'none' }}
            />
            <button 
                onClick={() => iniciarEscaneo(setBusqueda)}
                title="Escanear código de barras o QR"
                style={{
                    height: '40px',
                    background: '#0f172a',
                    border: '1px solid #1e293b',
                    borderLeft: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '0 12px',
                    borderRadius: '0 6px 6px 0',
                    display: 'flex',
                    alignItems: 'center'
                }}
            ><QrCode size={20} /></button>
          </div>
          <input 
            type="date" 
            title="Filtrar por fecha específica"
            value={fechaFiltro || ""} 
            onChange={(e) => setFechaFiltro(e.target.value)} 
            className={styles.inputFecha}
            style={{ height: '40px' }}
          />
          
          <button 
            onClick={limpiarFiltros}
            className={styles.btnVerTodo}
            style={{
              padding: '0 15px',
              backgroundColor: '#334155',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              height: '40px'
            }}
          >
            👁️ Ver Todo
          </button>

          {!esVendedor && (
            /* ============ DROPDOWN BUTTON "Excel ▾" ============
               1) Exportar Tabla a Excel  2) Auditar/Conciliar  3) Ver Duplicados */
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuExcelAbierto(v => !v)}
                title="Opciones de Excel y auditoría"
                className={styles.btnExcel}
                style={{ height: '40px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                📥 Excel
                <ChevronDown size={16} style={{ transform: menuExcelAbierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {menuExcelAbierto && (
                <>
                  {/* Capa invisible que cierra el menú al hacer clic fuera */}
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setMenuExcelAbierto(false)} />
                  <div className={styles.menuDesplegable}>
                    <button
                      className={styles.itemMenuDesplegable}
                      onClick={() => { setMenuExcelAbierto(false); exportarExcel(); }}
                    >
                      <Download size={16} />
                      <span>
                        <strong>📥 Exportar Tabla a Excel</strong>
                        <small>Descarga el reporte actual filtrado</small>
                      </span>
                    </button>
                    <button
                      className={styles.itemMenuDesplegable}
                      onClick={abrirModalAuditoria}
                    >
                      <FileSpreadsheet size={16} />
                      <span>
                        <strong>🔍 Auditar / Conciliar con Excel</strong>
                        <small>Cruza tu archivo con el inventario</small>
                      </span>
                    </button>
                    <button
                      className={styles.itemMenuDesplegable}
                      onClick={alternarResaltadoDuplicados}
                    >
                      <AlertTriangle size={16} />
                      <span>
                        <strong>⚠️ Verificar Duplicados</strong>
                        <small>
                          {serialesDuplicados.size > 0
                            ? `${serialesDuplicados.size} S/N repetido(s)`
                            : 'Resalta S/N repetidos'}
                        </small>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

    {/* --- CONTENEDOR FLEX PARA ALINEAR PESTAÑAS Y SELECTOR --- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
        
        {/* Pestañas originales */}
        <div className={styles.estadoTabs} style={{ margin: 0 }}>
          <button onClick={() => setFiltroEstado('TODOS')} className={filtroEstado === 'TODOS' ? styles.active : ''}>📋 TODOS ({laptops?.length || 0})</button>
          <button onClick={() => setFiltroEstado('STOCK')} className={filtroEstado === 'STOCK' ? `${styles.active} ${styles.stock}` : ''}>🟢 STOCK ({laptops.filter(l => (l.estado || 'STOCK').toUpperCase().trim() === 'STOCK').length})</button>
          <button onClick={() => setFiltroEstado('VENDIDO')} className={filtroEstado === 'VENDIDO' ? `${styles.active} ${styles.vendido}` : ''}>🔴 VENDIDOS / SALIDA ({laptops.filter(l => (l.estado || '').toUpperCase().trim() === 'VENDIDO').length})</button>
          <button onClick={() => setFiltroEstado('PENDIENTE')} className={filtroEstado === 'PENDIENTE' ? `${styles.active} ${styles.pendiente}` : ''}>
            🟡 PENDIENTES POR RECIBIR ({laptops.filter(l => (l.estado || '').toUpperCase().trim() === 'PENDIENTE').length})
          </button>
        </div>

       {/* --- CONTENEDOR: SELECTOR + MINI CALENDARIO DE MESES --- */}
      <div style={{ display: 'flex', gap: '10px' }}>
        
        {/* 1. SELECTOR PRINCIPAL */}
        <select 
          value={filtroTiempo}
          onChange={(e) => {
            const nuevoFiltro = e.target.value;
            setFiltroTiempo(nuevoFiltro);
            if (nuevoFiltro !== 'ELEGIR_MES') {
              setFechaFiltro('');
            }
          }}
          style={{
            backgroundColor: '#1e293b',
            color: '#ffffff',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '0 35px 0 12px',
            fontSize: '13px',
            cursor: 'pointer',
            outline: 'none',
            height: '40px',
            width: '200px',     /* <-- Mantenemos tu ancho original */
            flexShrink: 0,      /* <-- Mantenemos tu regla para que no se deforme */
            appearance: 'none',
            WebkitAppearance: 'none',
            MozAppearance: 'none',
            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            backgroundSize: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        >
          <option value="TODAS" style={{ background: '#1e293b', color: '#fff' }}>📅 TODAS LAS FECHAS</option>
          <option value="HOY" style={{ background: '#1e293b', color: '#fff' }}>📅 HOY</option>
          <option value="ESTE_ANIO" style={{ background: '#1e293b', color: '#fff' }}>📅 2026</option>
          <option value="ELEGIR_MES" style={{ background: '#1e293b', color: '#fff' }}>📅 ELEGIR DIA...</option>
        </select>

        {/* 2. CALENDARIO DE MESES (Aparece SOLO si se selecciona "ELEGIR_MES") */}
        {filtroTiempo === 'ELEGIR_MES' && (
          <input 
            type="date" // Cambiado de month a date
            min="2026-01-01" // Fecha mínima para el año 2026
            max="2026-12-31" // Fecha máxima para el año 2026
            value={fechaFiltro || ''}
            onChange={(e) => setFechaFiltro(e.target.value)}
            style={{
              backgroundColor: '#1e293b',
              color: '#ffffff',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '0 12px',
              fontSize: '13px',
              cursor: 'pointer',
              outline: 'none',
              height: '40px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              colorScheme: 'dark'
            }}
          />
        )}

        {/* BOTÓN DE EDICIÓN MASIVA (junto al filtro de fechas) */}
        {!esVendedor && (
          <button
            onClick={alternarModoEdicion}
            title="Seleccionar varios equipos y reasignarlos en lote"
            style={{
              height: '40px',
              padding: '0 15px',
              borderRadius: '8px',
              border: modoEdicion ? '1px solid #ef4444' : '1px solid #f59e0b',
              backgroundColor: modoEdicion ? '#ef4444' : 'rgba(245, 158, 11, 0.15)',
              color: modoEdicion ? '#fff' : '#f59e0b',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              whiteSpace: 'nowrap'
            }}
          >
            {modoEdicion ? '✖️ Cancelar Edición' : '✏️ Edición Masiva'}
          </button>
        )}
      </div>
      </div>

      {/* --- BARRA DE ACCIONES MASIVAS (solo visible en modo edición) --- */}
      {modoEdicion && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '10px',
          padding: '12px 15px',
          marginBottom: '15px'
        }}>
          <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '13px' }}>
            🖊️ MODO EDICIÓN: {seleccionadosMasivos.size} seleccionado(s)
          </span>

          {/* Selector para seleccionar/deseleccionar todo lo visible */}
          <button
            onClick={toggleSeleccionarTodoVisible}
            style={{
              height: '36px', padding: '0 12px', borderRadius: '6px',
              border: '1px solid #334155', backgroundColor: '#1e293b',
              color: '#e2e8f0', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
            }}
          >
            ☑️ Seleccionar / Deseleccionar todo lo visible
          </button>

          {/* Selector de Nuevo Usuario */}
          <select
            value={nuevoUsuarioMasivo}
            onChange={(e) => setNuevoUsuarioMasivo(e.target.value)}
            disabled={!!ubicacionMasiva}
            title={ubicacionMasiva ? "Desactivado porque elegiste una ubicación" : "Reasignar a un usuario específico"}
            style={{
              minHeight: '40px', height: 'auto', padding: '8px 12px',
              borderRadius: '6px', border: '1px solid #334155',
              backgroundColor: '#1e293b', color: '#ffffff',
              fontSize: '13px', lineHeight: '20px',
              display: 'flex', alignItems: 'center',
              cursor: 'pointer', outline: 'none',
              width: '250px', flexShrink: 0, flexGrow: 0, flexBasis: 'auto',
              whiteSpace: 'nowrap', overflow: 'hidden', boxSizing: 'border-box',
              opacity: ubicacionMasiva ? 0.5 : 1
            }}
          >
            <option value="">👤 Nuevo Usuario (opcional)...</option>
            <option value="Ray">🏪 TIENDA PRINCIPAL</option>
            <option value="Jefe">🏢 GENERAL</option>
            <option value="David">DAVID</option>
            <option value="Cristofer">CRISTOFER</option>
            <option value="Yael">YAEL</option>
            <option value="Personal Administrador">ADMINISTRADOR</option>
          </select>

          {/* Selector de Ubicación rápida */}
          <select
            value={ubicacionMasiva}
            onChange={(e) => setUbicacionMasiva(e.target.value)}
            title="Cambia masivamente la ubicación de los equipos"
            style={{
              minHeight: '40px', height: 'auto', padding: '8px 12px',
              borderRadius: '6px', border: '1px solid #334155',
              backgroundColor: '#1e293b', color: '#ffffff',
              fontSize: '13px', lineHeight: '20px',
              display: 'flex', alignItems: 'center',
              cursor: 'pointer', outline: 'none',
              width: '240px', flexShrink: 0, flexGrow: 0, flexBasis: 'auto',
              whiteSpace: 'nowrap', overflow: 'hidden', boxSizing: 'border-box'
            }}
          >
            <option value="">📍 Ubicación (opcional)...</option>
            <option value="Jefe">🏢 GENERAL</option>
            <option value="Ray">🏪 TIENDA PRINCIPAL</option>
          </select>

          {/* Botón Aplicar */}
          <button
            onClick={aplicarEdicionMasiva}
            disabled={aplicandoMasivo || seleccionadosMasivos.size === 0}
            style={{
              height: '36px', padding: '0 18px', borderRadius: '6px',
              border: 'none', backgroundColor: (aplicandoMasivo || seleccionadosMasivos.size === 0) ? '#475569' : '#00ff7f',
              color: (aplicandoMasivo || seleccionadosMasivos.size === 0) ? '#94a3b8' : '#0f172a',
              fontWeight: 'bold', fontSize: '13px', cursor: (aplicandoMasivo || seleccionadosMasivos.size === 0) ? 'not-allowed' : 'pointer'
            }}
          >
            {aplicandoMasivo ? '⌛ Aplicando...' : '✅ Aplicar a seleccionados'}
          </button>

          {/* Botón destructivo: Eliminar Seleccionados (Borrado múltiple).
              Mismo permiso que el borrado individual y DESHABILITADO sin selección. */}
          {puedeEliminarMasivo() && (
            <button
              onClick={abrirConfirmacionEliminarMasivo}
              disabled={eliminandoMasivo || seleccionadosMasivos.size === 0}
              title={
                seleccionadosMasivos.size === 0
                  ? 'Selecciona al menos un equipo para eliminar'
                  : `Eliminar definitivamente ${seleccionadosMasivos.size} equipo(s)`
              }
              style={{
                height: '36px', padding: '0 18px', borderRadius: '6px',
                border: 'none',
                backgroundColor: (eliminandoMasivo || seleccionadosMasivos.size === 0) ? '#475569' : '#ef4444',
                color: (eliminandoMasivo || seleccionadosMasivos.size === 0) ? '#94a3b8' : '#ffffff',
                fontWeight: 'bold', fontSize: '13px',
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                cursor: (eliminandoMasivo || seleccionadosMasivos.size === 0) ? 'not-allowed' : 'pointer',
                opacity: seleccionadosMasivos.size === 0 ? 0.7 : 1,
                transition: 'background-color 0.2s ease, filter 0.2s ease'
              }}
            >
              <Trash2 size={15} />
              {eliminandoMasivo ? 'Eliminando...' : `Eliminar Seleccionados (${seleccionadosMasivos.size})`}
            </button>
          )}
        </div>
      )}
      <div className="table-responsive-wrapper">
        <table className={styles.leonidasTable} style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #334155' }}>
              {modoEdicion && (
                <th style={{ ...estiloCelda, width: '40px', textAlign: 'center', fontWeight: '600' }}>
                  <input
                    type="checkbox"
                    checked={datosFiltrados.length > 0 && datosFiltrados.every(d => !d.fireId || seleccionadosMasivos.has(d.fireId))}
                    onChange={toggleSeleccionarTodoVisible}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#f59e0b' }}
                    title="Seleccionar / deseleccionar todo lo visible"
                  />
                </th>
              )}
              <th style={{ ...estiloCelda, width: '50px', color: '#94a3b8', textAlign: 'center', fontWeight: '600' }}>#</th>
              <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>FECHA</th>
              {!esVendedor && <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>USUARIO</th>}
              <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>LAPTOP</th>
              <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>CARACTERÍSTICAS</th>
              <th style={{ ...estiloCelda, textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>N/STOCK</th>
              <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>N/PEDIDO</th>
              {esAdmin2 && <th style={{ ...estiloCelda, color: '#ef4444', fontWeight: '600' }}>COSTO</th>}
              <th style={{ ...estiloCelda, textAlign: 'center', color: '#60a5fa', fontWeight: '600' }}>PRECIO</th>
              {esAdmin2 && <th style={{ ...estiloCelda, color: '#00ff7f', fontWeight: '600' }}>GANANCIA</th>}
              <th style={{ ...estiloCelda, textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>ESTADO</th>
              <th style={{ ...estiloCelda, textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>ACCIONES</th>
            </tr>
          </thead>
        {useMemo(() => {
          // FUNCIÓN DE NORMALIZACIÓN SEGURA Y ÚNICA PARA TODO EL COMPONENTE
          const obtenerFechaEstandar = (item) => {
            // ✅ CORRECCIÓN: se usa la FECHA EFECTIVA (fechaVentaDe) para que las VENDIDAS
            // se ordenen por su fecha de venta/salida y NO por su fecha de registro (fechaCreacion).
            const stringFecha = String(fechaVentaDe(item) || '');
            const partes = stringFecha.split(/[-/]/); // Soporta "/" y "-"
            if (partes.length === 3) {
              let dia, mes, anio;
              if (partes[2].length === 4) { // Formato DD/MM/YYYY
                dia = partes[0]; mes = partes[1]; anio = partes[2];
              } else if (partes[0].length === 4) { // Formato YYYY-MM-DD
                anio = partes[0]; mes = partes[1]; dia = partes[2];
              }
              if (anio && mes && dia) {
                return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
              }
            }
            return '1970-01-01'; // Respaldo para evitar nulls
          };

          // 1. ORDENAMIENTO DE DOS NIVELES COHERENTE
          const datosOrdenados = [...datosFiltrados].sort((a, b) => {
            const fechaA = obtenerFechaEstandar(a);
            const fechaB = obtenerFechaEstandar(b);

            if (fechaB !== fechaA) {
              return fechaB.localeCompare(fechaA); // Ordena los días descendente
            }

            // Desempate por hora exacta
            const tiempoA = a.fechaCreacion?.toDate ? a.fechaCreacion.toDate().getTime() : 0;
            const tiempoB = b.fechaCreacion?.toDate ? b.fechaCreacion.toDate().getTime() : 0;
            return tiempoB - tiempoA;
          });

          return (
            <tbody>
              {datosOrdenados.map((item, index) => {
                const itemAnterior = index > 0 ? datosOrdenados[index - 1] : null;

                // Extraer strings normalizados de comparación de forma idéntica al sort
                const fechaActualNorm = obtenerFechaEstandar(item);
                const fechaAnteriorNorm = itemAnterior ? obtenerFechaEstandar(itemAnterior) : null;

                // Generar etiquetas legibles para la interfaz (DD/MM/AAAA)
                const formatearA_Interfaz = (isoString) => {
                  if (isoString === '1970-01-01') return 'FECHA DESCONOCIDA';
                  const [a, m, d] = isoString.split('-');
                  return `${parseInt(d, 10)}/${parseInt(m, 10)}/${a}`;
                };

                const diaActual = formatearA_Interfaz(fechaActualNorm);
                const mesActual = obtenerMesYAnio(diaActual);
                const mesAnterior = itemAnterior ? obtenerMesYAnio(formatearA_Interfaz(fechaAnteriorNorm)) : null;

                const mostrarEncabezadoMes = mesActual !== mesAnterior;
                const mostrarEncabezadoDia = fechaActualNorm !== fechaAnteriorNorm;

                const estaExpandido = diasExpandidos[String(diaActual)] !== false;

                // --- MOTOR DE MODELOS Y FILAS ORIGINALES INTACTOS ---
                const estadoStr = (item.estado || "STOCK").toUpperCase();
                const colorEstado = estadoStr === 'VENDIDO' ? '#ef4444' : estadoStr === 'SEPARADO' || estadoStr === 'PENDIENTE' ? '#f59e0b' : '#10b981';
                const tienePrecio = item.precio && Number(item.precio) > 0;
                const tieneFotos = item.imagenes && item.imagenes.length > 0;

                const marcaLimpia = item.marca ? String(item.marca).toUpperCase().trim() : '';
                const modeloLimpio = item.modelo ? String(item.modelo).toUpperCase().trim() : '';
                const esModeloAgrupable = marcaLimpia === 'ASUS' && modeloLimpio === 'E410KA-CL464'; 

                const claveModelo = `${diaActual}-${item.marca}-${item.modelo}`;
                const mismoModeloQueAnterior = itemAnterior && itemAnterior.marca === item.marca && itemAnterior.modelo === item.modelo;

                const mostrarHeaderModelo = esModeloAgrupable && !mismoModeloQueAnterior; 
                const mostrarFila = !esModeloAgrupable || modelosExpandidos[claveModelo];

      return (
        <React.Fragment key={item.fireId || index}>
          
          {/* TÍTULO DEL MES */}
          {mostrarEncabezadoMes && (
            <tr style={{ backgroundColor: '#0f172a' }}>
              <td colSpan={modoEdicion ? 13 : 12} style={{ padding: '12px', textAlign: 'center', color: '#38bdf8', fontWeight: 'bold', borderBottom: '1px solid #38bdf8', textTransform: 'uppercase' }}>
                {mesActual}
              </td>
            </tr>
          )}

          {/* FILA DESPLEGABLE DEL DÍA */}
          {mostrarEncabezadoDia && (
            <tr 
              onClick={() => toggleDia(String(diaActual))}
              style={{ backgroundColor: '#1e293b', cursor: 'pointer', borderBottom: '1px solid #334155' }}
            >
              <td colSpan={modoEdicion ? 13 : 12} style={{ padding: '10px 20px', color: '#e2e8f0', fontWeight: 'bold' }}>
                <span style={{ marginRight: '10px', color: '#38bdf8', fontSize: '14px', display: 'inline-block', width: '15px' }}>
                  {estaExpandido ? '▼' : '▶'}
                </span>
                Registros del {diaActual}
              </td>
            </tr>
          )}

         {/* --- 1. TÍTULO DEL MODELO (NUEVO SUB-DESPLEGABLE) --- */}
{estaExpandido && mostrarHeaderModelo && (
  <tr 
    onClick={() => toggleModelo(claveModelo)} 
    style={{ backgroundColor: '#0f172a', cursor: 'pointer', borderBottom: '1px solid #334155' }}
  >
    <td colSpan={modoEdicion ? 13 : 12} style={{ padding: '6px 20px', color: '#38bdf8', fontWeight: 'bold', textAlign: 'left', fontSize: '13px' }}>
      <span style={{ marginRight: '10px', display: 'inline-block', width: '15px' }}>
        {modelosExpandidos[claveModelo] ? '▼' : '▶'}
      </span>
      <strong style={{ color: obtenerColorMarca(item.marca) }}>{item.marca}</strong> {item.modelo}
    </td>
  </tr>
)}

{/* --- 2. FILA ORIGINAL DE LA LAPTOP (Normal para el resto, oculta para ASUS cerrados) --- */}
{estaExpandido && mostrarFila && (
  <tr
    title={resaltarDuplicados && serialesDuplicados.has(normalizarSerialAudit(item.serial)) ? '⚠️ Número de serie repetido en el inventario' : undefined}
    style={{ 
    backgroundColor: (modoEdicion && item.fireId && seleccionadosMasivos.has(item.fireId)) ? 'rgba(0, 255, 127, 0.18)'
      : (resaltarDuplicados && serialesDuplicados.has(normalizarSerialAudit(item.serial))) ? 'rgba(239, 68, 68, 0.22)' : 'transparent',
    boxShadow: (modoEdicion && item.fireId && seleccionadosMasivos.has(item.fireId)) ? 'inset 4px 0 0 0 #00ff7f'
      : (resaltarDuplicados && serialesDuplicados.has(normalizarSerialAudit(item.serial))) ? 'inset 4px 0 0 0 #ef4444' : 'none',
    transition: 'background-color 0.15s ease'
  }}>
                  {modoEdicion && (
                    <td style={{ ...estiloCelda, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={!!item.fireId && seleccionadosMasivos.has(item.fireId)}
                        onChange={() => toggleSeleccionMasiva(item.fireId)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#f59e0b' }}
                      />
                    </td>
                  )}
                  {/* --- CELDA # (recibe el indicador de comentario en la esquina superior izquierda) --- */}
                  <td
                    style={{ ...estiloCelda, textAlign: 'center', color: '#94a3b8', position: 'relative' }}
                    data-fila-id={item.fireId || `fila-${index}`}
                    onMouseEnter={(e) => abrirComentarioHover(e, item)}
                    onMouseLeave={cerrarComentarioHover}
                    onClick={(e) => { e.stopPropagation(); alternarComentarioClick(e, item); }}
                    className={textoComentario(item) ? styles.celdaConComentario : undefined}
                  >
                    {/* Pestaña/triángulo tipo Excel: solo si la fila tiene comentario */}
                    {!!textoComentario(item) && (
                      <span
                        data-comentario-marcador="true"
                        className={styles.marcadorComentario}
                        aria-label="Ver comentario / observación"
                      />
                    )}
                    {index + 1}
                  </td>
                  <td style={estiloCelda}>{fechaVentaDe(item)}</td>
                  {!esVendedor && <td style={{ ...estiloCelda, color: '#60a5fa' }}>
                    {nombreVendedorVisible(typeof (item.responsable || item.vendedor) === 'object'
                      ? (item.responsable || item.vendedor)?.nombre
                      : (item.responsable || item.vendedor))
                    }
                  </td>}
                  <td style={estiloCelda}><strong style={{ color: obtenerColorMarca(item.marca) }}>{item.marca}</strong> {item.modelo}</td>
                  <td style={{ ...estiloCelda, minWidth: '220px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '2px 0' }}>
                      <span style={{ fontSize: '12px' }}><strong>Proc:</strong> {item.procesador} {corregirGeneracion(item.generacion || item.gen) || ''}</span>
                      <span style={{ fontSize: '12px' }}><strong>RAM:</strong> {item.ram} | <strong>Disco:</strong> {item.almacenamiento || item.disco}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}><strong>S/N:</strong> {item.serial}</span>
                    </div>
                  </td>
                  <td style={{ ...estiloCelda, textAlign: 'center', color: '#00ff7f', fontWeight: 'bold', fontSize: '1.1rem' }}>
                    {laptops.filter(l => 
                        (l.estado || 'STOCK').toUpperCase() === 'STOCK' &&
                        (l.marca || '') === (item.marca || '') &&
                        (l.modelo || '') === (item.modelo || '') &&
                        (l.procesador || '') === (item.procesador || '') &&
                        (l.generacion || l.gen || '') === (item.generacion || item.gen || '') &&
                        (l.ram || '') === (item.ram || '') &&
                        (l.almacenamiento || l.disco || '') === (item.almacenamiento || item.disco || '') &&
                        (l.gpu || '') === (item.gpu || '')
                    ).length}
                  </td>
                  <td style={{ ...estiloCelda, textAlign: 'center', color: '#cbd5e1', fontSize: '13px', fontWeight: 'bold' }}>
  {item.n_pedido || '-'}
</td>
                  {esAdmin2 && <td style={{ ...estiloCelda, color: '#ef4444' }}>S/ {item.precio_costo || 0}</td>}
                  <td style={{ ...estiloCelda, textAlign: 'center', color: tienePrecio ? '#60a5fa' : '#ef4444', fontWeight: 'bold' }}>
                    {tienePrecio ? `S/ ${item.precio}` : 'SIN PRECIO'}
                  </td>
                  {esAdmin2 && <td style={{ ...estiloCelda, color: '#00ff7f', fontWeight: 'bold' }}>
                    S/ {(estadoStr === 'VENDIDO' ? (item.utilidad || (Number(item.precio) - Number(item.precio_costo)) || 0) : 0).toFixed(2)}
                  </td>}
                  <td style={{ ...estiloCelda, textAlign: 'center', padding: '0px 4px' }}>
                    <span style={{ color: colorEstado, fontWeight: 'bold', fontSize: '10px', border: `1px solid ${colorEstado}`, padding: '1px 5px', borderRadius: '3px', textTransform: 'uppercase' }}>
                      {estadoStr}
                    </span>
                  </td>
                  <td style={estiloCelda}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
                      <button 
                        onClick={() => tieneFotos && setModalImagen(item.imagenes)} 
                        style={{
                          opacity: tieneFotos ? 1 : 0.3,
                          cursor: tieneFotos ? 'pointer' : 'not-allowed',
                          background: 'transparent', border: 'none', fontSize: '14px', padding: '0'
                        }}
                      >
                        {tieneFotos ? '👁️' : '🚫'}
                      </button>
                      {puedeEditar(item) && (
                        <button onClick={() => activarEdicion(item)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0', fontSize: '14px' }}>✏️</button>
                      )}
                      {puedeEliminar(item) && (
                        <button onClick={() => window.confirm("¿Eliminar?") && eliminarProducto(item.fireId, item.serial)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0', fontSize: '14px' }}>🗑️</button>
                      )}
                    </div>
                  </td>
                </tr>
              )} {/* <-- CIERRE DEL DESPLEGABLE */}
        </React.Fragment>
      );
    })}
            </tbody>
          );
        }, [datosFiltrados, diasExpandidos, modelosExpandidos, esVendedor, esAdmin2, laptops, modoEdicion, seleccionadosMasivos, resaltarDuplicados, serialesDuplicados])}
        </table>
      </div>

      {/* ============================================================
          MODAL DE AUDITORÍA / CONCILIACIÓN CON EXCEL (Dark Mode)
          ============================================================ */}
      {modalAuditoria && createPortal(
        <div className={styles.overlayPeligro} onClick={() => setModalAuditoria(false)} role="presentation">
          <div className={styles.modalAuditoria} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className={styles.auditoriaCabecera}>
              <div>
                <h3>🔍 Auditoría / Conciliación de Inventario</h3>
                <p>Sube tu reporte físico (.xlsx / .csv) y lo cruzamos con el sistema por número de serie.</p>
              </div>
              <button onClick={() => setModalAuditoria(false)} className={styles.auditoriaCerrar} title="Cerrar">✕</button>
            </div>

            <div className={styles.auditoriaCuerpo}>
              {/* ---------- FILTROS PREVIOS ---------- */}
              <div className={styles.auditoriaFiltros}>
                <div className={styles.auditoriaCampo}>
                  <label>Estado del Equipo</label>
                  <select value={filtroEstadoAuditoria} onChange={(e) => setFiltroEstadoAuditoria(e.target.value)}>
                    <option value="TODOS">TODOS</option>
                    <option value="STOCK">🟢 STOCK</option>
                    <option value="VENDIDOS">🔴 VENDIDOS</option>
                  </select>
                </div>
                <div className={styles.auditoriaCampo}>
                  <label>Marca</label>
                  <input list="marcas-auditoria" value={filtroMarcaAuditoria}
                    onChange={(e) => setFiltroMarcaAuditoria(e.target.value)}
                    placeholder="LENOVO, HP, DELL, ASUS..." />
                  <datalist id="marcas-auditoria">
                    {marcasDisponibles.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>
                <div className={styles.auditoriaCampo}>
                  <label>Modelo</label>
                  <input list="modelos-auditoria" value={filtroModeloAuditoria}
                    onChange={(e) => setFiltroModeloAuditoria(e.target.value)}
                    placeholder="IDEAPAD 1, THINKPAD E15, 15-FD0XXX..." />
                  <datalist id="modelos-auditoria">
                    {modelosDisponibles.map(m => <option key={m} value={m} />)}
                  </datalist>
                </div>
              </div>
              <small className={styles.auditoriaNota}>
                Con estos filtros se auditan <strong>{inventarioFiltradoAuditoria.length}</strong> equipo(s) del sistema.
              </small>

              {/* ---------- ZONA DRAG & DROP ---------- */}
              <label
                className={styles.zonaDrop}
                onDragOver={(e) => { e.preventDefault(); setArrastrandoArchivo(true); }}
                onDragLeave={() => setArrastrandoArchivo(false)}
                onDrop={(e) => { e.preventDefault(); setArrastrandoArchivo(false); procesarArchivoAuditoria(e.dataTransfer.files?.[0]); }}
              >
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
                  onChange={(e) => procesarArchivoAuditoria(e.target.files?.[0])} />
                {procesandoArchivo ? (
                  <span>⏳ Procesando archivo...</span>
                ) : (
                  <>
                    <strong>📂 Arrastra tu archivo Excel aquí</strong>
                    <span>o haz clic para buscarlo — Formatos: .xlsx, .xls, .csv</span>
                    {nombreArchivo && <em>Archivo cargado: {nombreArchivo}</em>}
                  </>
                )}
              </label>

              {/* ---------- PESTAÑAS ---------- */}
              {nombreArchivo && (
                <div className={styles.auditoriaPestanas}>
                  <button className={`${styles.pestanaAuditoria} ${pestanaAuditoria === 'coincidentes' ? styles.pestanaOk : ''}`}
                    onClick={() => setPestanaAuditoria('coincidentes')}>
                    <CheckCircle2 size={15} /> ✅ Coincidentes ({resultadosAuditoria.coincidentes.length})
                  </button>
                  <button className={`${styles.pestanaAuditoria} ${pestanaAuditoria === 'faltantesSistema' ? styles.pestanaWarn : ''}`}
                    onClick={() => setPestanaAuditoria('faltantesSistema')}>
                    <PlusCircle size={15} /> ⚠️ Faltan en Sistema ({resultadosAuditoria.faltantesSistema.length})
                  </button>
                  <button className={`${styles.pestanaAuditoria} ${pestanaAuditoria === 'faltantesExcel' ? styles.pestanaError : ''}`}
                    onClick={() => setPestanaAuditoria('faltantesExcel')}>
                    <XCircle size={15} /> ❌ Faltan en Físico/Excel ({resultadosAuditoria.faltantesExcel.length})
                  </button>
                </div>
              )}
              {/* ---------- RESULTADOS ---------- */}
              {nombreArchivo && (
                <div className={styles.auditoriaResultados}>
                  {pestanaAuditoria === 'coincidentes' && (
                    <table className={styles.tablaAuditoria}>
                      <thead><tr><th>N° de Serie</th><th>Modelo (Excel)</th><th>Modelo (Sistema)</th><th>Detalle</th></tr></thead>
                      <tbody>
                        {resultadosAuditoria.coincidentes.length === 0 ? (
                          <tr><td colSpan="4" className={styles.celdaVacia}>Sin coincidencias.</td></tr>
                        ) : resultadosAuditoria.coincidentes.map((r, i) => (
                          <tr key={`${r.serial}-${i}`}>
                            <td className={styles.serieAuditoria}>{r.serial}</td>
                            <td>{r.excel.modelo || '—'}</td>
                            <td>{r.bd.modelo || '—'}</td>
                            <td>
                              <span className={r.coincideModelo ? styles.etiquetaOk : styles.etiquetaWarn}>
                                {r.coincideModelo ? 'OK' : 'Revisar modelo'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {pestanaAuditoria === 'faltantesSistema' && (
                    <>
                      <div className={styles.auditoriaAcciones}>
                        <button className={styles.btnSecundario}
                          onClick={() => setSeleccionFaltantes(new Set(resultadosAuditoria.faltantesSistema.map(f => f.serial)))}>
                          Seleccionar todos
                        </button>
                        <button className={styles.btnSecundario} onClick={() => setSeleccionFaltantes(new Set())}>
                          Deseleccionar
                        </button>
                        <button className={styles.btnPrimario} onClick={registrarFaltantesSeleccionados}
                          disabled={seleccionFaltantes.size === 0 || registrandoFaltantes}>
                          {registrandoFaltantes ? '⌛ Registrando...' : `➕ Registrar Selección (${seleccionFaltantes.size})`}
                        </button>
                      </div>
                      <table className={styles.tablaAuditoria}>
                        <thead><tr><th style={{ width: '40px' }}></th><th>N° de Serie (Excel)</th><th>Marca</th><th>Modelo</th></tr></thead>
                        <tbody>
                          {resultadosAuditoria.faltantesSistema.length === 0 ? (
                            <tr><td colSpan="4" className={styles.celdaVacia}>Todo el Excel ya está registrado.</td></tr>
                          ) : resultadosAuditoria.faltantesSistema.map((r, i) => (
                            <tr key={`${r.serial}-${i}`}>
                              <td style={{ textAlign: 'center' }}>
                                <input type="checkbox" checked={seleccionFaltantes.has(r.serial)}
                                  onChange={() => alternarSeleccionFaltante(r.serial)}
                                  style={{ width: '16px', height: '16px', accentColor: '#f59e0b', cursor: 'pointer' }} />
                              </td>
                              <td className={styles.serieAuditoria}>{r.serial}</td>
                              <td>{r.excel.marca || '—'}</td>
                              <td>{r.excel.modelo || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {pestanaAuditoria === 'faltantesExcel' && (
                    <table className={styles.tablaAuditoria}>
                      <thead><tr><th>N° de Serie (Sistema)</th><th>Marca</th><th>Modelo</th><th>Estado</th></tr></thead>
                      <tbody>
                        {resultadosAuditoria.faltantesExcel.length === 0 ? (
                          <tr><td colSpan="4" className={styles.celdaVacia}>Todo el sistema aparece en el archivo.</td></tr>
                        ) : resultadosAuditoria.faltantesExcel.map((r, i) => (
                          <tr key={`${r.serial}-${i}`}>
                            <td className={styles.serieAuditoria}>{r.serial}</td>
                            <td>{r.bd.marca || '—'}</td>
                            <td>{r.bd.modelo || '—'}</td>
                            <td>{(r.bd.estado || 'STOCK').toUpperCase()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================
          MODAL DE CONFIRMACIÓN DE ELIMINACIÓN MASIVA (Dark Mode)
          Montado con createPortal para que el position:fixed se ancle a la
          ventana real y no a un contenedor con transform (fade-in).
          ============================================================ */}
      {modalEliminarMasivo && createPortal(
        <div
          className={styles.overlayPeligro}
          onClick={() => !eliminandoMasivo && setModalEliminarMasivo(false)}
          role="presentation"
        >
          <div
            className={styles.modalPeligro}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-eliminar-masivo"
          >
            <h3 id="titulo-eliminar-masivo" className={styles.modalPeligroTitulo}>
              ⚠️ Confirmar Eliminación Masiva
            </h3>

            <p className={styles.modalPeligroMensaje}>
              ¿Estás seguro de que deseas eliminar definitivamente los{' '}
              <strong>{seleccionadosMasivos.size}</strong> equipos seleccionados?
              Esta acción no se puede deshacer.
            </p>

            {/* Resumen de lo que se va a borrar (seriales, para revisar antes de confirmar) */}
            <div className={styles.modalPeligroDetalle}>
              <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.6px', textTransform: 'uppercase', color: '#94a3b8' }}>
                Equipos a eliminar
              </span>
              <div className={styles.modalPeligroLista}>
                {(laptops || [])
                  .filter(l => l.fireId && seleccionadosMasivos.has(l.fireId))
                  .slice(0, 50)
                  .map(l => (
                    <span key={l.fireId} className={styles.modalPeligroChip}>
                      {l.serial || 'S/N'} · {l.marca} {l.modelo}
                    </span>
                  ))}
                {seleccionadosMasivos.size > 50 && (
                  <span className={styles.modalPeligroChip}>
                    …y {seleccionadosMasivos.size - 50} más
                  </span>
                )}
              </div>
            </div>

            <div className={styles.modalPeligroAcciones}>
              <button
                onClick={() => setModalEliminarMasivo(false)}
                disabled={eliminandoMasivo}
                className={`${styles.modalPeligroBtn} ${styles.modalPeligroBtnCancelar}`}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminarMasivo}
                disabled={eliminandoMasivo || seleccionadosMasivos.size === 0}
                className={`${styles.modalPeligroBtn} ${styles.modalPeligroBtnConfirmar}`}
              >
                {eliminandoMasivo
                  ? '⌛ Eliminando...'
                  : `Sí, eliminar ${seleccionadosMasivos.size} equipo${seleccionadosMasivos.size === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* TOAST de resultado (éxito / error) de la eliminación masiva */}
      {notificacionMasiva && createPortal(
        <div className={styles.toastContainer} role="status">
          <div
            className={`${styles.toast} ${notificacionMasiva.tipo === 'error' ? styles.toastError : styles.toastExito}`}
          >
            {notificacionMasiva.texto}
          </div>
        </div>,
        document.body
      )}

      {/* ============================================================
          POPOVER DE COMENTARIO / OBSERVACIÓN (tema oscuro)
          Se posiciona justo debajo de la celda # para no tapar la fila.
          Se cierra al salir del cursor, al hacer clic fuera o con ESC.
          ============================================================ */}
      {/* El popover se monta en document.body con createPortal: así el position:fixed
          se ancla a la ventana real y no a un contenedor con transform (fade-in),
          que es el mismo motivo por el que los modales del proyecto se portalean. */}
      {comentarioVisible && createPortal(
        <div
          ref={refContenedorPopover}
          className={styles.popoverComentario}
          style={{ left: comentarioVisible.x, top: comentarioVisible.y }}
        >
          <div className={styles.popoverTitulo}>
            <span>💬 Comentario</span>
            <button
              onClick={() => { setComentarioFijado(null); setComentarioHover(null); }}
              title="Cerrar"
              className={styles.popoverCerrar}
            >✕</button>
          </div>
          <div>{comentarioVisible.texto}</div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default HojaReportes;
