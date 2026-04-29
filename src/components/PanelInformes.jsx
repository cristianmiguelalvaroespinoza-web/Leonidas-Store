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

// IMPORTACIÓN DEL CSS MODULE
import styles from './PanelInformes.module.css';

const PanelInformes = ({ laptops, manejarGeneracionReporte, cargando, usuarioLogueado }) => {
  // --- ESTADOS ORIGINALES ---
  const [periodoInterno, setPeriodoInterno] = useState('dia'); 
  const [fechaManual, setFechaManual] = useState(new Date().toISOString().split('T')[0]);
  const [periodoTabla, setPeriodoTabla] = useState('dia'); 
  const [fechaTabla, setFechaTabla] = useState(new Date().toISOString().split('T')[0]);
  const [mostrarModalVendidos, setMostrarModalVendidos] = useState(false);

  // --- NUEVOS ESTADOS PARA LA PESTAÑA DE DETALLES ---
  const [mostrarModalDetalleVendedor, setMostrarModalDetalleVendedor] = useState(false);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState(null);
  const [laptopsVendedor, setLaptopsVendedor] = useState([]);

  // --- NUEVO ESTADO PARA EL MODAL DE STOCK EN TIENDA ---
  const [mostrarModalStock, setMostrarModalStock] = useState(false);
  const [laptopsEnStock, setLaptopsEnStock] = useState([]);

  // --- NUEVO ESTADO PARA EL HISTORIAL DE ACTIVIDAD ---
  const [mostrarHistorial, setMostrarHistorial] = useState(false);

  // --- FUNCIONES DE APOYO ---
  const limpiarFecha = (str) => {
    if (!str) return "";
    return str.split('/').map(p => parseInt(p, 10)).join('/');
  };

  // --- FUNCIONES PARA EXCEL AJUSTADAS ---
  
  const descargarInformeGeneral = () => {
    try {
      const datosAFiltar = registrosParaTabla.length > 0 ? registrosParaTabla : laptops;
      if (!datosAFiltar || datosAFiltar.length === 0) {
        alert("No hay datos disponibles para exportar en este momento.");
        return;
      }
      const datosExcel = datosAFiltar.map((l, index) => {
        const esVendido = l.estado?.toUpperCase() === 'VENDIDO';
        return {
          'N°': index + 1,
          'ESTADO': l.estado?.toUpperCase() || 'STOCK',
          'FECHA': l.fecha_venta || l.fecha || '---',
          'EQUIPO': `${l.marca || ''} ${l.modelo || ''}`,
          'ESPECIFICACIONES': `${l.procesador || ''} / ${l.ram || ''} / ${l.disco || l.almacenamiento || ''}`,
          'S/N SERIAL': l.serial || '---',
          'PRECIO S/': Number(l.precio) || 0,
          'VENDEDOR': esVendido ? (l.responsable || 'LEONIDAS') : '' 
        };
      });
      const ws = XLSX.utils.json_to_sheet(datosExcel);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Informe General");
      XLSX.writeFile(wb, `Informe_General_FINPROStore.xlsx`);
    } catch (e) {
      console.error("Error en Excel:", e);
      alert("Hubo un error al generar el archivo.");
    }
  };

  const descargarRegistroVentas = () => {
    try {
      const todasLasVentas = laptops.filter(l => l.estado?.toUpperCase() === 'VENDIDO');
      const datosVentas = todasLasVentas.map((l, i) => ({
        'N°': i + 1,
        'FECHA VENTA': l.fecha_venta || l.fecha,
        'VENDEDOR': l.responsable || 'LEONIDAS',
        'EQUIPO': `${l.marca} ${l.modelo}`,
        'ESPECIFICACIONES': `${l.procesador} / ${l.ram} / ${l.disco}`,
        'SERIE SERIAL': l.serial,
        'PRECIO VENTA': l.precio,
        'CLIENTE': l.cliente || 'PARTICULAR'
      }));
      const ws = XLSX.utils.json_to_sheet(datosVentas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ventas Historicas");
      XLSX.writeFile(wb, `Registro_Ventas_Historico_Leonidas.xlsx`);
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
        if (rolEnDB === 'super_admin') asignado = 'LEONIDAS';
        else if (nombreEnDB.includes('DAVID')) asignado = 'DAVID';
        else if (nombreEnDB.includes('CRISTOFER')) asignado = 'CRISTOFER';
        else if (nombreEnDB.includes('YAEL')) asignado = 'YAEL';
        else if (rolEnDB === 'admin_2') asignado = 'DAVID';
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
        if (rolEnDB === 'super_admin') asignado = 'LEONIDAS';
        else if (nombreEnDB.includes('DAVID')) asignado = 'DAVID';
        else if (nombreEnDB.includes('CRISTOFER')) asignado = 'CRISTOFER';
        else if (nombreEnDB.includes('YAEL')) asignado = 'YAEL';
        else if (rolEnDB === 'admin_2') asignado = 'DAVID';
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
    manejarGeneracionReporte(formato, { tipo: periodoInterno, fecha: fechaManual });
  };

  // --- LÓGICA DE FILTRADO ---
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
      'YAEL': { cantidad: 0, total: 0, color: '#a855f7' }
    };

    registrosParaTabla.forEach(l => {
      if (l.estado?.trim().toUpperCase() === 'VENDIDO') {
        const nombreEnDB = (l.responsable || "").trim().toUpperCase();
        const rolEnDB = (l.rol_responsable || "").trim().toLowerCase();
        
        let asignado = '';

        // Prioridad 1: Búsqueda por nombre clave
        if (nombreEnDB.includes('DAVID')) asignado = 'DAVID';
        else if (nombreEnDB.includes('CRISTOFER')) asignado = 'CRISTOFER';
        else if (nombreEnDB.includes('YAEL')) asignado = 'YAEL';
        // Prioridad 2: Si es super_admin o dice Leonidas
        else if (rolEnDB === 'super_admin' || nombreEnDB.includes('LEONIDAS')) asignado = 'LEONIDAS';
        // Prioridad 3: Solo si está vacío o es un nombre desconocido, va a Leonidas
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
        <h1><BarChart3 size={32} /> PANEL DE CONTROL Y RENDIMIENTO</h1>
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
              <div className={styles.controlesPeriodo}>
                <button onClick={() => setPeriodoInterno('dia')} className={`${styles.btnPeriodo} ${periodoInterno === 'dia' ? styles.btnPeriodoActive : ''}`}>HOY</button>
                <div className={`${styles.inputDateContainer} ${periodoInterno === 'calendario' ? styles.inputDateContainerActive : ''}`}>
                  <CalendarIcon size={16} style={{marginRight: '10px'}}/>
                  <input type="date" value={fechaManual} className={styles.inputDate} onChange={(e) => { setFechaManual(e.target.value); setPeriodoInterno('calendario'); }} />
                </div>
                <button onClick={() => setPeriodoInterno('mes')} className={`${styles.btnPeriodo} ${periodoInterno === 'mes' ? styles.btnPeriodoActive : ''}`}>MES ACTUAL</button>
              </div>
              <div className={styles.gridAcciones}>
                <button onClick={() => ejecutarReporte('pdf')} disabled={cargando} className={`${styles.btnAccion} ${styles.btnPdf}`}><FileText size={20} /> {cargando ? 'GENERANDO...' : 'ENVIAR GMAIL TABLA'}</button>
                
                <div style={{ display: 'flex', gap: '10px', gridColumn: 'span 1' }}>
                  <button onClick={descargarInformeGeneral} className={styles.btnAccion} style={{ flex: 1, borderColor: '#00ff7f', color: '#00ff7f', background: 'transparent' }}>
                    <Table size={18} /> INFORME GENERAL
                  </button>
                  <button onClick={descargarRegistroVentas} className={styles.btnAccion} style={{ flex: 1, borderColor: '#34d399', color: '#34d399', background: 'transparent' }}>
                    <FileSpreadsheet size={18} /> REGISTRO DE VENTAS
                  </button>
                </div>

                <button onClick={() => ejecutarReporte('texto')} className={`${styles.btnAccion} ${styles.btnMail}`}><Mail size={20} /> GMAIL REPORT EXCEL</button>
                <button onClick={() => ejecutarReporte('whatsapp')} className={`${styles.btnAccion} ${styles.btnWhatsapp}`}><MessageCircle size={20} /> WHATSAPP</button>
              </div>
          </div>
        </section>

        <section className={styles.seccionOscura}>
          {/* ... Encabezado de tabla y botones de historial se mantienen igual ... */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Users size={22} color="#00ff7f" /> RENDIMIENTO POR VENDEDOR
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
                <div className={styles.inputDateContainer} style={{padding: '0 5px'}}>
                  <input type="date" value={fechaTabla} onChange={(e) => { setFechaTabla(e.target.value); setPeriodoTabla('calendario'); }} className={styles.inputDate} style={{fontSize: '0.7rem', width: '90px'}} />
                </div>
                <button onClick={() => setPeriodoTabla('mes')} className={`${styles.btnMini} ${periodoTabla === 'mes' ? styles.btnMiniActive : ''}`}>MES</button>
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className={styles.tablaLeonidas}>
              <thead>
                <tr>
                  <th>VENDEDOR</th>
                  <th style={{ textAlign: 'center' }}>EQUIPOS</th>
                  <th style={{ textAlign: 'right' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(rendimientoUsuarios).map(([nombre, data]) => (
                  <tr key={nombre} className={styles.rowVendedor}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: data.color }}></div>
                        <span style={{ fontWeight: 'bold' }}>{nombre}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className={styles.cantidadBadge} 
                        onClick={() => abrirDetallesVendedor(nombre)}
                        style={{ cursor: 'pointer', border: '1px solid #00ff7f', background: 'transparent', color: '#00ff7f', padding: '2px 10px', borderRadius: '10px' }}
                      >
                        {data.cantidad} vendidos
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                        <span style={{ fontWeight: 'bold' }}>S/ {data.total.toFixed(2)}</span>
                        <button className={styles.btnAccionPequeno} style={{borderColor: '#34d399', color: '#34d399'}} onClick={() => generarExcelVendedor(nombre, data.cantidad, data.total)} title="Bajar Excel detallado"><Table size={14} /></button>
                        <button className={styles.btnAccionPequeno} style={{borderColor: '#00ff7f', color: '#00ff7f'}} onClick={() => generarPDFVendedor(nombre, data.cantidad, data.total)} title="Bajar PDF detallado"><FileDown size={14} /></button>
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
              {registrosParaTabla.length > 0 ? (
                registrosParaTabla.map((reg, idx) => (
                  <div key={idx} style={{ padding: '12px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ color: '#00ff7f', fontSize: '0.75rem', display: 'block' }}>{reg.fecha_venta || reg.fecha}</span>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#fff' }}>
                        <strong>{reg.estado === 'VENDIDO' ? 'Venta:' : 'Registro:'}</strong> {reg.marca} {reg.modelo}
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
    </div>
  );
};

export default PanelInformes;