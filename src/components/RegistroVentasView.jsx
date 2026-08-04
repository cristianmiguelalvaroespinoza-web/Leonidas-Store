import React, { useState, useEffect } from 'react';
import {
  Save, Laptop, Cpu, Hash, Smartphone, XCircle, Plus, Trash2, Camera, X, Pencil
} from 'lucide-react';
import styles from './RegistroVentasView.module.css';
import * as XLSX from 'xlsx-js-style';
// Traemos las constantes que ya usas
import {
  OPCIONES_MARCAS, OPCIONES_RAM, OPCIONES_ALMACENAMIENTO, 
  OPCIONES_PROCESADOR, OPCIONES_GPU, PRESETS_MODELOS
} from "../constants/config.js";
import { db } from '../firebase'; // Verifica que la ruta apunte a tu archivo firebase.js
import { collection, addDoc, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
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
  laptops,
  tienePermiso
}) => {
  const [mostrarManual, setMostrarManual] = useState({});
  const [mostrarAgenda, setMostrarAgenda] = useState(false);
  const [modalRapidoOpen, setModalRapidoOpen] = useState(false);
  const [editingRapido, setEditingRapido] = useState(null);
  const [modalEdicionRapidaOpen, setModalEdicionRapidaOpen] = useState(false);
  const [registroRapido, setRegistroRapido] = useState({
    fecha: '',
    marca: '',
    cantidad: '',
    encargado: ''
  });
  // 1. Estado para guardar los registros rápidos que traigamos de Firebase
  const [datosRapidos, setDatosRapidos] = useState([]);

  // 2. Efecto para escuchar la nueva colección "registrosRapidos" en tiempo real
  useEffect(() => {
    const qRapidos = collection(db, "registrosRapidos");
    const desuscribir = onSnapshot(qRapidos, (snapshot) => {
      setDatosRapidos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => desuscribir();
  }, []);

  // 3. Función real que guarda los datos en Firebase
  const guardarRapidoBD = async (e) => {
    e.preventDefault();
    try {
      // Formatear la fecha de YYYY-MM-DD a DD/MM/YYYY para que coincida con los demás
      const [anio, mes, dia] = registroRapido.fecha.split('-');
      const fechaFormateada = `${parseInt(dia)}/${parseInt(mes)}/${anio}`;

      await addDoc(collection(db, "registrosRapidos"), {
        fecha: fechaFormateada, // <--- Fecha corregida al formato 23/6/2026
        marca: registroRapido.marca.toUpperCase(),
        cantidad: Number(registroRapido.cantidad),
        encargado: registroRapido.encargado.toUpperCase(),
        
        // 👇 AQUÍ ESTÁ LA CORRECCIÓN DEL USUARIO 👇
        // Usamos el nombre del usuario logueado. Si por alguna razón falla, dirá "Sistema"
        responsable: usuarioLogueado?.nombre || "Sistema", 
        
        hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
        modelo: "---",
        procesador: "---",
        ram: "---",
        disco: "---",
        gpu: "---",
        procedencia: "---",
        equipo: "---"
      });
      
      // Cerramos el modal y limpiamos los campos
      setModalRapidoOpen(false);
      setRegistroRapido({ fecha: '', marca: '', cantidad: '', encargado: '' });
      
    } catch (error) {
      console.error("Error al guardar en Firebase:", error);
      alert("Hubo un error al guardar.");
    }
  };
  const abrirModalEdicionRapida = (registro) => {
    setEditingRapido(registro);
    setModalEdicionRapidaOpen(true);
  };

  const actualizarRegistroRapido = async (e) => {
    e.preventDefault();
    if (!editingRapido) return;

    try {
      const docRef = doc(db, "registrosRapidos", editingRapido.id);
      
      let fechaParaGuardar = editingRapido.fecha;
      // Si la fecha viene del input 'date', estará en formato YYYY-MM-DD
      if (fechaParaGuardar.includes('-')) {
        const [anio, mes, dia] = fechaParaGuardar.split('-');
        fechaParaGuardar = `${parseInt(dia)}/${parseInt(mes)}/${anio}`;
      }

      await updateDoc(docRef, {
        fecha: fechaParaGuardar,
        marca: editingRapido.marca.toUpperCase(),
        cantidad: Number(editingRapido.cantidad),
        encargado: editingRapido.encargado.toUpperCase(),
      });

      setModalEdicionRapidaOpen(false);
      setEditingRapido(null);
      
    } catch (error) {
      console.error("Error al actualizar registro rápido:", error);
      alert("Hubo un error al actualizar.");
    }
  };

  const eliminarRegistroRapido = async (id) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este registro rápido? Esta acción no se puede deshacer.")) {
        try {
            await deleteDoc(doc(db, "registrosRapidos", id));
            // No necesitas hacer nada más, onSnapshot actualizará la tabla automáticamente
        } catch (error) {
            console.error("Error al eliminar el registro:", error);
            alert("Hubo un error al eliminar.");
        }
    }
};
// Función experta en leer tus fechas y horas para ordenarlas cronológicamente
 // Función experta unificada para ordenar cronológicamente
  const convertirFechaHora = (fechaStr, horaStr) => {
    if (!fechaStr || fechaStr === 'Sin fecha') return 0;
    
    let dia, mes, anio;
    // Detecta automáticamente si viene con guiones o barras
    if (fechaStr.includes('-')) {
      [anio, mes, dia] = fechaStr.split('-');
    } else {
      [dia, mes, anio] = fechaStr.split('/');
    }
    
    let horas = 0, minutos = 0;
    if (horaStr && horaStr !== '--:--') {
      const match = horaStr.toLowerCase().match(/(\d+):(\d+)\s*([ap])/);
      if (match) {
        horas = parseInt(match[1], 10);
        minutos = parseInt(match[2], 10);
        if (match[3] === 'p' && horas < 12) horas += 12; // PM a formato 24h
        if (match[3] === 'a' && horas === 12) horas = 0;  // 12 AM a 00h
      }
    }

    return new Date(anio, mes - 1, dia, horas, minutos).getTime();
  };
  const descargarExcelAgenda = () => {
    // Si ambas listas están vacías, no hace nada
    if ((!laptops || laptops.length === 0) && (!datosRapidos || datosRapidos.length === 0)) {
      alert("No hay registros para descargar.");
      return;
    }

    // 👇 AQUÍ ESTÁ EL TRUCO: Juntamos y ordenamos cronológicamente antes de crear el Excel
    const registrosOrdenadosExcel = [...laptops, ...datosRapidos].sort((a, b) => {
      return convertirFechaHora(b.fecha, b.hora) - convertirFechaHora(a.fecha, a.hora);
    });

    // ... (aquí continúa tu código de configuración de estilos de Excel) ...
    // ... (ejemplo: const rows = [ ["FECHA", "HORA", ...], ... ]) ...

// CÓDIGO NUEVO (Ordena por Fecha Y Hora exacta):
    const datosExcel = [...laptops, ...datosRapidos]
        .sort((a, b) => {
            const obtenerValorTiempo = (fechaStr, horaStr) => {
                if (!fechaStr || fechaStr === 'Sin fecha') return 0;
                
                // 1. Extraer Día, Mes y Año
                let anio, mes, dia;
                if (fechaStr.includes('/')) {
                    const partes = fechaStr.split('/');
                    dia = parseInt(partes[0], 10);
                    mes = parseInt(partes[1], 10) - 1; // Los meses en JS empiezan en 0
                    anio = parseInt(partes[2], 10);
                } else if (fechaStr.includes('-')) {
                    const partes = fechaStr.split('-');
                    anio = parseInt(partes[0], 10);
                    mes = parseInt(partes[1], 10) - 1;
                    dia = parseInt(partes[2], 10);
                } else {
                    return 0;
                }

                // 2. Extraer Horas y Minutos (Soporta formato 12h con a. m. / p. m.)
                let horas = 0;
                let minutos = 0;
                if (horaStr && horaStr !== '--:--') {
                    const match = horaStr.match(/(\d+):(\d+)/);
                    if (match) {
                        horas = parseInt(match[1], 10);
                        minutos = parseInt(match[2], 10);
                        
                        const textoHora = horaStr.toLowerCase();
                        // Ajuste para la tarde (1 pm a 11 pm se suman 12 horas)
                        if (textoHora.includes('p') && horas < 12) horas += 12;
                        // Ajuste para la medianoche (12 am se vuelve hora 0)
                        if (textoHora.includes('a') && horas === 12) horas = 0;
                    }
                }
                
                // Devolvemos el valor de tiempo exacto para comparar
                return new Date(anio, mes, dia, horas, minutos).getTime();
            };

            // Ordenamos: El tiempo mayor (más reciente) va primero
            return obtenerValorTiempo(b.fecha, b.hora) - obtenerValorTiempo(a.fecha, a.hora);
        })
        .map(laptop => {
            const especificaciones = laptop.especificaciones || 
                `${laptop.procesador || ''} | ${laptop.ram || ''} | ${laptop.disco || ''} | ${laptop.gpu || ''}`;

            return {
                "FECHA": laptop.fecha || 'Sin fecha',
                "HORA": laptop.hora || '--:--',
                "USUARIO": laptop.usuario || laptop.responsable || '---',
                "MARCA": laptop.marca || '---',
                "MODELO": laptop.modelo || '---',
                "ESPECIFICACIONES": especificaciones,
                "CANTIDAD": laptop.cantidad || 0,
                "ENCARGADO": laptop.encargado || '---',
                "PROCEDENCIA": laptop.procedencia || '---'
            };
        });

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

    ws['!cols'] = [{wch: 12}, {wch: 10}, {wch: 25}, {wch: 20}, {wch: 25}, {wch: 40}, {wch: 10}, {wch: 20}, {wch: 20}];

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

    // 1. Filtramos las cajas
    const serialesValidos = listaSeriales.filter(s => s && s.trim() !== "");

    // 2. Lógica para seriales opcionales
    const serialesFinales = serialesValidos.length > 0 ? serialesValidos.join(', ') : "S/N";

    // 3. Actualizamos el 'form'
    form.serial = serialesFinales;
    form.cantidad = serialesValidos.length > 0 ? serialesValidos.length : (form.cantidad || 1);

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
      'ram', 'almacenamiento', 'gpu'
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
      gpu: '', pago: 'EFECTIVO',
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
          {editandoId ? '🔧 EDITANDO EQUIPO' : '📝 REGISTRO DE EQUIPO'}
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
              <label>MODELO (Incluye Sugerencias Opcionales)</label>
              <input
                list="modelos-filtrados"
                name="modelo"
                value={form.modelo}                onChange={manejarCambioModeloAuto}
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
            <label>ENCARGADO</label>
            <input
              type="text"
              name="encargado"
              placeholder="Ej: Juan Pérez..."
              value={form.encargado || ""}
              onChange={(e) => setForm({ ...form, encargado: e.target.value.toUpperCase() })}
            />
          </div>
          {/* Nuevo campo PROCEDENCIA */}
<div className={styles.campo} style={{ maxWidth: '300px', flex: 1, minWidth: '200px' }}>
    <label>PROCEDENCIA</label>
    <input
        type="text"
        name="procedencia"
        placeholder="Ej: Almacén..."
        value={form.procedencia || ""}
        onChange={(e) => setForm({ ...form, procedencia: e.target.value.toUpperCase() })}
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
                    <option value="Jefe">Jefe</option>
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

            {usuarioLogueado?.rol === 'super_admin' || (tienePermiso && tienePermiso('ASIGNAR_PRECIOS')) ? (
                <div className={styles.campo}>
                    <label style={{ color: '#00ff7f' }}>
                      PRECIO COSTO (S/.)
                    </label>
                    <input type="number" name="precio_costo" value={form.precio_costo} onChange={manejarCambio} placeholder="Inversión"
                      style={{ border: '1px solid #00ff7f', background: 'rgba(0, 255, 127, 0.05)' }}
                    />
                </div>
            ) : (
                <div className={styles.campo}><label>CLIENTE</label><input name="cliente" value={form.cliente} onChange={manejarCambio} /></div>
            )}
            
            <div className={styles.campo}>
                {usuarioLogueado?.rol === 'super_admin' || (tienePermiso && tienePermiso('ASIGNAR_PRECIOS')) ? ( // Este es el campo PRECIO VENTA
                    <div className={styles.campo} style={{ gridColumn: 'span 2' }}> {/* Hace que abarque 2 columnas */}
                        <label>PRECIO DE VENTA (S/.)</label>
                        <input type="number" name="precio" value={form.precio} onChange={manejarCambio} style={{ height: '50px', fontSize: '1.2rem' }} />
                    </div>
                ) : ( // Este es el campo CELULAR para otros roles
                    <div className={styles.campo}><label>CELULAR</label><input name="cel" value={form.cel} onChange={manejarCambio} /></div>
                )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginTop: '10px' }}>
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
                  {form.imagenes && form.imagenes.length > 0 ? `${form.imagenes.length} archivo(s)` : 'Seleccionar Imagen..'}
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
    onClick={() => setModalRapidoOpen(true)}
    style={{
      background: '#2563eb',
      color: 'white',
      border: 'none',
      padding: '8px 12px',
      borderRadius: '6px',
      cursor: 'pointer',
      fontWeight: 'bold',
      display: 'flex',
      alignItems: 'center',
      gap: '5px',
      fontSize: '13px',
      transition: 'transform 0.1s'
    }}
    onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
    onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
  >
    ⚡ Registro Rápido
  </button>
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
                    <th style={{ padding: '12px 8px' }}>CANTIDAD</th>
                    <th style={{ padding: '12px 8px' }}>ENCARGADO</th>
                    <th style={{ padding: '12px 8px' }}>PROCEDENCIA</th>
                    <th style={{ padding: '12px 8px' }}>ACCIONES</th> {/* <--- AGREGA ESTO */}
                  </tr>
                  
                </thead>
                
                  <tbody>
                  {(laptops.length > 0 || datosRapidos.length > 0) ? (
                    [...laptops, ...datosRapidos]
                      .sort((a, b) => convertirFechaHora(b.fecha, b.hora) - convertirFechaHora(a.fecha, a.hora))
                      .map((laptop, index) => (
                      <tr key={laptop.id || index} style={{ borderBottom: '1px solid #1e293b', backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '12px 8px', color: '#a855f7' }}>
                          {laptop.fecha || 'Sin fecha'}<br/>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>{laptop.hora || '--:--'}</span>
                        </td>
                        <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>
                          {typeof (laptop.responsable || laptop.usuario || laptop.vendedor) === 'object' 
                            ? (laptop.responsable || laptop.usuario || laptop.vendedor)?.nombre
                            : (laptop.responsable || laptop.usuario || laptop.vendedor || 'Sistema')
                          }
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ color: '#38bdf8' }}>{laptop.marca}</span> {laptop.modelo} {laptop.equipo && `(${laptop.equipo})`}
                        </td>
                        <td style={{ padding: '12px 8px', fontSize: '13px', color: '#cbd5e1' }}>
                          {laptop.procesador} | {laptop.ram} | {laptop.disco || laptop.almacenamiento} | {laptop.gpu}
                        </td>
                        <td style={{ padding: '12px 8px', color: '#10B981', fontWeight: 'bold' }}>
                          {laptop.cantidad || '0'}
                        </td>
                        <td style={{ padding: '12px 8px', color: '#10B981', fontWeight: 'bold' }}>
                          {laptop.encargado || '---'}
                        </td>
                        <td style={{ padding: '12px 8px', color: '#a855f7' }}>
                          {laptop.procedencia || '---'}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          {laptop.modelo === '---' && (
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button
                                onClick={() => abrirModalEdicionRapida(laptop)}
                                style={{ cursor: 'pointer', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px' }}
                                title="Editar registro rápido"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => eliminarRegistroRapido(laptop.id)}
                                style={{ cursor: 'pointer', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px' }}
                                title="Eliminar registro rápido"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No hay registros disponibles.</td>
                    </tr>
                  )}
                </tbody>
              
              </table>
            </div>
          </div>
        </div>
      )}
      {/* VENTANA FLOTANTE REGISTRO RÁPIDO */}
{modalRapidoOpen && (
  <div style={{
    position: 'fixed',
    top: 0, left: 0, width: '100vw', height: '100vh',
    backgroundColor: 'rgba(15, 23, 42, 0.85)', // Fondo oscuro traslúcido
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 9999 // Por encima de todo
  }}>
    <div style={{
      backgroundColor: '#1e293b', // Mismo tono oscuro de tu app
      color: 'white',
      padding: '24px',
      borderRadius: '12px',
      width: '380px',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      border: '1px solid #334155'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: '600' }}>
        ⚡ Registro Rápido
      </h3>
      
      <form onSubmit={guardarRapidoBD}>
        {/* INPUT FECHA */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#94a3b8' }}>FECHA</label>
          <input 
            type="date" 
            required
            value={registroRapido.fecha}
            onChange={(e) => setRegistroRapido({...registroRapido, fecha: e.target.value})}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white' }}
          />
        </div>

        {/* INPUT MARCA */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#94a3b8' }}>MARCA</label>
          <input 
            type="text" 
            placeholder="Ej. HP, LENOVO"
            required
            value={registroRapido.marca}
            onChange={(e) => setRegistroRapido({...registroRapido, marca: e.target.value})}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white' }}
          />
        </div>

        {/* INPUT CANTIDAD */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#94a3b8' }}>CANTIDAD</label>
          <input 
            type="number" 
            min="1"
            placeholder="0"
            required
            value={registroRapido.cantidad}
            onChange={(e) => setRegistroRapido({...registroRapido, cantidad: e.target.value})}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white' }}
          />
        </div>

        {/* INPUT ENCARGADO */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#94a3b8' }}>ENCARGADO</label>
          <input 
            type="text" 
            placeholder="Nombre del responsable"
            required
            value={registroRapido.encargado}
            onChange={(e) => setRegistroRapido({...registroRapido, encargado: e.target.value})}
            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white' }}
          />
        </div>

        {/* BOTONES */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button 
            type="button" 
            onClick={() => setModalRapidoOpen(false)}
            style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#475569', color: 'white', cursor: 'pointer', fontWeight: '500' }}
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#22c55e', color: 'white', fontWeight: '600', cursor: 'pointer' }}
          >
            Guardar
          </button>
        </div>

      </form>
    </div>
  </div>
)}
      {/* MODAL DE EDICIÓN RÁPIDA */}
      {modalEdicionRapidaOpen && editingRapido && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(15, 23, 42, 0.85)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 10000 // Aún más alto
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            color: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '380px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
            border: '1px solid #334155'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', fontWeight: '600' }}>
              ✏️ Editar Registro Rápido
            </h3>
            
            <form onSubmit={actualizarRegistroRapido}>
              {/* INPUT FECHA */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#94a3b8' }}>FECHA</label>
                <input 
                  type="date" 
                  required
                  value={
                    // El input 'date' necesita YYYY-MM-DD. La BD tiene DD/MM/YYYY.
                    editingRapido.fecha.includes('/') 
                      ? editingRapido.fecha.split('/').reverse().join('-') 
                      : editingRapido.fecha
                  }
                  onChange={(e) => setEditingRapido({...editingRapido, fecha: e.target.value})}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white' }}
                />
              </div>

              {/* INPUT MARCA */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#94a3b8' }}>MARCA</label>
                <input 
                  type="text" 
                  required
                  value={editingRapido.marca}
                  onChange={(e) => setEditingRapido({...editingRapido, marca: e.target.value})}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white' }}
                />
              </div>

              {/* INPUT CANTIDAD */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#94a3b8' }}>CANTIDAD</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  value={editingRapido.cantidad}
                  onChange={(e) => setEditingRapido({...editingRapido, cantidad: e.target.value})}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white' }}
                />
              </div>

              {/* INPUT ENCARGADO */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#94a3b8' }}>ENCARGADO</label>
                <input 
                  type="text" 
                  required
                  value={editingRapido.encargado}
                  onChange={(e) => setEditingRapido({...editingRapido, encargado: e.target.value})}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: 'white' }}
                />
              </div>

              {/* BOTONES */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setModalEdicionRapidaOpen(false)} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#475569', color: 'white', cursor: 'pointer', fontWeight: '500' }}>Cancelar</button>
                <button type="submit" style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', backgroundColor: '#3b82f6', color: 'white', fontWeight: '600', cursor: 'pointer' }}>Actualizar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistroVentasView;