import React from 'react';
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
  modoVentas = false 
}) => {

  const puedeEditar = (item) => {
    return usuarioLogueado?.rol === 'super_admin';
  };

  const laptopsVisibles = laptops.filter(lap => {
    if (!lap) return false;
    if (usuarioLogueado?.rol === 'super_admin' || usuarioLogueado?.rol === 'admin_2') {
      return true;
    }
    return (lap.vendedor === usuarioLogueado?.nombre || lap.responsable === usuarioLogueado?.nombre);
  });

  const laptopsFiltradas = laptopsVisibles.filter(l => {
    const texto = busqueda.toLowerCase().trim();
    if (!texto) return true;

    const marca = (l.marca || "").toLowerCase();
    const modelo = (l.modelo || "").toLowerCase();
    const serial = (l.serial || "").toLowerCase();
    const vendedor = (l.responsable || l.vendedor || "").toLowerCase();
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
    XLSX.utils.book_append_sheet(wb, ws, "Reporte_Finpro");
    XLSX.writeFile(wb, `FinproStore_Inventario_${new Date().toLocaleDateString()}.xlsx`);
  };

  const estiloCelda = { 
    fontSize: '13px', 
    fontWeight: '400', 
    verticalAlign: 'middle',
    padding: '4px 8px' 
  };

  return (
    <div className="excel-container fade-in">
      <div className="excel-header-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{color: '#fff', marginBottom: '1rem'}}>📊 {modoVentas ? "TABLA DE VENTAS" : "TABLA DE INVENTARIO"}</h2>
        <button 
          className="btn-excel-download" 
          onClick={descargarExcel}
          title="Exportar registros actuales a archivo Excel"
        >
          📥 Descargar Reporte ({laptopsFiltradas.length})
        </button>
      </div>

      <div className="excel-table-wrapper" style={{ overflowX: 'auto' }}>
        <table className="excel-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#1e293b' }}>
              <th className="p-2" style={{ fontSize: '11px', width: '40px', color: '#94a3b8' }}>#</th>
              <th className="p-2" style={{ fontSize: '11px', textAlign: 'left' }}>FECHA</th>
              <th className="p-2" style={{ fontSize: '11px', textAlign: 'left' }}>VENDEDOR</th>
              <th className="p-2" style={{ fontSize: '11px', textAlign: 'left' }}>LAPTOP</th>
              <th className="p-2" style={{ fontSize: '11px', textAlign: 'center' }}>PROCESADOR / GEN</th>
              <th className="p-2" style={{ fontSize: '11px', textAlign: 'center' }}>RAM</th>
              <th className="p-2" style={{ fontSize: '11px', textAlign: 'center' }}>GPU</th>
              <th className="p-2" style={{ fontSize: '11px', textAlign: 'center' }}>DISCO</th>
              <th className="p-2" style={{ fontSize: '11px', textAlign: 'left' }}>SERIAL</th>

              {usuarioLogueado?.rol === 'super_admin' && (
                <th className="p-2" style={{ fontSize: '11px', textAlign: 'left', color: '#00ff7f' }}>COSTO</th>
              )}

              <th className="p-2" style={{ fontSize: '11px', textAlign: 'left' }}>PRECIO</th>

              {usuarioLogueado?.rol === 'super_admin' && (
                <th className="p-2" style={{ fontSize: '11px', textAlign: 'left', color: '#00ff7f' }}>UTILIDAD</th>
              )}

              <th className="p-2" style={{ fontSize: '11px', textAlign: 'left' }}>ESTADO</th>
              <th className="p-2" style={{ fontSize: '11px', textAlign: 'center' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {laptopsFiltradas.map((l, i) => (
              <tr key={l.fireId || i} className={`row-excel-compact ${puedeEditar(l) ? "row-editable" : "row-readonly"}`}>
                <td style={{ ...estiloCelda, color: '#94a3b8', textAlign: 'center' }}>{i + 1}</td>
                <td style={estiloCelda}>{l.fecha}</td>
                <td style={{ ...estiloCelda, color: '#60a5fa' }}>{l.responsable || l.vendedor}</td>
                <td style={estiloCelda}>
                  <span style={{ color: '#94a3b8', marginRight: '4px' }}>{l.marca}</span>
                  {l.modelo}
                </td>
                <td className="text-center" style={estiloCelda}>
                  <span style={{ color: '#fff' }}>
                    {l.procesador || '-'} {l.generacion || l.gen || ''}
                  </span>
                </td>
                <td className="text-center" style={estiloCelda}>{l.ram || '-'}</td>
                <td className="text-center" style={estiloCelda}>{l.gpu || '-'}</td>
                <td className="text-center" style={estiloCelda}>{l.almacenamiento || l.disco || '-'}</td>
                <td style={{ ...estiloCelda, fontFamily: 'monospace', fontSize: '12px' }}>{l.serial}</td>
                
                {usuarioLogueado?.rol === 'super_admin' && (
                  <td style={{ ...estiloCelda, color: '#ef4444' }}>S/ {l.precio_costo || 0}</td>
                )}

                <td style={estiloCelda}>
                  <div style={{ fontWeight: 'bold' }}>S/ {l.precio}</div>
                </td>
                
                {usuarioLogueado?.rol === 'super_admin' && (
                  <td style={{ ...estiloCelda, color: '#00ff7f', fontWeight: 'bold' }}>S/ {l.utilidad || 0}</td>
                )}

                <td>
                  <span className={`excel-badge ${l.estado?.toLowerCase() || 'stock'}`} style={{ fontSize: '11px', fontWeight: '400', padding: '2px 6px' }}>
                    {l.estado || "STOCK"}
                  </span>
                </td>
                <td>
                  <div className="excel-actions-btns" style={{display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '8px'}}>
                    
                    {modoVentas && l.estado !== 'VENDIDO' && (
                      <button 
                        className="btn-vender-ahora" 
                        onClick={() => onVenderClick(l)}
                        title="Registrar venta"
                        style={{
                          background: '#00ff7f',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          fontSize: '1.1rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                      >
                        💰
                      </button>
                    )}

                    {/* BOTÓN DE GALERÍA ACTUALIZADO SEGÚN TU PEDIDO */}
                    <button 
                      className={`btn-view-small ${(!l.imagenes || l.imagenes.length === 0) ? 'no-photos' : ''}`} 
                      onClick={() => {
                        if (l.imagenes && l.imagenes.length > 0) {
                          setModalImagen(l.imagenes);
                        }
                      }}
                      title={l.imagenes && l.imagenes.length > 0 ? "Ver galería de fotos" : "Sin imágenes"}
                      style={{
                        opacity: (l.imagenes && l.imagenes.length > 0) ? 1 : 0.4,
                        cursor: (l.imagenes && l.imagenes.length > 0) ? 'pointer' : 'not-allowed',
                        filter: (l.imagenes && l.imagenes.length > 0) ? 'none' : 'grayscale(1)'
                      }}
                    >
                      {l.imagenes && l.imagenes.length > 0 ? '👁️' : '🚫'}
                    </button>

                    {puedeEditar(l) && (
                      <>
                        <button 
                          className="btn-edit-small" 
                          onClick={() => activarEdicion(l)}
                          title="Editar especificaciones técnica"
                        >
                          ✏️
                        </button>
                        <button 
                          className="btn-delete-small" 
                          onClick={() => window.confirm(`¿Eliminar ${l.serial}?`) && eliminarProducto(l.fireId, l.serial)}
                          title="Eliminar de la base de datos"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AlmacenTabla;