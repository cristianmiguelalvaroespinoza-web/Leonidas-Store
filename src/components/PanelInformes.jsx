import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  MessageCircle, 
  FileText, 
  Mail, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  Package,
  Users,
  Table,
  FileDown,
  ShoppingCart,
  X,
  Laptop,
  Cpu,
  Monitor,
  HardDrive,
  Hash,
  FileSpreadsheet,
  History // Nuevo icono para el historial
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
// IMPORTACIÓN DEL CSS MODULE
import styles from './PanelInformes.module.css';

const PanelInformes = ({ laptops, manejarGeneracionReporte, cargando, usuarioLogueado }) => {
  // --- ESTADOS ORIGINALES ---
  const [periodoInterno, setPeriodoInterno] = useState('dia'); 
  const [fechaManual, setFechaManual] = useState(new Date().toISOString().split('T')[0]);
  const [periodoTabla, setPeriodoTabla] = useState('dia'); 
  const [fechaTabla, setFechaTabla] = useState(new Date().toISOString().split('T')[0]);
  const [mostrarModalVendidos, setMostrarModalVendidos] = useState(false);

  // 👇 PEGA ESTA FUNCIÓN AQUÍ 👇
  const descargarExcelEstiloOscuro = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Informe General');

    // Columnas
    worksheet.columns = [
      { header: 'N°', key: 'index', width: 8 },
      { header: 'FECHA', key: 'fecha', width: 15 },
      { header: 'VENDEDOR', key: 'vendedor', width: 30 },
      { header: 'MARCA', key: 'marca', width: 15 },
      { header: 'MODELO', key: 'modelo', width: 15 },
      { header: 'PROCESADOR', key: 'procesador', width: 18 },
      { header: 'RAM', key: 'ram', width: 12 },
      { header: 'GPU', key: 'gpu', width: 12 },
      { header: 'DISCO', key: 'disco', width: 15 }
    ];

    // Estilo del Encabezado
    worksheet.getRow(1).eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1426' } };
      cell.font = { color: { argb: 'FF38BDF8' }, bold: true };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF334155' } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'thin', color: { argb: 'FF334155' } },
        right: { style: 'thin', color: { argb: 'FF334155' } }
      };
    });

    // Datos (asegúrate de que tu componente reciba "laptops" como prop)
    const datosParaExportar = laptops || []; 

    datosParaExportar.forEach((lap, index) => {
      const row = worksheet.addRow({
        index: index + 1,
        fecha: lap.fecha || 'N/A',
        vendedor: lap.vendedor || 'Personal administrativo',
        marca: lap.marca || 'N/A',
        modelo: lap.modelo || 'OTRO',
        procesador: lap.procesador || 'N/A',
        ram: lap.ram || 'N/A',
        gpu: lap.gpu || 'N/A',
        disco: lap.disco || 'N/A'
      });

      // Estilo de las celdas de datos
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.font = { color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF334155' } },
          left: { style: 'thin', color: { argb: 'FF334155' } },
          bottom: { style: 'thin', color: { argb: 'FF334155' } },
          right: { style: 'thin', color: { argb: 'FF334155' } }
        };
      });
    });

    // Generar y descargar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'Informe_General_Oscuro.xlsx');
  };
  // 👆 FIN DE LA FUNCIÓN 👆

  // --- NUEVOS ESTADOS PARA LA PESTAÑA DE DETALLES ---
  const [mostrarModalDetalleVendedor, setMostrarModalDetalleVendedor] = useState(false);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState(null);
  const [laptopsVendedor, setLaptopsVendedor] = useState([]);

  // --- NUEVO ESTADO PARA EL MODAL DE STOCK EN TIENDA ---
  const [mostrarModalStock, setMostrarModalStock] = useState(false);
  const [laptopsEnStock, setLaptopsEnStock] = useState([]);

  // --- NUEVO ESTADO PARA EL HISTORIAL DE ACTIVIDAD ---
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  // --- NUEVOS ESTADOS PARA LA INTERCEPCIÓN DE LEONIDAS ---
  const [showModalLeonidas, setShowModalLeonidas] = useState(false);
  const [modalDataLeonidas, setModalDataLeonidas] = useState(null);
  const [tipoArchivoLeonidas, setTipoArchivoLeonidas] = useState("");

  // --- FUNCIONES DE APOYO ---
  const limpiarFecha = (str) => {
    if (!str) return "";
    return str.split('/').map(p => parseInt(p, 10)).join('/');
  };

// FUNCIÓN PARA CONTROLAR EL MODAL DE LEONIDAS
  const handleAccionVendedor = (nombre, cantidad, total, tipo) => {
    if (nombre === "LEONIDAS") {
      setModalDataLeonidas({ nombre, cantidad, total });
      setTipoArchivoLeonidas(tipo);
      setShowModalLeonidas(true);
    } else {
      // Para David, Cristofer o Yael, descarga directo
      tipo === "Excel" 
        ? generarExcelVendedor(nombre, cantidad, total) 
        : generarPDFVendedor(nombre, cantidad, total);
    }
  };
  // --- FUNCIONES PARA EXCEL AJUSTADAS ---
  
  const descargarInformeGeneral = () => {
    try {
      // MODIFICACIÓN: Filtramos directamente del array 'laptops' original 
      // para obtener TODO lo que esté en STOCK, ignorando filtros de fecha.
      const soloStock = laptops.filter(l => l.estado?.toUpperCase() === 'STOCK');

      if (!soloStock || soloStock.length === 0) {
        alert("No hay laptops en stock para exportar.");
        return;
      }

      const datosExcel = soloStock.map((l, index) => {
        return {
          'N°': index + 1,
          'ESTADO': 'STOCK',
          'FECHA REGISTRO': l.fecha || '---',
          'MARCA': l.marca || '---',
          'MODELO': l.modelo || '---',
          'PROCESADOR': l.procesador || '---',
          'RAM': l.ram || '---',
          'REGISTRADO POR': l.responsable || '---',
          'DISCO': l.disco || l.almacenamiento || '---',
          'S/N SERIAL': l.serial || '---',
          'PRECIO VENTA S/': Number(l.precio) || 0,
          'COSTO S/': Number(l.precio_costo) || 0, // Añadido para control interno
          'UTILIDAD S/': (Number(l.precio) || 0) - (Number(l.precio_costo) || 0)
        };
      });

      const ws = XLSX.utils.json_to_sheet(datosExcel);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Stock Actual");
      
      // Ajuste de ancho de columnas automático
      ws['!cols'] = [
        {wch: 5}, {wch: 10}, {wch: 15}, {wch: 15}, {wch: 25}, 
        {wch: 20}, {wch: 10}, {wch: 15}, {wch: 20}, {wch: 20}, // Ancho para el nombre
        {wch: 15}, {wch: 15}, {wch: 15}
      ];

      XLSX.writeFile(wb, `Informe_Stock_General_LeonidasStore.xlsx`);
    } catch (e) {
      console.error("Error en Excel:", e);
      alert("Hubo un error al generar el archivo.");
    }
  };

  const descargarRegistroVentasOscuro = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Ventas Historicas');

      // 1. Tus columnas exactas adaptadas al nuevo formato
      worksheet.columns = [
        { header: 'N°', key: 'index', width: 8 },
        { header: 'FECHA VENTA', key: 'fecha', width: 15 },
        { header: 'VENDEDOR', key: 'vendedor', width: 25 },
        { header: 'EQUIPO', key: 'equipo', width: 25 },
        { header: 'ESPECIFICACIONES', key: 'especificaciones', width: 35 },
        { header: 'SERIE SERIAL', key: 'serial', width: 20 },
        { header: 'PRECIO VENTA', key: 'precio', width: 15 },
        { header: 'CLIENTE', key: 'cliente', width: 25 }
      ];

      // 2. Pintar el encabezado (Oscuro y letras celestes)
      worksheet.getRow(1).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1426' } };
        cell.font = { color: { argb: 'FF38BDF8' }, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin', color: { argb: 'FF334155' } }, left: { style: 'thin', color: { argb: 'FF334155' } }, bottom: { style: 'thin', color: { argb: 'FF334155' } }, right: { style: 'thin', color: { argb: 'FF334155' } } };
      });

      // 3. Tu lógica original para filtrar solo los "VENDIDOS"
      const todasLasVentas = laptops.filter(l => l.estado?.toUpperCase() === 'VENDIDO');

      // 4. Llenar los datos
      todasLasVentas.forEach((l, i) => {
        const row = worksheet.addRow({
          index: i + 1,
          fecha: l.fecha_venta || l.fecha,
          vendedor: l.responsable || 'LEONIDAS',
          equipo: `${l.marca} ${l.modelo}`,
          especificaciones: `${l.procesador} / ${l.ram} / ${l.disco}`,
          serial: l.serial,
          precio: l.precio,
          cliente: l.cliente || 'PARTICULAR'
        });

        // 5. Pintar cada fila de datos (Gris y letras blancas)
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
          cell.font = { color: { argb: 'FFFFFFFF' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { top: { style: 'thin', color: { argb: 'FF334155' } }, left: { style: 'thin', color: { argb: 'FF334155' } }, bottom: { style: 'thin', color: { argb: 'FF334155' } }, right: { style: 'thin', color: { argb: 'FF334155' } } };
        });
      });

      // 6. Generar el archivo igual que el otro
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, 'Registro_Ventas_Historico_Leonidas.xlsx');

    } catch (e) {
      console.error(e);
      alert("Error al exportar Registro de Ventas");
    }
  };

  const cerrarModalDetalleVendedor = () => {
    setMostrarModalDetalleVendedor(false);
    setVendedorSeleccionado(null);
    setLaptopsVendedor([]);
  };

  const abrirDetallesVendedor = (nombreVendedor) => {
    const filtradas = registrosParaTabla.filter(l => {
      if (l.estado?.trim().toUpperCase() !== 'VENDIDO') return false;
      
      // NORMALIZACIÓN DE DATOS
      const nombreEnDB = (l.responsable || "").trim().toUpperCase();
      const rolEnDB = (l.rol_responsable || "").trim().toLowerCase();
      let asignado = '';

      if (nombreEnDB.includes('DAVID')) asignado = 'DAVID';
      else if (nombreEnDB.includes('CRISTOFER')) asignado = 'CRISTOFER';
      else if (nombreEnDB.includes('YAEL')) asignado = 'YAEL';
      else if (rolEnDB === 'administrador_ventas' || nombreEnDB.includes('PERSONAL ADMINISTRADOR')) asignado = 'PERSONAL ADMINISTRADOR';
      else if (rolEnDB === 'super_admin' || nombreEnDB.includes('LEONIDAS')) asignado = 'LEONIDAS';
      else asignado = 'LEONIDAS';

      return asignado === nombreVendedor;
    });

    // Forzamos que el estado se actualice con la lista nueva y limpia
    setLaptopsVendedor([...filtradas]); 
    setVendedorSeleccionado(nombreVendedor);
    setMostrarModalDetalleVendedor(true);
  };

  const abrirModalStock = () => {
    const enTienda = laptops.filter(l => l.estado === 'STOCK');
    setLaptopsEnStock(enTienda);
    setMostrarModalStock(true);
  };

  const generarExcelVendedor = (nombre, cantidad, total) => {
    try {
      const fechaReporte = periodoTabla === 'dia' ? new Date().toLocaleDateString('es-PE') : fechaTabla;
      const equiposVendedor = registrosParaTabla.filter(l => {
        if (l.estado?.trim().toUpperCase() !== 'VENDIDO') return false;
        const nombreEnDB = (l.responsable || "").toUpperCase();
        const rolEnDB = (l.rol_responsable || "").trim().toLowerCase();
        let asignado = '';

        if (nombreEnDB.includes('DAVID')) asignado = 'DAVID';
        else if (nombreEnDB.includes('CRISTOFER')) asignado = 'CRISTOFER';
        else if (nombreEnDB.includes('YAEL')) asignado = 'YAEL';
        else if (rolEnDB === 'administrador_ventas' || nombreEnDB.includes('PERSONAL ADMINISTRADOR')) asignado = 'PERSONAL ADMINISTRADOR';
        else if (rolEnDB === 'super_admin' || nombreEnDB.includes('LEONIDAS')) asignado = 'LEONIDAS';
        else asignado = 'LEONIDAS';

        return asignado === nombre;
      });
      const datosExcel = [
        { "REPORTE": "FINPRO STORE - SISTEMA DE VENTAS" },
        { "REPORTE": "------------------------------------" },
        { "REPORTE": "Vendedor:", "VALOR": nombre },
        { "REPORTE": "Periodo:", "VALOR": periodoTabla.toUpperCase() },
        { "REPORTE": "Fecha de Emisión:", "VALOR": fechaReporte },
        {}, 
        { "REPORTE": "RESUMEN DE RESULTADOS" },
        { "REPORTE": "Cantidad Vendida:", "VALOR": `${cantidad} unidades` },
        { "REPORTE": "Monto Total Recaudado:", "VALOR": `S/ ${Number(total).toFixed(2)}` },
        { "REPORTE": "Moneda:", "VALOR": "Soles (S/)" },
        {},
        { "REPORTE": "DETALLE DE EQUIPOS VENDIDOS" },
        { "REPORTE": "EQUIPO / ESPECIFICACIONES", "VALOR": "PRECIO" }
      ];
      equiposVendedor.forEach(eq => {
        datosExcel.push({
          "REPORTE": `${eq.marca} ${eq.modelo} (${eq.procesador} / ${eq.ram} / ${eq.disco || eq.almacenamiento})`,
          "VALOR": `S/ ${Number(eq.precio).toFixed(2)}`
        });
      });
      const ws = XLSX.utils.json_to_sheet(datosExcel, { skipHeader: true });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reporte Individual");
      ws['!cols'] = [{ wch: 60 }, { wch: 20 }];
      XLSX.writeFile(wb, `Excel_Ventas_${nombre}_${fechaReporte.replace(/\//g, '-')}.xlsx`);
    } catch (error) {
      console.error("Error en Excel individual:", error);
      alert("No se pudo generar el archivo Excel");
    }
  };

  const generarPDFVendedor = (nombre, cantidad, total) => {
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const fechaReporte = periodoTabla === 'dia' ? new Date().toLocaleDateString('es-PE') : fechaTabla;
      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text("FINPRO STORE", 14, 20);
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text("REPORTE DETALLADO DE VENTAS", 14, 28);
      doc.setDrawColor(0, 255, 127);
      doc.line(14, 32, 60, 32);
      doc.setFontSize(11);
      doc.setTextColor(40);
      doc.text(`Vendedor: ${nombre}`, 14, 45);
      doc.text(`Periodo: ${periodoTabla.toUpperCase()}`, 14, 52);
      doc.text(`Fecha Ref: ${fechaReporte}`, 14, 59);
      autoTable(doc, {
        startY: 65,
        head: [['Descripción del Concepto', 'Detalle']],
        body: [
          ['Cantidad de Equipos Vendidos', `${cantidad} unidades`],
          ['Monto Total Recaudado', `S/ ${Number(total).toFixed(2)}`],
          ['Moneda', 'Soles (S/)']
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
        styles: { fontSize: 10 }
      });
      const equiposVendedor = registrosParaTabla.filter(l => {
        if (l.estado?.trim().toUpperCase() !== 'VENDIDO') return false;
        const nombreEnDB = (l.responsable || "").toUpperCase();
        const rolEnDB = (l.rol_responsable || "").trim().toLowerCase();
        let asignado = '';

        if (nombreEnDB.includes('DAVID')) asignado = 'DAVID';
        else if (nombreEnDB.includes('CRISTOFER')) asignado = 'CRISTOFER';
        else if (nombreEnDB.includes('YAEL')) asignado = 'YAEL';
        else if (rolEnDB === 'administrador_ventas' || nombreEnDB.includes('PERSONAL ADMINISTRADOR')) asignado = 'PERSONAL ADMINISTRADOR';
        else if (rolEnDB === 'super_admin' || nombreEnDB.includes('LEONIDAS')) asignado = 'LEONIDAS';
        else asignado = 'LEONIDAS';

        return asignado === nombre;
      });
      doc.setFontSize(11);
      doc.text("LISTA DE EQUIPOS VENDIDOS:", 14, doc.lastAutoTable.finalY + 10);
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 15,
        head: [['Equipo', 'Especificaciones', 'Precio']],
        body: equiposVendedor.map(eq => [
          `${eq.marca} ${eq.modelo}`,
          `${eq.procesador} / ${eq.ram} / ${eq.disco || eq.almacenamiento}`,
          `S/ ${Number(eq.precio).toFixed(2)}`
        ]),
        theme: 'striped',
        headStyles: { fillColor: [0, 255, 127], textColor: [0, 0, 0] },
        styles: { fontSize: 9 }
      });
      const finalY = doc.lastAutoTable.finalY;
      doc.setFontSize(9);
      doc.setTextColor(150);
      doc.text("Reporte generado por el sistema administrativo de FINPRO Store.", 14, finalY + 15);
      doc.save(`PDF_Ventas_${nombre}_${fechaReporte.replace(/\//g, '-')}.pdf`);
    } catch (error) {
      console.error("Error crítico al generar el PDF:", error);
      alert("Error técnico: " + error.message);
    }
  };

  const ejecutarReporte = (formato) => {
    const config = { tipo: periodoInterno, fecha: fechaManual };
    manejarGeneracionReporte(formato, config);
  };

  // --- LÓGICA DE FILTRADO ---
// --- LÓGICA DE FILTRADO DEL HISTORIAL CORREGIDA ---
  const datosHistorialReal = useMemo(() => {
    return [...laptops].sort((a, b) => {
      // 1. Obtenemos las fechas (priorizando fecha de venta si existe)
      // Usamos el formato que entiende JS (YYYY-MM-DD) si es posible
      const obtenerFechaIso = (item) => {
        const f = item.fecha_venta || item.fecha || "";
        if (!f) return 0;
        // Si tu fecha es "DD/MM/YYYY", la convertimos a "YYYY-MM-DD"
        const partes = f.split('/');
        if (partes.length === 3) {
          return new Date(`${partes[2]}-${partes[1]}-${partes[0]}`).getTime();
        }
        return new Date(f).getTime();
      };

      const tiempoA = obtenerFechaIso(a);
      const tiempoB = obtenerFechaIso(b);
      
      // 2. Orden descendente: El tiempo más grande (más reciente) primero
      return tiempoB - tiempoA;
    });
  }, [laptops]);

 const registrosParaTabla = useMemo(() => {
    const hoy = new Date();
    // Formato estándar D/M/YYYY para comparar con limpiarFecha
    const hoyStr = `${hoy.getDate()}/${hoy.getMonth() + 1}/${hoy.getFullYear()}`;
    
    return laptops.filter(l => {
      const fEquipo = limpiarFecha(l.fecha);
      const fVenta = limpiarFecha(l.fecha_venta);

      if (periodoTabla === 'dia') {
        return fEquipo === hoyStr || fVenta === hoyStr;
      }
      
      if (periodoTabla === 'calendario') {
        if (!fechaTabla) return false;
        const [y, m, d] = fechaTabla.split('-');
        const fBusca = `${parseInt(d)}/${parseInt(m)}/${y}`;
        return fEquipo === fBusca || fVenta === fBusca;
      }

      if (periodoTabla === 'mes') {
        const mesActual = hoy.getMonth() + 1;
        const anioActual = hoy.getFullYear();
        // Priorizamos fecha de venta para el reporte mensual
        const fechaAnalizar = l.fecha_venta || l.fecha || "";
        const [dl, ml, al] = fechaAnalizar.split('/');
        return parseInt(ml) === mesActual && parseInt(al) === anioActual;
      }
      return true;
    });
  }, [laptops, periodoTabla, fechaTabla]);

  // --- RENDIMIENTO POR VENDEDOR (DINÁMICO) ---
  const rendimientoUsuarios = useMemo(() => {
    const data = {
      'LEONIDAS': { cantidad: 0, total: 0, color: '#00ff7f' },
      'DAVID': { cantidad: 0, total: 0, color: '#3b82f6' },
      'CRISTOFER': { cantidad: 0, total: 0, color: '#0ea5e9' },
      'YAEL': { cantidad: 0, total: 0, color: '#a855f7' },
      'PERSONAL ADMINISTRADOR': { cantidad: 0, total: 0, color: '#f59e0b' }
    };

    registrosParaTabla.forEach(l => {
      if (l.estado?.trim().toUpperCase() === 'VENDIDO') {
        const nombreEnDB = (l.responsable || "").trim().toUpperCase();
        const rolEnDB = (l.rol_responsable || "").trim().toLowerCase();
        
        let asignado = '';

        // Lógica de asignación de ventas
        if (nombreEnDB.includes('DAVID')) asignado = 'DAVID';
        else if (nombreEnDB.includes('CRISTOFER')) asignado = 'CRISTOFER';
        else if (nombreEnDB.includes('YAEL')) asignado = 'YAEL';
        // Prioridad para el rol de administrador
        else if (rolEnDB === 'administrador_ventas' || nombreEnDB.includes('PERSONAL ADMINISTRADOR')) asignado = 'PERSONAL ADMINISTRADOR';
        // Prioridad para el super admin
        else if (rolEnDB === 'super_admin' || nombreEnDB.includes('LEONIDAS')) asignado = 'LEONIDAS';
        // Caso por defecto: cualquier otro usuario va a Leonidas
        else asignado = 'LEONIDAS';

        if (data[asignado]) {
          data[asignado].cantidad += 1;
          const precioNum = typeof l.precio === 'string' 
            ? parseFloat(l.precio.replace(/[^0-9.]/g, '')) 
            : Number(l.precio || 0);
          data[asignado].total += (precioNum || 0);
        }
      }
    });
    return data;
  }, [registrosParaTabla]);

  const totalVentasTabla = Object.values(rendimientoUsuarios).reduce((acc, curr) => acc + curr.total, 0);
  const laptopsVendidasHistorico = useMemo(() => laptops.filter(l => l.estado?.toUpperCase() === 'VENDIDO'), [laptops]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1><BarChart3 size={32} /> PANEL DE INFORMES</h1>
        <p>Bienvenido, <strong>{usuarioLogueado?.nombre}</strong>. Gestión de Finpro Store.</p>
      </header>

      <div className={styles.mainGrid}>
        <section>
          {/* ... tus cardsGrid (Total Recaudado, Stock, etc) se mantienen igual ... */}
          <div className={styles.cardsGrid}>
             <div className={`${styles.card} ${styles.recaudado}`}>
               <TrendingUp color="#00ff7f" size={20} />
               <span>TOTAL RECAUDADO (VISTA)</span>
               <h2>S/ {totalVentasTabla.toFixed(2)}</h2>
             </div>
             
             <div className={`${styles.card} ${styles.tienda}`} onClick={abrirModalStock} style={{ cursor: 'pointer' }} title="Click para ver detalle del Stock">
               <Package color="#3b82f6" size={20} />
               <span>STOCK EN TIENDA</span>
               <h2>{laptops.filter(l => l.estado === 'STOCK').length}</h2>
             </div>

             <div className={`${styles.card} ${styles.vendido}`} onClick={() => setMostrarModalVendidos(true)} style={{ cursor: 'pointer' }}>
               <ShoppingCart color="#a855f7" size={20} />
               <span>STOCK VENDIDO TOTAL</span>
               <h2>{laptopsVendidasHistorico.length}</h2>
             </div>
          </div>

          <div className={styles.seccionOscura}>
              {/* ... controles de periodo se mantienen igual ... */}
              <h3>⚙️ CONFIGURACIÓN DEL REPORTE</h3>
              <div className={`${styles.controlesPeriodo} mobile-stack`} style={{ display: 'flex', alignItems: 'stretch' }}>
  <button onClick={() => setPeriodoInterno('dia')} className={`${styles.btnPeriodo} ${periodoInterno === 'dia' ? styles.btnPeriodoActive : ''}`}>HOY</button>
  
  <input 
    type="date" 
    value={fechaManual} 
    className={styles.inputDate} 
    onChange={(e) => { 
      setFechaManual(e.target.value); 
      setPeriodoInterno('calendario'); 
    }} 
    style={{ 
      flex: 1, 
      maxWidth: '200px', 
      padding: '0 15px',
      borderRadius: '8px',
      border: periodoInterno === 'calendario' ? '2px solid #3b82f6' : '1px solid transparent',
      outline: 'none',
      cursor: 'pointer',
      margin: '0 5px',
      boxSizing: 'border-box'
    }}
  />
  
  <button onClick={() => setPeriodoInterno('mes')} className={`${styles.btnPeriodo} ${periodoInterno === 'mes' ? styles.btnPeriodoActive : ''}`}>MES ACTUAL</button>
</div>
              <div className={`${styles.gridAcciones} mobile-stack`}>
                <button onClick={() => ejecutarReporte('pdf')} disabled={cargando} className={`${styles.btnAccion} ${styles.btnPdf}`}><FileText size={20} /> {cargando ? 'GENERANDO...' : 'ENVIAR GMAIL TABLA'}</button>
                
                <div style={{ display: 'flex', gap: '10px', gridColumn: 'span 1' }}>
                  <button 
  onClick={descargarExcelEstiloOscuro} 
  className={styles.btnAccion} 
  style={{ flex: 1, background: 'transparent', borderColor: '#00ff7f', color: '#00ff7f' }}
>
  <Table size={18} /> INFORME GENERAL
</button>
                  <button onClick={descargarRegistroVentasOscuro} className={styles.btnAccion} style={{ flex: 1, borderColor: '#34d399', color: '#34d399', background: 'transparent' }}>
                    <FileSpreadsheet size={18} /> REGISTRO DE VENTAS
                  </button>
                </div>

                <button onClick={() => ejecutarReporte('texto')} className={`${styles.btnAccion} ${styles.btnMail}`}><Mail size={20} /> GMAIL REPORT EXCEL</button>
                <button onClick={() => ejecutarReporte('whatsapp')} className={`${styles.btnAccion} ${styles.btnWhatsapp}`}><MessageCircle size={20} /> WHATSAPP</button>
              </div>
          </div>
        </section>

        <section className={styles.seccionOscura} style={{ width: '100%', maxWidth: '550px' }}>
          {/* ... Encabezado de tabla y botones de historial se mantienen igual ... */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={22} color="#00ff7f" /> VENTAS REALIZADAS
            </h3>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button 
                onClick={() => setMostrarHistorial(true)}
                style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid #3b82f6', color: '#3b82f6', padding: '5px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
              >
                <History size={16} /> Historial
              </button>

              <div className={styles.controlesTabla}>
                <button onClick={() => setPeriodoTabla('dia')} className={`${styles.btnMini} ${periodoTabla === 'dia' ? styles.btnMiniActive : ''}`}>HOY</button>
               <div className={styles.inputDateContainer} style={{ padding: '0', display: 'flex', alignItems: 'center' }}>
        <input 
          type="date" 
          value={fechaTabla} 
          onChange={(e) => setFechaTabla(e.target.value)}
          style={{
            height: '32px',          /* Misma altura que los botones */
            width: '135px',          /* <-- ESTO LO HACE MÁS CORTO */
            padding: '0 8px',        /* Reducimos el relleno interno */
            boxSizing: 'border-box', /* Evita que crezca de más */
            borderRadius: '6px',     /* Bordes redondeados */
            border: 'none',          /* Sin bordes extraños */
            outline: 'none',
            fontSize: '13px',
            fontFamily: 'inherit',
            margin: '0',
            backgroundColor: '#ffffff', /* Fondo blanco */
            color: '#000000'            /* Texto negro */
          }}
        />
      </div>
                <button onClick={() => setPeriodoTabla('mes')} className={`${styles.btnMini} ${periodoTabla === 'mes' ? styles.btnMiniActive : ''}`}>MES</button>
              </div>
            </div>
          </div>

         <div style={{ width: '100%', overflowX: 'auto' }}>
  <table className={styles.tablaLeonidas} style={{ width: '100%', minWidth: '0', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
    <thead>
      <tr>
        <th style={{ width: '40%', padding: '5px', textAlign: 'left', fontSize: '0.85rem' }}>VENDEDOR</th>
        <th style={{ width: '24%', padding: '5px', textAlign: 'center', fontSize: '0.85rem' }}>EQUIPOS</th>
        <th style={{ width: '36%', padding: '5px', textAlign: 'right', fontSize: '0.85rem' }}>ACCIONES</th>
      </tr>
    </thead>
    <tbody>
      {Object.entries(rendimientoUsuarios).map(([nombre, data]) => (
        <tr key={nombre} className={styles.rowVendedor}>
          <td style={{ padding: '10px 5px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: data.color, flexShrink: 0 }}></div>
              <span style={{ fontWeight: 'bold', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
            </div>
          </td>
          <td style={{ textAlign: 'center', padding: '10px 0' }}>
            <button
              className={styles.cantidadBadge}
              onClick={() => abrirDetallesVendedor(nombre)}
              style={{ cursor: 'pointer', border: '1px solid #00ff7f', background: 'transparent', color: '#00ff7f', fontSize: '0.8rem', padding: '4px 8px', whiteSpace: 'nowrap' }}
            >
              {data.cantidad} vendidos
            </button>
          </td>
          <td style={{ textAlign: 'right', padding: '10px 5px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>S/ {data.total.toFixed(2)}</span>
  
  {/* Botón Excel con Intercepción */}
  <button 
    className={styles.btnAccionPequeno} 
    style={{borderColor: '#34d399', color: '#34d399'}} 
    onClick={() => handleAccionVendedor(nombre, data.cantidad, data.total, "Excel")} 
    title="Bajar Excel detallado"
  >
    <Table size={14} />
  </button>

  {/* Botón PDF con Intercepción */}
  <button 
    className={styles.btnAccionPequeno} 
    style={{borderColor: '#00ff7f', color: '#00ff7f'}} 
    onClick={() => handleAccionVendedor(nombre, data.cantidad, data.total, "PDF")} 
    title="Bajar PDF detallado"
  >
    <FileDown size={14} />
  </button>
</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.consolidado}>
            <span>TOTAL CONSOLIDADO</span>
            <span>S/ {totalVentasTabla.toFixed(2)}</span>
          </div>
        </section>
      </div>

      {/* --- MODAL DE HISTORIAL CORREGIDO --- */}
      {mostrarHistorial && (
        <div className={styles.modalOverlay} onClick={() => setMostrarHistorial(false)}>
          <div className={styles.modalPanel} style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalHeaderTitle}><History size={28} /> HISTORIAL DE ACTIVIDAD</h2>
              <p className={styles.modalHeaderSub}>Registro de movimientos en tiempo real</p>
              <button className={styles.btnCloseTop} onClick={() => setMostrarHistorial(false)}><X /></button>
            </div>
            <div style={{ padding: '20px', maxHeight: '400px', overflowY: 'auto' }}>
              {datosHistorialReal.length > 0 ? (
                datosHistorialReal.map((reg, idx) => (
                  <div key={idx} style={{ padding: '12px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ color: '#00ff7f', fontSize: '0.75rem', display: 'block' }}>{reg.fecha_venta || reg.fecha}</span>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>
                        <strong>{reg.estado?.trim().toUpperCase() === 'VENDIDO' ? 'Venta:' : 'Registro:'}</strong> {reg.marca} {reg.modelo}
                      </p>
                    </div>
                    <span className={styles.vendedorTag} style={{ fontSize: '0.7rem' }}>{reg.responsable || 'LEONIDAS'}</span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#475569' }}>
                  <History size={40} style={{ marginBottom: '15px', opacity: 0.3 }} />
                  <p style={{ fontSize: '0.9rem' }}>No hay actividad para el periodo seleccionado.</p>
                </div>
              )}
            </div>
            <div style={{ padding: '20px', textAlign: 'right', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <button className={styles.btnCancelarModal} onClick={() => setMostrarHistorial(false)}>CERRAR</button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalStock && (
        <div className={styles.modalOverlay} onClick={() => setMostrarModalStock(false)}>
          <div className={styles.modalPanel} style={{ maxWidth: '900px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalHeaderTitle}><Package size={28} /> STOCK ACTUAL EN TIENDA</h2>
              <p className={styles.modalHeaderSub}>Lista detallada de las {laptopsEnStock.length} laptops disponibles</p>
              <button className={styles.btnCloseTop} onClick={() => setMostrarModalStock(false)}><X /></button>
            </div>
            <div className={styles.gridDetalleTecnico} style={{ maxHeight: '60vh', overflowY: 'auto', padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
              {laptopsEnStock.map((l, i) => (
                <div key={i} style={{ background: '#0f172a', borderRadius: '12px', padding: '15px', display: 'flex', gap: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <img src={l.imagenes?.[0] || 'placeholder.jpg'} style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '8px', background: '#1e293b' }} alt="Laptop" />
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#fff' }}>{l.marca} {l.modelo}</h4>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      <span style={{ background: '#1e293b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', color: '#94a3b8' }}><Cpu size={12}/>{l.procesador}</span>
                      <span style={{ background: '#1e293b', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', color: '#94a3b8' }}><Monitor size={12}/>{l.ram}</span>
                    </div>
                    <div style={{ background: '#22d3ee', color: '#000', padding: '5px 10px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      <Hash size={14}/> S/N: {l.serial}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'right' }}>
              <button className={styles.btnCancelarModal} onClick={() => setMostrarModalStock(false)}><X size={18} /> CERRAR VISTA</button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalDetalleVendedor && (
        <div className={styles.modalOverlay} onClick={() => setMostrarModalDetalleVendedor(false)}>
          <div className={styles.modalPanel} style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalHeaderTitle}><Laptop size={28} /> VENTAS DE {vendedorSeleccionado}</h2>
              <button className={styles.btnCloseTop} onClick={() => setMostrarModalDetalleVendedor(false)}><X /></button>
            </div>
            <div className={styles.ventasList} style={{ maxHeight: '450px', overflowY: 'auto' }}>
              {laptopsVendedor.map((l, i) => (
                <div key={i} className={styles.ventaItem} style={{ borderLeft: '4px solid #00ff7f', marginBottom: '12px' }}>
                  <div className={styles.ventaDetails}>
                    <div style={{ fontSize: '1.1rem', color: '#fff', fontWeight: 'bold' }}>{l.marca} {l.modelo}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{l.procesador} | {l.ram}GB</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#00ff7f', fontWeight: 'bold' }}>S/ {l.precio}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className={styles.btnCancelarModal} onClick={cerrarModalDetalleVendedor}><X size={18} /> CERRAR DETALLES</button>
          </div>
        </div>
      )}

      {/* --- NUEVO: MODAL PARA STOCK VENDIDO TOTAL --- */}
      {mostrarModalVendidos && (
        <div className={styles.modalOverlay} onClick={() => setMostrarModalVendidos(false)}>
          <div className={styles.modalPanel} style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalHeaderTitle}><ShoppingCart size={28} /> HISTÓRICO DE VENTAS</h2>
              <p className={styles.modalHeaderSub}>Total de {laptopsVendidasHistorico.length} equipos vendidos</p>
              <button className={styles.btnCloseTop} onClick={() => setMostrarModalVendidos(false)}><X /></button>
            </div>
            <div className={styles.ventasList} style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {laptopsVendidasHistorico.map((l, i) => (
                <div key={i} className={styles.ventaItem} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '1rem', color: '#fff', fontWeight: 'bold' }}>{l.marca} {l.modelo}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>S/N: {l.serial}</div>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#aaa' }}>
                    Vendido por: <strong style={{ color: '#60a5fa' }}>{l.responsable || 'N/A'}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#00ff7f', fontWeight: 'bold' }}>S/ {l.precio}</div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{l.fecha_venta || l.fecha}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className={styles.btnCancelarModal} onClick={() => setMostrarModalVendidos(false)}><X size={18} /> CERRAR HISTÓRICO</button>
          </div>
        </div>
      )}
      {showModalLeonidas && (
  <div className={styles.modalOverlay} onClick={() => setShowModalLeonidas(false)} style={{ zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)' }}>
    <div className={styles.modalPanel} onClick={e => e.stopPropagation()} style={{ background: '#fff', color: '#333', padding: '0', borderRadius: '8px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
      
      {/* Encabezado del Modal estilo Vista Previa */}
      <div style={{ background: '#f8f9fa', padding: '15px 25px', borderBottom: '1px solid #dee2e6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTopLeftRadius: '8px', borderTopRightRadius: '8px' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#444' }}>VISTA PREVIA DEL REPORTE ({tipoArchivoLeonidas})</h2>
        <button onClick={() => setShowModalLeonidas(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#888' }}>&times;</button>
      </div>

      {/* Cuerpo del Reporte (Simulación de la imagen) */}
      <div style={{ padding: '40px', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ borderBottom: '2px solid #00ff7f', marginBottom: '20px', paddingBottom: '10px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#1a2a3a' }}>FINPRO STORE</h1>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>REPORTE DETALLADO DE VENTAS</p>
        </div>

        <div style={{ marginBottom: '30px', fontSize: '15px' }}>
          <p><strong>Vendedor:</strong> {modalDataLeonidas?.nombre}</p>
          <p><strong>Periodo:</strong> {periodoTabla || 'DIA'}</p>
          <p><strong>Fecha Ref:</strong> {new Date().toLocaleDateString()}</p>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <thead>
            <tr style={{ background: '#1a2a3a', color: '#fff' }}>
              <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #ddd' }}>Descripción del Concepto</th>
              <th style={{ textAlign: 'left', padding: '12px', border: '1px solid #ddd' }}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '12px', border: '1px solid #ddd' }}>Cantidad de Equipos Vendidos</td>
              <td style={{ padding: '12px', border: '1px solid #ddd' }}>{modalDataLeonidas?.cantidad} unidades</td>
            </tr>
            <tr>
              <td style={{ padding: '12px', border: '1px solid #ddd' }}>Monto Total Recaudado</td>
              <td style={{ padding: '12px', border: '1px solid #ddd' }}>S/ {modalDataLeonidas?.total.toFixed(2)}</td>
            </tr>
            <tr>
              <td style={{ padding: '12px', border: '1px solid #ddd' }}>Moneda</td>
              <td style={{ padding: '12px', border: '1px solid #ddd' }}>Soles (S/)</td>
            </tr>
          </tbody>
        </table>

        <div style={{ background: '#00ff7f', padding: '10px', color: '#000', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
          <span>Equipo</span>
          <span>Especificaciones</span>
          <span>Precio</span>
        </div>
        <div style={{ border: '1px solid #eee', padding: '20px', textAlign: 'center', color: '#999', fontSize: '13px' }}>
          Lista de equipos detallada en el archivo final.
        </div>
      </div>

      {/* Botones de Acción */}
      <div style={{ padding: '20px 40px', background: '#f8f9fa', textAlign: 'right', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
        <button onClick={() => setShowModalLeonidas(false)} style={{ padding: '10px 20px', marginRight: '10px', border: '1px solid #ccc', background: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Cerrar</button>
        <button 
          onClick={() => {
            tipoArchivoLeonidas === "Excel" 
              ? generarExcelVendedor(modalDataLeonidas.nombre, modalDataLeonidas.cantidad, modalDataLeonidas.total)
              : generarPDFVendedor(modalDataLeonidas.nombre, modalDataLeonidas.cantidad, modalDataLeonidas.total);
            setShowModalLeonidas(false);
          }}
          style={{ padding: '10px 25px', background: '#1a2a3a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          DESCARGAR {tipoArchivoLeonidas}
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
};

export default PanelInformes;
