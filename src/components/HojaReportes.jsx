import React, { useState, useEffect } from 'react';
import { suscribirseAInventario, eliminarProducto, actualizarProducto } from '../services/api'; 
import * as XLSX from 'xlsx';

// IMPORTACIÓN DEL CSS MODULE
import styles from './HojaReportes.module.css';

const HojaReportes = ({ usuarioLogueado, activarEdicion, setModalImagen, fechaFiltro, setFechaFiltro }) => {
  const [datos, setDatos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState('TODOS');

  const esVendedor = usuarioLogueado?.rol === 'vendedor';
  const esSuperAdmin = usuarioLogueado?.rol === 'super_admin'; 
  const esAdmin2 = usuarioLogueado?.rol === 'admin_2'; // Cristofer

  useEffect(() => {
    const desubscribir = suscribirseAInventario((productos) => {
      setDatos(productos);
    });
    return () => desubscribir();
  }, []);

  const datosFiltrados = datos.filter(d => {
    if (!d) return false;
    if (fechaFiltro) {
      const [year, month, day] = fechaFiltro.split('-');
      const fechaFormateada = `${parseInt(day)}/${parseInt(month)}/${year}`;
      if (d.fecha !== fechaFormateada) return false;
    }
    const estadoActual = d.estado || "STOCK";
    if (filtroEstado !== 'TODOS' && estadoActual !== filtroEstado) return false;
    const texto = busqueda.toLowerCase().trim();
    if (!texto) return true;
    const caracteristicas = `${d.marca || ''} ${d.modelo || ''} ${d.serial || ''} ${d.procesador || ''} ${d.generacion || d.gen || ''} ${d.ram || ''} ${d.gpu || ''} ${d.almacenamiento || d.disco || ''} ${d.responsable || ''}`.toLowerCase();
    return caracteristicas.includes(texto);
  });

  const manejarCambioEstado = async (item, nuevoEstado) => {
    try {
      await actualizarProducto(item.fireId, { estado: nuevoEstado });
    } catch (error) {
      console.error("Error al actualizar estado:", error);
      alert("No se pudo actualizar el estado");
    }
  };

  const exportarExcel = () => {
    if (esVendedor) return; 
    const datosFormateados = datosFiltrados.map((item, i) => {
      const row = {
        'N°': i + 1,
        FECHA: item.fecha,
        VENDEDOR: item.responsable,
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
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario Leonidas");
    XLSX.writeFile(wb, `Reporte_LeonidasStore_${new Date().toLocaleDateString()}.xlsx`);
  };

  // Permiso para cambiar el estado (Cristofer SI puede, PERO solo si hay precio)
  const tienePermisoEstado = (item) => {
    if (esVendedor) return false;
    
    // VALIDACIÓN DE PRECIO: Si no hay precio, nadie (excepto tú quizás para pruebas, pero aquí bloqueamos a todos) cambia el estado
    const tienePrecioAsignado = item.precio && Number(item.precio) > 0;
    if (!tienePrecioAsignado) return false;

    return esSuperAdmin || esAdmin2 || item.responsable === usuarioLogueado?.nombre;
  };

  // Permiso para Editar/Eliminar (Cristofer NO puede)
  const tienePermisoCritico = (item) => {
    if (esVendedor || esAdmin2) return false;
    return esSuperAdmin || item.responsable === usuarioLogueado?.nombre;
  };

  return (
    <div className={styles.reportesContainer}>
      <div className={styles.reportesHeader}>
        <h2 className={styles.reportesTitle}>
          {esVendedor ? "🚀 Panel de Ventas Leonidas" : "📊 TABLA GENERAL Y BASE DE DATOS"}
        </h2>
        <div className={styles.reportesControls}>
          <input 
            type="text" 
            placeholder="Buscar por marca, modelo o serial..." 
            className={styles.inputBusqueda} 
            onChange={(e) => setBusqueda(e.target.value)} 
          />
          <input 
            type="date" 
            title="Filtrar por fecha específica"
            value={fechaFiltro || ""} 
            onChange={(e) => setFechaFiltro(e.target.value)} 
            className={styles.inputFecha} 
          />
          {!esVendedor && (
            <button 
              onClick={exportarExcel} 
              className={styles.btnExcel}
              title="Descargar lista actual en Excel"
            >
              📥 Excel
            </button>
          )}
        </div>
      </div>

      <div className={styles.estadoTabs}>
        <button onClick={() => setFiltroEstado('TODOS')} className={filtroEstado === 'TODOS' ? styles.active : ''}>📋 TODOS ({datos.length})</button>
        <button onClick={() => setFiltroEstado('STOCK')} className={filtroEstado === 'STOCK' ? `${styles.active} ${styles.stock}` : ''}>🟢 STOCK</button>
        <button onClick={() => setFiltroEstado('VENDIDO')} className={filtroEstado === 'VENDIDO' ? `${styles.active} ${styles.vendido}` : ''}>🔴 VENDIDOS</button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.leonidasTable}>
          <thead>
            <tr>
              <th className={styles.thNum}>#</th>
              <th>FECHA</th>
              {!esVendedor && <th>VENDEDOR</th>}
              <th>LAPTOP</th>
              <th className={styles.textCenter}>PROCESADOR</th>
              <th className={styles.textCenter}>RAM</th>
              <th className={styles.textCenter}>GPU</th>
              <th className={styles.textCenter}>DISCO</th>
              <th>SERIAL</th>
              {esSuperAdmin && <th style={{ color: '#00ff7f' }}>COSTO</th>}
              <th className={styles.textCenter}>PRECIO</th>
              {esSuperAdmin && <th style={{ color: '#00ff7f' }}>UTILIDAD</th>}
              <th className={styles.textCenter}>ESTADO</th>
              <th className={styles.textCenter}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {datosFiltrados.map((item, index) => {
              const puedeCambiarEstado = tienePermisoEstado(item);
              const puedeEditarOEliminar = tienePermisoCritico(item);
              const estadoStr = (item.estado || "STOCK").toUpperCase();
              const tienePrecio = item.precio && Number(item.precio) > 0;
              
              const colorEstado = estadoStr === 'VENDIDO' ? '#ef4444' : 
                                 estadoStr === 'SEPARADO' ? '#f59e0b' : '#10b981';

              return (
                <tr key={item.fireId || index} className={styles.leonidasRow}>
                  <td className={styles.tdNum}>{index + 1}</td>
                  <td className={styles.tdFecha}>{item.fecha}</td>
                  {!esVendedor && <td className={styles.tdVendedor}>{item.responsable}</td>}
                  <td className={styles.tdLaptop}><strong>{item.marca}</strong> {item.modelo}</td>
                  <td className={styles.tdTech}>{item.procesador} <small>{item.generacion || item.gen || ''}</small></td>
                  <td className={styles.textCenter}>{item.ram}</td>
                  <td className={styles.textCenter} style={{color: '#60a5fa', fontWeight: 'bold'}}>{item.gpu || 'INTEL'}</td>
                  <td className={styles.textCenter}>{item.almacenamiento || item.disco}</td>
                  <td className={styles.tdSerial}>{item.serial}</td>

                  {esSuperAdmin && <td style={{ color: '#888', fontSize: '12px' }}>S/ {item.precio_costo || 0}</td>}
                  <td className={styles.tdPrecio} style={{ color: tienePrecio ? 'inherit' : '#ff4444', fontWeight: tienePrecio ? 'normal' : 'bold' }}>
                    {tienePrecio ? `S/ ${item.precio}` : 'SIN PRECIO'}
                  </td>
                  {esSuperAdmin && <td style={{ color: '#00ff7f', fontWeight: 'bold' }}>S/ {item.utilidad || 0}</td>}
                  
                  {/* ESTADO CON MENÚ DESPLEGABLE CONDICIONAL */}
                  <td className={styles.textCenter}>
                    {puedeCambiarEstado ? (
                      <select
                        value={estadoStr}
                        onChange={(e) => manejarCambioEstado(item, e.target.value)}
                        style={{
                          backgroundColor: colorEstado,
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '2px 4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          outline: 'none'
                        }}
                      >
                        <option value="STOCK">🟢 STOCK</option>
                        <option value="VENDIDO">🔴 VENDIDO</option>
                        <option value="SEPARADO">🟡 SEPARADO</option>
                      </select>
                    ) : (
                      <span style={{ 
                        color: !tienePrecio ? '#777' : colorEstado, 
                        fontWeight: 'bold', 
                        fontSize: '12px',
                        border: `1px solid ${!tienePrecio ? '#444' : colorEstado}`, 
                        padding: '2px 6px', 
                        borderRadius: '4px',
                        display: 'inline-block', 
                        minWidth: '80px',
                        opacity: !tienePrecio ? 0.6 : 1
                      }} title={!tienePrecio ? "Bloqueado: Requiere precio del Super Admin" : ""}>
                        {estadoStr}
                      </span>
                    )}
                  </td>

                  <td>
                    <div className={styles.accionesFlex}>
                      <button onClick={() => setModalImagen(item.imagenes)} title="Ver fotos">👁️</button>
                      
                      {puedeEditarOEliminar ? (
                        <>
                          <button onClick={() => activarEdicion(item)} title="Editar">✏️</button>
                          <button onClick={() => window.confirm("¿Eliminar?") && eliminarProducto(item.fireId, item.serial)} title="Eliminar">🗑️</button>
                        </>
                      ) : (
                        <span className={styles.lockIcon} title="No tienes permiso para editar/eliminar">🔒</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HojaReportes;