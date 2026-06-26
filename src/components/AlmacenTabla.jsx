import React, { useState } from 'react'; // Añadimos useState
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

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
  toggleSeleccion,
  tienePermiso // <-- NUEVA PROP
}) => {
  const [diasExpandidos, setDiasExpandidos] = React.useState({});
  
  const toggleDia = (dia) => {
    setDiasExpandidos(prev => ({ 
      ...prev, 
      [dia]: prev[dia] !== false ? false : true 
    }));
  };
  
  const puedeEditar = (item) => {
    if (usuarioLogueado?.rol === 'super_admin') return true;
    return tienePermiso && tienePermiso('EDITAR_REGISTRO');
  };

  const puedeEliminar = (item) => {
    if (usuarioLogueado?.rol === 'super_admin') return true;
    return tienePermiso && tienePermiso('ELIMINAR_REGISTRO');
  }

 const descargarExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const nombreHoja = modoVentas ? "Reporte_Ventas" : "Inventario_Almacen";
const worksheet = workbook.addWorksheet(nombreHoja);

      // 1. Armar las columnas base dinámicamente
      const columns = [
        { header: 'N°', key: 'index', width: 6 },
        { header: 'FECHA', key: 'fecha', width: 15 },
        { header: 'VENDEDOR', key: 'vendedor', width: 20 },
        { header: 'MARCA', key: 'marca', width: 15 },
        { header: 'MODELO', key: 'modelo', width: 25 },
        { header: 'PROCESADOR', key: 'procesador', width: 35 },
        { header: 'RAM', key: 'ram', width: 15 },
        { header: 'GPU', key: 'gpu', width: 20 },
        { header: 'DISCO', key: 'disco', width: 15 },
        { header: 'SERIAL', key: 'serial', width: 20 }
      ];

      // Insertar columnas privadas de Super Admin
      if (usuarioLogueado?.rol === 'super_admin') {
        columns.push({ header: 'COSTO', key: 'costo', width: 15 });
      }
      columns.push({ header: 'PRECIO', key: 'precio', width: 15 });
      
      if (usuarioLogueado?.rol === 'super_admin') {
        columns.push({ header: 'UTILIDAD', key: 'utilidad', width: 15 });
      }
      columns.push({ header: 'ESTADO', key: 'estado', width: 15 });

      worksheet.columns = columns;

      // 2. Pintar el encabezado (Fondo oscuro, letras celestes)
      worksheet.getRow(1).eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1426' } };
        cell.font = { color: { argb: 'FF38BDF8' }, bold: true };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { top: { style: 'thin', color: { argb: 'FF334155' } }, left: { style: 'thin', color: { argb: 'FF334155' } }, bottom: { style: 'thin', color: { argb: 'FF334155' } }, right: { style: 'thin', color: { argb: 'FF334155' } } };
      });

      // 3. Procesar las filas y pintarlas (Fondo gris oscuro, letras blancas)
      laptops.forEach((l, i) => {
        const rowData = {
          index: i + 1,
          fecha: l.fecha,
          vendedor: l.responsable || l.vendedor,
          marca: l.marca,
          modelo: l.modelo,
          procesador: `${l.procesador || ''} ${l.generacion || l.gen || ''}`.trim() || 'N/A',
          ram: l.ram || 'N/A',
          gpu: l.gpu || 'N/A',
          disco: l.almacenamiento || l.disco || 'N/A',
          serial: l.serial,
          precio: l.precio || 0,
          estado: l.estado || "STOCK"
        };

        if (usuarioLogueado?.rol === 'super_admin') {
          rowData.costo = l.precio_costo || 0;
          rowData.utilidad = l.utilidad || 0;
        }

        const row = worksheet.addRow(rowData);

        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
          cell.font = { color: { argb: 'FFFFFFFF' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { top: { style: 'thin', color: { argb: 'FF334155' } }, left: { style: 'thin', color: { argb: 'FF334155' } }, bottom: { style: 'thin', color: { argb: 'FF334155' } }, right: { style: 'thin', color: { argb: 'FF334155' } } };
        });
      });

      // 4. Exportar el archivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      // Asegurar que la fecha no tenga "/" que rompan el nombre del archivo
      const fechaLimpia = new Date().toLocaleDateString().replace(/\//g, '-');
      const prefijoArchivo = modoVentas ? "Ventas" : "Inventario";
saveAs(blob, `LeonidasStore_${prefijoArchivo}_${fechaLimpia}.xlsx`);

    } catch (e) {
      console.error(e);
      alert("Error al exportar Reporte de Ventas Oscuro");
    }
  };

  const estiloCelda = { 
    fontSize: '12px', 
    fontWeight: '400', 
    verticalAlign: 'middle',
    padding: '6px 8px', 
    borderBottom: '1px solid #1e293b' 
  };

  // 👇 AQUÍ PEGAS LA FUNCIÓN, JUSTO ANTES DEL RETURN 👇
const obtenerMesYAnio = (fechaString) => {
  if (!fechaString) return 'FECHA DESCONOCIDA';
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const [dia, mes, anio] = fechaString.split('/');
  return `${meses[parseInt(mes) - 1]} ${anio}`;
};

  return (
    <>
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

    return laptops.map((l, i) => {
      const mesActual = obtenerMesYAnio(l.fecha);
      const diaActual = l.fecha;
      
      const mostrarEncabezadoMes = mesActual !== ultimoMesVisto;
      if (mostrarEncabezadoMes) ultimoMesVisto = mesActual;

      const mostrarEncabezadoDia = diaActual !== ultimoDiaVisto;
      if (mostrarEncabezadoDia) ultimoDiaVisto = diaActual;

      // Consultamos a nuestra "memoria" si este día en específico fue clickeado
      const estaExpandido = diasExpandidos[diaActual] !== false;

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
                <td style={{ ...estiloCelda, color: '#60a5fa' }}>
                  {typeof (l.responsable || l.vendedor) === 'object'
                    ? (l.responsable || l.vendedor)?.nombre
                    : (l.responsable || l.vendedor)
                  }
                </td>
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
                      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => activarEdicion(l)}>✏️</button>
                    )}
                    {puedeEliminar(l) && (
                      <button style={{ background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => window.confirm(`¿Eliminar ${l.serial}?`) && eliminarProducto(l.fireId, l.serial)}>🗑️</button>
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