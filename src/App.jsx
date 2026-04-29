import React, { useState, useEffect } from 'react';
import './App.css';
import AlmacenTabla from './components/AlmacenTabla';
import { Html5QrcodeScanner } from 'html5-qrcode';
import VentasView from './components/VentasView';
import PanelInformes from './components/PanelInformes';
// Importación de constantes y servicios
import { enviarInformeGmailPDF } from './serviciosReportes';
import HojaReportes from './components/HojaReportes';
import RegistroVentasView from './components/RegistroVentasView';
import logoFinpro from './assets/logo-finpro.png'; // La ruta donde guardaste la imagen

import { 
  CONFIG, OPCIONES_MARCAS, OPCIONES_RAM,
  OPCIONES_ALMACENAMIENTO, OPCIONES_PROCESADOR, OPCIONES_GPU, 
  OPCIONES_DESTINO, MODELOS_SUGERIDOS, OPCIONES_ESTADO
} from "./constants/config.js";

import { LISTA_USUARIOS } from "./constants/usuarios.js";

import { 
  subirACloudinary, sincronizarConExcel,
  guardarProducto, actualizarProducto, eliminarProducto, suscribirseAInventario, enviarInformeEmail 
} from './services/api';

// --- CONFIGURACIÓN DE AVATARES PERSONALIZADOS (LEONIDAS STORE) ---
const AVATARES_USUARIOS = {
  'YAEL': 'https://images.steamusercontent.com/ugc/2450612450625227938/B4074195BDE6EB792E801EA52EB5F0BF971F4008/?imw=512&&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=false',
  'DAVID': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-HIltRjS8H7tv-tgTeCiQYVNU5K4Y-ResdQ&s',
  'CRISTOFER': 'https://media.tenor.com/9LH4AwWJB2oAAAAe/agnes-tachyon-uma-musume.png',
  // Avatar por defecto para LEONIDAS y otros usuarios
  'DEFAULT': logoFinpro
};

const PRESETS_MODELOS = {
  // --- LENOVO ---
  "IDEAPAD SLIM 3 15IAN8": { procesador: "CORE I9", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "1 TB SSD", gpu: "RTX 4060" },
  "IDEAPAD 3": { procesador: "CORE I5", generacion: "12VA GEN", ram: "8 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "LEGION 5": { procesador: "CORE I7", generacion: "13VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 4060" },
  "LOQ": { procesador: "RYZEN 7", generacion: "SERIE 7000", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 4050" },

  // --- ASUS ---
  "VIVOBOOK 15": { procesador: "CORE I5", generacion: "12VA GEN", ram: "12 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "TUF GAMING F15": { procesador: "CORE I7", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 3050" },
  "ROG STRIX": { procesador: "CORE I9", generacion: "13VA GEN", ram: "32 GB", almacenamiento: "1 TB SSD", gpu: "RTX 4070" },

  // --- HP ---
  "VICTUS 16": { procesador: "CORE I5", generacion: "13VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 4050" },
  "PAVILION 15": { procesador: "CORE I7", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "PROBOOK 450": { procesador: "CORE I5", generacion: "12VA GEN", ram: "8 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },

  // --- DELL ---
  "INSPIRON 3520": { procesador: "CORE I3", generacion: "12VA GEN", ram: "8 GB", almacenamiento: "256 GB SSD", gpu: "INTEGRADA" },
  "LATITUDE 5420": { procesador: "CORE I7", generacion: "11VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },
  "ALIENWARE M16": { procesador: "CORE I9", generacion: "13VA GEN", ram: "32 GB", almacenamiento: "1 TB SSD", gpu: "RTX 4080" },

  // --- APPLE (OJO: No usan "Generación" sino el Chip) ---
  "MACBOOK AIR M1": { procesador: "CHIP M1", generacion: "8 CORES", ram: "8 GB", almacenamiento: "256 GB SSD", gpu: "7 CORES" },
  "MACBOOK AIR M2": { procesador: "CHIP M2", generacion: "8 CORES", ram: "8 GB", almacenamiento: "256 GB SSD", gpu: "8 CORES" },
  "MACBOOK PRO 14": { procesador: "CHIP M3 PRO", generacion: "11 CORES", ram: "18 GB", almacenamiento: "512 GB SSD", gpu: "14 CORES" },

  // --- ACER ---
  "NITRO 5": { procesador: "CORE I5", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 3050" },
  "ASPIRE 5": { procesador: "RYZEN 5", generacion: "SERIE 5000", ram: "8 GB", almacenamiento: "512 GB SSD", gpu: "INTEGRADA" },

  // --- MSI ---
  "GF63 THIN": { procesador: "CORE I7", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 4050" },
  "KATANA GF66": { procesador: "CORE I7", generacion: "12VA GEN", ram: "16 GB", almacenamiento: "512 GB SSD", gpu: "RTX 3060" }
};

function App() {
  // Añade este estado al inicio de tu componente
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [mostrarModalInformes, setMostrarModalInformes] = useState(false);
  const [indiceEscaneo, setIndiceEscaneo] = useState(null);
const [mostrarPin, setMostrarPin] = useState(false);
const [pinDigitado, setPinDigitado] = useState("");
const [usuarioPendiente, setUsuarioPendiente] = useState(null);
  const [autenticado, setAutenticado] = useState(false);
  const [userDigitado, setUserDigitado] = useState(""); 
  const [tipoPeriodo, setTipoPeriodo] = useState('dia');
  const [passDigitado, setPassDigitado] = useState(""); 
  const [fechaPersonalizada, setFechaPersonalizada] = useState(new Date().toISOString().split('T')[0]);
  const [usuarioLogueado, setUsuarioLogueado] = useState(null);
  const [pestanaActual, setPestanaActual] = useState("almacen");
  const [laptops, setLaptops] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [listaSeriales, setListaSeriales] = useState([""]);
  const [fechaFiltro, setFechaFiltro] = useState('');
  
  const [fechaConsulta, setFechaConsulta] = useState(new Date().toISOString().split('T')[0]);
  const [mostrarManual, setMostrarManual] = useState({});
  
  const [modalImagen, setModalImagen] = useState(null);
  const [fotoActual, setFotoActual] = useState("");
  const [escaneando, setEscaneando] = useState(false);

  const [form, setForm] = useState({
    marca: '', modelo: '', precio: '', precio_costo: '', serial: '', 
    procesador: '', generacion: '', 
    ram: '', almacenamiento: '', 
    gpu: '', cliente: '', dni: '', cel: '', destino: '', pago: 'EFECTIVO', 
    estado: 'STOCK', imagenes: [],
    cantidad: 1 
  });

  const cerrarGaleria = () => {
    setModalImagen(null);
    setFotoActual(""); 
  };

// ... dentro de tu componente principal App ...

const manejarEnvioFormal = async (datosFiltrados = null) => {
  // CLAVE: Si vienen datos del filtro (HOY/MES), usamos esos. 
  // Si no (por si acaso), usa la lista global.
  const datosAProcesar = datosFiltrados || laptops;

  // Verificamos si hay datos en el paquete filtrado
  if (!datosAProcesar || datosAProcesar.length === 0) {
    alert("No hay datos en el periodo seleccionado para generar el PDF.");
    return;
  }

  setCargando(true); 
  
  try {
    // IMPORTANTE: Ahora pasamos 'datosAProcesar' al servicio, NO 'laptops'
    await enviarInformeGmailPDF(datosAProcesar, usuarioLogueado?.nombre || "Admin");
    
    alert("✅ ¡Informe Formal enviado con éxito a Gmail!");
    setMostrarModalInformes(false); 
  } catch (error) {
    console.error("Error al enviar el PDF:", error);
    alert("❌ Hubo un error al generar o enviar el PDF.");
  } finally {
    setCargando(false); 
  }
};

  const iniciarEscaneo = (index = null) => {
  setIndiceEscaneo(index);
  setEscaneando(true);

  // Esperamos un milisegundo a que el div 'reader' aparezca en el DOM
  setTimeout(() => {
    const scanner = new Html5QrcodeScanner("reader", { 
  fps: 15, 
  qrbox: { width: 250, height: 120 },
  // ESTO FUERZA LA CÁMARA TRASERA
  videoConstraints: {
    facingMode: { exact: "environment" } 
  },
  rememberLastUsedCamera: true
});

    scanner.render((decodedText) => {
      if (index !== null) {
        // Si estamos en registro masivo
        const nuevaLista = [...listaSeriales];
        nuevaLista[index] = decodedText.toUpperCase();
        setListaSeriales(nuevaLista);
      } else {
        // Si estamos editando un equipo individual
        setForm(prev => ({ ...prev, serial: decodedText.toUpperCase() }));
      }
      
      scanner.clear(); // Apagar cámara
      setEscaneando(false);
    }, (error) => {
      // Error silencioso mientras busca el código
    });
  }, 300);
};

  const activarEdicion = (lap) => {
    setEditandoId(lap.fireId);
    const datosEdit = {
      ...lap,
      marca: lap.marca || "",
      modelo: lap.modelo || "",
      procesador: lap.procesador || "",
      generacion: lap.generacion || "",
      almacenamiento: lap.almacenamiento || lap.ssd || "", 
      ram: lap.ram || "",
      precio: lap.precio || "",
      serial: lap.serial || "",
      cantidad: 1
    };

    const manuales = {};
    if (datosEdit.marca && !OPCIONES_MARCAS.includes(datosEdit.marca)) manuales.marca = true;
    if (datosEdit.procesador && !OPCIONES_PROCESADOR.includes(datosEdit.procesador)) manuales.procesador = true;
    
    const sugerenciasMarca = MODELOS_SUGERIDOS[datosEdit.marca] || [];
    if (datosEdit.modelo && !sugerenciasMarca.includes(datosEdit.modelo)) manuales.modelo = true;
    if (datosEdit.ram && !OPCIONES_RAM.includes(datosEdit.ram)) manuales.ram = true;
    if (datosEdit.almacenamiento && !OPCIONES_ALMACENAMIENTO.includes(datosEdit.almacenamiento)) manuales.almacenamiento = true;

    setForm(datosEdit);
    setMostrarManual(manuales);
    setPestanaActual("registro");
  };

  // --- EFECTO 1: Redirección Automática de Seguridad ---
  useEffect(() => {
    if (usuarioLogueado?.rol === 'vendedor') {
      if (pestanaActual === 'almacen' || pestanaActual === 'registro') {
        setPestanaActual('ventas');
      }
    }
  }, [usuarioLogueado, pestanaActual]);

  // --- EFECTO 2: Suscripción a Firebase ---
  useEffect(() => {
    if (autenticado) {
      const desuscribir = suscribirseAInventario((datos) => setLaptops(datos));
      return () => desuscribir();
    }
  }, [autenticado]);

  // --- 2. EL CEREBRO DE LOS REPORTES ---
const manejarGeneracionReporte = (formato, config = {}) => {
  // Extraemos los valores del panel.
  const tipoPeriodo = config.tipo || 'dia';
  const fechaPersonalizada = config.fecha || new Date().toISOString().split('T')[0];
  
  const hoy = new Date();

  // Función de normalización para que 08/04 sea igual a 8/4
  const normalizar = (fechaStr) => {
    if (!fechaStr) return "";
    const partes = fechaStr.split('/');
    if (partes.length !== 3) return fechaStr;
    return `${parseInt(partes[0])}/${parseInt(partes[1])}/${partes[2]}`;
  };

  const hoyStr = normalizar(hoy.toLocaleDateString('es-PE'));

  const filtrados = laptops.filter(lap => {
    // Usamos fecha_venta para el reporte, o fecha de ingreso si no tiene venta
    const fechaLapStr = normalizar(lap.fecha_venta || lap.fecha || "");

    if (tipoPeriodo === 'dia') {
      return fechaLapStr === hoyStr;
    } 
    else if (tipoPeriodo === 'calendario') {
      const [ySel, mSel, dSel] = fechaPersonalizada.split('-');
      const fechaBuscada = `${parseInt(dSel)}/${parseInt(mSel)}/${ySel}`;
      return fechaLapStr === fechaBuscada;
    } 
    else {
      // Filtro por Mes Actual
      const [d, m, a] = fechaLapStr.split('/');
      return (parseInt(m) - 1) === hoy.getMonth() && parseInt(a) === hoy.getFullYear();
    }
  });

  if (filtrados.length === 0) {
    alert(`No hay registros para este periodo.`);
    return;
  }

  // --- NUEVO: CÁLCULOS DE UTILIDAD PARA EL REPORTE ---
  const inversionTotal = filtrados.reduce((acc, lap) => acc + (Number(lap.precio_costo) || 0), 0);
  const ventaTotal = filtrados.reduce((acc, lap) => acc + (Number(lap.precio) || 0), 0);
  const utilidadNeta = filtrados.reduce((acc, lap) => acc + (Number(lap.utilidad) || 0), 0);

  // --- DISPARO DE ACCIONES ---
  if (formato === 'pdf') {
    // Pasamos los cálculos adicionales si tu función manejarEnvioFormal los requiere
    manejarEnvioFormal(filtrados, { inversionTotal, ventaTotal, utilidadNeta });
  } 
  else if (formato === 'texto') {
    // Pasamos los cálculos al envío de EmailJS
    enviarInformeDiarioEmailJS(filtrados, { inversionTotal, ventaTotal, utilidadNeta });
  } 
  else if (formato === 'whatsapp') {
    // Lógica de WhatsApp mejorada con los montos de Leonidas Store
    let mensaje = `*📊 REPORTE LEONIDAS STORE*\n`;
    mensaje += `*Periodo:* ${tipoPeriodo.toUpperCase()}\n`;
    mensaje += `*Total Equipos:* ${filtrados.length}\n`;
    mensaje += `*Ventas:* S/ ${ventaTotal.toFixed(2)}\n`;
    
    // Solo mostramos utilidad en WhatsApp si es el dueño (opcional, aquí lo incluimos)
    if (usuarioLogueado?.rol === 'super_admin' || usuarioLogueado?.rol === 'admin_2') {
      mensaje += `*Inversión:* S/ ${inversionTotal.toFixed(2)}\n`;
      mensaje += `*Ganancia Neta:* S/ ${utilidadNeta.toFixed(2)}\n`;
    }
    
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  }
};

  const enviarInformeDiarioEmailJS = async (laptopsFiltradas = null) => {
  // --- BLOQUE DE COMPATIBILIDAD CON EL MODAL ---
  // Si vienen datos filtrados del modal, los usamos directamente
  let registradosHoy, vendidosHoy, fechaParaInforme;

  if (laptopsFiltradas) {
    registradosHoy = laptopsFiltradas;
    // Consideramos vendidos los que están en ese estado dentro de la selección
    vendidosHoy = laptopsFiltradas.filter(l => l.estado === 'VENDIDO');
    fechaParaInforme = "Reporte Personalizado";
  } else {
    // --- LÓGICA ORIGINAL (No se quita nada) ---
    if (!fechaConsulta) {
      return alert("Por favor, selecciona una fecha para el informe.");
    }
    const [year, month, day] = fechaConsulta.split('-');
    const fechaCalendarioLimpia = `${parseInt(day)}/${parseInt(month)}/${year}`;
    fechaParaInforme = fechaCalendarioLimpia;

    registradosHoy = laptops.filter(l => {
      if (!l.fecha) return false;
      const partes = l.fecha.split('/');
      if (partes.length < 3) return false;
      const fechaDB = `${parseInt(partes[0])}/${parseInt(partes[1])}/${partes[2]}`;
      return fechaDB === fechaCalendarioLimpia;
    });

    vendidosHoy = laptops.filter(l => {
      if (l.estado !== 'VENDIDO') return false;
      const fVenta = l.fecha_venta || l.fecha;
      const partes = fVenta.split('/');
      if (partes.length < 3) return false;
      const fechaVentaDB = `${parseInt(partes[0])}/${parseInt(partes[1])}/${partes[2]}`;
      return fechaVentaDB === fechaCalendarioLimpia;
    });
  }

  // 3. Validar si hay algo que enviar
  if (registradosHoy.length === 0 && vendidosHoy.length === 0) {
    return alert(`No hay registros ni ventas para el periodo seleccionado.`);
  }

  setCargando(true);

  try {
    const totalGanado = vendidosHoy.reduce((acc, curr) => acc + Number(curr.precio || 0), 0);
    
    const agruparLotes = (lista, esVenta = false) => {
      const grupos = {};
      lista.forEach(l => {
        const llave = `${l.marca} ${l.modelo}`.trim().toUpperCase();
        if (!grupos[llave]) {
          grupos[llave] = { cantidad: 0, precio: 0 };
        }
        grupos[llave].cantidad += 1;
        grupos[llave].precio += Number(l.precio || 0);
      });

      return Object.entries(grupos).map(([nombre, data]) => {
        if (esVenta) {
          return `• ${nombre} <b>(${data.cantidad})</b> - S/ ${data.precio.toFixed(2)}`;
        }
        return `• ${nombre} <b>(${data.cantidad})</b>`;
      }).join('<br/>');
    };

    const listaIngresos = registradosHoy.length > 0 
      ? agruparLotes(registradosHoy) 
      : "Sin ingresos";

    const listaVentas = vendidosHoy.length > 0 
      ? agruparLotes(vendidosHoy, true) 
      : "Sin ventas";

    // 4. Parámetros para la plantilla
    const templateParams = {
      user_email: CONFIG.ADMIN_EMAILS,
      fecha_informe: fechaParaInforme,
      equipos_hoy: registradosHoy.length,   
      ventas_hoy: vendidosHoy.length,       
      stock_total: laptops.filter(l => {
        const estadoLimpio = l.estado?.toUpperCase().trim();
        return estadoLimpio === 'STOCK' || estadoLimpio === 'ALMACEN' || estadoLimpio === 'EN STOCK';
      }).length,
      total_db: laptops.length,
      total_ganado: totalGanado.toFixed(2),
      link_reporte: `https://tu-app-leonidas.vercel.app/reporte/${fechaConsulta}`,
      remitente_nombre: usuarioLogueado?.nombre || "Usuario Desconocido",
      lista_equipos: listaIngresos,
      lista_vendidos: listaVentas,
      name: "Leonidas Store"
    };

    const res = await enviarInformeEmail(templateParams);

    if (res.status === 200) {
      alert(`✅ ¡Informe profesional enviado!\nIngresos: ${registradosHoy.length}\nVentas: S/ ${totalGanado.toFixed(2)}`);
      if(setMostrarModalInformes) setMostrarModalInformes(false);
    }

  } catch (err) {
    console.error("Error en el envío:", err);
    alert("❌ Error: " + (err.text || err.message));
  } finally {
    setCargando(false);
  }
};

  const manejarCambio = (e) => {
    const { name, value, files } = e.target;
    if (name === "imagenes") setForm({ ...form, imagenes: files });
    else setForm({ ...form, [name]: value });
  };

  const manejarCambioModeloAuto = (e) => {
  const modeloTexto = e.target.value.toUpperCase();
  const marcaSeleccionada = form.marca.toUpperCase(); // Obtenemos la marca actual del form
  
  setForm(prev => ({ ...prev, modelo: modeloTexto }));

  // Buscamos el preset
  const preset = PRESETS_MODELOS[modeloTexto];
  
  // SOLO autocompletamos si el modelo existe Y el usuario ya eligió una marca
  if (preset) {
    setForm(prev => ({
      ...prev,
      procesador: preset.procesador,
      generacion: preset.generacion,
      ram: preset.ram,
      almacenamiento: preset.almacenamiento,
      gpu: preset.gpu
    }));
  }
};

  const manejarVerTodo = () => {
  setBusqueda("");
  setFechaFiltro("");
  setFiltroEstado("TODOS");
  setFechaConsulta("");
  // Esto hará que el filtro 'coincideTexto' y 'coincideFecha' sean siempre true
};

 const guardarLaptop = async (e) => {
  e.preventDefault();

  let serialesFinales = [];

  if (!editandoId) {
    const serialesLimpios = listaSeriales.map(s => s.trim().toUpperCase()).filter(s => s !== "");
    if (serialesLimpios.length === 0) return alert("❌ Debes ingresar al menos un serial.");
    const tieneDuplicados = new Set(serialesLimpios).size !== serialesLimpios.length;
    if (tieneDuplicados) return alert("❌ Hay seriales duplicados en la lista.");
    serialesFinales = serialesLimpios; 
  } else {
    if (!form.serial || form.serial.trim() === "") {
      return alert("❌ El equipo debe tener un número de serie.");
    }
    serialesFinales = [form.serial.trim().toUpperCase()];
  }

  setCargando(true);
  try {
    let links = form.imagenes;
    if (form.imagenes instanceof FileList && form.imagenes.length > 0) {
      links = await Promise.all(Array.from(form.imagenes).map(file => subirACloudinary(file)));
    }

    for (const s of serialesFinales) {
      const modeloProcesado = form.modelo && form.modelo.trim() !== "" 
        ? form.modelo.toUpperCase() 
        : "OTRO";

      const vVenta = Number(form.precio) || 0;
      const vCosto = Number(form.precio_costo) || 0;
      const utilidadCalculada = vVenta - vCosto;

      // --- ESTRUCTURA BASE DE DATOS ---
    const datosFinales = { 
        ...form,
        precio: vVenta,
        precio_costo: vCosto,
        utilidad: utilidadCalculada, // Se guarda la ganancia calculada
        serial: s, 
        modelo: modeloProcesado,
        imagenes: links,
      };

      // --- VALIDACIÓN DE RESPONSABLE (AUTORÍA) CORREGIDA ---
if (!editandoId) {
  // Solo si es NUEVO, guardamos quién lo registra inicialmente
  datosFinales.responsable = form.responsable || usuarioLogueado?.nombre || "Sin Nombre";
  datosFinales.rol_responsable = usuarioLogueado?.rol || "vendedor";
  datosFinales.fecha = new Date().toLocaleDateString('es-PE');
  datosFinales.hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: true });
} else {
  // SI ESTAMOS EDITANDO:
  // Permitimos el cambio solo si el usuario tiene permisos de admin
  if (usuarioLogueado?.rol === 'super_admin' || usuarioLogueado?.rol === 'admin_2') {
    // Si el admin eligió un responsable en el select, lo mantenemos. 
    // Si no, no tocamos nada.
    if (!form.responsable) {
      delete datosFinales.responsable;
    }
  } else {
    // Si NO es admin, protegemos el campo para que no se altere
    delete datosFinales.responsable;
  }
  
  // Estos campos normalmente no se editan
  delete datosFinales.rol_responsable;
  delete datosFinales.fecha;
  delete datosFinales.hora;
}

      delete datosFinales.cantidad;

      const datosParaExcel = {
        ...datosFinales,
        procesador: form.procesador,
        generacion: form.generacion,
        almacenamiento: form.almacenamiento || form.ssd,
        ram: form.ram,
        // Para el Excel, si estamos editando usamos el nombre que ya venía en el form (el original)
        // Si es nuevo, usamos el del usuario actual.
        responsable: editandoId ? form.responsable : (usuarioLogueado?.nombre || "Sin Nombre")
      };

      if (editandoId) {
        await actualizarProducto(editandoId, datosFinales);
        await sincronizarConExcel(datosParaExcel, usuarioLogueado.hoja, usuarioLogueado.rol);
        break; 
      } else {
        await guardarProducto(datosFinales);
        await sincronizarConExcel(datosParaExcel, usuarioLogueado.hoja, usuarioLogueado.rol);
      }
    }

    alert(`✅ ${editandoId ? 'Actualizado' : 'Registrado'} correctamente por ${usuarioLogueado.nombre}`);
    cancelarEdicion();
    setPestanaActual("almacen");

  } catch (err) {
    console.error("Error completo:", err);
    alert("❌ Error al procesar: " + err.message);
  } finally { 
    setCargando(false); 
  }
};
  
 const cancelarEdicion = () => {
  setEditandoId(null);
  setMostrarManual({});
  setForm({ 
    marca: '', modelo: '', precio: '', precio_costo: '', // <-- Agregar esto
    serial: '', procesador: '', generacion: '', ram: '', 
    almacenamiento: '', gpu: '', cliente: '', dni: '', 
    cel: '', destino: '', pago: 'EFECTIVO', estado: 'STOCK', 
    imagenes: [], cantidad: 1 
  });
};

  const manejarEliminar = async (id, serial) => {
  if (window.confirm(`⚠️ ¿Estás seguro de eliminar el equipo con serial ${serial || ''}? Esta acción no se puede deshacer.`)) {
    try {
      setCargando(true);
      await eliminarProducto(id, serial); // Aquí usamos lo que importaste de api.js
      alert("✅ Equipo eliminado correctamente.");
    } catch (err) {
      alert("❌ Error al eliminar: " + err.message);
    } finally {
      setCargando(false);
    }
  }
};

const marcarComoVendido = async (laptop) => {
  // Obtenemos la fecha actual ajustada a Perú
  const hoy = new Date();
  
  // Formato manual DD/MM/YYYY para asegurar compatibilidad total con tus filtros actuales
  const dia = hoy.getDate();
  const mes = hoy.getMonth() + 1;
  const anio = hoy.getFullYear();
  const fechaFormateada = `${dia}/${mes}/${anio}`; 

  const confirmacion = window.confirm(`¿Confirmar venta de la serie ${laptop.serial}?`);
  
  if (confirmacion) {
    try {
      setCargando(true);
      
      // Actualizamos en Firebase con la nueva lógica de salida
      await actualizarProducto(laptop.fireId, { 
        estado: 'VENDIDO',
        fecha_venta: fechaFormateada, // Esta es la fecha que usaremos para reportes
        hora_venta: hoy.toLocaleTimeString('es-PE'),
        vendedor_final: usuarioLogueado?.nombre || "Sistema", // Importante para el Rendimiento
        responsable_venta: usuarioLogueado?.nombre || "Sin asignar"
      });

      alert(`✅ Venta registrada el ${fechaFormateada}. ¡Excelente trabajo, ${usuarioLogueado?.nombre}!`);
      
    } catch (err) {
      console.error("Error en venta:", err);
      alert("❌ Error al procesar venta: " + err.message);
    } finally {
      setCargando(false);
    }
  }
};

  // --- DENTRO DE APP.JSX ---
const laptopsFiltradas = laptops.filter(lap => {
  if (!lap) return false;

  // 1. FILTRO DE ESTADO (STOCK, VENDIDO, etc.)
  const estadoLap = lap.estado?.toUpperCase().trim() || "STOCK";

  // Ocultar vendidos si estamos en Almacén
  if (pestanaActual === 'almacen' && estadoLap === 'VENDIDO') {
    return false;
  }

  if (filtroEstado !== 'TODOS' && estadoLap !== filtroEstado) return false;

  // 2. FILTRO POR ROL (SEGURIDAD DE LEONIDAS STORE)
  const coincideVendedor = (usuarioLogueado?.rol === 'super_admin' || usuarioLogueado?.rol === 'admin_2')
    ? true
    : (lap.vendedor === usuarioLogueado?.nombre || lap.responsable === usuarioLogueado?.nombre || lap.usuario === usuarioLogueado?.nombre);
  
  if (!coincideVendedor) return false;

  // 3. FILTRO DE FECHA (CONVERSIÓN SEGURA)
  const formatearFecha = (fechaInput) => {
    if (!fechaInput) return null;
    const [year, month, day] = fechaInput.split('-');
    return `${parseInt(day)}/${parseInt(month)}/${year}`;
  };

  const fechaReq = formatearFecha(fechaConsulta || fechaFiltro);
  if (fechaReq && lap.fecha !== fechaReq) return false;

  // 4. FILTRO DE BÚSQUEDA POR TEXTO (SÚPER BÚSQUEDA INTEGRADA)
  if (busqueda && busqueda.trim() !== "") {
    const texto = busqueda.toLowerCase().trim();
    
    const infoCompleta = [
      lap.marca,
      lap.modelo,
      lap.serial,
      lap.procesador,
      lap.generacion,
      lap.gen,
      lap.ram,
      lap.almacenamiento,
      lap.disco,
      lap.gpu,
      lap.vendedor,
      lap.responsable
    ].join(" ").toLowerCase();

    if (!infoCompleta.includes(texto)) {
      return false;
    }
  }

  return true; 
});

// --- NUEVOS CAMBIOS PASO 2: CÁLCULO DE TOTALES (SOLO ADMINS) ---
// Estos cálculos se ejecutan sobre el resultado ya filtrado
let inversionTotal = 0;
let utilidadTotal = 0;

if (usuarioLogueado?.rol === 'super_admin' || usuarioLogueado?.rol === 'admin_2') {
  inversionTotal = laptopsFiltradas.reduce((acc, lap) => acc + (Number(lap.precio_costo) || 0), 0);
  utilidadTotal = laptopsFiltradas.reduce((acc, lap) => acc + (Number(lap.utilidad) || 0), 0);
}

const renderCampoMixto = (label, nombre, opciones) => {
  const esOtro = mostrarManual[nombre];
  const opcionesLimpias = opciones.filter(opt => opt !== "OTRO...");
  return (
    <div className="campo">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: '5px' }}>
        {!esOtro ? (
          <select name={nombre} value={form[nombre]} onChange={(e) => {
            if (e.target.value === "OTRO...") setMostrarManual({...mostrarManual, [nombre]: true});
            else manejarCambio(e);
          }} required style={{ flex: 1 }}>
            <option value="">Seleccionar...</option>
            {opcionesLimpias.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            <option value="OTRO...">OTRO (Escribir...)</option>
          </select>
        ) : (
          <>
            <input type="text" name={nombre} placeholder="Escribir manual..." value={form[nombre]} onChange={manejarCambio} autoFocus style={{ flex: 1 }} />
            <button type="button" onClick={() => { setMostrarManual({...mostrarManual, [nombre]: false}); setForm({...form, [nombre]: ""}); }} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '0 10px', cursor: 'pointer' }}> ✖ </button>
          </>
        )}
      </div>
    </div>
  );
};

if (!autenticado) {
    const verificarPin = () => {
      const PIN_MAESTRO = "4444"; // <--- CAMBIA TU PIN AQUÍ
      if (pinDigitado === PIN_MAESTRO) {
        setAutenticado(true);
        setUsuarioLogueado(usuarioPendiente);
        setMostrarPin(false);
      } else {
        alert("❌ PIN incorrecto. Acceso denegado.");
        setPinDigitado("");
      }
    };

    return (
      <div id="login-root">
        {!mostrarPin ? (
          <form className="login-box" onSubmit={(e) => { 
            e.preventDefault();
            const usuarioInput = userDigitado.toLowerCase().trim();
            const passInput = passDigitado.trim();
            const encontrado = LISTA_USUARIOS.find(u => 
              u.user.toLowerCase() === usuarioInput && 
              u.pass === passInput
            );

            if (encontrado) {
              // Si es super_admin, activamos el flujo del PIN
              if (encontrado.rol === 'super_admin') {
                setUsuarioPendiente(encontrado);
                setMostrarPin(true);
              } else {
                // Si es cualquier otro rol, entra directo
                setUsuarioLogueado(encontrado);
                setAutenticado(true);
              }
            } else {
              alert("❌ Usuario o contraseña incorrectos.");
            }
          }}>
            <img 
              src={logoFinpro} 
              className="login-avatar" 
              alt="Logo Finpro Store" 
              style={{ objectFit: 'contain' }} 
            />
            <h2 className="login-title">FINPRO STORE</h2>
            
            <input 
              type="text" 
              placeholder="Usuario" 
              className="login-field" 
              value={userDigitado} 
              onChange={(e) => setUserDigitado(e.target.value)} 
              required 
              autoComplete="new-password"
              autoFocus
            />
            
            <input 
              type="password" 
              placeholder="Contraseña" 
              className="login-field" 
              value={passDigitado} 
              onChange={(e) => setPassDigitado(e.target.value)} 
              required 
              autoComplete="new-password"
            />
            
            <button type="submit" className="login-button">ENTRAR</button>
          </form>
        ) : (
          /* VISTA DEL PIN PARA EL SUPER_ADMIN */
          <div className="login-box fade-in">
            <h2 className="login-title" style={{ color: '#00ff7f' }}>🔐 PIN REQUERIDO</h2>
            <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '20px' }}>
              Confirmar identidad para nivel Super Admin
            </p>
            
            <input 
              type="password" 
              maxLength="4"
              placeholder="----" 
              className="login-field"
              style={{ textAlign: 'center', fontSize: '2rem', letterSpacing: '10px' }}
              value={pinDigitado}
              onChange={(e) => setPinDigitado(e.target.value.replace(/\D/g, ""))}
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && verificarPin()}
            />
            
            <button type="button" onClick={verificarPin} className="login-button">
              VALIDAR PIN
            </button>
            
            <button 
              type="button"
              onClick={() => setMostrarPin(false)} 
              style={{ background: 'transparent', color: '#888', border: 'none', marginTop: '15px', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              ← VOLVER AL LOGIN
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-viewport">
      {mostrarModalInformes && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            backgroundColor: '#1a1d23', padding: '30px', borderRadius: '15px',
            border: '2px solid #00ff7f', boxShadow: '0 0 25px rgba(0, 255, 127, 0.2)',
            width: '400px', textAlign: 'center', position: 'relative'
          }}>
            <h2 style={{ color: '#00ff7f', marginTop: 0 }}>📊 CENTRO DE REPORTES</h2>
            <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '20px' }}>Selecciona el periodo y formato para Finpro Store</p>

            {/* NUEVO: SELECTOR DE PERIODO (HOY / MES) */}
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              marginBottom: '25px', 
              background: 'rgba(255,255,255,0.05)', 
              padding: '5px', 
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)'
            }}>
              <button 
                type="button"
                onClick={() => setTipoPeriodo('dia')}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  background: tipoPeriodo === 'dia' ? '#00ff7f' : 'transparent',
                  color: tipoPeriodo === 'dia' ? '#000' : '#fff',
                  cursor: 'pointer', fontWeight: 'bold', transition: '0.3s'
                }}
              >
                📅 HOY
              </button>
                <div style={{
    flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
    background: tipoPeriodo === 'calendario' ? '#00ff7f' : 'rgba(255,255,255,0.1)',
    borderRadius: '8px', padding: '2px'
  }}>
    <input 
      type="date" 
      value={fechaPersonalizada}
      onChange={(e) => {
        setFechaPersonalizada(e.target.value);
        setTipoPeriodo('calendario');
      }}
      style={{
        width: '100%', background: 'transparent', border: 'none', 
        color: tipoPeriodo === 'calendario' ? '#000' : '#fff',
        cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', outline: 'none',
        textAlign: 'center'
      }}
    />
  </div>

              <button 
                type="button"
                onClick={() => setTipoPeriodo('mes')}
                style={{
                  flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                  background: tipoPeriodo === 'mes' ? '#00ff7f' : 'transparent',
                  color: tipoPeriodo === 'mes' ? '#000' : '#fff',
                  cursor: 'pointer', fontWeight: 'bold', transition: '0.3s'
                }}
              >
                🗓️ MES
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              {/* OPCIÓN GMAIL PDF */}
              {/* OPCIÓN GMAIL PDF */}
<button 
  onClick={() => manejarGeneracionReporte('pdf')} // <--- CAMBIO AQUÍ
  className="report-btn"
  disabled={cargando}
  style={{ border: '1px solid #00ff7f', color: '#00ff7f' }}
>
  {cargando ? '⏳ ENVIANDO...' : '📄 Enviar Informe Formal (PDF)'}
</button>

{/* OPCIÓN GMAIL TEXTO */}
<button 
  onClick={() => manejarGeneracionReporte('texto')} // <--- CAMBIO AQUÍ
  className="report-btn"
  style={{ border: '1px solid #ffffff', color: '#ffffff' }}
>
  📧 Enviar Resumen Rápido (Texto)
</button>

{/* OPCIÓN WHATSAPP */}
<button 
  onClick={() => manejarGeneracionReporte('whatsapp')} // <--- CAMBIO AQUÍ
  className="report-btn"
  style={{ border: '1px solid #25d366', color: '#25d366' }}
>
  📱 Enviar por WhatsApp
</button>
            </div>

            <button 
              onClick={() => setMostrarModalInformes(false)}
              style={{ marginTop: '25px', background: 'none', border: 'none', color: '#ff4444', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ❌ CANCELAR
            </button>
          </div>
        </div>
      )}
      {/* INTERFAZ DEL ESCÁNER (Aparece arriba si está activo) */}
     {/* Visor de cámara mejorado para Leonidas Store */}
{escaneando && (
  <div style={{ 
    position: 'fixed', 
    top: 0, 
    left: 0, 
    width: '100vw', 
    height: '100vh', 
    background: '#020617', // Fondo oscuro sólido
    zIndex: 20000, // Superior al encabezado azul
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: '20px'
  }}>
    <div style={{ width: '100%', maxWidth: '400px' }}>
      <div id="reader" style={{ background: 'white', borderRadius: '10px', overflow: 'hidden' }}></div>
      
      <button 
        onClick={() => { 
          // Limpieza manual al cerrar
          const container = document.getElementById('reader');
          if (container) container.innerHTML = '';
          setEscaneando(false); 
        }}
        style={{ 
          width: '100%', 
          marginTop: '20px', 
          padding: '15px', 
          background: '#ef4444', 
          color: 'white', 
          border: 'none', 
          borderRadius: '8px',
          fontWeight: 'bold',
          fontSize: '1rem'
        }}
      >
        CANCELAR ESCANEO
      </button>
    </div>
  </div>
)}
      {/* MODAL DE GALERÍA */}
      {modalImagen && (
  <div className="modal-overlay active" onClick={() => { setModalImagen(null); setFotoActual(null); }}>
    <div className="modal-content-galeria" onClick={(e) => e.stopPropagation()}>
      
      {/* Botón X superior para un cierre rápido */}
      <button className="close-x-galeria" onClick={() => { setModalImagen(null); setFotoActual(null); }}>✕</button>

      <div className="galeria-main-wrapper">
        <img 
          src={fotoActual || (Array.isArray(modalImagen) ? modalImagen[0] : modalImagen)} 
          alt="Laptop Principal" 
          className="galeria-imagen-principal"
        />
      </div>

      {Array.isArray(modalImagen) && modalImagen.length > 1 && (
        <div className="galeria-thumbnails-bar">
          {modalImagen.map((url, index) => (
            <img 
              key={index}
              src={url} 
              alt={`Vista ${index + 1}`} 
              className={`galeria-thumb ${fotoActual === url ? 'active-thumb' : ''}`}
              onClick={() => setFotoActual(url)}
            />
          ))}
        </div>
      )}
    </div>
  </div>
)}

      {/* HEADER CORREGIDO */}
     {/* HEADER CORREGIDO Y DISPERSO */}
      <header className="blue-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', minHeight: '80px' }}>
  
  {/* BLOQUE IZQUIERDA: Identidad (Ancho fijo para equilibrar el centro) */}
  <div className="brand-section" style={{ width: '300px', display: 'flex', alignItems: 'center', gap: '10px' }}>
    {(() => {
      const nombreUsuario = usuarioLogueado?.nombre?.toUpperCase();
      const avatarSrc = AVATARES_USUARIOS[nombreUsuario] || AVATARES_USUARIOS['DEFAULT'];
      const esImagenUrl = avatarSrc.startsWith('http') || avatarSrc.startsWith('/');

      return esImagenUrl 
        ? <img src={avatarSrc} alt="logo" className="nav-logo" />
        : <div className="nav-logo-emoji">{avatarSrc}</div>;
    })()}
    
    <div className="brand-info">
      <h1 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: 'bold' }}>FINPRO STORE</h1>
      <div className="user-status-badges" style={{ display: 'flex', gap: '5px', marginTop: '3px' }}>
        <span className="welcome-badge" style={{ fontSize: '0.75rem' }}>
          ✅ {usuarioLogueado?.nombre.toUpperCase()}
        </span>
        <span className="role-badge" style={{ fontSize: '0.75rem' }}>
          🛡️ {usuarioLogueado?.rol.replace('_', ' ').toUpperCase()}
        </span>
      </div>
    </div>
  </div>

  {/* BLOQUE CENTRAL: Navegación Reordenada, Centrada y con LED */}
  <nav className="nav-actions" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', flexGrow: 1 }}>
    
    {/* 1. EXCEL LOCAL */}
    <button 
      className={pestanaActual === 'excel_interno' ? 'nav-btn active' : 'nav-btn'} 
      onClick={() => setPestanaActual('excel_interno')}
      style={{ border: '1px solid rgba(0, 255, 255, 0.4)', boxShadow: '0 0 8px rgba(0, 255, 255, 0.2)', minWidth: '135px' }}
    >
      📊 EXCEL LOCAL
    </button>

    {/* 2. INFORME */}
    <button 
  className="nav-btn btn-header-report" 
  onClick={() => setPestanaActual('informes')}// Ahora abre el panel
  disabled={cargando}
  style={{ border: '1px solid rgba(0, 255, 127, 0.5)', boxShadow: '0 0 10px rgba(0, 255, 127, 0.3)', minWidth: '135px' }}
>
  {cargando ? '...' : '📧 INFORMES'}
</button>

    {/* 3. VENTAS */}
    <button 
      className={pestanaActual === 'ventas' ? 'nav-btn active' : 'nav-btn'} 
      onClick={() => setPestanaActual('ventas')}
      style={{ border: '1px solid rgba(255, 193, 7, 0.4)', boxShadow: '0 0 8px rgba(255, 193, 7, 0.2)', minWidth: '135px' }}
    >
      💰 VENTAS
    </button>

    {/* 4. ALMACÉN (Solo no vendedores) */}
    {usuarioLogueado?.rol !== 'vendedor' && (
      <button 
        className={pestanaActual === 'almacen' ? 'nav-btn active' : 'nav-btn'} 
        onClick={() => setPestanaActual('almacen')}
        style={{ border: '1px solid rgba(0, 123, 255, 0.5)', boxShadow: '0 0 8px rgba(0, 123, 255, 0.2)', minWidth: '135px' }}
      >
        📖 ALMACÉN
      </button>
    )}
    
    {/* 5. REGISTRO (Solo no vendedores) */}
    {usuarioLogueado?.rol !== 'vendedor' && (
      <button 
        className={pestanaActual === 'registro' ? 'nav-btn active' : 'nav-btn'} 
        onClick={() => setPestanaActual('registro')}
        style={{ border: '1px solid rgba(138, 43, 226, 0.5)', boxShadow: '0 0 8px rgba(138, 43, 226, 0.2)', minWidth: '135px' }}
      >
        ➕ {editandoId ? 'EDITAR' : 'REGISTRAR'}
      </button>
    )}
  </nav>

  {/* BLOQUE DERECHA: Salida (Ancho fijo para equilibrar) */}
  <div className="exit-section" style={{ width: '300px', display: 'flex', justifyContent: 'flex-end' }}>
    <button 
      className="btn-exit" 
      onClick={() => { 
        setAutenticado(false); 
        setUsuarioLogueado(null);
        setUserDigitado("");
        setPassDigitado("");
        setPinDigitado("");
        localStorage.clear();
        sessionStorage.clear();
      }}
      style={{ border: '1px solid rgba(239, 68, 68, 0.6)', boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)', padding: '8px 15px', fontWeight: 'bold' }}
    >
      🚪 SALIR
    </button>
  </div>
</header>

     <main className="main-content">
  {/* VISTA ALMACÉN */}
      {pestanaActual === 'almacen' && (
  <div className="inventory-view fade-in">
    
    {/* === BLOQUE DE TOTALES EXCLUSIVO PARA SUPER_ADMIN (DUEÑO) === */}
    {usuarioLogueado?.rol === 'super_admin' && (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-around', 
        background: '#1a1d23', 
        padding: '15px', 
        borderRadius: '12px', 
        border: '1px solid #00ff7f',
        marginBottom: '15px',
        textAlign: 'center',
        boxShadow: '0 4px 15px rgba(0, 255, 127, 0.1)'
      }}>
        <div>
          <div style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '5px' }}>INVERSIÓN FILTRADA</div>
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.2rem' }}>S/ {inversionTotal.toFixed(2)}</div>
        </div>
        <div style={{ width: '1px', background: '#333' }}></div>
        <div>
          <div style={{ color: '#aaa', fontSize: '0.8rem', marginBottom: '5px' }}>GANANCIA </div>
          <div style={{ color: '#00ff7f', fontWeight: 'bold', fontSize: '1.2rem' }}>S/ {utilidadTotal.toFixed(2)}</div>
        </div>
      </div>
    )}
    {/* ============================================================= */}

    <div className="search-container-modern">
      <div className="search-box-wrapper">
        <span className="search-icon">🔍</span>
        <input 
          type="text" 
          placeholder="Buscar por Serie en Almacén..." 
          className="search-input-modern" 
          value={busqueda} 
          onChange={(e) => setBusqueda(e.target.value)} 
        />
      </div>
      <div className="filter-controls">
        <input 
          type="date" 
          className="custom-date-picker" 
          value={fechaConsulta || ""} 
          onChange={(e) => setFechaConsulta(e.target.value)} 
        />
        <button className="btn-show-all" onClick={manejarVerTodo}>📋 VER TODO</button>
      </div>
    </div>

    <AlmacenTabla 
      laptops={laptopsFiltradas}
      eliminarProducto={manejarEliminar}
      marcarComoVendido={marcarComoVendido}
      activarEdicion={activarEdicion} 
      actualizarProducto={actualizarProducto}
      usuarioLogueado={usuarioLogueado}
      busqueda={busqueda}
      setModalImagen={(img) => {
        setModalImagen(img);
        setFotoActual(Array.isArray(img) ? img[0] : img);
      }} 
    />
  </div>
)}

  {pestanaActual === 'informes' && (
  <PanelInformes 
    laptops={laptops} 
    manejarGeneracionReporte={manejarGeneracionReporte}
    cargando={cargando}
    usuarioLogueado={usuarioLogueado}
  />
)}

  {/* VISTA VENTAS REALIZADAS (NUEVA) */}
  {/* VISTA VENTAS REALIZADAS */}
{pestanaActual === 'ventas' && (
  <VentasView 
    laptops={laptops}
    busqueda={busqueda}
    setBusqueda={setBusqueda}
    setPestanaActual={setPestanaActual}
    usuarioLogueado={usuarioLogueado}
    setModalImagen={setModalImagen}
    setFotoActual={setFotoActual}
    activarEdicion={activarEdicion}
    eliminarProducto={manejarEliminar}
    actualizarProducto={actualizarProducto}
  />
)}

{pestanaActual === 'registro' && (
  <RegistroVentasView 
    form={form}
    setForm={setForm}
    manejarCambio={manejarCambio}
    guardarLaptop={guardarLaptop}
    cargando={cargando}
    listaSeriales={listaSeriales}
    setListaSeriales={setListaSeriales}
    iniciarEscaneo={iniciarEscaneo}
    cancelarEdicion={cancelarEdicion}
    editandoId={editandoId}
    usuarioLogueado={usuarioLogueado}
    // IMPORTANTE: Asegúrate de que estas 4 líneas estén aquí
    OPCIONES_MARCAS={OPCIONES_MARCAS}
    MODELOS_SUGERIDOS={MODELOS_SUGERIDOS}
    OPCIONES_DESTINO={OPCIONES_DESTINO}
    OPCIONES_ESTADO={OPCIONES_ESTADO}
  />
)}

        {/* VISTA EXCEL INTERNO */}
        {pestanaActual === 'excel_interno' && (
          <div className="fade-in">
            <HojaReportes 
              laptops={laptopsFiltradas} 
              usuarioLogueado={usuarioLogueado}
              activarEdicion={activarEdicion}
              setModalImagen={setModalImagen}
              fechaFiltro={fechaFiltro}
              setFechaFiltro={setFechaFiltro}
              eliminarProducto={manejarEliminar}
            />
          </div>
        )}
      </main>
    </div>
  );
}
export default App;