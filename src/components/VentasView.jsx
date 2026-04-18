import React, { useState } from 'react';
import AlmacenTabla from './AlmacenTabla';
import './VentasView.css';

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
  const [fechaFiltro, setFechaFiltro] = useState("");
  const [marcaSeleccionada, setMarcaSeleccionada] = useState("TODAS");

  // Función provisional para el botón de vender
  const manejarVentaProxima = (laptop) => {
    alert(`Sistema de Pago para ${laptop.modelo}: ¡Muy pronto!\nEstamos trabajando en el módulo de facturación y pagos.`);
  };

  // Obtener todas las marcas únicas del inventario
  const marcasDisponibles = [
    "TODAS", 
    ...new Set(laptops.filter(l => l.marca).map(l => l.marca.toUpperCase()))
  ];

  // 1. LÓGICA DE FILTRADO (MODO VENTAS: SOLO DISPONIBLES CON PRECIO)
  const ventasFiltradas = laptops.filter(lap => {
    
    // --- FILTRO DE DISPONIBILIDAD REAL (SOLO STOCK Y CON PRECIO) ---
    const estaEnStock = (lap.estado || "STOCK").toUpperCase() === 'STOCK';
    const tienePrecioValido = lap.precio && lap.precio !== "" && Number(lap.precio) > 0;

    // Si no está en stock o no tiene precio, se oculta de la vista de ventas
    if (!estaEnStock || !tienePrecioValido) return false;

    // --- ACCESO SEGÚN ROL ---
    const tieneAccesoTotal = usuarioLogueado?.rol === 'super_admin' || usuarioLogueado?.rol === 'admin_2';
    const coincideVendedor = tieneAccesoTotal
      ? true
      : (lap.vendedor === usuarioLogueado?.nombre || lap.responsable === usuarioLogueado?.nombre);
    
    if (!coincideVendedor) return false;

    // --- FILTRO POR MARCA (BOTONES) ---
    if (marcaSeleccionada !== "TODAS" && (lap.marca || "").toUpperCase() !== marcaSeleccionada) {
      return false;
    }

    // Filtro por Calendario
    if (fechaFiltro) {
      const [y, m, d] = fechaFiltro.split('-');
      const fechaFormateada = `${parseInt(d)}/${parseInt(m)}/${y}`;
      if (lap.fecha !== fechaFormateada && lap.fecha_venta !== fechaFormateada) return false;
    }

    // Filtro por Búsqueda de texto
    const texto = busquedaVentas.toLowerCase().trim();
    if (texto === "") return true;

    return (
      (lap.serial || "").toLowerCase().includes(texto) ||
      (lap.modelo || "").toLowerCase().includes(texto) ||
      (lap.marca || "").toLowerCase().includes(texto) ||
      (lap.procesador || "").toLowerCase().includes(texto) ||
      (lap.ram || "").toLowerCase().includes(texto) ||
      (lap.gpu || "").toLowerCase().includes(texto) ||
      (lap.almacenamiento || "").toLowerCase().includes(texto) ||
      (lap.cliente || "").toLowerCase().includes(texto)
    );
  });

  // --- NUEVO: CÁLCULOS DE NEGOCIO PARA SUPER_ADMIN ---
  const inversionVentas = ventasFiltradas.reduce((acc, lap) => acc + (Number(lap.precio_costo) || 0), 0);
  const utilidadVentas = ventasFiltradas.reduce((acc, lap) => acc + (Number(lap.utilidad) || 0), 0);

  const manejarVerTodo = () => {
    setBusquedaVentas("");
    setFechaFiltro("");
    setMarcaSeleccionada("TODAS");
  };

  return (
    <div className="ventas-view-container fade-in">
      
      {/* TÍTULO Y BOTÓN DE WHATSAPP */}
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2 style={{ color: '#fff', margin: 0 }}>💼 GESTIÓN DE VENTAS (MODO EXCEL)</h2>
        <button 
          onClick={() => manejarGeneracionReporte('whatsapp')}
          className="report-btn-wa"
        >
          📱 WhatsApp Ventas
        </button>
      </div>

      {/* BLOQUE PRIVADO: SOLO PARA EL DUEÑO (super_admin) */}
      {usuarioLogueado?.rol === 'super_admin' && (
        <div className="admin-balance-mini" style={{
          display: 'flex',
          gap: '20px',
          background: 'rgba(0, 255, 127, 0.1)',
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid #00ff7f',
          marginBottom: '20px',
          fontSize: '0.9rem'
        }}>
          <div><span style={{color: '#aaa'}}>Inversión en Stock:</span> <b style={{color: '#fff'}}>S/ {inversionVentas.toFixed(2)}</b></div>
          <div style={{width: '1px', background: '#00ff7f44'}}></div>
          <div><span style={{color: '#aaa'}}>Utilidad Proyectada:</span> <b style={{color: '#00ff7f'}}>S/ {utilidadVentas.toFixed(2)}</b></div>
        </div>
      )}

      {/* BOTONES DE FILTRO POR MARCA */}
      <div className="contenedor-filtros-marcas">
        {marcasDisponibles.map(marca => (
          <button
            key={marca}
            className={`btn-marca ${marcaSeleccionada === marca ? 'active-marca' : ''}`}
            onClick={() => setMarcaSeleccionada(marca)}
          >
            {marca === "TODAS" ? "📂 TODAS" : marca}
          </button>
        ))}
      </div>

      {/* BUSCADOR MODERNO */}
      <div className="seccion-busqueda-ventas">
        <div className="busqueda-wrapper">
          <span className="icono-lupa">🔍</span>
          <input 
            type="text" 
            className="input-ventas-moderno" 
            placeholder="Buscar laptops disponibles..." 
            value={busquedaVentas}
            onChange={(e) => setBusquedaVentas(e.target.value)}
          />
        </div>

        {/* FILTRO DE FECHA Y REINICIAR */}
        <div className="controles-adicionales-ventas">
          <div className="grupo-fecha">
            <label>Fecha de ingreso:</label>
            <input 
              type="date" 
              className="input-fecha-ventas"
              value={fechaFiltro}
              onChange={(e) => setFechaFiltro(e.target.value)}
            />
          </div>
          <button className="btn-ver-todo-ventas" onClick={manejarVerTodo}>
            🔄 REINICIAR
          </button>
        </div>
      </div>

      <div className="stats-bar-ventas">
        Equipos listos para vender (En Stock con Precio): <strong>{ventasFiltradas.length}</strong>
      </div>

      {/* TABLA DE RESULTADOS CON MODO VENTAS ACTIVADO */}
      <AlmacenTabla 
        laptops={ventasFiltradas} 
        usuarioLogueado={usuarioLogueado}
        setModalImagen={(img) => {
          setModalImagen(img);
          if (setFotoActual) setFotoActual(Array.isArray(img) ? img[0] : img);
        }}
        activarEdicion={activarEdicion}
        eliminarProducto={manejarEliminar}
        onVenderClick={manejarVentaProxima}
        modoVentas={true}
      />
    </div>
  );
};

export default VentasView;