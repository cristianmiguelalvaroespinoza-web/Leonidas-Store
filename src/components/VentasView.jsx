import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import React, { useState } from 'react';
import AlmacenTabla from './AlmacenTabla';
import { X, Printer, User, MapPin, CheckCircle, FileText, CalendarDays, Search, RotateCcw } from 'lucide-react'; 
import './VentasView.css';
import { db } from '../firebase'; 
import { doc, updateDoc } from 'firebase/firestore';

const VentasView = ({ 
  laptops, 
  usuarioLogueado, 
  setModalImagen, 
  setFotoActual, 
  activarEdicion, 
  manejarEliminar,
  manejarGeneracionReporte
}) => {
  const [cargando, setCargando] = useState(false); // Nuevo estado para controlar la carga
  const [busquedaVentas, setBusquedaVentas] = useState("");
  const [filtroFecha, setFiltroFecha] = useState(""); // Nuevo estado para calendario
  const [laptopsSeleccionadas, setLaptopsSeleccionadas] = useState([]);
  const [equipoDetalle, setEquipoDetalle] = useState(null); // Inicializar equipoDetalle
  const [mostrarInforme, setMostrarInforme] = useState(false);
  const [modoVenta, setModoVenta] = useState(false); 
  const [nombreCliente, setNombreCliente] = useState("");
  const [destinoVenta, setDestinoVenta] = useState("LIMA");

  const manejarVentaProxima = (laptop) => {
    setEquipoDetalle(laptop);
    setLaptopsSeleccionadas([]); // Limpiar selección masiva al iniciar venta individual
    setMostrarInforme(true);
    setModoVenta(false); 
    setNombreCliente("");
    setDestinoVenta("LIMA");
  };

  const limpiarFiltros = () => {
    setBusquedaVentas("");
    setFiltroFecha("");
  };

  // Para alternar la selección de un equipo
const toggleSeleccion = (laptop) => {
  if (laptopsSeleccionadas.find(l => l.fireId === laptop.fireId)) {
    setLaptopsSeleccionadas(laptopsSeleccionadas.filter(l => l.fireId !== laptop.fireId));
  } else {
    setLaptopsSeleccionadas([...laptopsSeleccionadas, laptop]);
  }
};

// Venta masiva
const finalizarVentaLote = () => {
  setMostrarInforme(true); // Solo abre el modal, la lógica de venta se maneja en finalizarVentaYActualizar
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

  // Determinar si es una venta individual o masiva
  const isIndividualSale = equipoDetalle !== null && laptopsSeleccionadas.length === 0;
  const listaVenta = isIndividualSale ? [equipoDetalle] : laptopsSeleccionadas;

  if (listaVenta.length === 0) {
    alert("Error: No se seleccionó ningún equipo para la venta.");
    return;
  }

  // Generar el PDF para la venta (sea individual o masiva)
  await descargarPDF();

  try {
    setCargando(true); // Asumimos que tienes un estado de cargando

    // 3. Actualizamos cada equipo en Firebase usando un bucle con Promise.all
    await Promise.all(listaVenta.map(async (laptop) => {
      const laptopId = laptop.fireId || laptop.id;
      if (!laptopId) throw new Error("ID de equipo no encontrado.");

      const equipoRef = doc(db, "inventario", laptopId.trim());
      
      return updateDoc(equipoRef, {
        estado: "Vendido",
        cliente: nombreCliente.toUpperCase(),
        fecha_venta: new Date().toLocaleDateString('es-PE'), // Usar formato es-PE
        destino: destinoVenta.toUpperCase(),
        vendedor_final: usuarioLogueado?.nombre || "Sistema", // Para tracking
        responsable_venta: usuarioLogueado?.nombre || "Sin asignar" // Para tracking
      });
    }));

    alert(`¡Venta registrada! ${listaVenta.length} equipo(s) ya no aparecerán en stock.`);
    
    // 4. Limpieza de estados
    setMostrarInforme(false);
    setEquipoDetalle(null); // Limpiar selección individual
    setLaptopsSeleccionadas([]); // Limpiamos la selección masiva
    setModoVenta(false);
    setNombreCliente("");
    setDestinoVenta("LIMA");

  } catch (error) {
    console.error("Error al actualizar:", error);
    alert("Falló la conexión con la base de datos: " + error.message);
  } finally {
    setCargando(false);
  }
};
  
  const ventasFiltradas = laptops.filter(lap => {
  const estaEnStock = (lap.estado || "STOCK").toUpperCase() === 'STOCK';
  const tienePrecioValido = lap.precio && Number(lap.precio) > 0;
  
  if (!estaEnStock || !tienePrecioValido) return false;

  // FILTRO DE CALENDARIO CORREGIDO
  if (filtroFecha) {
    const [year, month, day] = filtroFecha.split('-');
    const f1 = `${parseInt(day)}/${parseInt(month)}/${year}`;
    const f2 = `${day}/${month}/${year}`;

    // REVISA AQUÍ: ¿Se llama fecha o fechaIngreso en tu base de datos?
    // Si usaste la "función interesante" de 2 fechas, usa el nombre de la fecha de entrada.
    const fechaParaFiltrar = lap.fechaIngreso || lap.fecha; 

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
      lap.disco?.toLowerCase().includes(texto) || // Ahora busca por SSD/HDD
      lap.gpu?.toLowerCase().includes(texto) ||
      lap.serial?.toLowerCase().includes(texto) ||
      lap.id?.toLowerCase().includes(texto)
    );
  });

  return (
    <div className="ventas-view-container fade-in">
      <div className="section-header">
        <h2 style={{ color: '#fff', margin: 0 }}>💼 GESTIÓN DE VENTAS - FINPRO STORE</h2>
        
        <div className="header-controls-ventas mobile-stack">
          {/* Botón Ver Todo */}
          <button className="btn-ver-todo-ventas" onClick={limpiarFiltros}>
            <RotateCcw size={16} /> Ver Todo
          </button>

          {/* Calendario */}
          <div className="calendar-box-ventas">
            <input 
              type="date" 
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="input-calendar-ventas"
            />
          </div>

        {/* Buscador Corregido */}
    <div className="search-box-ventas">
      {/* Condición: Solo muestra el ícono si no hay nada escrito */}
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
    </div>
        </div>
      </div>

      <div className="table-wrapper-global">
        <AlmacenTabla 
          laptops={ventasFiltradas} 
          usuarioLogueado={usuarioLogueado}
          setModalImagen={setModalImagen}
          onVenderClick={manejarVentaProxima}
          activarEdicion={activarEdicion}
          manejarEliminar={manejarEliminar}
          laptopsSeleccionadas={laptopsSeleccionadas}
          toggleSeleccion={toggleSeleccion}
          modoVentas={true}
        />
      </div>

      {laptopsSeleccionadas.length > 0 && (
  <div className="bar-multiventa mobile-stack" style={{ background: '#1e293b', padding: '15px', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ color: '#fff' }}>
      Has seleccionado <b>{laptopsSeleccionadas.length}</b> equipos.
    </span>
    <div style={{ display: 'flex', gap: '10px' }}>
      <button 
        className="btn-vender-masivo" 
        onClick={() => setMostrarInforme(true)} // Esto abre tu modal de venta actual
        style={{ background: '#00ff7f', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
      >
        💰 VENDER LOTE
      </button>
      <button 
        className="btn-cancelar-lote"
        onClick={() => setLaptopsSeleccionadas([])}
        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
      >
        CANCELAR
      </button>
    </div>
  </div>
)}

      {mostrarInforme && (equipoDetalle || laptopsSeleccionadas.length > 0) && (
        <div className="overlay-informe-leonidas">
          <div className="contenedor-boleta-formal" style={{ backgroundColor: '#1e293b', borderRadius: '0px', border: '1px solid #334155', boxShadow: 'none', color: 'white' }}>
            <button className="btn-cerrar-boleta-esquina" onClick={() => setMostrarInforme(false)}>
              <X size={24} />
            </button>

            <header className="header-boleta-formal">
              <div className="info-empresa">
                <h1 className="logo-leonidas-formal" style={{color: '#00c853'}}>FINPRO STORE</h1>
                <p style={{color: '#94a3b8'}}>Especialistas en Laptop & Equipos de Cómputo</p>
                <p style={{color: '#94a3b8'}}>Lima - Perú</p>
              </div>
              <div className="recuadro-tipo-doc" style={{ border: '1px solid #334155', backgroundColor: '#0f172a', borderRadius: '0px', color: 'white' }}>
                <h2 style={{color: 'white'}}>BOLETA DE VENTA</h2>
                <h3 style={{color: 'white'}}>ELECTRÓNICA</h3>
                <p className="numero-doc" style={{color: 'white'}}>
                    {equipoDetalle?.id ? `B001-${equipoDetalle.id.substring(0,6).toUpperCase()}` : 
                     laptopsSeleccionadas.length > 0 ? `B001-LOTE-${laptopsSeleccionadas.length}` : 
                     "B001-N/A"}
                </p>
              </div>
            </header>

            <div className="cuerpo-boleta-formal">
              <div className="seccion-datos-cliente">
                <div className="dato-cliente-fila">
                  <User size={16} className="icono-dato" />
                  <label>CLIENTE:</label>
                  <span style={{color: 'white'}}>{nombreCliente.toUpperCase() || "________________________"}</span>
                </div>
                <div className="dato-cliente-fila">
                  <CalendarDays size={16} className="icono-dato" />
                  <label>FECHA:</label>
                  <span style={{color: 'white'}}>{new Date().toLocaleDateString()}</span>
                </div>
                <div className="dato-cliente-fila">
                  <MapPin size={16} className="icono-dato" />
                  <label>DESTINO:</label>
                  <span style={{color: 'white'}}>{destinoVenta.toUpperCase()}</span>
                </div>
              </div>

             <table className="tabla-items-boleta">
  <thead>
    <tr style={{ backgroundColor: '#0f172a', borderBottom: '1px solid #334155' }}>
      <th style={{ color: 'white' }}>CANT.</th>
      <th style={{ textAlign: 'left', color: 'white' }}>DESCRIPCIÓN</th>
      <th style={{ textAlign: 'right', color: 'white' }}>TOTAL</th>
    </tr>
  </thead>
  <tbody>
    {/* Usamos el array de seleccionadas si existe, si no, convertimos el equipo individual a array */}
    {(laptopsSeleccionadas.length > 0 ? laptopsSeleccionadas : [equipoDetalle].filter(Boolean)).map((item, index) => (
      <tr key={item.fireId || index} style={{ borderBottom: '1px solid #334155' }}>
        <td style={{ color: 'white', padding: '6px 10px' }}>1</td>
        <td style={{ color: 'white', padding: '6px 10px' }}>
          <strong>LAPTOP {item.marca?.toUpperCase()} {item.modelo?.toUpperCase()}</strong><br />
          <small style={{ color: '#94a3b8' }}>S/N: {item.serial || "N/A"} | {item.procesador}</small>
        </td>
        <td className="monto total-fila" style={{ padding: '6px 10px' }}>S/ {Number(item.precio || 0).toFixed(2)}</td>
      </tr>
    ))}
  </tbody>
</table>

{/* TOTAL A PAGAR (Único) */}
{(() => {
  const totalAPagar = laptopsSeleccionadas.length > 0 
    ? laptopsSeleccionadas.reduce((sum, l) => sum + (Number(l.precio) || 0), 0)
    : (Number(equipoDetalle?.precio) || 0);
    
  return (
    <div className="contenedor-totales-boleta">
      <div className="total-fila-resumen final">
        <label style={{ color: '#94a3b8' }}>TOTAL A PAGAR:</label>
        <span className="monto-final">S/ {totalAPagar.toFixed(2)}</span>
      </div>
    </div>
  );
})()}

              <footer className="pie-boleta-formal" style={{ color: '#94a3b8' }}>
                <p style={{ color: '#94a3b8' }}>Gracias por su compra en FINPRO STORE.</p>
              </footer>
            </div>

            <div className="grupo-botones-boleta-no-imprimir">
                {!modoVenta ? (
                  <>
                    <button className="btn-formal-imprimir" onClick={() => window.print()}>
                      <Printer size={18} /> IMPRIMIR BOLETA
                    </button>
                    <button className="btn-formal-vender" onClick={() => setModoVenta(true)}>
                      <FileText size={18} /> INICIAR PROCESO DE VENTA
                    </button>
                  </>
                ) : (
                  <div className="contenedor-confirmar-venta-formal">
                      <input 
                        type="text" 
                        className="input-nombre-cliente-formal"
                        placeholder="Nombre del cliente..."
                        value={nombreCliente}
                        onChange={(e) => setNombreCliente(e.target.value)}
                      />
                      <input 
                        type="text" 
                        className="input-nombre-cliente-formal"
                        placeholder="Editar Destino..."
                        value={destinoVenta}
                        onChange={(e) => setDestinoVenta(e.target.value)}
                      />
                    <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                      <button className="btn-formal-confirmar" onClick={finalizarVentaYActualizar} disabled={cargando}>
                        <CheckCircle size={18} /> CONFIRMAR Y PDF
                      </button>
                      <button className="btn-formal-cancelar" onClick={() => setModoVenta(false)}>
                        VOLVER
                      </button>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VentasView;