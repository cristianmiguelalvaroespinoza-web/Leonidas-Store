import React, { useState, useEffect } from 'react';
import {
  Save, Laptop, Cpu, Hash, Smartphone, XCircle, Plus, Trash2, Camera
} from 'lucide-react';
import styles from './RegistroVentasView.module.css';

// Traemos las constantes que ya usas
import {
  OPCIONES_MARCAS, OPCIONES_RAM, OPCIONES_ALMACENAMIENTO,
  OPCIONES_PROCESADOR, OPCIONES_GPU
} from "../constants/config.js";

const PRESETS_MODELOS = {
  "IDEAPAD SLIM 3 15IAN8": { procesador: "CORE I9", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "1 TB SSD", gpu: "RTX 4060" },
  "IDEAPAD 3": { procesador: "CORE I5", generacion: "12VA GEN", ram: "8 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "LEGION 5": { procesador: "CORE I7", generacion: "13VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 4060" },
  "LOQ": { procesador: "RYZEN 7", generacion: "SERIE 7000", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 4050" },
  "VIVOBOOK 15": { procesador: "CORE I5", generacion: "12VA GEN", ram: "12 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "TUF GAMING F15": { procesador: "CORE I7", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 3050" },
  "ROG STRIX": { procesador: "CORE I9", generacion: "13VA GEN", ram: "32 GB", almacenamiento: "1 TB SSD", gpu: "RTX 4070" },
  "VICTUS 16": { procesador: "CORE I5", generacion: "13VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 4050" },
  "PAVILION 15": { procesador: "CORE I7", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "PROBOOK 450": { procesador: "CORE I5", generacion: "12VA GEN", ram: "8 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "INSPIRON 3520": { procesador: "CORE I3", generacion: "12VA GEN", ram: "8 GB", almacenamiento: "256 GB SSD", gpu: "INTEGRADA" },
  "LATITUDE 5420": { procesador: "CORE I7", generacion: "11VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "ALIENWARE M16": { procesador: "CORE I9", generacion: "13VA GEN", ram: "32 GB", almacenamiento: "1 TB SSD", gpu: "RTX 4080" },
  "MACBOOK AIR M1": { procesador: "CHIP M1", generacion: "8 CORES", ram: "8 GB", almacenamiento: "256 GB SSD", gpu: "7 CORES" },
  "MACBOOK AIR M2": { procesador: "CHIP M2", generacion: "8 CORES", ram: "8 GB", almacenamiento: "256 GB SSD", gpu: "8 CORES" },
  "MACBOOK PRO 14": { procesador: "CHIP M3 PRO", generacion: "11 CORES", ram: "18 GB", almacenamiento: "512 GB SSD", gpu: "14 CORES" },
  "NITRO 5": { procesador: "CORE I5", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 3050" },
  "ASPIRE 5": { procesador: "RYZEN 5", generacion: "SERIE 5000", ram: "8 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "GF63 THIN": { procesador: "CORE I7", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 4050" },
  "KATANA GF66": { procesador: "CORE I7", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 3060" }
};

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
  usuarioLogueado,
  MODELOS_SUGERIDOS,
  OPCIONES_DESTINO,
  OPCIONES_ESTADO,
  setVistaActual
}) => {
  const [mostrarManual, setMostrarManual] = useState({});

  useEffect(() => {
    if (editandoId && form.serial) {
      setListaSeriales([form.serial.toUpperCase()]);
      setForm(prev => ({ ...prev, cantidad: 1 })); 
    } else if (!editandoId) {
      setForm(prev => ({ ...prev, cantidad: 1 }));
      setListaSeriales([""]); 
    }
  }, [editandoId, form.serial]);

  const manejarEnvioLocal = async (e) => {
    e.preventDefault();
    const exito = await guardarLaptop(e);
    if (exito !== false) {
      setListaSeriales([""]);
    }
  };

  const manejarCancelarLocal = () => {
    if (setVistaActual) {
      setVistaActual('excel'); 
    } else {
      cancelarEdicion();
    }
  };

  const manejarCambioModeloAuto = (e) => {
    const modeloTexto = e.target.value.toUpperCase();
    setForm(prev => ({ ...prev, modelo: modeloTexto }));

    const preset = PRESETS_MODELOS[modeloTexto];
    if (preset) {
      setForm(prev => ({ ...prev, ...preset }));
    }
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
              <button type="button" onClick={() => setMostrarManual({...manual, [nombre]: false})} className={styles.btnCloseManual}>
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
      <form className={styles.formularioLeonidas} onSubmit={manejarEnvioLocal}>
        <header className={styles.formHeader}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {editandoId ? '🔧 EDITANDO EQUIPO' : '📝 REGISTRO DE VENTA'}
          </h2>
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

          <div className={styles.seccionRecuadroTecnico} style={{
            marginTop: '20px',
            padding: '15px',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.03)'
          }}>
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
            <div className={styles.stockWrapper} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div className={styles.campo} style={{ maxWidth: '200px' }}>
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

              <div className={styles.seccionRecuadroSeriales} style={{
                padding: '15px',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.02)'
              }}>
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
            {/* NUEVO CAMPO: PRECIO COSTO (SOLO PARA SUPER_ADMIN) */}
            {usuarioLogueado?.rol === 'super_admin' ? (
              <div className={styles.campo}>
                <label style={{ color: '#00ff7f', fontWeight: 'bold' }}>PRECIO COSTO (S/.)</label>
                <input
                  type="number"
                  name="precio_costo"
                  placeholder="Inversión"
                  value={form.precio_costo || ""}
                  onChange={manejarCambio}
                  style={{ border: '1px solid #00ff7f', background: 'rgba(0, 255, 127, 0.05)' }}
                />
              </div>
            ) : (
              <div className={styles.campo}>
                <label>REGISTRADO POR</label>
                <input
                  type="text"
                  value={form.responsable || "Pendiente"}
                  disabled
                  className={styles.inputLocked}
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa' }}
                />
              </div>
            )}

            <div className={styles.campo}>
              <label>PRECIO VENTA (S/.)</label>
              <input
                type="number"
                name="precio"
                value={form.precio}
                onChange={manejarCambio}
                disabled={usuarioLogueado?.rol !== 'super_admin'}
                className={usuarioLogueado?.rol !== 'super_admin' ? styles.inputLocked : ''}
              />
            </div>
            <div className={styles.campo}><label>CLIENTE</label><input name="cliente" value={form.cliente} onChange={manejarCambio} /></div>
            <div className={styles.campo}><label>CELULAR</label><input name="cel" value={form.cel} onChange={manejarCambio} /></div>
          </div>

          {/* Fila inferior para campos restantes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginTop: '10px' }}>
             {/* Si es Super Admin, el responsable se muestra aquí para mantener el orden */}
             {usuarioLogueado?.rol === 'super_admin' && (
              <div className={styles.campo}>
                <label>REGISTRADO POR</label>
                <input
                  type="text"
                  value={form.responsable || "Pendiente"}
                  disabled
                  className={styles.inputLocked}
                  style={{ background: 'rgba(255,255,255,0.05)', color: '#aaa' }}
                />
              </div>
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
          </div>

          <div className={styles.campo} style={{ marginTop: '10px' }}>
            <label>IMÁGENES (MÁX 3)</label>
            <input type="file" name="imagenes" onChange={manejarCambio} multiple accept="image/*" />
          </div>
        </div>

        <footer className={styles.formFooterButtons} style={{ display: 'flex', gap: '15px', marginTop: '30px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
          <button
            type="submit"
            className={styles.btnSave}
            disabled={cargando}
            style={{ flex: 2, padding: '15px', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#3397d1', color: 'white', border: 'none' }}
          >
            <Save size={18} />
            {cargando ? '⌛ PROCESANDO...' : (editandoId ? 'ACTUALIZAR EQUIPO' : 'GUARDAR EQUIPO')}
          </button>
          <button
            type="button"
            onClick={manejarCancelarLocal}
            style={{ flex: 1, background: '#64748b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
          >
            ❌ BORRAR 
          </button>
        </footer>
      </form>
    </div>
  );
};

export default RegistroVentasView;