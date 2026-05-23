import React, { useState } from 'react'; // Añadimos useState
import * as XLSX from 'xlsx';

// Componente de Tabla estilo Excel para Leonidas Store
const AlmacenTabla = ({ 
  usuarioLogueado, 
  activarEdicion, 
  laptops, 
  setModalImagen, 
  eliminarProducto, 
  busqueda = "",
  onVenderClick, 
  modoVentas = false,
  laptopsSeleccionadas = [],
  toggleSeleccion
}) => {
  // --- NUEVO ESTADO PARA FILTRAR POR VENDEDOR ---
  const [filtroVendedor, setFiltroVendedor] = useState("TODOS");
  const [filtroTiempo, setFiltroTiempo] = useState("TODAS"); // <-- NUEVO ESTADO
  const [filtroFecha, setFiltroFecha] = useState(""); // <-- ESTADO PARA EL CALENDARIO DE MESES
// Memoria para saber qué días están desplegados
  const [diasExpandidos, setDiasExpandidos] = React.useState({});
  
  const toggleDia = (dia) => {
    setDiasExpandidos(prev => ({ ...prev, [dia]: !prev[dia] }));
  };
  const puedeEditar = (item) => {
    return usuarioLogueado?.rol === 'super_admin';
  };

  const laptopsVisibles = laptops.filter(lap => {
    if (!lap) return false;
    if (usuarioLogueado?.rol === 'super_admin' || usuarioLogueado?.rol === 'admin_2' || usuarioLogueado?.rol === 'administrador_ventas') {
      return true;
    }
    return (lap.vendedor === usuarioLogueado?.nombre || lap.responsable === usuarioLogueado?.nombre);
  });

// --- LÓGICA DE FILTRADO ACTUALIZADA (TEXTO + VENDEDOR + TIEMPO) ---
  const laptopsFiltradas = laptopsVisibles.filter(l => {
    // 1. Filtro por Vendedor
    const nombreVendedor = (l.responsable || l.vendedor || "").toUpperCase();
    const pasaVendedor = filtroVendedor === "TODOS" || nombreVendedor.includes(filtroVendedor);
    if (!pasaVendedor) return false;

    // 2. Filtro por Tiempo (ACTUALIZADO PARA MINI CALENDARIO)
    if (filtroTiempo !== "TODAS") {
      const fechaStr = l.fecha || "";
      const [diaStr, mesStr, anioStr] = fechaStr.split('/');
      
      if (!diaStr || !mesStr || !anioStr) return false;

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
      else if (filtroTiempo === "ELEGIR_MES") {
        // Si el usuario aún no selecciona un mes en el calendario, no filtramos nada
        if (!filtroFecha) return true; 
        
        // El input type="month" devuelve "YYYY-MM" (ej: "2026-05")
        const [anioSeleccionado, mesSeleccionado] = filtroFecha.split('-');
        
        // Comparamos el mes y año de la laptop con el del calendario
        if (anio !== parseInt(anioSeleccionado, 10) || mes !== parseInt(mesSeleccionado, 10)) {
          return false;
        }
      }
    }

    // 3. Filtro por Texto (Búsqueda)
    const texto = busqueda.toLowerCase().trim();
    if (!texto) return true;

    const marca = (l.marca || "").toLowerCase();
    const modelo = (l.modelo || "").toLowerCase();
    const serial = (l.serial || "").toLowerCase();
    const vendedor = nombreVendedor.toLowerCase();
    const procesador = (l.procesador || "").toLowerCase();
    const generacion = (l.generacion || l.gen || "").toLowerCase();
    const ram = (l.ram || "").toLowerCase();
    const disco = (l.almacenamiento || l.disco || "").toLowerCase();
    const gpu = (l.gpu || "").toLowerCase();

    return marca.includes(texto) || modelo.includes(texto) || serial.includes(texto) || 
           vendedor.includes(texto) || procesador.includes(texto) || generacion.includes(texto) || 
           ram.includes(texto) || disco.includes(texto) || gpu.includes(texto);
  });
  const descargarExcel = () => {
    const tablaExcel = laptopsFiltradas.map((l, i) => {
      const fila = {
        'N°': i + 1,
        FECHA: l.fecha,
        VENDEDOR: l.responsable || l.vendedor,
        MARCA: l.marca,
        MODELO: l.modelo,
        PROCESADOR: `${l.procesador || ''} ${l.generacion || l.gen || ''}`.trim() || 'N/A',
        RAM: l.ram || 'N/A',
        GPU: l.gpu || 'N/A',
        DISCO: l.almacenamiento || l.disco || 'N/A',
        SERIAL: l.serial,
      };

      if (usuarioLogueado?.rol === 'super_admin') {
        fila['COSTO'] = l.precio_costo || 0;
      }

      fila['PRECIO'] = l.precio || 0;

      if (usuarioLogueado?.rol === 'super_admin') {
        fila['UTILIDAD'] = l.utilidad || 0;
      }

      fila['ESTADO'] = l.estado || "STOCK";

      return fila;
    });

    const ws = XLSX.utils.json_to_sheet(tablaExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Leonidas");
    XLSX.writeFile(wb, `LeonidasStore_Inventario_${new Date().toLocaleDateString()}.xlsx`);
  };

  const estiloCelda = { 
    fontSize: '12px', 
    fontWeight: '400', 
    verticalAlign: 'middle',
    padding: '6px 8px', 
    borderBottom: '1px solid #1e293b' 
  };

  const laptopsOrdenadas = [...laptopsFiltradas].sort((a, b) => {
    const fechaA = new Date(a.fecha.split('/').reverse().join('-'));
    const fechaB = new Date(b.fecha.split('/').reverse().join('-'));
    return fechaB - fechaA;
  });
  // 👇 AQUÍ PEGAS LA FUNCIÓN, JUSTO ANTES DEL RETURN 👇
const obtenerMesYAnio = (fechaString) => {
  if (!fechaString) return 'FECHA DESCONOCIDA';
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const [dia, mes, anio] = fechaString.split('/');
  return `${meses[parseInt(mes) - 1]} ${anio}`;
};

  return (
    <>
      <div className="excel-header-actions" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem', // Aumentamos un poco el margen
        flexWrap: 'wrap',
        gap: '10px' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <h2 style={{ 
  color: '#fff', 
  margin: 0, 
  display: 'flex', 
  flexDirection: 'row', 
  alignItems: 'center', 
  flexWrap: 'nowrap', 
  whiteSpace: 'nowrap', 
  gap: '10px' 
}}>
  📊 {modoVentas ? "TABLA DE VENTAS" : "INVENTARIO"}
</h2>
          
          {/* --- SELECTOR DE VENDEDOR CORREGIDO Y ALINEADO --- */}
          <select 
            value={filtroVendedor}
            onChange={(e) => setFiltroVendedor(e.target.value)}
            style={{
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    border: '1px solid #334155',
    borderRadius: '8px',
    padding: '0 35px 0 12px', // Más espacio a la derecha para la flecha
    fontSize: '13px',         // Subimos un punto para que se vea mejor
    cursor: 'pointer',
    outline: 'none',         // Subimos de 36px a 40px para que no corte la letra
    height: '45px',           // Altura reducida para que sea más delgado
    lineHeight: '20px',       // Centra el texto verticalmente en la nueva altura
    width: '200px',          // Ancho original restaurado
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '16px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    verticalAlign: 'middle'   // Alineación extra
  }}
>
  <option value="TODOS">👤 TODOS LOS USUARIOS</option>
  <option value="LEONIDAS">LEONIDAS</option>
  <option value="CRISTOFER">CRISTOFER</option>
  <option value="DAVID">DAVID</option>
  <option value="YAEL">YAEL</option>
  <option value="PERSONAL ADMINISTRADOR">PERSONAL ADMINISTRADOR</option>
</select>
{/* --- CONTENEDOR: SELECTOR + MINI CALENDARIO DE MESES --- */}
      <div style={{ display: 'flex', gap: '10px' }}>
        
        {/* 1. SELECTOR PRINCIPAL */}
        <select 
          value={filtroTiempo}
          onChange={(e) => setFiltroTiempo(e.target.value)}
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
            minWidth: '180px',
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
          <option value="ESTE_ANIO" style={{ background: '#1e293b', color: '#fff' }}>📅 AÑO 2026</option>
          <option value="ELEGIR_MES" style={{ background: '#1e293b', color: '#fff' }}>📅 ELEGIR MES...</option>
        </select>

        {/* 2. CALENDARIO DE MESES (Aparece SOLO si se selecciona "ELEGIR_MES") */}
        {filtroTiempo === 'ELEGIR_MES' && (
          <input 
            type="month"
            min="2026-01"
            max="2026-12"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
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
      </div>
</div>
        <button 
          className="btn-excel-download" 
          onClick={descargarExcel}
          style={{ height: '36px', display: 'flex', alignItems: 'center' }} // Alineado con el select
        >
          📥 Descargar Reporte ({laptopsFiltradas.length})
        </button>
      </div>

      <div className="table-responsive-wrapper">
        <table className="excel-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #334155' }}>
              {/* Espaciador para la columna de checkboxes en modo ventas */}
              {modoVentas && <th style={{ ...estiloCelda, width: '30px' }}></th>}
              <th style={{ ...estiloCelda, fontSize: '11px', width: '40px', color: '#94a3b8', textAlign: 'center', fontWeight: '600' }}>#</th>
              <th style={{ ...estiloCelda, fontSize: '11px', textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>FECHA</th>
              <th style={{ ...estiloCelda, fontSize: '11px', textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>USUARIO</th>
              <th style={{ ...estiloCelda, fontSize: '11px', textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>LAPTOP</th>
              <th style={{ ...estiloCelda, fontSize: '11px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>PROCESADOR / GEN</th>
              <th style={{ ...estiloCelda, fontSize: '11px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>RAM</th>
              <th style={{ ...estiloCelda, fontSize: '11px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>GPU</th>
              <th style={{ ...estiloCelda, fontSize: '11px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>DISCO</th>
              <th style={{ ...estiloCelda, fontSize: '11px', textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>SERIAL</th>
              {usuarioLogueado?.rol === 'super_admin' && (
                <th style={{ ...estiloCelda, fontSize: '11px', textAlign: 'left', color: '#ef4444', fontWeight: '600' }}>COSTO</th>
              )}
              <th style={{ ...estiloCelda, fontSize: '11px', textAlign: 'left', color: '#60a5fa', fontWeight: '600' }}>PRECIO</th>
              {usuarioLogueado?.rol === 'super_admin' && (
                <th style={{ ...estiloCelda, fontSize: '11px', textAlign: 'left', color: '#00ff7f', fontWeight: '600' }}>UTILIDAD</th>
              )}
              <th style={{ ...estiloCelda, fontSize: '11px', textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>ESTADO</th>
              <th style={{ ...estiloCelda, fontSize: '11px', textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>ACCIONES</th>
            </tr>
          </thead>
         <tbody>
  {(() => {
    let ultimoMesVisto = null;
    let ultimoDiaVisto = null; // <-- Memoria para los días

    return laptopsOrdenadas.map((l, i) => {
      const mesActual = obtenerMesYAnio(l.fecha);
      const diaActual = l.fecha;
      
      const mostrarEncabezadoMes = mesActual !== ultimoMesVisto;
      if (mostrarEncabezadoMes) ultimoMesVisto = mesActual;

      const mostrarEncabezadoDia = diaActual !== ultimoDiaVisto;
      if (mostrarEncabezadoDia) ultimoDiaVisto = diaActual;

      // Consultamos a nuestra "memoria" si este día en específico fue clickeado
      const estaExpandido = diasExpandidos[diaActual];

      return (
        <React.Fragment key={l.fireId || i}>
          
          {/* 1. TÍTULO DEL MES (Fondo azul oscuro) */}
          {mostrarEncabezadoMes && (
            <tr style={{ backgroundColor: '#0f172a' }}>
              <td colSpan="15" style={{ padding: '12px', textAlign: 'center', color: '#38bdf8', fontWeight: 'bold', borderBottom: '1px solid #38bdf8', textTransform: 'uppercase' }}>
                {mesActual}
              </td>
            </tr>
          )}

          {/* 2. FILA DESPLEGABLE DEL DÍA (Gris oscuro, clickeable) */}
          {mostrarEncabezadoDia && (
            <tr 
              onClick={() => toggleDia(diaActual)}
              style={{ backgroundColor: '#1e293b', cursor: 'pointer', borderBottom: '1px solid #334155' }}
              title="Haz clic para expandir o contraer este día"
            >
              <td colSpan="15" style={{ padding: '10px 20px', color: '#e2e8f0', fontWeight: 'bold' }}>
                <span style={{ marginRight: '10px', color: '#38bdf8', fontSize: '14px', display: 'inline-block', width: '15px' }}>
                  {estaExpandido ? '▼' : '▶'}
                </span>
                Registros del {diaActual}
              </td>
            </tr>
          )}

          {/* 3. INICIO DE CONDICIÓN: Las laptops solo se dibujan si estaExpandido es true */}
          {estaExpandido && (
              <tr className="row-hover-simple" style={{ backgroundColor: 'transparent' }}>
                {modoVentas && (
                  <td style={estiloCelda}>
                    <input
                      type="checkbox"
                      checked={laptopsSeleccionadas.some(sel => sel.fireId === l.fireId)}
                      onChange={() => toggleSeleccion && toggleSeleccion(l)}
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '0px',
                        accentColor: '#00ff7f',
                        cursor: 'pointer',
                        appearance: 'auto',
                        WebkitAppearance: 'auto',
                      }}
                    />
                  </td>
                )}
                <td style={{ ...estiloCelda, color: '#94a3b8', textAlign: 'center' }}>{i + 1}</td>
                <td style={{ ...estiloCelda, color: '#e2e8f0' }}>{l.fecha}</td>
                <td style={{ ...estiloCelda, color: '#60a5fa' }}>{l.responsable || l.vendedor}</td>
                <td style={{ ...estiloCelda, color: '#e2e8f0' }}>
                  <span style={{ color: '#94a3b8', marginRight: '4px' }}>{l.marca}</span>
                  {l.modelo}
                </td>
                <td style={{ ...estiloCelda, textAlign: 'center', color: '#fff' }}>
                  {l.procesador || '-'} {l.generacion || l.gen || ''}
                </td>
                <td style={{ ...estiloCelda, textAlign: 'center', color: '#e2e8f0' }}>{l.ram || '-'}</td>
                <td style={{ ...estiloCelda, textAlign: 'center', color: '#e2e8f0' }}>{l.gpu || '-'}</td>
                <td style={{ ...estiloCelda, textAlign: 'center', color: '#e2e8f0' }}>{l.almacenamiento || l.disco || '-'}</td>
                <td style={{ ...estiloCelda, fontFamily: 'monospace', fontSize: '11px', color: '#94a3b8' }}>{l.serial}</td>
                {usuarioLogueado?.rol === 'super_admin' && (
                  <td style={{ ...estiloCelda, color: '#ef4444' }}>S/ {l.precio_costo || 0}</td>
                )}
                <td style={{ ...estiloCelda, color: '#60a5fa', fontWeight: 'bold' }}>S/ {l.precio}</td>
                {usuarioLogueado?.rol === 'super_admin' && (
                  <td style={{ ...estiloCelda, color: '#00ff7f', fontWeight: 'bold' }}>S/ {l.utilidad || 0}</td>
                )}
                <td style={estiloCelda}>
                  <span style={{ 
                    fontSize: '10px', 
                    color: l.estado?.toLowerCase() === 'vendido' ? '#ef4444' : '#00ff7f',
                    textTransform: 'uppercase',
                    fontWeight: 'bold'
                  }}>
                    {l.estado || "STOCK"}
                  </span>
                </td>
                <td style={estiloCelda}>
                  <div className="excel-actions-btns" style={{display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '6px'}}>
                    {modoVentas && l.estado !== 'VENDIDO' && (
                      <button 
                        onClick={() => onVenderClick(l)}
                        style={{ background: '#00ff7f', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 6px' }}
                      >💰</button>
                    )}
                    <button 
                      className={`btn-view-small ${(!l.imagenes || l.imagenes.length === 0) ? 'no-photos' : ''}`} 
                      onClick={() => l.imagenes?.length > 0 && setModalImagen(l.imagenes)}
                      style={{
                        opacity: (l.imagenes?.length > 0) ? 1 : 0.3,
                        cursor: (l.imagenes?.length > 0) ? 'pointer' : 'not-allowed',
                        background: 'transparent', border: 'none'
                      }}
                    >{l.imagenes?.length > 0 ? '👁️' : '🚫'}</button>
                    {puedeEditar(l) && (
                      <>
                        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => activarEdicion(l)}>✏️</button>
                        <button style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => window.confirm(`¿Eliminar ${l.serial}?`) && eliminarProducto(l.fireId, l.serial)}>🗑️</button>
                      </>
                    )}
                  </div>
                </td>
             </tr>
             )}
        </React.Fragment>
      );
    });
  })()}
</tbody>
        </table>
      </div>
    </>
  );
};

export default AlmacenTabla;