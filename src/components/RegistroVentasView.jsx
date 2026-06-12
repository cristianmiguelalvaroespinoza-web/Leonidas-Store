import React, { useState, useEffect } from 'react';
import {
  Save, Laptop, Cpu, Hash, Smartphone, XCircle, Plus, Trash2, Camera, X
} from 'lucide-react';
import styles from './RegistroVentasView.module.css';
import * as XLSX from 'xlsx-js-style';
// Traemos las constantes que ya usas
import {
  OPCIONES_MARCAS, OPCIONES_RAM, OPCIONES_ALMACENAMIENTO, 
  OPCIONES_PROCESADOR, OPCIONES_GPU, PRESETS_MODELOS
} from "../constants/config.js";

const RegistroVentasView = ({
  form,
  setForm,
  manejarCambio,
  guardarLaptop,
  cargando,
  listaSeriales,
  setListaSeriales,
  iniciarEscaneo,
  cancelarEdicion,
  editandoId,
  manejarCambioModeloAuto,
  usuarioLogueado,
  MODELOS_SUGERIDOS,
  OPCIONES_DESTINO,
  OPCIONES_ESTADO,
  setVistaActual,
  laptops
}) => {
  const [mostrarManual, setMostrarManual] = useState({});
  const [mostrarAgenda, setMostrarAgenda] = useState(false);

  const descargarExcelAgenda = () => {
    if (!laptops || laptops.length === 0) {
      alert("No hay registros para descargar.");
      return;
    }

    const datosExcel = laptops.slice().reverse().map(laptop => ({
      "FECHA": laptop.fecha || 'Sin fecha',
      "HORA": laptop.hora || '--:--',
      "RESPONSABLE": laptop.responsable || laptop.usuario || laptop.vendedor || 'Sistema',
      "MARCA": laptop.marca || '',
      "MODELO": laptop.modelo || '',
      "PROCESADOR": laptop.procesador || '',
      "RAM": laptop.ram || '',
      "ALMACENAMIENTO": laptop.disco || laptop.almacenamiento || '',
      "GPU": laptop.gpu || '',
      "RESPONSABLE INGRESO": laptop.encargado || '' // <--- SOLO AGREGAR ESTA LÍNEA (con su coma en la línea de arriba)
    }));

    const ws = XLSX.utils.json_to_sheet(datosExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agenda Registros");

    const estiloCabecera = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "0F172A" } }
    };
    const rango = XLSX.utils.decode_range(ws['!ref']);
    for(let C = rango.s.c; C <= rango.e.c; ++C) {
      const celda = XLSX.utils.encode_cell({r:0, c:C});
      if(ws[celda]) ws[celda].s = estiloCabecera;
    }

    ws['!cols'] = [{wch: 12}, {wch: 10}, {wch: 25}, {wch: 15}, {wch: 25}, {wch: 15}, {wch: 10}, {wch: 15}, {wch: 15}];

    XLSX.writeFile(wb, "Agenda_Registros_FINPRO.xlsx");
  };

  // RESTRICCIÓN DE VISIBILIDAD DE PRECIO
  const puedeVerPrecioVenta = usuarioLogueado?.rol === 'super_admin' || usuarioLogueado?.rol === 'administrador_ventas';

  useEffect(() => {
    if (editandoId && form.serial) {
      setListaSeriales([form.serial.toUpperCase()]);
      setForm(prev => ({ 
        ...prev, 
        cantidad: 1,
        responsable: prev.responsable || form.responsable 
      })); 
    } else if (!editandoId) {
      setForm(prev => ({ ...prev, cantidad: 1, responsable: usuarioLogueado?.nombre }));
      setListaSeriales([""]); 
    }
  }, [editandoId, form.serial]);

  const manejarEnvioLocal = async (e) => {
  e.preventDefault();

  // 1. Filtramos las cajitas para ignorar las que dejaste vacías
  const serialesValidos = listaSeriales.filter(s => s.trim() !== "");

  // 2. Si presionas guardar sin llenar ni una sola cajita, te avisa
  if (serialesValidos.length === 0) {
    alert("El equipo debe tener al menos un número de serie.");
    return;
  }

  // 3. EL TRUCO: Unimos las cajitas con comas y actualizamos el 'form'
  // Así engañamos a la validación antigua para que reciba lo que espera.
  form.serial = serialesValidos.join(', ');
  form.cantidad = serialesValidos.length; // ¡Se calcula solo!

  // 4. Mandamos a guardar
  const exito = await guardarLaptop(e);
  
  if (exito !== false) {
    setListaSeriales([""]);
  }
};

  const manejarCancelarLocal = () => {
    let confirmar = true;
    if (editandoId) {
      confirmar = window.confirm("¿DESEA VOLVER AL MENÚ PRINCIPAL (Excel Local)? Se perderán los cambios no guardados.");
    }

    if (confirmar) {
      if (setVistaActual) {
        setVistaActual('excel_interno'); 
      }
      cancelarEdicion(); 
    }
  };

  const hasUserData = () => {
    const fieldsToCheck = [
      'marca', 'modelo', 'precio', 'precio_costo', 'procesador', 'generacion',
      'ram', 'almacenamiento', 'gpu', 'cliente', 'dni', 'cel', 'destino'
    ];

    for (const field of fieldsToCheck) {
      if (form[field] && form[field].toString().trim() !== '') {
        return true;
      }
    }

    if (editandoId) {
      if (form.serial && form.serial.trim() !== '') return true;
    } else {
      if (listaSeriales.some(s => s && s.trim() !== '')) return true;
    }

    if (form.imagenes && form.imagenes.length > 0) return true;
    return false;
  };

  const resetearFormulario = () => {
    setForm({
      marca: '', modelo: '', precio: '', precio_costo: '', serial: '',
      procesador: '', generacion: '',
      ram: '', almacenamiento: '',
      gpu: '', cliente: '', dni: '', cel: '', destino: '', pago: 'EFECTIVO',
      estado: 'STOCK', imagenes: [],
      cantidad: 1,
      responsable: usuarioLogueado?.nombre,
      encargado: '' // <--- ¡SOLO DEBES AGREGAR ESTA LÍNEA!
    });
    setListaSeriales([""]); 
  };

  const renderCampoMixto = (label, nombre, opciones) => {
    const esOtro = mostrarManual[nombre];
    return (
      <div className={styles.campo}>
        <label>{label}</label>
        <div className={styles.inputGroupMixto}>
          {!esOtro ? (
            <select
              name={nombre}
              value={form[nombre]}
              onChange={(e) => {
                if (e.target.value === "OTRO...") setMostrarManual({...mostrarManual, [nombre]: true});
                else manejarCambio(e);
              }}
            >
              <option value="">Seleccionar...</option>
              {(opciones || []).filter(o => o !== "OTRO...").map(opt => <option key={opt} value={opt}>{opt}</option>)}
              <option value="OTRO...">➕ OTRO...</option>
            </select>
          ) : (
            <div className={styles.inputManualWrapper} style={{ display: 'flex', gap: '5px' }}>
              <input
                type="text"
                name={nombre}
                value={form[nombre]}
                onChange={manejarCambio}
                autoFocus
                placeholder="Escriba manualmente..."
              />
              <button type="button" onClick={() => setMostrarManual({...mostrarManual, [nombre]: false})} className={styles.btnCloseManual}>
                <XCircle size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.registroContainer} fade-in`}>
      <form className={styles.formularioLeonidas} onSubmit={(e) => e.preventDefault()}>
       <header className={styles.formHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
          {editandoId ? '🔧 EDITANDO EQUIPO' : '📝 REGISTRO DE VENTA'}
        </h2>
        
        <button
          type="button" 
          onClick={() => setMostrarAgenda(true)}
          style={{
            background: 'rgba(168, 85, 247, 0.1)', 
            border: '1px solid #a855f7',
            color: '#d8b4fe',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s ease-in-out'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.3)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)'}
        >
          📅 AGENDA
        </button>
      </header>

        <div className={styles.formGrid}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {renderCampoMixto("MARCA", "marca", OPCIONES_MARCAS)}

            <div className={styles.campo}>
              <label>MODELO (AUTOPRESS O OPCIONAL)</label>
              <input
                list="modelos-filtrados"
                name="modelo"
                value={form.modelo}
                onChange={manejarCambioModeloAuto}
                placeholder={form.marca ? `Modelos de ${form.marca}...` : "Elija marca primero"}
                disabled={!form.marca}
              />
              <datalist id="modelos-filtrados">
                {Object.keys(PRESETS_MODELOS).map(m => {
                  const sugerencias = MODELOS_SUGERIDOS[form.marca] || [];
                  return sugerencias.some(s => s.toUpperCase() === m) ? <option key={m} value={m} /> : null;
                })}
              </datalist>
            </div>
          </div>

          <div className={styles.seccionRecuadroTecnico} style={{ marginTop: '20px', padding: '15px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(255,255,255,0.03)' }}>
            <h3 className={styles.subtitulo} style={{ marginBottom: '15px', color: '#3397d1', fontSize: '0.85rem' }}>🛠️ CARACTERÍSTICAS TÉCNICAS</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              <div className={styles.campo}><label>PROCESADOR</label><input name="procesador" value={form.procesador} onChange={manejarCambio} placeholder="Ej: Core i9" /></div>
              <div className={styles.campo}><label>GENERACIÓN</label><input name="generacion" value={form.generacion} onChange={manejarCambio} placeholder="12va Gen" /></div>
              <div className={styles.campo}><label>RAM</label><input name="ram" value={form.ram} onChange={manejarCambio} placeholder="16 GB" /></div>
              <div className={styles.campo}><label>ALMACENAMIENTO</label><input name="almacenamiento" value={form.almacenamiento} onChange={manejarCambio} placeholder="1 TB SSD" /></div>
              <div className={styles.campo}><label>GPU (GRÁFICOS)</label><input name="gpu" value={form.gpu} onChange={manejarCambio} placeholder="RTX 4060" /></div>
            </div>
          </div>

          <div className={styles.seccionStock} style={{ marginTop: '20px' }}>
            {/* Contenedor flexible exclusivo para Stock y N/Pedido */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', flexWrap: 'wrap', marginBottom: '15px' }}>
          
          {/* Campo Cantidad (Stock) - Con maxWidth */}
          <div className={styles.campo} style={{ maxWidth: '200px', minWidth: '150px' }}>
            <label>CANTIDAD (STOCK)</label>
            <input
              type="number"
              name="cantidad"
              value={form.cantidad || ""}
              min="1"
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setForm({ ...form, cantidad: val });
                if (val >= 0) {
                  const nuevaLista = [...listaSeriales];
                  if (val > nuevaLista.length) {
                    setListaSeriales([...nuevaLista, ...Array(val - nuevaLista.length).fill("")]);
                  } else {
                    setListaSeriales(nuevaLista.slice(0, val));
                  }
                }
              }}
            />
          </div>

          {/* Nuevo Campo N/Pedido - Con maxWidth limitado para que no se estire */}
          <div className={styles.campo} style={{ maxWidth: '300px', flex: 1, minWidth: '200px' }}>
            <label>N/PEDIDO</label>
            <input
              type="text"
              name="n_pedido"
              placeholder="Ej: PED-001..."
              value={form.n_pedido || ""}
              onChange={(e) => setForm({ ...form, n_pedido: e.target.value.toUpperCase() })}
            />
          </div>
{/* Nuevo Campo ENCARGADO / RESPONSABLE */}
          <div className={styles.campo} style={{ maxWidth: '300px', flex: 1, minWidth: '200px' }}>
            <label>RESPONSABLE</label>
            <input
              type="text"
              name="encargado"
              placeholder="Ej: Juan Pérez..."
              value={form.encargado || ""}
              onChange={(e) => setForm({ ...form, encargado: e.target.value.toUpperCase() })}
            />
          </div>
        </div>

        {/* ¡IMPORTANTE! La sección de SERIALES debe empezar AQUÍ, FUERA del div flexible anterior */}
        <div style={{ marginTop: '10px' }}>
          <h4>ESCANEAR SERIALES</h4>
          {/* ... resto de tu código de seriales ... */}

              <div className={styles.seccionRecuadroSeriales} style={{ padding: '15px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                <label className={styles.fullWidthLabel} style={{ display: 'block', marginBottom: '10px', color: '#3397d1', fontSize: '0.85rem' }}>📋 ESCANEAR SERIALES ({listaSeriales.length})</label>
                <div className={styles.gridSeriales} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px' }}>
                  {listaSeriales.map((s, index) => (
                    <div key={index} className={styles.serialInputRow} style={{ display: 'flex', gap: '5px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <input
                        type="text"
                        placeholder={`Serie #${index + 1}`}
                        value={s}
                        required
                        style={{ border: 'none', background: 'transparent', color: 'white' }}
                        onChange={(e) => {
                          const n = [...listaSeriales];
                          n[index] = e.target.value.toUpperCase();
                          setListaSeriales(n);
                        }}
                        onKeyDown={(e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  }}
                      />
                      <button type="button" onClick={() => iniciarEscaneo(index)} className={styles.btnScan} style={{ padding: '6px', background: '#3397d1', color: 'white', border: 'none', borderRadius: '4px' }}>
                        <Camera size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginTop: '20px' }}>
            <div className={styles.campo}>
              {usuarioLogueado?.rol === 'super_admin' ? (
                <>
                  <label style={{ color: '#00ff7f', fontWeight: 'bold' }}>REGISTRADO POR</label>
                  <select name="responsable" value={form.responsable || ""} onChange={manejarCambio} style={{ border: '1px solid #00ff7f', background: 'rgba(0, 255, 127, 0.05)', color: 'white' }}>
                    <option value="">Seleccionar Vendedor...</option>
                    <option value="Leonidas">Leonidas</option>
                    <option value="David">David</option>
                    <option value="Cristofer">Cristofer</option>
                    <option value="Yael">Yael</option>
                  </select>
                </>
              ) : (
                <>
                  <label>REGISTRADO POR</label>
                  <input type="text" value={form.responsable || "Pendiente"} disabled className={styles.inputLocked} style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa' }} />
                </>
              )}
            </div>

            {/* PRECIO VENTA / COSTO CON RESTRICCIÓN VISUAL */}
            {puedeVerPrecioVenta && (
              <div className={styles.campo}>
                <label style={{ color: usuarioLogueado?.rol === 'super_admin' ? '#00ff7f' : 'inherit' }}>
                  {usuarioLogueado?.rol === 'super_admin' ? 'PRECIO COSTO (S/.)' : 'PRECIO VENTA (S/.)'}
                </label>
                <input
                  type="number"
                  name={usuarioLogueado?.rol === 'super_admin' ? "precio_costo" : "precio"}
                  placeholder={usuarioLogueado?.rol === 'super_admin' ? "Inversión" : ""}
                  value={usuarioLogueado?.rol === 'super_admin' ? (form.precio_costo || "") : form.precio}
                  onChange={manejarCambio}
                  disabled={(usuarioLogueado?.rol !== 'super_admin' && usuarioLogueado?.rol !== 'administrador_ventas') && !editandoId}
                  style={usuarioLogueado?.rol === 'super_admin' ? { border: '1px solid #00ff7f', background: 'rgba(0, 255, 127, 0.05)' } : {}}
                />
              </div>
            )}
            
            {usuarioLogueado?.rol === 'super_admin' ? (
                <div className={styles.campo}>
                    <label>PRECIO VENTA (S/.)</label>
                    <input type="number" name="precio" value={form.precio} onChange={manejarCambio} />
                </div>
            ) : (
                <div className={styles.campo}><label>CLIENTE</label><input name="cliente" value={form.cliente} onChange={manejarCambio} /></div>
            )}
            
            <div className={styles.campo}>
                {usuarioLogueado?.rol === 'super_admin' ? (
                    <><label>CLIENTE</label><input name="cliente" value={form.cliente} onChange={manejarCambio} /></>
                ) : (
                    <><label>CELULAR</label><input name="cel" value={form.cel} onChange={manejarCambio} /></>
                )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginTop: '10px' }}>
            {usuarioLogueado?.rol === 'super_admin' && (
              <div className={styles.campo}><label>CELULAR</label><input name="cel" value={form.cel} onChange={manejarCambio} /></div>
            )}
            <div style={{ gridColumn: usuarioLogueado?.rol === 'super_admin' ? 'span 1' : 'span 2' }}>
              {renderCampoMixto("DESTINO", "destino", OPCIONES_DESTINO)}
            </div>
            <div className={styles.campo}>
              <label>ESTADO</label>
              <select name="estado" value={form.estado} onChange={manejarCambio}>
                {OPCIONES_ESTADO.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div className={styles.campo}>
              <label>IMÁGEN REFERENCIAL</label>
              <div className={styles.fileInputWrapper}>
                <label htmlFor="imagenes-registro" className={styles.fileInputLabel}>
                  {form.imagenes && form.imagenes.length > 0 ? `${form.imagenes.length} archivo(s)` : 'Seleccionar archivos...'}
                </label>
                <input type="file" id="imagenes-registro" name="imagenes" onChange={manejarCambio} multiple accept="image/*" className={styles.fileInput} />
              </div>
            </div>
          </div>
        </div>

        <footer className={styles.formFooterButtons} style={{ display: 'flex', gap: '15px', marginTop: '30px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
          <button type="submit" className={styles.btnSave} disabled={cargando} onClick={manejarEnvioLocal} style={{ flex: 2, padding: '15px', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#3397d1', color: 'white', border: 'none' }}>
            <Save size={18} />
            {cargando ? '⌛ PROCESANDO...' : (editandoId ? 'ACTUALIZAR EQUIPO' : 'GUARDAR EQUIPO')}
          </button>
          
          <button type="button" onClick={manejarCancelarLocal} style={{ flex: 1, background: '#94a3b8', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <X size={18} /> CANCELAR / VOLVER
          </button>

          {hasUserData() && (
            <button type="button" onClick={() => {
                let confirmarBorrar = editandoId 
                  ? window.confirm("¿ESTÁS SEGURO DE BORRAR? Se limpiarán todos los campos del formulario de edición.")
                  : window.confirm("¿Deseas limpiar todos los campos del formulario de registro?");
                if (confirmarBorrar) resetearFormulario();
              }} 
              style={{ flex: 1, background: '#64748b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ❌ BORRAR 
            </button>
          )}
        </footer>
      </form>
      {/* =========================================
          MODAL DE AGENDA (BITÁCORA DE REGISTROS)
          ========================================= */}
      {mostrarAgenda && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#0f172a', width: '90%', maxWidth: '900px',
            maxHeight: '80vh', borderRadius: '12px', border: '1px solid #334155',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            {/* CABECERA DEL MODAL */}
            <div style={{ 
              padding: '20px', borderBottom: '1px solid #1e293b', 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(168, 85, 247, 0.1)'
            }}>
              <h3 style={{ margin: 0, color: '#d8b4fe', display: 'flex', alignItems: 'center', gap: '10px' }}>
                📅 AGENDA DE REGISTROS
              </h3>
              
              {/* Aquí agrupamos el botón de Excel y la X para cerrar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button
                  type="button"
                  onClick={descargarExcelAgenda}
                  style={{
                    background: '#10B981', color: 'white', border: 'none',
                    padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
                    fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px',
                    fontSize: '13px', transition: 'transform 0.1s'
                  }}
                  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                  onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  📊 EXCEL
                </button>
                <button 
                  type="button"
                  onClick={() => setMostrarAgenda(false)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', padding: '0 5px' }}
                >
                  ✖
                </button>
              </div>
            </div>

            {/* CUERPO DEL MODAL (TABLA) */}
            <div style={{ padding: '20px', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: '#e2e8f0', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #334155', textAlign: 'left', color: '#94a3b8' }}>
                    <th style={{ padding: '12px 8px' }}>FECHA / HORA</th>
                    <th style={{ padding: '12px 8px' }}>USUARIO</th>
                    <th style={{ padding: '12px 8px' }}>EQUIPO</th>
                    <th style={{ padding: '12px 8px' }}>ESPECIFICACIONES</th>
                    <th style={{ padding: '12px 8px' }}>RESPONSABLE</th>
                  </tr>
                </thead>
                <tbody>
                  {laptops && laptops.length > 0 ? (
                    laptops.slice().reverse().map((laptop, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid #1e293b', backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '12px 8px', color: '#a855f7' }}>
                          {laptop.fecha || 'Sin fecha'}<br/>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>{laptop.hora || '--:--'}</span>
                        </td>
                        <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{laptop.responsable || laptop.usuario || laptop.vendedor || 'Sistema'}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ color: '#38bdf8' }}>{laptop.marca}</span> {laptop.modelo}
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: '13px', color: '#cbd5e1' }}>
                          {laptop.procesador} | {laptop.ram} | {laptop.disco || laptop.almacenamiento} | {laptop.gpu}
                          <td style={{ padding: '12px 8px', color: '#10B981', fontWeight: 'bold' }}>
  {laptop.encargado || '---'}
</td>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No hay registros disponibles.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistroVentasView;