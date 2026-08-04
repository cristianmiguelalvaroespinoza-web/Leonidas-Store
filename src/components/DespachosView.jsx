import React, { useState, useMemo } from 'react';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { X, Printer, User, MapPin, CalendarDays, Search, Package, Truck, RotateCcw, PlusCircle, FileDown } from 'lucide-react'; 
import { doc, updateDoc, addDoc, collection } from "firebase/firestore"; // Importación necesaria
import { db } from "../firebase"; // Asegúrate que la ruta sea correcta
import './VentasView.css';

const DespachosView = ({ laptops, usuarioLogueado }) => {
  const [busqueda, setBusqueda] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [equipoDetalle, setEquipoDetalle] = useState(null);
  const [mostrarGuia, setMostrarGuia] = useState(false);
  const [mostrarModalVentaRapida, setMostrarModalVentaRapida] = useState(false);
  const [cargandoVentaRapida, setCargandoVentaRapida] = useState(false);
  const [ventaRapidaForm, setVentaRapidaForm] = useState({
    marca: '',
    modelo: '',
    precio: '',
    precio_costo: '',
    fecha_venta: new Date().toISOString().split('T')[0],
    cliente: 'VENTA EXTERNA',
    destino: ''
  });

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
      { header: 'Fecha Despacho', key: 'fecha_despacho', width: 15 },
      { header: 'N° Pedido', key: 'n_pedido', width: 15 },
      { header: 'Cliente', key: 'cliente', width: 30 },
      { header: 'Precio (S/)', key: 'precio', width: 15 },
      { header: 'Equipo', key: 'equipo', width: 30 },
      { header: 'Serial', key: 'serial', width: 20 },
      { header: 'Destino', key: 'destino', width: 20 },
      { header: 'Responsable Envío', key: 'responsable_despacho', width: 25 },
    ];

    // Estilo del encabezado (Blanco y Negro)
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
      });
      // Estilo de las filas (Blanco y Negro)
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

  const handleGuardarVentaRapida = async (e) => {
    e.preventDefault();
    setCargandoVentaRapida(true);

    const { marca, modelo, precio, precio_costo, fecha_venta, cliente, destino } = ventaRapidaForm;

    if (!marca || !precio || !precio_costo || !fecha_venta) {
      alert("Por favor, complete los campos requeridos: Fecha, Marca, Precio de Venta y Precio de Costo.");
      setCargandoVentaRapida(false);
      return;
    }

    const vVenta = Number(precio);
    const vCosto = Number(precio_costo);
    const utilidad = vVenta - vCosto;

    const [y, m, d] = fecha_venta.split('-');
    const fechaFormateada = `${parseInt(d)}/${parseInt(m)}/${y}`;

    const nuevaVenta = {
      marca: marca.toUpperCase(),
      modelo: modelo.toUpperCase() || 'EXTERNO',
      precio: vVenta,
      precio_costo: vCosto,
      utilidad: utilidad,
      fecha_venta: fechaFormateada,
      fecha_despacho: fechaFormateada,
      cliente: cliente.toUpperCase() || 'VENTA EXTERNA',
      destino: destino.toUpperCase() || 'LIMA',
      estado: 'VENDIDO',
      estado_despacho: 'DESPACHADO',
      serial: `EXT-${Date.now()}`,
      responsable_venta: usuarioLogueado?.nombre || 'Sistema',
      responsable_despacho: usuarioLogueado?.nombre || 'Sistema',
      vendedor_final: usuarioLogueado?.nombre || 'Sistema',
      fecha: fechaFormateada,
      responsable: usuarioLogueado?.nombre || 'Sistema',
    };

    try {
      await addDoc(collection(db, "inventario"), nuevaVenta);
      alert('✅ Venta rápida registrada con éxito.');
      setMostrarModalVentaRapida(false);
      setVentaRapidaForm({ marca: '', modelo: '', precio: '', precio_costo: '', fecha_venta: new Date().toISOString().split('T')[0], cliente: 'VENTA EXTERNA', destino: '' });
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

  const abrirGuiaEnvio = (laptop) => {
    setEquipoDetalle(laptop);
    setMostrarGuia(true);
  };

  const descargarPDF = async () => {
    const elemento = document.querySelector(".contenedor-guia-envio");
    if(!elemento) return;

    const botones = document.querySelector(".grupo-botones-guia");
    const botonX = document.querySelector(".btn-cerrar-guia");
    
    if(botones) botones.style.display = 'none';
    if(botonX) botonX.style.display = 'none';

    try {
      const canvas = await html2canvas(elemento, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: 800 
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = 190; 
      const marginX = (pdfWidth - imgWidth) / 2; 
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", marginX, 10, imgWidth, imgHeight);
      pdf.save(`Guia_Envio_${equipoDetalle?.cliente?.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("Error al generar PDF:", error);
    } finally {
      if(botones) botones.style.display = 'flex';
      if(botonX) botonX.style.display = 'block';
    }
  };

  return (
    <div className="ventas-view-container fade-in">
      <div className="section-header">
        <h2 style={{ color: '#fff', margin: 0 }}>📦 HISTORIAL DE SALIDAS</h2>
        <div className="header-controls-ventas mobile-stack">
          <button className="btn-ver-todo-ventas" onClick={limpiarFiltros}>
            <RotateCcw size={16} /> Ver Todo
          </button>
          <button
            className="btn-ver-todo-ventas"
            onClick={() => setMostrarModalVentaRapida(true)}
            style={{ background: '#00ff7f', color: '#0f172a', borderColor: '#00ff7f' }}
          >
            <PlusCircle size={16} /> Venta Rápida
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
            </tr>
          </thead>
          <tbody>
            {despachosHechos.length > 0 ? (
              despachosHechos.map(laptop => (
                <tr key={laptop.fireId} className="row-hover-simple" style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '6px 12px', color: 'white', borderRadius: 0 }}>{laptop.fecha_despacho || laptop.fecha_venta}</td>
                  <td style={{ padding: '6px 12px', color: '#94a3b8', fontFamily: 'monospace' }}>{laptop.n_pedido || '-'}</td>
                  <td style={{ padding: '6px 12px', color: 'white', fontWeight: 'bold' }}>{laptop.cliente}</td>
                  
                  {/* AQUÍ ESTÁ EL INPUT QUE QUERÍAS */}
                  <td style={{ padding: '6px 12px' }}>
                    <input 
                      type="number" 
                      defaultValue={laptop.precio || ''} 
                      onBlur={(e) => handlePrecioChange(laptop.fireId, e.target.value)}
                      style={{ background: '#0f172a', border: '1px solid #334155', color: '#00ff7f', padding: '8px 4px', borderRadius: '4px', width: '100px', minWidth: '80px', height: '28px' , fontSize: '14px', boxSizing: 'border-box'}}
                    />
                  </td>

                  <td style={{ padding: '6px 12px', color: 'white' }}>
                    {laptop.marca} {laptop.modelo} <br/>
                    <small style={{ color: '#94a3b8' }}>S/N: {laptop.serial}</small>
                  </td>
                  <td style={{ padding: '6px 12px', color: '#00ff7f', fontWeight: 'bold' }}>
                    <Truck size={14} style={{ display: 'inline', marginRight: '5px' }}/>
                    {laptop.destino}
                  </td>
                  <td style={{ padding: '6px 12px', color: '#60a5fa' }}>{laptop.responsable_despacho || 'N/A'}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', borderRadius: 0 }}>
                    <button 
                      onClick={() => abrirGuiaEnvio(laptop)}
                      style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      <Package size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }}/>
                      Ver Guía
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                  No se encontraron despachos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL MANTENIDO TAL CUAL */}
      {mostrarGuia && equipoDetalle && (
        <div className="overlay-informe-leonidas" style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(3px)', alignItems: 'flex-start', paddingTop: '5vh' }}>
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
            <h3 style={{ borderBottom: '1px solid #000', paddingBottom: '5px', fontSize: '16px' }}>DETALLE DEL EQUIPO</h3>
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
    <tr style={{ borderRadius: '0px', backgroundColor: '#ffffff' }}>
      <td style={{ padding: '4px 8px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>1</td>
      <td style={{ padding: '4px 8px', border: '1px solid #000', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>
        <strong>LAPTOP {equipoDetalle.marca?.toUpperCase()} {equipoDetalle.modelo?.toUpperCase()}</strong><br/>
        <small style={{ color: '#555', fontSize: '10px' }}>Procesador: {equipoDetalle.procesador} | RAM: {equipoDetalle.ram} | Disco: {equipoDetalle.disco}</small>
      </td>
      <td style={{ padding: '4px 8px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>
        {equipoDetalle.serial}
      </td>
      <td style={{ padding: '4px 8px', border: '1px solid #000', textAlign: 'right', fontWeight: 'bold', fontSize: '12px', color: '#000', backgroundColor: '#ffffff' }}>
        S/ {Number(equipoDetalle.precio || 0).toFixed(2)}
      </td>
    </tr>
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
        </div>
      )}

      {mostrarModalVentaRapida && (
        <div className="overlay-informe-leonidas" onClick={() => setMostrarModalVentaRapida(false)}>
          <div className="modal-panel-venta-rapida" onClick={e => e.stopPropagation()}>
            <h3>⚡ Registro de Venta Rápida</h3>
            <p>Registra una venta externa para el control de ganancias.</p>
            <form onSubmit={handleGuardarVentaRapida}>
              <div className="form-campo-rapido">
                <label>Fecha de Venta</label>
                <input name="fecha_venta" type="date" value={ventaRapidaForm.fecha_venta} onChange={handleVentaRapidaChange} required />
              </div>
              <div className="form-grid-rapido">
                <div className="form-campo-rapido">
                  <label>Marca</label>
                  <input name="marca" placeholder="Ej: HP, Lenovo" value={ventaRapidaForm.marca} onChange={handleVentaRapidaChange} required />
                </div>
                <div className="form-campo-rapido">
                  <label>Modelo</label>
                  <input name="modelo" placeholder="(Opcional)" value={ventaRapidaForm.modelo} onChange={handleVentaRapidaChange} />
                </div>
              </div>
              <div className="form-grid-rapido">
                <div className="form-campo-rapido">
                  <label>Precio de Venta (S/)</label>
                  <input name="precio" type="number" step="0.01" placeholder="0.00" value={ventaRapidaForm.precio} onChange={handleVentaRapidaChange} required />
                </div>
                <div className="form-campo-rapido">
                  <label>Precio de Costo (S/)</label>
                  <input name="precio_costo" type="number" step="0.01" placeholder="0.00" value={ventaRapidaForm.precio_costo} onChange={handleVentaRapidaChange} required />
                </div>
              </div>
              <div className="form-grid-rapido">
                <div className="form-campo-rapido">
                  <label>Cliente</label>
                  <input name="cliente" placeholder="(Opcional)" value={ventaRapidaForm.cliente} onChange={handleVentaRapidaChange} />
                </div>
                <div className="form-campo-rapido">
                  <label>Destino</label>
                  <input name="destino" placeholder="Ej: AREQUIPA" value={ventaRapidaForm.destino} onChange={handleVentaRapidaChange} />
                </div>
              </div>
              
              <div className="botones-rapido">
                <button type="button" className="btn-cancelar-rapido" onClick={() => setMostrarModalVentaRapida(false)}>Cancelar</button>
                <button type="submit" className="btn-guardar-rapido" disabled={cargandoVentaRapida}>
                  {cargandoVentaRapida ? 'Guardando...' : 'Guardar Venta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DespachosView;