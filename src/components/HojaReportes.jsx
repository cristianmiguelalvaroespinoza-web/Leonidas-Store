import React, { useState, useEffect, useMemo } from 'react'; 
import { suscribirseAInventario, eliminarProducto, actualizarProducto } from '../services/api'; 
import { QrCode } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

// IMPORTACIÓN DEL CSS MODULE
import styles from './HojaReportes.module.css';
const obtenerMesYAnio = (fechaString) => {
  if (!fechaString) return 'FECHA DESCONOCIDA';
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const [dia, mes, anio] = fechaString.split('/');
  return `${meses[parseInt(mes) - 1]} ${anio}`;
};

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

const toggleModelo = (clave) => {
  setModelosExpandidos(prev => ({ ...prev, [clave]: !prev[clave] }));
};
  const esVendedor = usuarioLogueado?.rol === 'vendedor';
  const esSuperAdmin = usuarioLogueado?.rol === 'super_admin'; 
  const esAdmin2 = usuarioLogueado?.rol === 'admin_2'; 
  const stats2026 = useMemo(() => {
    const lista = laptops || [];
    const ventas2026 = lista.filter(l => 
      l && l.fecha && String(l.fecha).includes('2026') && (l.estado === 'VENDIDO')
    );

    const recaudado = ventas2026.reduce((acc, curr) => acc + (Number(curr.precio) || 0), 0);
    const vendidos = ventas2026.length;
    const enTienda = lista.filter(l => l.estado === 'STOCK' || !l.estado).length;
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

    // 4. Filtro por Estado (TODOS, STOCK, VENDIDOS)
    const estadoActual = d.estado || "STOCK";
    if (filtroEstado !== 'TODOS' && estadoActual !== filtroEstado) return false;

    // 5. Filtro por Texto
    const texto = busqueda.toLowerCase().trim();
    if (!texto) return true;
    const caracteristicas = `${d.marca || ''} ${d.modelo || ''} ${d.serial || ''} ${d.procesador || ''} ${d.generacion || d.gen || ''} ${d.ram || ''} ${d.gpu || ''} ${d.almacenamiento || d.disco || ''} ${nombreVendedor}`.toLowerCase();
    return caracteristicas.includes(texto);
  });

  const exportarExcel = () => {
    if (esVendedor) return; 

    // --- INICIO: LÓGICA DE ORDENAMIENTO PARA EXCEL ---
    // Se replica el orden cronológico de la tabla visual para asegurar consistencia en el archivo exportado.
    const obtenerFechaEstandar = (item) => {
      if (item.fechaCreacion?.toDate) {
        const d = item.fechaCreacion.toDate();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
      const stringFecha = String(item.fecha_venta || item.fecha || '');
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

      const esVendido = (item.estado || "STOCK").toUpperCase() === 'VENDIDO';

      if (esSuperAdmin) row['COSTO'] = item.precio_costo || 0;
      row['PRECIO'] = item.precio;
      if (esSuperAdmin) {
        // ✅ CORRECCIÓN: La utilidad en el reporte es 0 si no está vendido.
        row['UTILIDAD'] = esVendido ? (item.utilidad || (Number(item.precio) - Number(item.precio_costo)) || 0) : 0;
      }
      row['ESTADO'] = item.estado || "STOCK";
      row['CLIENTE'] = item.cliente || "N/A";
      row['TELEFONO'] = item.telefono || item.celular || "N/A";

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(datosFormateados);

    // --- INICIO: MAGIA DE COLORES PARA FINPRO STORE ---
    
    // 1. Definimos los colores (sin el símbolo #, usando códigos HEX puros)
    const estiloEncabezado = {
      font: { bold: true, color: { rgb: "FFFFFF" } }, // Letra Blanca
      fill: { fgColor: { rgb: "000000" } },          // Fondo Negro
      alignment: { horizontal: "center", vertical: "center" },
      border: { 
        top: {style: "thin", color: {rgb: "000000"}}, bottom: {style: "thin", color: {rgb: "000000"}}, 
        left: {style: "thin", color: {rgb: "000000"}}, right: {style: "thin", color: {rgb: "000000"}} 
      }
    };

    const estiloCuerpo = {
      font: { color: { rgb: "000000" } },            // Letra Negra
      fill: { fgColor: { rgb: "FFFFFF" } },          // Fondo Blanco
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

  const puedeEditar = (item) => {
    if (usuarioLogueado?.rol === 'super_admin' || 
      usuarioLogueado?.rol === 'administrador_ventas') return true;
    return tienePermiso && tienePermiso('EDITAR_REGISTRO');
  };

  const puedeEliminar = (item) => {
    return tienePermiso && tienePermiso('ELIMINAR_REGISTRO');
  };

  return (
    <div className={styles.reportesContainer}>
      
      {esSuperAdmin && (
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
                <option value="JEFE">JEFE</option>
                <option value="CRISTOFER">CRISTOFER</option>
                <option value="DAVID">DAVID</option>
                <option value="YAEL">YAEL</option>
                <option value="RAY">RAY</option>
                <option value="PERSONAL ADMINISTRADOR">ADMINISTRADOR</option>
            </select>
        </div>

        <div className={`${styles.reportesControls} mobile-stack`} style={{alignItems: 'center'}}>
          <div style={{display: 'flex', alignItems: 'center', flex: 1}}>
            <input
              type="text"
              placeholder="Buscar por marca, modelo o serial..."
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
          <button onClick={() => setFiltroEstado('TODOS')} className={filtroEstado === 'TODOS' ? styles.active : ''}>📋 TODOS ({laptops?.length || 0})</button>
          <button onClick={() => setFiltroEstado('STOCK')} className={filtroEstado === 'STOCK' ? `${styles.active} ${styles.stock}` : ''}>🟢 STOCK</button>
          <button onClick={() => setFiltroEstado('VENDIDO')} className={filtroEstado === 'VENDIDO' ? `${styles.active} ${styles.vendido}` : ''}>🔴 VENDIDOS / SALIDA</button>
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
      </div>
      </div>
      <div className="table-responsive-wrapper">
        <table className={styles.leonidasTable} style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0f172a' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b', borderBottom: '2px solid #334155' }}>
              <th style={{ ...estiloCelda, width: '50px', color: '#94a3b8', textAlign: 'center', fontWeight: '600' }}>#</th>
              <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>FECHA</th>
              {!esVendedor && <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>USUARIO</th>}
              <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>LAPTOP</th>
              <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>CARACTERÍSTICAS</th>
              <th style={{ ...estiloCelda, textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>N/STOCK</th>
              <th style={{ ...estiloCelda, textAlign: 'left', color: '#94a3b8', fontWeight: '600' }}>N/PEDIDO</th>
              {esSuperAdmin && <th style={{ ...estiloCelda, color: '#ef4444', fontWeight: '600' }}>COSTO</th>}
              <th style={{ ...estiloCelda, textAlign: 'center', color: '#60a5fa', fontWeight: '600' }}>PRECIO</th>
              {esSuperAdmin && <th style={{ ...estiloCelda, color: '#00ff7f', fontWeight: '600' }}>GANANCIA</th>}
              <th style={{ ...estiloCelda, textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>ESTADO</th>
              <th style={{ ...estiloCelda, textAlign: 'center', color: '#94a3b8', fontWeight: '600' }}>ACCIONES</th>
            </tr>
          </thead>
        {useMemo(() => {
          // FUNCIÓN DE NORMALIZACIÓN SEGURA Y ÚNICA PARA TODO EL COMPONENTE
          const obtenerFechaEstandar = (item) => {
            if (item.fechaCreacion?.toDate) {
              const d = item.fechaCreacion.toDate();
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }
            const stringFecha = String(item.fecha_venta || item.fecha || '');
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
                const colorEstado = estadoStr === 'VENDIDO' ? '#ef4444' : 
                                    estadoStr === 'SEPARADO' ? '#f59e0b' : '#10b981';
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
              <td colSpan="12" style={{ padding: '12px', textAlign: 'center', color: '#38bdf8', fontWeight: 'bold', borderBottom: '1px solid #38bdf8', textTransform: 'uppercase' }}>
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
              <td colSpan="12" style={{ padding: '10px 20px', color: '#e2e8f0', fontWeight: 'bold' }}>
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
    <td colSpan="12" style={{ padding: '6px 20px', color: '#38bdf8', fontWeight: 'bold', textAlign: 'left', fontSize: '13px' }}>
      <span style={{ marginRight: '10px', display: 'inline-block', width: '15px' }}>
        {modelosExpandidos[claveModelo] ? '▼' : '▶'}
      </span>
      {item.marca} {item.modelo}
    </td>
  </tr>
)}

{/* --- 2. FILA ORIGINAL DE LA LAPTOP (Normal para el resto, oculta para ASUS cerrados) --- */}
{estaExpandido && mostrarFila && (
  <tr style={{ backgroundColor: 'transparent' }}>
                  <td style={{ ...estiloCelda, textAlign: 'center', color: '#94a3b8' }}>{index + 1}</td>
                  <td style={estiloCelda}>{item.fecha}</td>
                  {!esVendedor && <td style={{ ...estiloCelda, color: '#60a5fa' }}>
                    {typeof (item.responsable || item.vendedor) === 'object'
                      ? (item.responsable || item.vendedor)?.nombre
                      : (item.responsable || item.vendedor)
                    }
                  </td>}
                  <td style={estiloCelda}><strong>{item.marca}</strong> {item.modelo}</td>
                  <td style={{ ...estiloCelda, minWidth: '220px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', padding: '2px 0' }}>
                      <span style={{ fontSize: '12px' }}><strong>Proc:</strong> {item.procesador} {item.generacion || item.gen || ''}</span>
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
                  {esSuperAdmin && <td style={{ ...estiloCelda, color: '#ef4444' }}>S/ {item.precio_costo || 0}</td>}
                  <td style={{ ...estiloCelda, textAlign: 'center', color: tienePrecio ? '#60a5fa' : '#ef4444', fontWeight: 'bold' }}>
                    {tienePrecio ? `S/ ${item.precio}` : 'SIN PRECIO'}
                  </td>
                  {esSuperAdmin && <td style={{ ...estiloCelda, color: '#00ff7f', fontWeight: 'bold' }}>
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
        }, [datosFiltrados, diasExpandidos, modelosExpandidos, esVendedor, esSuperAdmin, laptops])}
        </table>
      </div>
    </div>
  );
};

export default HojaReportes;
