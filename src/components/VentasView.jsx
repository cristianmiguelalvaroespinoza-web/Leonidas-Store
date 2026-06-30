import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import React, { useState, useMemo, useEffect } from 'react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import AlmacenTabla from './AlmacenTabla';
import { X, Printer, User, MapPin, CheckCircle, FileText, CalendarDays, Search, RotateCcw, Shield, QrCode, FileDown, DollarSign } from 'lucide-react';
import './VentasView.css';
import logoFinpro from '../assets/logo-finpro.png'; // Importamos el logo
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

const VentasView = ({
  laptops,
  usuarioLogueado,
  setModalImagen,
  setFotoActual,
  activarEdicion,
  manejarEliminar,
  manejarGeneracionReporte,
  tienePermiso, // <-- NUEVA PROP
  iniciarEscaneo
}) => {
  const [garantiaVenta, setGarantiaVenta] = useState("12 MESES");
  const [cargando, setCargando] = useState(false);
  const [busquedaVentas, setBusquedaVentas] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState("TODOS");
  const [filtroTiempo, setFiltroTiempo] = useState("TODAS");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [laptopsSeleccionadas, setLaptopsSeleccionadas] = useState([]);
  const [equipoDetalle, setEquipoDetalle] = useState(null);
  const [mostrarInforme, setMostrarInforme] = useState(false);
  const [modoVenta, setModoVenta] = useState(true);
  const [nombreCliente, setNombreCliente] = useState("");
  const [dniCliente, setDniCliente] = useState("");
  const [origenVenta, setOrigenVenta] = useState("LIMA"); // Origen fijo: Lima (no editable)
  const [destinoVenta, setDestinoVenta] = useState(""); // Destino opcional: si se llena, se despacha junto con la venta

  // --- NUEVOS ESTADOS PARA EL PANEL DE DESPACHO ---
  const [cargandoDespacho, setCargandoDespacho] = useState(null);
  const [destinosDespacho, setDestinosDespacho] = useState({});
  const [mostrarPanelDespacho, setMostrarPanelDespacho] = useState(false);
  const [despachosSeleccionados, setDespachosSeleccionados] = useState([]);

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


  const manejarVentaProxima = (laptop) => {
    setEquipoDetalle(laptop);
    setLaptopsSeleccionadas([]);
    setMostrarInforme(true);
    setModoVenta(false);
    setNombreCliente("");
    setDniCliente("");
    setOrigenVenta("LIMA");
    setDestinoVenta("");
  };

  const limpiarFiltros = () => {
    setBusquedaVentas("");
    setFiltroFecha("");
    setFiltroVendedor("TODOS");
    setFiltroTiempo("TODAS");
  };

  // Para alternar la selección de un equipo
  const toggleSeleccion = (laptop) => {
    if (laptopsSeleccionadas.find(l => l.fireId === laptop.fireId)) {
      setLaptopsSeleccionadas(laptopsSeleccionadas.filter(l => l.fireId !== laptop.fireId));
    } else {
      setLaptopsSeleccionadas([...laptopsSeleccionadas, laptop]);
    }
  };

  const toggleSeleccionDespacho = (laptop) => {
    if (despachosSeleccionados.find(l => l.fireId === laptop.fireId)) {
      setDespachosSeleccionados(despachosSeleccionados.filter(l => l.fireId !== laptop.fireId));
    } else {
      setDespachosSeleccionados([...despachosSeleccionados, laptop]);
    }
  };
  const descargarPDF = async () => {
    const elemento = document.querySelector(".contenedor-boleta-formal");
    if(!elemento) return;

    const botones = document.querySelector(".grupo-botones-boleta-no-imprimir");
    const botonX = document.querySelector(".btn-cerrar-boleta-esquina");
    const inputsVenta = document.querySelector(".contenedor-confirmar-venta-formal");

    if(botones) botones.style.display = 'none';
    if(botonX) botonX.style.display = 'none';
    if(inputsVenta) inputsVenta.style.display = 'none';

    try {
      const canvas = await html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 800
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = 190;
      const marginX = (pdfWidth - imgWidth) / 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", marginX, 10, imgWidth, imgHeight);
      pdf.save(`Boleta_FINPRO_${nombreCliente.replace(/\s+/g, '_') || 'Cliente'}.pdf`);
    } catch (error) {
      console.error("Error al generar PDF:", error);
    } finally {
      if(botones) botones.style.display = 'flex';
      if(botonX) botonX.style.display = 'block';
      if(inputsVenta && modoVenta) inputsVenta.style.display = 'block';
    }
  };

  const finalizarVentaYActualizar = async () => {
    if (!nombreCliente.trim()) {
      alert("Por favor, ingresa el nombre del cliente.");
      return;
    }

    const isIndividualSale = equipoDetalle !== null && laptopsSeleccionadas.length === 0;
    const listaVenta = isIndividualSale ? [equipoDetalle] : laptopsSeleccionadas;

    if (listaVenta.length === 0) {
      alert("Error: No se seleccionó ningún equipo para la venta.");
      return;
    }

    await descargarPDF();

    try {
      setCargando(true);
      
      const numeroBoletaBase = `B${String(proximoNumeroBoleta).padStart(3, '0')}`;
      
      // Se genera un único número de boleta para toda la transacción (sea individual o lote)
      const numeroBoletaCompleto = listaVenta.length > 1
        ? `${numeroBoletaBase}-LOTE-${listaVenta.length}`
        // Usamos el ID del primer (y único) item para ventas individuales
        : `${numeroBoletaBase}-${(listaVenta[0].fireId || listaVenta[0].id).substring(0,6).toUpperCase()}`;

      await Promise.all(listaVenta.map(async (laptop) => {
  const laptopId = laptop.fireId || laptop.id;
  if (!laptopId) throw new Error("ID de equipo no encontrado.");

  const equipoRef = doc(db, "inventario", laptopId.trim());

  return updateDoc(equipoRef, {
    estado: "VENDIDO",
    cliente: nombreCliente.toUpperCase(),
    dni: dniCliente.toUpperCase(),
    fecha_venta: new Date().toLocaleDateString('es-PE'),
    // Si el usuario no escribió nada, se guarda LIMA por defecto
    destino: destinoVenta.trim() === "" ? "LIMA" : destinoVenta.toUpperCase(),
    vendedor_final: usuarioLogueado?.nombre || "Sistema",
    responsable_venta: usuarioLogueado?.nombre || "Sin asignar",
    
    // --- ESTA ES LA UNIFICACIÓN ---
    estado_despacho: 'DESPACHADO', 
    fecha_despacho: new Date().toLocaleDateString('es-PE'),
    responsable_despacho: usuarioLogueado?.nombre || "Sistema",
    // Guardamos el número de boleta en cada equipo vendido
    numero_boleta: numeroBoletaCompleto
  });
      }));

      alert(`¡Venta registrada! ${listaVenta.length} equipo(s) ya no aparecerán en stock.`);

      setMostrarInforme(false);
      setEquipoDetalle(null);
      setLaptopsSeleccionadas([]);
      setModoVenta(false);
      setNombreCliente("");
      setDniCliente("");
      setDestinoVenta("LIMA");

    } catch (error) {
      console.error("Error al actualizar:", error);
      alert("Falló la conexión con la base de datos: " + error.message);
    } finally {
      setCargando(false);
    }
  };

  const descargarExcelVentas = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Reporte_Ventas");

      // 1. Armar las columnas base dinámicamente
      const columns = [
        { header: 'N°', key: 'index', width: 6 },
        { header: 'FECHA', key: 'fecha', width: 15 },
        { header: 'VENDEDOR', key: 'vendedor', width: 20 },
        { header: 'MARCA', key: 'marca', width: 15 },
        { header: 'MODELO', key: 'modelo', width: 25 },
        { header: 'PROCESADOR', key: 'procesador', width: 35 },
        { header: 'RAM', key: 'ram', width: 15 },
        { header: 'GPU', key: 'gpu', width: 20 },
        { header: 'DISCO', key: 'disco', width: 15 },
        { header: 'SERIAL', key: 'serial', width: 20 }
      ];

      // Insertar columnas privadas de Super Admin
      if (usuarioLogueado?.rol === 'super_admin') {
        columns.push({ header: 'COSTO', key: 'costo', width: 15 });
      }
      columns.push({ header: 'PRECIO', key: 'precio', width: 15 });
      
      if (usuarioLogueado?.rol === 'super_admin') {
        columns.push({ header: 'UTILIDAD', key: 'utilidad', width: 15 });
      }
      columns.push({ header: 'ESTADO', key: 'estado', width: 15 });

      worksheet.columns = columns;

      // 2. Pintar el encabezado (Fondo oscuro, letras celestes)
      worksheet.getRow(1).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } }, bottom: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } } };
      });

      // 3. Procesar las filas y pintarlas (Fondo gris oscuro, letras blancas)
      ventasOrdenadas.forEach((l, i) => {
        const rowData = {
          index: i + 1,
          fecha: l.fecha,
          vendedor: l.responsable || l.vendedor,
          marca: l.marca,
          modelo: l.modelo,
          procesador: `${l.procesador || ''} ${l.generacion || l.gen || ''}`.trim() || 'N/A',
          ram: l.ram || 'N/A',
          gpu: l.gpu || 'N/A',
          disco: l.almacenamiento || l.disco || 'N/A',
          serial: l.serial,
          precio: l.precio || 0,
          estado: l.estado || "STOCK"
        };

        if (usuarioLogueado?.rol === 'super_admin') {
          rowData.costo = l.precio_costo || 0;
          rowData.utilidad = l.utilidad || 0;
        }

        const row = worksheet.addRow(rowData);

        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
          cell.font = { color: { argb: 'FF000000' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { top: { style: 'thin', color: { argb: 'FF000000' } }, left: { style: 'thin', color: { argb: 'FF000000' } }, bottom: { style: 'thin', color: { argb: 'FF000000' } }, right: { style: 'thin', color: { argb: 'FF000000' } } };
        });
      });

      // 4. Exportar el archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const fechaLimpia = new Date().toLocaleDateString().replace(/\//g, '-');
      saveAs(blob, `LeonidasStore_Ventas_${fechaLimpia}.xlsx`);

    } catch (e) {
      console.error(e);
      alert("Error al exportar Reporte de Ventas");
    }
  };

  const manejarDespacho = async (laptop) => {
    const laptopId = laptop.fireId || laptop.id;
    const nuevoDestino = destinosDespacho[laptopId];

    if (!nuevoDestino || !nuevoDestino.trim()) {
        alert("Por favor, ingrese un destino para despachar.");
        return;
    }

    setCargandoDespacho(laptopId);
    try {
        const equipoRef = doc(db, "inventario", laptopId.trim());
        await updateDoc(equipoRef, {
            destino: nuevoDestino.toUpperCase(),
            estado_despacho: 'DESPACHADO',
            fecha_despacho: new Date().toLocaleDateString('es-PE'),
            responsable_despacho: usuarioLogueado?.nombre
        });
        alert(`Equipo ${laptop.serial} despachado a ${nuevoDestino.toUpperCase()}.`);
    } catch (error) {
        console.error("Error al despachar:", error);
        alert("Falló la conexión con la base de datos al intentar despachar: " + error.message);
    } finally {
        setCargandoDespacho(null);
    }
  };

  const manejarDespachoLote = async () => {
    const nuevoDestino = destinosDespacho['LOTE']; // Usamos una clave especial para el destino del lote
    if (despachosSeleccionados.length === 0) {
      alert("No ha seleccionado ningún equipo para despachar en lote.");
      return;
    }
    if (!nuevoDestino || !nuevoDestino.trim()) {
      alert("Por favor, ingrese un destino para el lote.");
      return;
    }

    if (!window.confirm(`¿Está seguro de despachar ${despachosSeleccionados.length} equipos a ${nuevoDestino.toUpperCase()}?`)) {
      return;
    }

    setCargandoDespacho('LOTE'); // Usamos una clave especial para el estado de carga del lote
    try {
      await Promise.all(despachosSeleccionados.map(async (laptop) => {
        const laptopId = laptop.fireId || laptop.id;
        const equipoRef = doc(db, "inventario", laptopId.trim());
        return updateDoc(equipoRef, {
          destino: nuevoDestino.toUpperCase(),
          estado_despacho: 'DESPACHADO',
          fecha_despacho: new Date().toLocaleDateString('es-PE'),
          responsable_despacho: usuarioLogueado?.nombre
        });
      }));
      alert(`¡Lote de ${despachosSeleccionados.length} equipos despachado a ${nuevoDestino.toUpperCase()}!`);
      setDespachosSeleccionados([]);
      setDestinosDespacho(prev => {
        const newDestinos = { ...prev };
        delete newDestinos['LOTE'];
        return newDestinos;
      });
    } catch (error) {
      console.error("Error al despachar lote:", error);
      alert("Falló la conexión con la base de datos al intentar despachar el lote: " + error.message);
    } finally {
      setCargandoDespacho(null);
    }
  };


  const ventasFiltradas = laptops.filter(lap => {
    const estaEnStock = (lap.estado || "STOCK").toUpperCase() === 'STOCK';
    const tienePrecioValido = lap.precio && Number(lap.precio) > 0;

    if (!estaEnStock) return false;

    // Filtro por Vendedor (movido desde AlmacenTabla)
    const nombreVendedor = String(lap.responsable || lap.vendedor || "").toUpperCase();
    const pasaVendedor = filtroVendedor === "TODOS" || nombreVendedor.includes(filtroVendedor);
    if (!pasaVendedor) return false;

    // Filtro por Tiempo (movido desde AlmacenTabla)
    if (filtroTiempo !== "TODAS") {
      const fechaStr = lap.fechaIngreso || lap.fecha || "";
      const [diaStr, mesStr, anioStr] = fechaStr.split('/');
      
      if (diaStr && mesStr && anioStr) {
        const dia = parseInt(diaStr, 10);
        const mes = parseInt(mesStr, 10);
        const anio = parseInt(anioStr, 10);
        const hoy = new Date();

        if (filtroTiempo === "HOY") {
          if (dia !== hoy.getDate() || mes !== (hoy.getMonth() + 1) || anio !== hoy.getFullYear()) return false;
        } 
        else if (filtroTiempo === "ESTE_ANIO") {
          if (anio !== 2026) return false;
        }
      } else {
        return false; // Si no hay fecha válida, no pasa el filtro de tiempo
      }
    }

    // Filtro por fecha exacta (calendario de día)
    if (filtroFecha) {
      const [year, month, day] = filtroFecha.split('-');
      // Normalizamos la fecha del input para que coincida con el formato DD/MM/YYYY
      // Aseguramos que no haya ceros a la izquierda para la comparación
      const f1 = `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;

      // También creamos una versión con ceros por si el formato en la BD es estricto
      const pad = (num) => String(num).padStart(2, '0');
      const f2 = `${pad(day)}/${pad(month)}/${year}`;

      const fechaParaFiltrar = lap.fechaIngreso || lap.fecha;

      // Comparamos con ambos formatos por seguridad
      if (fechaParaFiltrar !== f1 && fechaParaFiltrar !== f2) {
        return false;
      }
    }
    const texto = busquedaVentas.toLowerCase();

    return (
      lap.marca?.toLowerCase().includes(texto) ||
      lap.modelo?.toLowerCase().includes(texto) ||
      lap.procesador?.toLowerCase().includes(texto) ||
      lap.ram?.toLowerCase().includes(texto) ||
      lap.disco?.toLowerCase().includes(texto) ||
      lap.gpu?.toLowerCase().includes(texto) ||
      lap.serial?.toLowerCase().includes(texto) ||
      lap.id?.toLowerCase().includes(texto)
    );
  });

  const laptopsParaDespacho = useMemo(() =>
    laptops.filter(l =>
      l.estado?.toUpperCase() === 'VENDIDO' &&
      (l.estado_despacho === 'PENDIENTE' || !l.estado_despacho)
    )
  , [laptops]);

  // Ordenamiento cronológico ANTES de la paginación
  const ventasOrdenadas = useMemo(() => {
    // Esta función es más robusta para leer fechas en formatos DD/MM/YYYY o YYYY-MM-DD
    // y también considera la hora para un ordenamiento más preciso.
    const obtenerFechaYHoraCompleta = (item) => {
      const fechaStr = item.fechaIngreso || item.fecha;
      const horaStr = item.hora_venta || item.hora; // Asumimos que podría existir una hora

      if (!fechaStr || typeof fechaStr !== 'string') return null;

      let dia, mes, anio;
      const separador = fechaStr.includes('/') ? '/' : fechaStr.includes('-') ? '-' : null;

      if (!separador) { // Si no hay separador, podría ser un formato inválido
          const d = new Date(fechaStr);
          if (!isNaN(d.getTime())) return d;
          return null;
      }

      const partes = fechaStr.split(separador);
      if (partes.length !== 3) return null;

      // Formato YYYY-MM-DD
      if (separador === '-' && partes[0].length === 4) {
        anio = parseInt(partes[0], 10);
        mes = parseInt(partes[1], 10);
        dia = parseInt(partes[2], 10);
      } 
      // Formato DD/MM/YYYY
      else if (partes[2].length === 4) {
        dia = parseInt(partes[0], 10);
        mes = parseInt(partes[1], 10);
        anio = parseInt(partes[2], 10);
      } else {
        return null; // Formato no reconocido
      }

      if (isNaN(dia) || isNaN(mes) || isNaN(anio)) return null;

      let horas = 0, minutos = 0;
      if (horaStr) {
        const match12h = horaStr.toLowerCase().match(/(\d+):(\d+)\s*([ap])\.?m?\.?/);
        if (match12h) {
          horas = parseInt(match12h[1], 10);
          minutos = parseInt(match12h[2], 10);
          const periodo = match12h[3];
          if (periodo === 'p' && horas < 12) horas += 12;
          if (periodo === 'a' && horas === 12) horas = 0;
        } else {
          const match24h = horaStr.match(/(\d+):(\d+)/);
          if (match24h) {
            horas = parseInt(match24h[1], 10);
            minutos = parseInt(match24h[2], 10);
          }
        }
      }
      // El mes en new Date() es 0-indexado (0-11)
      return new Date(anio, mes - 1, dia, horas, minutos);
    };

    return [...ventasFiltradas].sort((a, b) => {
      const fechaA = obtenerFechaYHoraCompleta(a);
      const fechaB = obtenerFechaYHoraCompleta(b);

      // Si alguna fecha no es válida, la mandamos al final.
      if (!fechaA) return 1;
      if (!fechaB) return -1;

      return fechaB.getTime() - fechaA.getTime(); // De más reciente a más antiguo
    });
  }, [ventasFiltradas]);

  // Resetear paginación al cambiar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [busquedaVentas, filtroFecha, filtroVendedor, filtroTiempo]);

  return (
    <div className="ventas-view-container fade-in">
      <div className="section-header">
        <h2 style={{ color: '#fff', margin: 0 }}>💼 GESTIÓN DE VENTAS</h2>
        <div className="header-controls-ventas mobile-stack">
          <button className="btn-ver-todo-ventas" onClick={limpiarFiltros}>
            <RotateCcw size={16} /> Ver Todo
          </button>

          {/* --- FILTROS MOVIDOS DESDE ALMACENTABLA --- */}
          <select 
            value={filtroVendedor}
            onChange={(e) => setFiltroVendedor(e.target.value)}
            className="select-filtro-ventas"
          >
            <option value="TODOS">👤 Todos los Usuarios</option>
            <option value="LEONIDAS">Leonidas</option>
            <option value="CRISTOFER">Cristofer</option>
            <option value="DAVID">David</option>
            <option value="YAEL">Yael</option>
            <option value="PERSONAL ADMINISTRADOR">Administrador</option>
          </select>

          <select 
            value={filtroTiempo}
            onChange={(e) => {
              setFiltroTiempo(e.target.value);
              // Limpiamos el filtro de fecha si se elige algo que no sea por día
              if (e.target.value !== 'DIA') {
                setFiltroFecha('');
              }
            }}
            className="select-filtro-ventas"
          >
            <option value="TODAS">📅 Todas las Fechas</option>
            <option value="HOY">📅 Hoy</option>
            <option value="ESTE_ANIO">📅 Este Año (2026)</option>
            <option value="DIA">📅 Elegir Día...</option>
          </select>

          {/* El calendario de día solo aparece si se elige "Elegir Día..." */}
          {filtroTiempo === 'DIA' && (
            <div className="calendar-box-ventas">
              <input
                type="date"
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
                className="input-calendar-ventas"
              />
            </div>
          )}

          <button 
            onClick={descargarExcelVentas}
            className="btn-excel-download" 
          >
            <FileDown size={16} /> Descargar ({ventasOrdenadas.length})
          </button>
          <div className="search-box-ventas">
            {busquedaVentas === "" && (
              <Search size={18} className="search-icon" />
            )}
            <input
              type="text"
              placeholder="Buscar laptop..."
              value={busquedaVentas}
              onChange={(e) => setBusquedaVentas(e.target.value)}
              className={`input-busqueda-ventas ${busquedaVentas === "" ? "con-lupa" : "sin-lupa"}`}
            />
            <button 
              onClick={() => iniciarEscaneo(setBusquedaVentas)} 
              title="Escanear código de barras o QR"
              style={{
                position: 'absolute',
                right: '10px',
                background: 'transparent',
                border: 'none',
                color: '#8b949e',
                cursor: 'pointer',
                padding: 0,
                display: 'flex'
              }}
            >
              <QrCode size={18} />
            </button>
          </div>
        </div>
      </div>

      {laptopsSeleccionadas.length > 0 && (
        <div className="bar-multiventa mobile-stack" style={{ background: '#1e293b', padding: '15px', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#fff' }}>
            Has seleccionado <b>{laptopsSeleccionadas.length}</b> equipos.
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              className="btn-vender-masivo"
              onClick={() => setMostrarInforme(true)}
              style={{ background: '#00ff7f', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <DollarSign size={18} /> VENDER LOTE
            </button>
            <button
              className="btn-cancelar-lote"
              onClick={() => setLaptopsSeleccionadas([])}
              style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <X size={18} /> CANCELAR
            </button>
          </div>
        </div>
      )}
      <div className="table-wrapper-global">
        <AlmacenTabla
          laptops={ventasOrdenadas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)}
          usuarioLogueado={usuarioLogueado}
          setModalImagen={setModalImagen}
          onVenderClick={manejarVentaProxima}
          activarEdicion={activarEdicion}
          manejarEliminar={manejarEliminar}
          laptopsSeleccionadas={laptopsSeleccionadas}
          toggleSeleccion={toggleSeleccion}
          modoVentas={true}
          busqueda={busquedaVentas}
          tienePermiso={tienePermiso}
        />
      </div>
      {Math.ceil(ventasOrdenadas.length / itemsPerPage) > 1 && (
        <div className="paginacion-container">
          <span className="paginacion-info">
            Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, ventasOrdenadas.length)}-{Math.min(currentPage * itemsPerPage, ventasOrdenadas.length)} de {ventasOrdenadas.length} registros
          </span>
          <div className="paginacion-botones">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
              « Primero
            </button>
            <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
              ‹ Anterior
            </button>
            <span className="paginacion-pagina-actual">
              Página {currentPage} de {Math.ceil(ventasOrdenadas.length / itemsPerPage)}
            </span>
            <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(ventasOrdenadas.length / itemsPerPage)))} disabled={currentPage === Math.ceil(ventasOrdenadas.length / itemsPerPage)}>
              Siguiente ›
            </button>
            <button onClick={() => setCurrentPage(Math.ceil(ventasOrdenadas.length / itemsPerPage))} disabled={currentPage === Math.ceil(ventasOrdenadas.length / itemsPerPage)}>
              Último »
            </button>
          </div>
        </div>
      )}

      {/* ================================== */}
      {/* MODAL DE PANEL DE DESPACHO         */}
      {/* ================================== */}
      {mostrarPanelDespacho && (
        <div className="overlay-informe-leonidas">
          <div className="dispatch-section" style={{ width: '90%', maxWidth: '1200px', margin: 'auto', background: '#0f172a', padding: '20px', borderRadius: '8px', border: '1px solid #334155', position: 'relative' }}>
            <button className="btn-cerrar-boleta-esquina" onClick={() => setMostrarPanelDespacho(false)}>
              <X size={24} />
            </button>
            <h2 style={{ color: '#fff', borderBottom: '1px solid #334155', paddingBottom: '15px', marginBottom: '20px' }}>
              🚚 Panel de salidas Pendientes ({laptopsParaDespacho.length})
            </h2>

            {/* --- CONTROLES PARA DESPACHO EN LOTE --- */}
            {despachosSeleccionados.length > 0 && (
              <div className="bar-multiventa" style={{ background: '#1e293b', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                <span style={{ color: '#fff' }}>
                  <b>{despachosSeleccionados.length}</b> equipos seleccionados para despacho.
                </span>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Destino del Lote..."
                    value={destinosDespacho['LOTE'] || ''}
                    onChange={(e) => setDestinosDespacho(prev => ({ ...prev, 'LOTE': e.target.value }))}
                    style={{
                      background: '#0f172a',
                      border: '1px solid #334155',
                      color: 'white',
                      borderRadius: '4px',
                      padding: '10px',
                      width: '200px'
                    }}
                  />
                  <button
                    className="btn-vender-masivo"
                    onClick={manejarDespachoLote}
                    disabled={cargandoDespacho === 'LOTE'}
                    style={{ background: '#3b82f6', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {cargandoDespacho === 'LOTE' ? 'Enviando...' : `🚚 DESPACHAR LOTE`}
                  </button>
                </div>
              </div>
            )}

            <div className="table-wrapper-global" style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="excel-table" style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #334155', textAlign: 'left' }}>
                    <th style={{ padding: '10px', width: '40px' }}>
                       {/* Checkbox para seleccionar todos (opcional, no implementado para simplicidad) */}
                    </th>
                    <th style={{ padding: '10px', color: '#94a3b8' }}>Fecha Venta</th>
                    <th style={{ padding: '10px', color: '#94a3b8' }}>Cliente</th>
                    <th style={{ padding: '10px', color: '#94a3b8' }}>Equipo</th>
                    <th style={{ padding: '10px', color: '#94a3b8' }}>Destino Actual</th>
                    <th style={{ padding: '10px', color: '#94a3b8', width: '200px' }}>Nuevo Destino (Individual)</th>
                    <th style={{ padding: '10px', color: '#94a3b8', textAlign: 'center' }}>Acción Individual</th>
                  </tr>
                </thead>
                <tbody>
                  {laptopsParaDespacho.length > 0 ? (
                    laptopsParaDespacho.map(laptop => (
                      <tr key={laptop.fireId} className="row-hover-simple">
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            className="custom-checkbox-despacho"
                            checked={despachosSeleccionados.some(l => l.fireId === laptop.fireId)}
                            onChange={() => toggleSeleccionDespacho(laptop)}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b' }}>{laptop.fecha_venta}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b' }}>{laptop.cliente}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b' }}>
                          {laptop.marca} {laptop.modelo}
                          <br />
                          <small style={{ color: '#94a3b8' }}>S/N: {laptop.serial}</small>
                        </td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b' }}>{laptop.destino}</td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b' }}>
                          <input
                            type="text"
                            placeholder="Ciudad o provincia..."
                            value={destinosDespacho[laptop.fireId] || ''}
                            onChange={(e) => {
                              const { value } = e.target;
                              setDestinosDespacho(prev => ({
                                ...prev,
                                [laptop.fireId]: value
                              }));
                            }}
                            style={{
                              width: '100%',
                              background: '#1e293b',
                              border: '1px solid #334155',
                              color: 'white',
                              borderRadius: '4px',
                              padding: '8px'
                            }}
                          />
                        </td>
                        <td style={{ padding: '8px 10px', borderBottom: '1px solid #1e293b', textAlign: 'center' }}>
                          <button
                            onClick={() => manejarDespacho(laptop)}
                            disabled={cargandoDespacho === laptop.fireId}
                            style={{
                              background: '#16a34a',
                              color: 'white',
                              border: 'none',
                              padding: '8px 15px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            {cargandoDespacho === laptop.fireId ? 'Enviando...' : 'Despachar'}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
                        No hay equipos pendientes de despacho.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {mostrarInforme && (equipoDetalle || laptopsSeleccionadas.length > 0) && (
        <div className="overlay-informe-leonidas" style={{ alignItems: 'flex-start', paddingTop: '5vh' }}>
          <div className="contenedor-boleta-formal" style={{ backgroundColor: '#ffffff', borderRadius: '0px', border: '1px solid #ccc', boxShadow: 'none', color: '#000000' }}>
            <button className="btn-cerrar-boleta-esquina" onClick={() => setMostrarInforme(false)} style={{ background: '#fff', color: '#000', border: '1px solid #ccc' }}>
              <X size={24} />
            </button>

            <header className="header-boleta-formal">
              <div className="info-empresa">
                {/* Usamos un div con background-image para un control total del logo */}
                <div 
                  aria-label="Logo Finpro Store"
                  style={{
                    width: '220px',       // Ancho del logo
                    height: '180px',     // Altura aumentada para más presencia
                    backgroundImage: `url(${logoFinpro})`,
                    backgroundSize: 'contain', // Asegura que el logo quepa sin cortarse
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'left top',
                    marginBottom: '5px'
                  }}>
                </div>
                <p style={{color: '#333', fontSize: '0.8rem', margin: '0 0 5px 0'}}>Especialistas en Laptop & Equipos de Cómputo</p>
                <p style={{color: '#333'}}>Lima - Perú</p>
                <p style={{color: '#333', fontSize: '0.8rem', margin: '5px 0 0 0'}}>Av Jose Galvez # 186 La Victoria (Referencia: Av Raymondi)</p>
                <p style={{color: '#333', fontWeight: 'bold', margin: '5px 0 0 0'}}>RUC: 10424432551</p>
              </div>
              <div className="recuadro-tipo-doc" style={{ border: '1px solid #ccc', backgroundColor: '#f0f0f0', borderRadius: '0px', color: '#000' }}>
                <h2 style={{color: '#000'}}>BOLETA DE VENTA</h2>
                <h3 style={{color: '#000'}}>ELECTRÓNICA</h3>
                <p className="numero-doc" style={{color: '#000'}}>
                    {(equipoDetalle?.fireId || equipoDetalle?.id) ? `B${String(proximoNumeroBoleta).padStart(3, '0')}-${(equipoDetalle.fireId || equipoDetalle.id).substring(0,6).toUpperCase()}` :
                     laptopsSeleccionadas.length > 0 ? `B${String(proximoNumeroBoleta).padStart(3, '0')}-LOTE-${laptopsSeleccionadas.length}` :
                     `B${String(proximoNumeroBoleta).padStart(3, '0')}-N/A`}
                </p>
              </div>
            </header>

            <div className="cuerpo-boleta-formal">
              <div className="seccion-datos-cliente" style={{ backgroundColor: '#f8f8f8', border: '1px solid #ddd' }}>
                <div className="dato-cliente-fila">
                  <User size={16} className="icono-dato" style={{ color: '#555' }} />
                  <label style={{ color: '#555' }}>CLIENTE:</label>
                  <span style={{color: '#000'}}>{nombreCliente.toUpperCase() || "________________________"}</span>
                </div>
                <div className="dato-cliente-fila">
                  <FileText size={16} className="icono-dato" style={{ color: '#555' }} />
                  <label style={{ color: '#555' }}>DNI:</label>
                  <span style={{color: '#000'}}>{dniCliente.toUpperCase() || "________________________"}</span>
                </div>
                <div className="dato-cliente-fila">
      <MapPin size={16} className="icono-dato" style={{ color: '#555' }} />
      <label style={{ color: '#555' }}>ORIGEN:</label>
      <span style={{color: '#000'}}>LIMA</span>
    </div>
                <div className="dato-cliente-fila">
                  <CalendarDays size={16} className="icono-dato" style={{ color: '#555' }} />
                  <label style={{ color: '#555' }}>FECHA:</label>
                  <span style={{color: '#000'}}>{new Date().toLocaleDateString()}</span>
                </div>
                <div className="dato-cliente-fila">
                  <MapPin size={16} className="icono-dato" style={{ color: '#555' }} />
                  <label style={{ color: '#555' }}>DESTINO:</label>
                  <span style={{color: '#000'}}>{destinoVenta.trim() === "" ? "________________________" : destinoVenta.toUpperCase()}</span>
                </div>
                {/* ========================================================= */}
{/* PASO 2: SECCIÓN DE GARANTÍA AGREGADA                      */}
{/* ========================================================= */}
<div className="dato-cliente-fila">
  <Shield size={16} className="icono-dato" style={{ color: '#555' }} />
  <label style={{ color: '#555' }}>GARANTÍA:</label>
  <span style={{ color: '#000' }}>
    {garantiaVenta.trim() === "" ? "____________________" : garantiaVenta.toUpperCase()}
  </span>
</div>
{/* ========================================================= */}
              </div>

             <table className="tabla-items-boleta">
  <thead>
    <tr>
      <th style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '12px 10px', textAlign: 'center' }}>CANT.</th>
      <th style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '12px 10px', textAlign: 'left' }}>DESCRIPCIÓN</th>
      <th style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '12px 10px', textAlign: 'right' }}>TOTAL</th>
    </tr>
  </thead>
  <tbody>
    {(laptopsSeleccionadas.length > 0 ? laptopsSeleccionadas : [equipoDetalle].filter(Boolean)).map((item, index) => (
      <tr key={item.fireId || index}>
        <td style={{ 
    backgroundColor: '#fff', color: '#000', border: '1px solid #ccc',
    padding: '6px 10px', 
    verticalAlign: 'top', 
    textAlign: 'center' 
}}>
    {/* Cantidad del producto */}
    <div style={{ fontWeight: 'bold' }}>
        {item.cantidad || 1}
    </div>
    
    {/* Etiqueta de código agregada justo abajo */}
    <div style={{ 
        marginTop: '6px', 
        fontSize: '9px', 
        color: '#555', 
        letterSpacing: '0.5px',
        lineHeight: '1.2'
    }}>
        CÓDIGO:<br />
        <span style={{ color: '#000', fontWeight: '500' }}>
            {item.idPersonalizado || item.codigo || '0001'}
        </span>
    </div>
</td>
        <td style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '6px 10px' }}>
          <strong>LAPTOP {item.marca?.toUpperCase()} {item.modelo?.toUpperCase()}</strong><br />
          <small style={{ color: '#555' }}>S/N: {item.serial || "N/A"} | {item.procesador}</small>
        </td>
        <td className="monto total-fila" style={{ backgroundColor: '#fff', color: '#000', border: '1px solid #ccc', padding: '6px 10px' }}>S/ {Number(item.precio || 0).toFixed(2)}</td>
      </tr>
    ))}
  </tbody>
</table>

{(() => {
        const totalAPagar = laptopsSeleccionadas.length > 0
          ? laptopsSeleccionadas.reduce((sum, l) => sum + (Number(l.precio) || 0), 0)
          : (Number(equipoDetalle?.precio) || 0);

        return (
          <>
            <div className="contenedor-totales-boleta">
              <div className="total-fila-resumen final">
                <label style={{ color: '#000', fontWeight: 'bold', fontSize: '1.1rem' }}>TOTAL A PAGAR:</label>
                <span className="monto-final" style={{ color: '#000' }}>S/ {totalAPagar.toFixed(2)}</span>
              </div>
            </div>
          </>
        );
      })()}
              <footer className="pie-boleta-formal" style={{ color: '#555' }}>
                <p style={{ color: '#555' }}>Gracias por su compra en FINPRO STORE.</p>
              </footer>
            </div>

            <div className="grupo-botones-boleta-no-imprimir">
              <div className="contenedor-confirmar-venta-formal">
                <input
                  type="text"
                  className="input-nombre-cliente-formal"
                  placeholder="Nombre del cliente..."
                  value={nombreCliente}
                  onChange={(e) => setNombreCliente(e.target.value)}
                  style={{ background: '#fff', color: '#000', border: '1px solid #ccc' }}
                />
                <input
                  type="text"
                  className="input-nombre-cliente-formal"
                  placeholder="DNI del cliente..."
                  value={dniCliente}
                  onChange={(e) => setDniCliente(e.target.value)}
                  style={{ background: '#fff', color: '#000', border: '1px solid #ccc' }}
                />
                <input
                  type="text"
                  className="input-nombre-cliente-formal"
                  placeholder="Editar Destino..."
                  value={destinoVenta}
                  onChange={(e) => setDestinoVenta(e.target.value)}
                  style={{ background: '#fff', color: '#000', border: '1px solid #ccc' }}
                />
                <input
                  type="text"
                  className="input-nombre-cliente-formal"
                  placeholder="Garantía (Ej: 1 año, 2 años, 3 años)..."
                  value={garantiaVenta}
                  onChange={(e) => setGarantiaVenta(e.target.value)}
                  style={{ marginTop: '8px', background: '#fff', color: '#000', border: '1px solid #ccc' }}
                />

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button className="btn-formal-confirmar" onClick={finalizarVentaYActualizar} disabled={cargando}>
                    <CheckCircle size={18} /> CONFIRMAR Y PDF
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default VentasView;