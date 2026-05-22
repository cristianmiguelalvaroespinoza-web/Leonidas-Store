import React, { useState, useEffect, useMemo } from 'react'; 
import { suscribirseAInventario, eliminarProducto, actualizarProducto } from '../services/api'; 
<<<<<<< HEAD
import * as XLSX from 'xlsx-js-style';

// IMPORTACIÓN DEL CSS MODULE
import styles from './HojaReportes.module.css';
const obtenerMesYAnio = (fechaString) => {
  if (!fechaString) return 'FECHA DESCONOCIDA';
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const [dia, mes, anio] = fechaString.split('/');
  return `${meses[parseInt(mes) - 1]} ${anio}`;
};
=======
import * as XLSX from 'xlsx';

// IMPORTACIÓN DEL CSS MODULE
import styles from './HojaReportes.module.css';
>>>>>>> a344bf8000a18a8d0969e2771381413d30399cba

const HojaReportes = ({ usuarioLogueado, activarEdicion, setModalImagen, fechaFiltro, setFechaFiltro }) => {
  const [datos, setDatos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  
  // --- NUEVO ESTADO PARA FILTRAR POR VENDEDOR ---
  const [filtroVendedor, setFiltroVendedor] = useState("TODOS");
  const [filtroTiempo, setFiltroTiempo] = useState("TODAS"); // <-- AÑADE ESTA LÍNEA
const [filtroFecha, setFiltroFecha] = useState("");
<<<<<<< HEAD
const [diasExpandidos, setDiasExpandidos] = useState({});

  const toggleDia = (dia) => {
    setDiasExpandidos(prev => ({ 
      ...prev, 
      [dia]: prev[dia] !== false ? false : true 
    }));
  };
=======

>>>>>>> a344bf8000a18a8d0969e2771381413d30399cba
  const esVendedor = usuarioLogueado?.rol === 'vendedor';
  const esSuperAdmin = usuarioLogueado?.rol === 'super_admin'; 
  const esAdmin2 = usuarioLogueado?.rol === 'admin_2'; 

  useEffect(() => {
    const desubscribir = suscribirseAInventario((productos) => {
      setDatos(productos);
    });
    return () => desubscribir();
  }, []);

  const stats2026 = useMemo(() => {
    const lista = datos || [];
    const ventas2026 = lista.filter(l => 
      l && l.fecha && String(l.fecha).includes('2026') && (l.estado === 'VENDIDO')
    );

    const recaudado = ventas2026.reduce((acc, curr) => acc + (Number(curr.precio) || 0), 0);
    const vendidos = ventas2026.length;
    const enTienda = lista.filter(l => l.estado === 'STOCK' || !l.estado).length;
    const utilidadTotal = ventas2026.reduce((acc, curr) => acc + (Number(curr.utilidad) || 0), 0);

    return { recaudado, vendidos, enTienda, utilidadTotal };
  }, [datos]);

  const limpiarFiltros = () => {
    setBusqueda("");
    setFechaFiltro(""); 
    setFiltroEstado('TODOS');
    setFiltroVendedor('TODOS'); // Limpiamos también el vendedor
  };

 // --- LÓGICA DE FILTRADO ACTUALIZADA ---
  const datosFiltrados = datos.filter(d => {
    if (!d) return false;

    // 1. Filtro por Vendedor
    const nombreVendedor = (d.responsable || d.vendedor || "").toUpperCase();
    const pasaVendedor = filtroVendedor === "TODOS" || nombreVendedor.includes(filtroVendedor);
    if (!pasaVendedor) return false;

    // 2. Filtro por Tiempo (ACTUALIZADO PARA MINI CALENDARIO)
    if (filtroTiempo !== "TODAS") {
      // Priorizamos la fecha de venta si existe, si no, la de registro
      const fechaStr = d.fecha_venta || d.fecha || "";
      const separador = fechaStr.includes('-') ? '-' : '/';
      const partesFecha = fechaStr.split(separador);

      if (partesFecha.length === 3) {
        const dia = parseInt(partesFecha[0], 10);
        const mes = parseInt(partesFecha[1], 10);
        const anio = parseInt(partesFecha[2], 10);

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
      } else {
        // Si la fecha está vacía o tiene un formato raro, la ocultamos en los filtros
        return false; 
      }
    }

    // 3. Filtro por Fecha Exacta (Input de calendario original)
    if (fechaFiltro) {
      const [year, month, day] = fechaFiltro.split('-');
      const fechaFormateada = `${parseInt(day)}/${parseInt(month)}/${year}`;
      if (d.fecha !== fechaFormateada && d.fecha_venta !== fechaFormateada) return false;
    }

    // 4. Filtro por Estado (TODOS, STOCK, VENDIDOS)
    const estadoActual = d.estado || "STOCK";
    if (filtroEstado !== 'TODOS' && estadoActual !== filtroEstado) return false;

    // 5. Filtro por Texto
    const texto = busqueda.toLowerCase().trim();
    if (!texto) return true;
    const caracteristicas = `${d.marca || ''} ${d.modelo || ''} ${d.serial || ''} ${d.procesador || ''} ${d.generacion || d.gen || ''} ${d.ram || ''} ${d.gpu || ''} ${d.almacenamiento || d.disco || ''} ${nombreVendedor}`.toLowerCase();
    return caracteristicas.includes(texto);
  });

  const datosOrdenados = useMemo(() => {
    return [...datosFiltrados].sort((a, b) => {
      const fechaA = new Date(a.fecha.split('/').reverse().join('-'));
      const fechaB = new Date(b.fecha.split('/').reverse().join('-'));
      return fechaB - fechaA; 
    });
  }, [datosFiltrados]);

  const exportarExcel = () => {
    if (esVendedor) return; 
    const datosFormateados = datosOrdenados.map((item, i) => {
      const row = {
        'N°': i + 1,
        FECHA: item.fecha,
        VENDEDOR: item.responsable || item.vendedor,
        MARCA: item.marca,
        MODELO: item.modelo,
        PROCESADOR: `${item.procesador || ''} ${item.generacion || item.gen || ''}`.trim() || 'N/A',
        RAM: item.ram || 'N/A',
        GPU: item.gpu || 'N/A',
        DISCO: item.almacenamiento || item.disco || 'N/A',
        SERIAL: item.serial,
      };

      if (esSuperAdmin) row['COSTO'] = item.precio_costo || 0;
      row['PRECIO'] = item.precio;
      if (esSuperAdmin) row['UTILIDAD'] = item.utilidad || 0;

      row['ESTADO'] = item.estado || "STOCK";
      row['CLIENTE'] = item.cliente || "N/A";
      row['TELEFONO'] = item.telefono || item.celular || "N/A";

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(datosFormateados);

    // --- INICIO: MAGIA DE COLORES PARA FINPRO STORE ---
    
    // 1. Definimos los colores (sin el símbolo #, usando códigos HEX puros)
    const estiloEncabezado = {
      font: { bold: true, color: { rgb: "38BDF8" } }, // Letra Celeste Neón
      fill: { fgColor: { rgb: "0F172A" } },          // Fondo muy oscuro (casi negro)
      alignment: { horizontal: "center", vertical: "center" },
      border: { 
        top: {style: "thin", color: {rgb: "334155"}}, bottom: {style: "thin", color: {rgb: "334155"}}, 
        left: {style: "thin", color: {rgb: "334155"}}, right: {style: "thin", color: {rgb: "334155"}} 
      }
    };

    const estiloCuerpo = {
      font: { color: { rgb: "E2E8F0" } },            // Letra blanco/grisáceo
      fill: { fgColor: { rgb: "1E293B" } },          // Fondo Azul oscuro
      alignment: { horizontal: "center", vertical: "center" },
      border: { 
        top: {style: "thin", color: {rgb: "334155"}}, bottom: {style: "thin", color: {rgb: "334155"}}, 
        left: {style: "thin", color: {rgb: "334155"}}, right: {style: "thin", color: {rgb: "334155"}} 
      }
    };

    // 2. Recorremos celda por celda como un pintor
    const rango = XLSX.utils.decode_range(ws['!ref']);
    for (let F = rango.s.r; F <= rango.e.r; F++) {
      for (let C = rango.s.c; C <= rango.e.c; C++) {
        const celda = ws[XLSX.utils.encode_cell({ r: F, c: C })];
        if (!celda) continue;
        
        // Si es la Fila 0 (los títulos), le damos estilo de Encabezado, sino estilo de Cuerpo
        celda.s = F === 0 ? estiloEncabezado : estiloCuerpo;
      }
    }

    // 3. Ensanchamos las columnas para que la información no se vea apretada
    ws['!cols'] = Array(rango.e.c + 1).fill({ wch: 18 });
    
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
    return esSuperAdmin || esAdmin2 || item.responsable === usuarioLogueado?.nombre;
  };

  const tienePermisoCritico = (item) => {
    if (esVendedor || esAdmin2) return false;
    return esSuperAdmin || item.responsable === usuarioLogueado?.nombre;
  };

  return (
    <div className={styles.reportesContainer}>
      
      {esSuperAdmin && (
        <div className={styles.contenedorEstadisticasAnuales}>
          <div className={styles.tarjetaAnual} style={{ '--color-borde': '#10b981' }}>
            <div className={styles.infoTarjeta}>
              <span>💰 TOTAL RECAUDADO 2026</span>
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
            {esVendedor ? "🚀 Panel de Ventas Leonidas" : "📊 TABLA GENERAL Y BASE DE DATOS"}
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
    minWidth: '260px',          // Aseguramos un ancho mínimo
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
                <option value="LEONIDAS">LEONIDAS</option>
                <option value="CRISTOFER">CRISTOFER</option>
                <option value="DAVID">DAVID</option>
                <option value="YAEL">YAEL</option>
                <option value="PERSONAL ADMINISTRADOR">PERSONAL ADMINISTRADOR</option>
            </select>
        </div>

        <div className={styles.reportesControls}>
          <input
  type="text"
  placeholder="Buscar por marca, modelo o serial..."
  className={styles.inputBusqueda} // <-- TU CLASE SE MANTIENE
  value={busqueda}
  onChange={(e) => setBusqueda(e.target.value)}
  style={{ flex: 1, height: '40px', borderRadius: '6px', padding: '0 15px' }}
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

          <input 
            type="date" 
            title="Filtrar por fecha específica"
            value={fechaFiltro || ""} 
            onChange={(e) => setFechaFiltro(e.target.value)} 
            className={styles.inputFecha}
            style={{ height: '40px' }}
          />
          {!esVendedor && (
            <button 
              onClick={exportarExcel} 
              className={styles.btnExcel}
              title="Descargar lista actual en Excel"
              style={{ height: '40px' }}
            >
              📥 Excel
            </button>
          )}
        </div>
      </div>

    {/* --- CONTENEDOR FLEX PARA ALINEAR PESTAÑAS Y SELECTOR --- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
        
        {/* Pestañas originales */}
        <div className={styles.estadoTabs} style={{ margin: 0 }}>
          <button onClick={() => setFiltroEstado('TODOS')} className={filtroEstado === 'TODOS' ? styles.active : ''}>📋 TODOS ({datos.length})</button>
          <button onClick={() => setFiltroEstado('STOCK')} className={filtroEstado === 'STOCK' ? `${styles.active} ${styles.stock}` : ''}>🟢 STOCK</button>
          <button onClick={() => setFiltroEstado('VENDIDO')} className={filtroEstado === 'VENDIDO' ? `${styles.active} ${styles.vendido}` : ''}>🔴 VENDIDOS</button>
        </div>

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
      <div className={styles.tableWrapper} style={{ overflowX: 'auto', borderRadius: '8px' }}>
        <table className={styles.leonidasTable} style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #334155' }}>
              <th style={{ ...estiloCelda, width: '40px', color: '#94a3b8', textAlign: 'center', fontWeight: '600' }}>#</th>
              <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>FECHA</th>
              {!esVendedor && <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>USUARIO</th>}
              <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>LAPTOP</th>
              <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>CARACTERÍSTICAS</th>
              {esSuperAdmin && <th style={{ ...estiloCelda, color: '#ef4444', fontWeight: '600' }}>COSTO</th>}
              <th style={{ ...estiloCelda, textAlign: 'center', color: '#60a5fa', fontWeight: '600' }}>PRECIO</th>
              {esSuperAdmin && <th style={{ ...estiloCelda, color: '#00ff7f', fontWeight: '600' }}>UTILIDAD</th>}
              <th style={{ ...estiloCelda, textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>ESTADO</th>
              <th style={{ ...estiloCelda, textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>ACCIONES</th>
            </tr>
          </thead>
<<<<<<< HEAD
        <tbody>
  {(() => {
    let ultimoMesVisto = null;
    let ultimoDiaVisto = null;

    return datosOrdenados.map((item, index) => {
      // --- NUESTRO MOTOR DE FECHAS ---
      const mesActual = obtenerMesYAnio(item.fecha);
      const diaActual = item.fecha;
      
      const mostrarEncabezadoMes = mesActual !== ultimoMesVisto;
      if (mostrarEncabezadoMes) ultimoMesVisto = mesActual;

      const mostrarEncabezadoDia = diaActual !== ultimoDiaVisto;
      if (mostrarEncabezadoDia) ultimoDiaVisto = diaActual;

      const estaExpandido = diasExpandidos[diaActual] !== false;

      // --- TUS VARIABLES ORIGINALES INTACTAS ---
      const puedeCambiarEstado = tienePermisoEstado(item);
      const puedeEditarOEliminar = tienePermisoCritico(item);
      const estadoStr = (item.estado || "STOCK").toUpperCase();
      const colorEstado = estadoStr === 'VENDIDO' ? '#ef4444' : 
                          estadoStr === 'SEPARADO' ? '#f59e0b' : '#10b981';
      const tienePrecio = item.precio && Number(item.precio) > 0;
      const tieneFotos = item.imagenes && item.imagenes.length > 0;

      return (
        <React.Fragment key={item.fireId || index}>
          
          {/* TÍTULO DEL MES */}
          {mostrarEncabezadoMes && (
            <tr style={{ backgroundColor: '#0f172a' }}>
              <td colSpan="12" style={{ padding: '12px', textAlign: 'center', color: '#38bdf8', fontWeight: 'bold', borderBottom: '1px solid #38bdf8', textTransform: 'uppercase' }}>
                {mesActual}
              </td>
            </tr>
          )}

          {/* FILA DESPLEGABLE DEL DÍA */}
          {mostrarEncabezadoDia && (
            <tr 
              onClick={() => toggleDia(diaActual)}
              style={{ backgroundColor: '#1e293b', cursor: 'pointer', borderBottom: '1px solid #334155' }}
            >
              <td colSpan="12" style={{ padding: '10px 20px', color: '#e2e8f0', fontWeight: 'bold' }}>
                <span style={{ marginRight: '10px', color: '#38bdf8', fontSize: '14px', display: 'inline-block', width: '15px' }}>
                  {estaExpandido ? '▼' : '▶'}
                </span>
                Registros del {diaActual}
              </td>
            </tr>
          )}

          {estaExpandido && (
            <tr style={{ backgroundColor: 'transparent' }}>
=======
          <tbody>
            {datosOrdenados.map((item, index) => {
              const puedeCambiarEstado = tienePermisoEstado(item);
              const puedeEditarOEliminar = tienePermisoCritico(item);
              const estadoStr = (item.estado || "STOCK").toUpperCase();
              const colorEstado = estadoStr === 'VENDIDO' ? '#ef4444' : 
                                 estadoStr === 'SEPARADO' ? '#f59e0b' : '#10b981';
              const tienePrecio = item.precio && Number(item.precio) > 0;
              const tieneFotos = item.imagenes && item.imagenes.length > 0;

              return (
                <tr key={item.fireId || index} style={{ backgroundColor: 'transparent' }}>
>>>>>>> a344bf8000a18a8d0969e2771381413d30399cba
                  <td style={{ ...estiloCelda, textAlign: 'center', color: '#94a3b8' }}>{index + 1}</td>
                  <td style={estiloCelda}>{item.fecha}</td>
                  {!esVendedor && <td style={{ ...estiloCelda, color: '#60a5fa' }}>{item.responsable || item.vendedor}</td>}
                  <td style={estiloCelda}><strong>{item.marca}</strong> {item.modelo}</td>
                  <td style={{ ...estiloCelda, minWidth: '220px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '2px 0' }}>
                      <span style={{ fontSize: '12px' }}><strong>Proc:</strong> {item.procesador} {item.generacion || item.gen || ''}</span>
                      <span style={{ fontSize: '12px' }}><strong>RAM:</strong> {item.ram} | <strong>Disco:</strong> {item.almacenamiento || item.disco}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace' }}><strong>S/N:</strong> {item.serial}</span>
                    </div>
                  </td>
                  {esSuperAdmin && <td style={{ ...estiloCelda, color: '#ef4444' }}>S/ {item.precio_costo || 0}</td>}
                  <td style={{ ...estiloCelda, textAlign: 'center', color: tienePrecio ? '#60a5fa' : '#ef4444', fontWeight: 'bold' }}>
                    {tienePrecio ? `S/ ${item.precio}` : 'SIN PRECIO'}
                  </td>
                  {esSuperAdmin && <td style={{ ...estiloCelda, color: '#00ff7f', fontWeight: 'bold' }}>S/ {item.utilidad || 0}</td>}
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
                      {puedeEditarOEliminar && (
                        <>
                          <button onClick={() => activarEdicion(item)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0', fontSize: '14px' }}>✏️</button>
                          <button onClick={() => window.confirm("¿Eliminar?") && eliminarProducto(item.fireId, item.serial)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0', fontSize: '14px' }}>🗑️</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
<<<<<<< HEAD
              )} {/* <-- CIERRE DEL DESPLEGABLE */}
        </React.Fragment>
      );
    });
  })()}
=======
              );
            })}
>>>>>>> a344bf8000a18a8d0969e2771381413d30399cba
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HojaReportes;
