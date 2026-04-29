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
  const [busquedaVentas, setBusquedaVentas] = useState("");
  const [filtroFecha, setFiltroFecha] = useState(""); // Nuevo estado para calendario
  const [equipoDetalle, setEquipoDetalle] = useState(null);
  const [mostrarInforme, setMostrarInforme] = useState(false);
  const [modoVenta, setModoVenta] = useState(false); 
  const [nombreCliente, setNombreCliente] = useState("");
  const [destinoVenta, setDestinoVenta] = useState("LIMA");

  const manejarVentaProxima = (laptop) => {
    setEquipoDetalle(laptop);
    setMostrarInforme(true);
    setModoVenta(false); 
    setNombreCliente("");
    setDestinoVenta("LIMA");
  };

  const limpiarFiltros = () => {
    setBusquedaVentas("");
    setFiltroFecha("");
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

    const laptopId = equipoDetalle?.fireId || equipoDetalle?.id;

    if (!laptopId) {
      alert("Error: No se encontró el ID del equipo.");
      return;
    }

    await descargarPDF();

    try {
      const equipoRef = doc(db, "inventario", laptopId.trim());

      await updateDoc(equipoRef, {
        estado: "Vendido",
        cliente: nombreCliente.toUpperCase(),
        fecha: new Date().toLocaleDateString(),
        destino: destinoVenta.toUpperCase()
      });

      alert("¡Venta registrada! El equipo ya no aparecerá en stock.");
      
      setMostrarInforme(false);
      setEquipoDetalle(null);
      setModoVenta(false);
      setNombreCliente("");

    } catch (error) {
      console.error("Error al actualizar:", error);
      alert("Fallo la conexión con la colección 'inventario'.");
    }
  };
  
  const ventasFiltradas = laptops.filter(lap => {
    const estaEnStock = (lap.estado || "STOCK").toUpperCase() === 'STOCK';
    const tienePrecioValido = lap.precio && Number(lap.precio) > 0;
    
    if (!estaEnStock || !tienePrecioValido) return false;

    // Filtro por fecha (si existe)
    if (filtroFecha && lap.fechaIngreso !== filtroFecha) return false;

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
        
        <div className="header-controls-ventas">
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
             <Search size={18} className="search-icon" />
             <input 
               type="text" 
               placeholder="Buscar laptop..." 
               value={busquedaVentas}
               onChange={(e) => setBusquedaVentas(e.target.value)}
               className="input-busqueda-ventas"
             />
          </div>
        </div>
      </div>

      <AlmacenTabla 
        laptops={ventasFiltradas} 
        usuarioLogueado={usuarioLogueado}
        setModalImagen={setModalImagen}
        onVenderClick={manejarVentaProxima}
        activarEdicion={activarEdicion}
        manejarEliminar={manejarEliminar}
        modoVentas={true}
      />

      {mostrarInforme && equipoDetalle && (
        <div className="overlay-informe-leonidas">
          <div className="contenedor-boleta-formal"> 
            <button className="btn-cerrar-boleta-esquina" onClick={() => setMostrarInforme(false)}>
              <X size={24} />
            </button>

            <header className="header-boleta-formal">
              <div className="info-empresa">
                <h1 className="logo-leonidas-formal" style={{color: '#00c853'}}>FINPRO STORE</h1>
                <p>Especialistas en Laptop & Equipos de Cómputo</p>
                <p>Lima - Perú</p>
              </div>
              <div className="recuadro-tipo-doc">
                <h2>BOLETA DE VENTA</h2>
                <h3>ELECTRÓNICA</h3>
                <p className="numero-doc">
                    B001-{equipoDetalle.id ? equipoDetalle.id.substring(0,6).toUpperCase() : "STOCK"}
                </p>
              </div>
            </header>

            <div className="cuerpo-boleta-formal">
              <div className="seccion-datos-cliente">
                <div className="dato-cliente-fila">
                  <User size={16} className="icono-dato" />
                  <label>CLIENTE:</label>
                  <span>{nombreCliente.toUpperCase() || "________________________"}</span>
                </div>
                <div className="dato-cliente-fila">
                  <CalendarDays size={16} className="icono-dato" />
                  <label>FECHA:</label>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
                <div className="dato-cliente-fila">
                  <MapPin size={16} className="icono-dato" />
                  <label>DESTINO:</label>
                  <span>{destinoVenta.toUpperCase()}</span>
                </div>
              </div>

              <table className="tabla-items-boleta">
                <thead>
                  <tr>
                    <th>CANT.</th>
                    <th>DESCRIPCIÓN</th>
                    <th>P. UNITARIO</th>
                    <th>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>
                      <strong>LAPTOP {equipoDetalle.marca?.toUpperCase()} {equipoDetalle.modelo?.toUpperCase()}</strong><br />
                      <small>S/N: {equipoDetalle.serial || "N/A"} | {equipoDetalle.procesador}</small>
                    </td>
                    <td className="monto">S/ {Number(equipoDetalle.precio).toFixed(2)}</td>
                    <td className="monto total-fila">S/ {Number(equipoDetalle.precio).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="contenedor-totales-boleta">
                <div className="total-fila-resumen final">
                  <label>TOTAL A PAGAR:</label>
                  <span className="monto-final">S/ {Number(equipoDetalle.precio).toFixed(2)}</span>
                </div>
              </div>

              <footer className="pie-boleta-formal">
                <p>Gracias por su compra en FINPRO STORE.</p>
              </footer>
            </div>

            <div className="grupo-botones-boleta-no-imprimir">
                {!modoVenta ? (
                  <>
                    <button className="btn-formal-imprimir" onClick={() => window.print()}>
                      <Printer size={18} /> IMPRIMIR
                    </button>
                    <button className="btn-formal-vender" onClick={() => setModoVenta(true)}>
                      <FileText size={18} /> INICIAR VENTA
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
                      <button className="btn-formal-confirmar" onClick={finalizarVentaYActualizar}>
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