
import { User, Lock, Eye, EyeOff, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
// --- NUEVO: Imports de Firebase para la base de datos en la nube ---
import React, { useState, useEffect, useMemo, useRef } from 'react';
import './App.css';
import DespachosView from './components/DespachosView';
import AlmacenTabla from './components/AlmacenTabla';
import { Html5QrcodeScanner } from 'html5-qrcode';
import VentasView from './components/VentasView';
import PanelInformes from './components/PanelInformes';
// Importación de constantes y servicios
import MenuMobile from './MenuMobile';
import { enviarInformeGmailPDF } from './serviciosReportes';
import HojaReportes from './components/HojaReportes';
import RegistroVentasView from './components/RegistroVentasView';
import logoFinpro from './assets/logo-finpro.png'; // La ruta donde guardaste la imagen
import PanelGestionUsuarios from './components/PanelGestionUsuarios'; // NUEVO: Panel de gestión

import { 
  CONFIG, OPCIONES_MARCAS, OPCIONES_RAM,
  OPCIONES_ALMACENAMIENTO, OPCIONES_PROCESADOR, OPCIONES_GPU, 
  OPCIONES_DESTINO, MODELOS_SUGERIDOS, OPCIONES_ESTADO, PRESETS_MODELOS
} from "./constants/config.js";

import { LISTA_USUARIOS as initialUsers } from "./constants/usuarios.js"; // Renombrado para el estado
import { PERMISSIONS, ROLES_PERMISSIONS } from './permissions.js'; // CORREGIDO: Ruta del sistema de permisos

import { 
  subirACloudinary, sincronizarConExcel,
  guardarProducto, actualizarProducto, eliminarProducto, suscribirseAInventario, enviarInformeEmail,
} from './services/api';
import { db } from './firebase';
import { collection, onSnapshot, doc, addDoc, updateDoc, deleteDoc, writeBatch, setDoc } from "firebase/firestore";

// --- CONFIGURACIÓN DE AVATARES PERSONALIZADOS (LEONIDAS STORE) ---
const AVATARES_USUARIOS = {
  'YAEL': 'https://images.steamusercontent.com/ugc/2450612450625227938/B4074195BDE6EB792E801EA52EB5F0BF971F4008/?imw=512&&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=false',
  'DAVID': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-HIltRjS8H7tv-tgTeCiQYVNU5K4Y-ResdQ&s',
  'CRISTOFER': 'https://media.tenor.com/9LH4AwWJB2oAAAAe/agnes-tachyon-uma-musume.png',
  // Avatar por defecto para LEONIDAS y otros usuarios
  'DEFAULT': logoFinpro
};
const obtenerMesYAnio = (fechaString) => {
  if (!fechaString) return 'FECHA DESCONOCIDA';
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
  const [dia, mes, anio] = fechaString.split('/');
  return `${meses[parseInt(mes) - 1]} ${anio}`;
};

function App() {
  // Añade este estado al inicio de tu componente
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [navScrollIndex, setNavScrollIndex] = useState(0);
  const [navOffset, setNavOffset] = useState(0);
  const navContainerRef = useRef(null);
  const [mostrarModalInformes, setMostrarModalInformes] = useState(false);
  const [indiceEscaneo, setIndiceEscaneo] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
const [mostrarPin, setMostrarPin] = useState(false);
const [esCelular, setEsCelular] = useState(window.innerWidth <= 768);
const [pinDigitado, setPinDigitado] = useState("");
const [usuarioPendiente, setUsuarioPendiente] = useState(null);
  const [autenticado, setAutenticado] = useState(false);
  const [userDigitado, setUserDigitado] = useState(""); 
  const [tipoPeriodo, setTipoPeriodo] = useState('dia');
  const [passDigitado, setPassDigitado] = useState(""); 
  const [configCargada, setConfigCargada] = useState(false); // NUEVO: Estado de carga para datos de la nube
  const [fechaPersonalizada, setFechaPersonalizada] = useState(new Date().toISOString().split('T')[0]);
  const [usuarioLogueado, setUsuarioLogueado] = useState(null);
  const [listaUsuarios, setListaUsuarios] = useState([]); // MODIFICADO: Inicia vacío, se llenará desde la nube
  const [rolesConPermisos, setRolesConPermisos] = useState({}); // MODIFICADO: Inicia vacío, se llenará desde la nube
  const [pestanaActual, setPestanaActual] = useState("excel_interno");
  const [laptops, setLaptops] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [listaSeriales, setListaSeriales] = useState([""]);
  const [fechaFiltro, setFechaFiltro] = useState('');
  
  const [fechaConsulta, setFechaConsulta] = useState("");
  const [mostrarManual, setMostrarManual] = useState({});
  
  const [modalImagen, setModalImagen] = useState(null);
  const [fotoActual, setFotoActual] = useState("");
  const [escaneando, setEscaneando] = useState(false);
  // NUEVOS ESTADOS PARA EL FORMATEO
  const [mostrarModalFormateo, setMostrarModalFormateo] = useState(false);
  const [tipoFormateoSeleccionado, setTipoFormateoSeleccionado] = useState(null); // 'mes' o 'total'
  const [mesFormateo, setMesFormateo] = useState('');
  const [anioFormateo, setAnioFormateo] = useState('');

  const [form, setForm] = useState({
    marca: '', modelo: '', precio: '', precio_costo: '', serial: '', 
    procesador: '', generacion: '', 
    ram: '', almacenamiento: '', 
    gpu: '', cliente: '', dni: '', cel: '', destino: '', pago: 'EFECTIVO', 
    estado: 'STOCK', imagenes: [],
    cantidad: 1 
  });
  const [codigoConfirmacion, setCodigoConfirmacion] = useState(''); // Para el código de formateo
  const [easterEggConfirmado, setEasterEggConfirmado] = useState(false); // Para el easter egg
const [verPassword, setVerPassword] = useState(false);

  const cerrarGaleria = () => {
    setModalImagen(null);
    setFotoActual(""); 
  };

  const handleLogout = () => {
    setIsMenuOpen(false); // Cierra el menú si está abierto
    setAutenticado(false); 
    setUsuarioLogueado(null);
    setUserDigitado("");
    setPassDigitado("");
    setPinDigitado("");
  };

  // --- NUEVO: GESTOR DE PERMISOS ---
  const tienePermiso = (permisoRequerido) => {
    return usuarioLogueado?.permissions?.includes(permisoRequerido) ?? false;
  };

  // --- NUEVO: MANEJADOR PARA ACTIVAR/DESACTIVAR USUARIOS ---
  const handleToggleActivo = async (userId, currentState) => {
    if (!window.confirm("¿Estás seguro de cambiar el estado de este usuario?")) return;
    try {
      const userRef = doc(db, "usuarios", userId);
      await updateDoc(userRef, { activo: !currentState });
      alert("✅ Estado del usuario actualizado en la nube.");
    } catch (error) {
      console.error("Error al actualizar estado de usuario:", error);
      alert("❌ Error al actualizar el estado del usuario.");
    }
};

  // --- NUEVO: MANEJADOR PARA EXCEPCIONES DE PERMISOS POR USUARIO ---
  const handleUpdateUserPermissionOverrides = async (userId, newOverrides) => {
    try {
      const userRef = doc(db, "usuarios", userId);
      await updateDoc(userRef, { permissionOverrides: newOverrides });
      // No se muestra alerta para no saturar la UI con cada cambio.
    } catch (error) {
      console.error("Error al actualizar excepciones de permisos:", error);
      alert("❌ Error al guardar las excepciones de permisos.");
    }
  };

  // --- NUEVO: MANEJADORES PARA ROLES Y PERMISOS ---
  const handleAddRole = async (newRoleName) => {
    if (!newRoleName || rolesConPermisos[newRoleName]) {
      alert("❌ Nombre de rol inválido o ya existente.");
      return false;
    }
    try {
      await setDoc(doc(db, "roles", newRoleName), { permissions: [] });
      alert(`✅ Rol "${newRoleName}" creado en la nube.`);
      return true;
    } catch (error) {
      console.error("Error al crear rol:", error);
      alert("❌ Error al crear el rol.");
      return false;
    }
  };

  const handleUpdateRolePermissions = async (role, permissions) => {
    try {
      const roleRef = doc(db, "roles", role);
      await updateDoc(roleRef, { permissions: permissions });
    } catch (error) {
      console.error("Error al actualizar permisos de rol:", error);
      alert("❌ Error al guardar los permisos del rol.");
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    if (!window.confirm("¿Estás seguro de cambiar el rol de este usuario?")) return;
    try {
      const userRef = doc(db, "usuarios", userId);
      await updateDoc(userRef, { rol: newRole });
      alert("✅ Rol del usuario actualizado en la nube.");
    } catch (error) {
      console.error("Error al cambiar rol de usuario:", error);
      alert("❌ Error al cambiar el rol del usuario.");
    }
  };

  const handleCreateUser = async (newUserData) => {
    // Validar que el nombre de usuario no exista
    if (listaUsuarios.some(u => u.user.toLowerCase() === newUserData.user.toLowerCase())) {
      alert('❌ Ya existe un usuario con ese nombre de login.');
      return false;
    }

    const newUserPayload = {
      ...newUserData,
      activo: true,
      // Se asigna una hoja de cálculo por defecto. Esto podría ser un campo más en el futuro.
      hoja: "https://docs.google.com/spreadsheets/d/1Ra3jKS2ynhlo_fdFYS6fm9R4gb0Dsk1xbxm1IY63sOQ/edit#gid=0"
    };

    try {
      const docRef = await addDoc(collection(db, "usuarios"), newUserPayload);
      alert(`✅ Usuario "${newUserData.nombre}" creado exitosamente en la nube.`);
      return true;
    } catch (error) {
      console.error("Error al crear usuario:", error);
      alert("❌ Error al crear el usuario.");
      return false;
    }
  };

  const handleDeleteRole = async (roleToDelete) => {
    // Seguridad: No permitir eliminar roles base del sistema.
    const rolesBase = Object.keys(ROLES_PERMISSIONS);
    if (rolesBase.includes(roleToDelete)) {
      alert(`❌ El rol "${roleToDelete}" es un rol base del sistema y no se puede eliminar.`);
      return false;
    }
    // Seguridad: Verificar si algún usuario tiene este rol asignado.
    if (listaUsuarios.some(user => user.rol === roleToDelete)) {
      alert(`❌ No se puede eliminar el rol "${roleToDelete}" porque está asignado a uno o más usuarios. Reasigna los usuarios a otro rol primero.`);
      return false;
    }
    if (window.confirm(`¿Estás seguro de eliminar el rol "${roleToDelete}"? Esta acción no se puede deshacer.`)) {
      try {
        await deleteDoc(doc(db, "roles", roleToDelete));
        alert(`✅ Rol "${roleToDelete}" eliminado de la nube.`);
        return true;
      } catch (error) {
        console.error("Error al eliminar rol:", error);
        alert("❌ Error al eliminar el rol.");
        return false;
      }
    }
    return false;
  };

  const handleDeleteUser = async (userId) => {
    const userToDelete = listaUsuarios.find(u => u.id === userId);
    if (!userToDelete) return;

    if (window.confirm(`¿Estás seguro de eliminar al usuario "${userToDelete.nombre}"? Esta acción es PERMANENTE.`)) {
      try {
        await deleteDoc(doc(db, "usuarios", userId));
        alert(`✅ Usuario "${userToDelete.nombre}" eliminado de la nube.`);
      } catch (error) {
        console.error("Error al eliminar usuario:", error);
        alert("❌ Error al eliminar el usuario.");
      }
    }
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
    alert("❌ Hubo un error al generar.");
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
    facingMode: { ideal: "environment" } 
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
    if (!autenticado) return;

    const pestanasPermitidas = [];
    if (tienePermiso(PERMISSIONS.VER_TABLA_GENERAL)) pestanasPermitidas.push('excel_interno');
    if (tienePermiso(PERMISSIONS.VER_INFORMES)) pestanasPermitidas.push('informes');
    if (tienePermiso(PERMISSIONS.VER_VENTAS)) pestanasPermitidas.push('ventas');
    
    if (tienePermiso(PERMISSIONS.VER_ALMACEN)) pestanasPermitidas.push('almacen');
    if (tienePermiso(PERMISSIONS.REGISTRAR)) pestanasPermitidas.push('registro');
    if (tienePermiso(PERMISSIONS.GESTIONAR_USUARIOS)) pestanasPermitidas.push('gestion_usuarios');

    // Si la pestaña actual no está en la lista de permitidas, redirige a la primera que sí lo esté.
    if (!pestanasPermitidas.includes(pestanaActual)) {
        setPestanaActual(pestanasPermitidas[0] || 'ventas');
    }
  }, [pestanaActual, autenticado, usuarioLogueado]);

  // --- EFECTO NUEVO: Carga de configuración (usuarios y roles) desde Firestore ---
  useEffect(() => {
    // Suscripción a la colección de USUARIOS
    const unsubUsuarios = onSnapshot(collection(db, "usuarios"), async (snapshot) => {
      if (snapshot.empty) {
        console.log("Colección 'usuarios' vacía. Sembrando datos iniciales...");
        const batch = writeBatch(db);
        initialUsers.forEach(user => {
          const userRef = doc(collection(db, "usuarios")); // Firestore genera el ID
          batch.set(userRef, user);
        });
        await batch.commit();
        console.log("Usuarios iniciales sembrados en la nube.");
      } else {
        const usersData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        setListaUsuarios(usersData);
      }
    });

    // Suscripción a la colección de ROLES
    const unsubRoles = onSnapshot(collection(db, "roles"), async (snapshot) => {
      if (snapshot.empty) {
        console.log("Colección 'roles' vacía. Sembrando datos iniciales...");
        const batch = writeBatch(db);
        Object.entries(ROLES_PERMISSIONS).forEach(([roleName, permissions]) => {
          const roleRef = doc(db, "roles", roleName);
          batch.set(roleRef, { permissions });
        });
        await batch.commit();
        console.log("Roles iniciales sembrados en la nube.");
      } else {
        const rolesData = {};
        snapshot.docs.forEach(doc => {
          rolesData[doc.id] = doc.data().permissions || [];
        });
        setRolesConPermisos(rolesData);
      }
      setConfigCargada(true); // Marcamos como cargado después de tener los roles
    });

    return () => {
      unsubUsuarios();
      unsubRoles();
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setEsCelular(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- EFECTO 2: Suscripción a Firebase (solo para roles que usan la UI principal) ---
  useEffect(() => {
  // Ahora permitimos que administrador_ventas también se suscriba al inventario
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
    if (tienePermiso(PERMISSIONS.VER_FINANZAS)) {
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
  const { name, value, type, files } = e.target;

  if (type === "file" || name === "imagenes") {
    if (files.length > 3) {
      alert("⚠️ Puedes subir un máximo de 3 imágenes.");
      e.target.value = null; // Limpia la selección física del input
      return;
    }
    // Convertimos FileList a Array para mejor compatibilidad
    setForm({ ...form, imagenes: Array.from(files) });
  } else {
    // Aplicamos toUpperCase para que los seriales y modelos queden estandarizados
    setForm({ 
      ...form, 
      [name]: typeof value === 'string' ? value.toUpperCase() : value 
    });
  }
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
    // --- NUEVA LÓGICA DE IMÁGENES CORREGIDA PARA LEONIDAS STORE ---
    let links = [];

    if (Array.isArray(form.imagenes) && form.imagenes.length > 0) {
      // Verificamos si el primer elemento es un archivo real (objeto File)
      // Si es un File, significa que son fotos nuevas seleccionadas en el celular/PC
      if (form.imagenes[0] instanceof File) {
        links = await Promise.all(
          form.imagenes.map(file => subirACloudinary(file))
        );
      } else {
        // Si no son archivos, asumimos que ya son las URLs de texto (links de Cloudinary anteriores)
        links = form.imagenes;
      }
    } else if (form.imagenes instanceof FileList && form.imagenes.length > 0) {
      // Compatibilidad por si acaso aún queda algún FileList
      links = await Promise.all(
        Array.from(form.imagenes).map(file => subirACloudinary(file))
      );
    }
    // -------------------------------------------------------------

    for (const s of serialesFinales) {
      const modeloProcesado = form.modelo && form.modelo.trim() !== "" 
        ? form.modelo.toUpperCase() 
        : "OTRO";

      const vVenta = Number(form.precio) || 0;
      const vCosto = Number(form.precio_costo) || 0;
      const utilidadCalculada = vVenta - vCosto;

      const datosFinales = { 
        ...form,
        precio: vVenta,
        precio_costo: vCosto,
        utilidad: utilidadCalculada,
        serial: s, 
        modelo: modeloProcesado,
        imagenes: links, // <--- Ahora 'links' garantizadamente son Strings (URLs)
      };

      // ... resto de tu lógica de responsables y guardado

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
  if (tienePermiso(PERMISSIONS.EDITAR_REGISTRO)) { // Asumimos que un editor puede reasignar
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

  alert(`✅ ${editandoId ? 'Actualizado' : 'Registrado'} correctamente por ${usuarioLogueado?.nombre || "Usuario"}`);
    cancelarEdicion();

    // Si es nuevo, va al almacén. Si es edición, regresa a la Tabla General.
    if (!editandoId) {
      setPestanaActual("almacen");
    } else {
      setPestanaActual("excel_interno");
    }

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

// --- NUEVA FUNCIÓN: FORMATEAR INVENTARIO (ELIMINACIÓN MASIVA) ---
const handleFormatearInventario = async () => {
  if (codigoConfirmacion !== "2260") {
    alert("❌ Código de confirmación incorrecto.");
    return;
  }

  setCargando(true);
  try {
    let laptopsAEliminar = [];
    let mensajeConfirmacion = "";

    if (tipoFormateoSeleccionado === 'total') {
      laptopsAEliminar = [...laptops]; // Todas las laptops
      mensajeConfirmacion = `⚠️ Estás a punto de eliminar TODOS los ${laptopsAEliminar.length} equipos del inventario. Esta acción es IRREVERSIBLE. ¿Estás ABSOLUTAMENTE seguro?`;
    } else if (tipoFormateoSeleccionado === 'mes' && mesFormateo && anioFormateo) {
      laptopsAEliminar = laptops.filter(lap => {
        if (!lap.fecha) return false;
        const [dia, mes, anio] = lap.fecha.split('/');
        // Asegurarse de que el mes y año de la laptop coincidan con los seleccionados
        return parseInt(mes) === parseInt(mesFormateo) && parseInt(anio) === parseInt(anioFormateo);
      });
      mensajeConfirmacion = `⚠️ Estás a punto de eliminar ${laptopsAEliminar.length} equipos del mes ${mesFormateo}/${anioFormateo}. Esta acción es IRREVERSIBLE. ¿Estás ABSOLUTAMENTE seguro?`;
    } else {
      alert("❌ Selección de formateo inválida.");
      setCargando(false);
      return;
    }

    if (laptopsAEliminar.length === 0) {
      alert("No se encontraron equipos para formatear en el periodo seleccionado.");
      setCargando(false);
      return;
    }

    const confirmacionFinal = window.confirm(mensajeConfirmacion);
    if (!confirmacionFinal) {
      setCargando(false);
      return;
    }

    // Iterar y eliminar cada producto
    for (const lap of laptopsAEliminar) {
      // Reutilizamos la función de servicio eliminarProducto
      await eliminarProducto(lap.fireId, lap.serial); 
    }

    alert(`✅ ${laptopsAEliminar.length} equipos formateados correctamente.`);
    // Resetear estados del modal
    setMostrarModalFormateo(false);
    setCodigoConfirmacion("");
    setMesFormateo("");
    setAnioFormateo("");
    setTipoFormateoSeleccionado(null);
    setEasterEggConfirmado(false); // Resetear easter egg
  } catch (err) {
    console.error("Error al formatear:", err);
    alert("❌ Error al formatear equipos: " + err.message);
  } finally {
    setCargando(false);
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
  // Si el usuario tiene permiso para ver todo el almacén, no se filtra por nombre.
  const puedeVerTodo = tienePermiso(PERMISSIONS.VER_ALMACEN); 
  const coincideVendedor = puedeVerTodo
    ? true
    : (lap.responsable === usuarioLogueado?.nombre);
  
  if (!coincideVendedor) return false;

  // 3. FILTRO DE FECHA (CONVERSIÓN SEGURA)
 const fechaSeleccionada = fechaConsulta || fechaFiltro;
  if (fechaSeleccionada) {
    const [year, month, day] = fechaSeleccionada.split('-');
    
    // Creamos ambas variantes para comparar (con cero y sin cero)
    const fechaFormato1 = `${parseInt(day)}/${parseInt(month)}/${year}`; // "18/4/2026"
    const fechaFormato2 = `${day}/${month}/${year}`;                   // "18/04/2026"

    // Si la fecha de la laptop no coincide con ninguna de las dos formas, se oculta
    if (lap.fecha !== fechaFormato1 && lap.fecha !== fechaFormato2) {
      return false;
    }
  }

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

// --- CÁLCULO DE TOTALES (SOLO ADMINS) ---
// Estos cálculos se ejecutan sobre el resultado ya filtrado
let inversionTotal = 0;
let utilidadTotal = 0;

if (tienePermiso(PERMISSIONS.VER_FINANZAS)) {
  inversionTotal = laptopsFiltradas.reduce((acc, lap) => acc + (Number(lap.precio_costo) || 0), 0);
  utilidadTotal = laptopsFiltradas.reduce((acc, lap) => acc + (Number(lap.utilidad) || 0), 0);
}

// --- Lógica para el menú de navegación desplazable ---
  const navItems = useMemo(() => {
    const items = [];
    if (tienePermiso(PERMISSIONS.VER_TABLA_GENERAL)) {
      items.push({ pestana: 'excel_interno', texto: '📊 Tabla General', style: { border: '1px solid rgba(0, 255, 255, 0.4)', whiteSpace: 'nowrap', '--color-activo': '#10b981' } });
    }
    if (tienePermiso(PERMISSIONS.VER_INFORMES)) {
      items.push({ pestana: 'informes', texto: cargando ? '...' : '📧 INFORMES', className: 'btn-header-report', style: { border: '1px solid rgba(0, 255, 127, 0.5)', whiteSpace: 'nowrap', '--color-activo': '#3b82f6' } });
    }
    if (tienePermiso(PERMISSIONS.VER_VENTAS)) {
      items.push({ pestana: 'ventas', texto: '💰 VENTAS', style: { border: '1px solid rgba(255, 193, 7, 0.4)', whiteSpace: 'nowrap', '--color-activo': '#f59e0b' } });
      //items.push({ pestana: 'despachos', texto: '🚚 DESPACHOS', style: { border: '1px solid rgba(59, 130, 246, 0.5)', whiteSpace: 'nowrap', '--color-activo': '#3b82f6' } });
    }
    if (tienePermiso(PERMISSIONS.VER_ALMACEN)) {
      items.push({ pestana: 'almacen', texto: '📖 ALMACÉN', style: { border: '1px solid rgba(0, 123, 255, 0.5)', whiteSpace: 'nowrap', '--color-activo': '#0ea5e9' } });
    }
    if (tienePermiso(PERMISSIONS.REGISTRAR)) {
      items.push({ pestana: 'registro', texto: `➕ ${editandoId ? 'EDITAR' : 'REGISTRAR'}`, style: { border: '1px solid rgba(138, 43, 226, 0.5)', whiteSpace: 'nowrap', '--color-activo': '#a855f7' } });
    }
    if (tienePermiso(PERMISSIONS.GESTIONAR_USUARIOS)) {
      items.push({ pestana: 'gestion_usuarios', texto: '👤 CONFIGURACIONES', style: { border: '1px solid rgba(255, 105, 180, 0.6)', whiteSpace: 'nowrap', '--color-activo': '#ec4899' } });
    }
    return items;
  }, [tienePermiso, cargando, editandoId]);

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

  // --- Lógica de Navegación Unificada con Scroll ---
  const ITEMS_PER_VIEW = 4; // Se muestran 4 botones principales
  const canScroll = false;
  const maxScrollIndex = canScroll ? navItems.length - ITEMS_PER_VIEW : 0;

  // Resetear el scroll al cerrar el panel o si cambian los items
  useEffect(() => {
    setNavScrollIndex(0);
  }, [navItems.length]);

  // Calcular el desplazamiento en píxeles para la animación
  useEffect(() => {
    if (!navContainerRef.current || !canScroll) {
      setNavOffset(0);
      return;
    }
    const buttons = Array.from(navContainerRef.current.children);
    let offset = 0;
    const gap = 12; // Corresponde al 'gap' en .nav-actions
    for (let i = 0; i < navScrollIndex; i++) {
      if (buttons[i]) {
        offset += buttons[i].offsetWidth + gap;
      }
    }
    setNavOffset(offset);
  }, [navScrollIndex, navItems, canScroll]);

  const handleNavScroll = (direction) => {
    setNavScrollIndex(prev => {
      const next = direction === 'right' ? prev + 1 : prev - 1;
      return Math.max(0, Math.min(next, maxScrollIndex));
    });
  };

  // --- NUEVO: Pantalla de carga mientras se sincroniza con la nube ---
  if (!configCargada) {
    return (
      <div id="login-root">
        <div className="login-box" style={{textAlign: 'center'}}>
          <img src={logoFinpro} className="login-avatar" alt="Logo Finpro" style={{objectFit: 'contain'}} />
          <h2 className="login-title" style={{color: '#00ff7f'}}>SINCRONIZANDO...</h2>
          <p style={{color: '#94a3b8', fontSize: '0.9rem'}}>
            Conectando con la base de datos en la nube para obtener la configuración más reciente.
          </p>
        </div>
      </div>
    );
  }

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
            const encontrado = listaUsuarios.find(u => 
              u.user.toLowerCase() === usuarioInput && 
              u.pass === passInput
            );

            if (encontrado) {
              // NUEVO: Verificar si la cuenta está activa
              if (!encontrado.activo) {
                alert("❌ Tu cuenta ha sido desactivada. Contacta a un administrador.");
                return;
              }

              // Asignar permisos al usuario encontrado
              const permisosRol = rolesConPermisos[encontrado.rol] || [];
              const overrides = encontrado.permissionOverrides || { add: [], remove: [] };
              
              // Aplicar excepciones:
              // 1. Empezamos con los permisos del rol.
              let permisosFinales = [...permisosRol];
              // 2. Añadimos los permisos permitidos explícitamente (sin duplicados).
              permisosFinales = [...new Set([...permisosFinales, ...overrides.add])];
              // 3. Quitamos los permisos denegados explícitamente.
              permisosFinales = permisosFinales.filter(p => !overrides.remove.includes(p));

              const usuarioConPermisos = { ...encontrado, permissions: permisosFinales };

              // Si el usuario tiene el permiso de PIN, activamos el flujo del PIN
              if (permisosFinales.includes(PERMISSIONS.PIN_LOGIN)) {
                setUsuarioPendiente(usuarioConPermisos);
                setMostrarPin(true);
              } else {
                // Si es cualquier otro rol, entra directo
                setUsuarioLogueado(usuarioConPermisos);
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
            <div className="input-group">
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
            <User className="input-icon" size={20} />
            </div>
            <div className="input-group" style={{ position: 'relative' }}>
  <input
    type={verPassword ? "text" : "password"} // <-- LA MAGIA: Cambia según el estado
    placeholder="Contraseña"
    className="login-field"
    style={{ paddingRight: '45px' }} // Espacio para que el texto no choque con el ojo
    value={passDigitado}
    onChange={(e) => setPassDigitado(e.target.value)}
    required
    autoComplete="new-password"
  />
  <Lock className="input-icon" size={20} />

  {/* BOTÓN DEL OJO: Agrégalo justo antes de cerrar el div */}
  <button
    type="button"
    onClick={() => setVerPassword(!verPassword)}
    style={{
      position: 'absolute',
      right: '15px',
      top: '50%',
      transform: 'translateY(-50%)',
      background: 'none',
      border: 'none',
      color: 'rgba(255, 255, 255, 0.4)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      zIndex: 10,
      padding: '0'
    }}
  >
    {verPassword ? <EyeOff size={20} /> : <Eye size={20} />}
  </button>
</div>

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
              className="pin-input-clean" /* ¡NUEVA CLASE! */
              value={pinDigitado}
              onChange={(e) => setPinDigitado(e.target.value.replace(/\D/g, ""))}
              autoFocus
              onKeyPress={(e) => e.key === 'Enter' && verificarPin()}
            />
            
            <button type="button" onClick={verificarPin} className="login-button" style={{ marginTop: '20px' }}>
              VALIDAR PIN
            </button>
            
<button
  type="button"
  onClick={() => setMostrarPin(false)}
  style={{
    width: '100%',
    padding: '12px',
    marginTop: '15px',
    backgroundColor: '#ff4d4d',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer',
    textTransform: 'uppercase',
    transition: 'background-color 0.3s'
  }}
  onMouseOver={(e) => e.target.style.backgroundColor = '#cc0000'}
  onMouseOut={(e) => e.target.style.backgroundColor = '#ff4d4d'}
>
  ← VOLVER AL LOGIN
</button>
          </div>
        )}
      </div>
    );
  }

  // --- LAYOUT PRINCIPAL (OSCURO) PARA OTROS ROLES (super_admin, admin_2, etc.) ---
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
              <button 
                onClick={() => manejarGeneracionReporte('pdf', { tipo: tipoPeriodo, fecha: fechaPersonalizada })}
                className="report-btn"
                disabled={cargando}
                style={{ border: '1px solid #00ff7f', color: '#00ff7f' }}
              >
                {cargando ? '⏳ ENVIANDO...' : '📄 Enviar Informe Formal (PDF)'}
              </button>

              {/* OPCIÓN GMAIL TEXTO */}
              <button 
                onClick={() => manejarGeneracionReporte('texto', { tipo: tipoPeriodo, fecha: fechaPersonalizada })}
                className="report-btn"
                style={{ border: '1px solid #ffffff', color: '#ffffff' }}
              >
                📧 Enviar Resumen Rápido (Texto)
              </button>

              {/* OPCIÓN WHATSAPP */}
              <button 
                onClick={() => manejarGeneracionReporte('whatsapp', { tipo: tipoPeriodo, fecha: fechaPersonalizada })}
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

      {/* MODAL DE FORMATEO (ELIMINACIÓN MASIVA) */}
      {mostrarModalFormateo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 2000, backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            backgroundColor: '#1a1d23', padding: '30px', borderRadius: '15px',
            border: '2px solid #ef4444', boxShadow: '0 0 25px rgba(239, 68, 68, 0.2)',
            width: '400px', textAlign: 'center', position: 'relative'
          }}>
            {easterEggConfirmado ? (
              <div>
                <img 
                  src="https://p16-common-sign.tiktokcdn-us.com/tos-maliva-p-0068/osdCIBirqEBqBzAArmAof7ib0dINIlrgEAYrdB~tplv-tiktokx-origin.image?dr=9636&x-expires=1779879600&x-signature=Rn0Ybgl4WMlh2w2fZcw7oCM6RQI%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=55bbe6a9&idc=useast5" 
                  alt="Easter Egg" 
                  style={{ maxWidth: '100%', borderRadius: '10px', border: '2px solid #00ff7f' }} 
                />
                <p style={{color: '#00ff7f', marginTop: '15px', fontWeight: 'bold'}}>TIENES 14? ACTIVA CAM</p>
                <button 
                  onClick={() => {
                    setEasterEggConfirmado(false);
                    setCodigoConfirmacion('');
                  }}
                  style={{ background: 'none', border: '1px solid #aaa', color: '#aaa', cursor: 'pointer', fontWeight: 'bold', padding: '8px 16px', borderRadius: '8px', marginTop: '10px' }}
                >
                  VOLVER
                </button>
              </div>
            ) : (
              <>
                <h2 style={{ color: '#ef4444', marginTop: 0 }}>🗑️ FORMATEAR INVENTARIO</h2>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '20px' }}>
                  Esta acción eliminará equipos de forma PERMANENTE, Por favor seleccione el período, MES o TODO.
                </p>

                {/* Selector de tipo de formateo */}
                <div style={{ 
                  display: 'flex', gap: '10px', marginBottom: '25px', background: 'rgba(255,255,255,0.05)', 
                  padding: '5px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <button 
                    type="button"
                    onClick={() => { setTipoFormateoSeleccionado('mes'); setCodigoConfirmacion(''); }}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                      background: tipoFormateoSeleccionado === 'mes' ? '#ef4444' : 'transparent',
                      color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s'
                    }}
                  >
                    POR MES
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setTipoFormateoSeleccionado('total'); setMesFormateo(''); setAnioFormateo(''); setCodigoConfirmacion(''); }}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                      background: tipoFormateoSeleccionado === 'total' ? '#ef4444' : 'transparent',
                      color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s'
                    }}
                  >
                    TODO EL INVENTARIO
                  </button>
                </div>

                {tipoFormateoSeleccionado === 'mes' && (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <select
                      value={mesFormateo}
                      onChange={(e) => setMesFormateo(e.target.value)}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#0F172A', color: '#fff' }}
                    >
                      <option value="">Selecciona Mes</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={String(m).padStart(2, '0')}>{new Date(0, m - 1).toLocaleString('es-PE', { month: 'long' }).toUpperCase()}</option>
                      ))}
                    </select>
                    <select
                      value={anioFormateo}
                      onChange={(e) => setAnioFormateo(e.target.value)}
                      style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #333', background: '#0F172A', color: '#fff' }}
                    >
                      <option value="">Selecciona Año</option>
                      {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 5 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}

                <input
                  type="password"
                  maxLength="4"
                  placeholder="Ingresa código de confirmación (2260)"
                  value={codigoConfirmacion}
                  onChange={(e) => setCodigoConfirmacion(e.target.value.replace(/\D/g, ""))}
                  style={{
                    width: 'calc(100% - 20px)', padding: '12px 10px', marginBottom: '20px',
                    borderRadius: '8px', border: '1px solid #ef4444', background: '#0F172A',
                    color: '#fff', fontSize: '1rem', textAlign: 'center'
                  }}
                />
                
                {codigoConfirmacion === '0014' ? (
                  <div style={{marginTop: '10px'}}>
                    <p style={{color: '#ffc107', margin: '0 0 10px 0', fontWeight: 'bold'}}>Código Valido</p>
                    <button 
                        onClick={() => setEasterEggConfirmado(true)}
                        className="report-btn"
                        style={{ border: '1px solid #ffc107', color: '#ffc107', marginBottom: '10px' }}
                    >
                        ❓ ¿Estás seguro de esta acción? ❓
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={handleFormatearInventario}
                    className="report-btn"
                    disabled={cargando || codigoConfirmacion !== '2260' || (tipoFormateoSeleccionado === 'mes' && (!mesFormateo || !anioFormateo))}
                    style={{ border: '1px solid #ef4444', color: '#ef4444', marginBottom: '10px' }}
                  >
                    {cargando ? '⏳ FORMATEANDO...' : '🗑️ CONFIRMAR FORMATEO'}
                  </button>
                )}

                <button 
                  onClick={() => {
                    setMostrarModalFormateo(false);
                    setCodigoConfirmacion('');
                    setMesFormateo(''); // Mantener reseteo
                    setAnioFormateo(''); // Mantener reseteo
                    setTipoFormateoSeleccionado(null);
                    setEasterEggConfirmado(false); // Añadir reseteo
                  }}
                  style={{ 
                    background: 'transparent',
                    border: '1px solid #555',
                    color: '#aaa',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    marginTop: '10px',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; e.currentTarget.style.borderColor = '#777'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#555'; }}
                >
                  CANCELAR
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* INTERFAZ DEL ESCÁNER (Aparece arriba si está activo) */}
     {/* Visor de cámara mejorado para Leonidas Store */}
      {escaneando && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
          background: '#020617', zIndex: 20000, display: 'flex', flexDirection: 'column', 
          alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <div id="reader" style={{ background: 'white', borderRadius: '10px', overflow: 'hidden' }}></div>
            <button 
              onClick={() => { 
                const container = document.getElementById('reader');
                if (container) container.innerHTML = '';
                setEscaneando(false); 
              }}
              style={{ 
                width: '100%', marginTop: '20px', padding: '15px', background: '#ef4444', 
                color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem'
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

      {esCelular ? (
        <MenuMobile
          usuarioLogueado={usuarioLogueado}
          pestanaActual={pestanaActual}
          setPestanaActual={setPestanaActual}
          handleLogout={handleLogout}
          tienePermiso={tienePermiso} // Pasamos la función de chequeo
          cargando={cargando}
          isEditing={editandoId !== null}
        />
      ) : (
        <header className="blue-nav">
          {/* ... Tu código de header de escritorio se mantiene aquí ... */}
          {/* BLOQUE IZQUIERDA: Identidad */}
          <div className="brand-section" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {(() => {
              const nombreUsuario = usuarioLogueado?.nombre?.toUpperCase();
              const avatarSrc = AVATARES_USUARIOS[nombreUsuario] || AVATARES_USUARIOS['DEFAULT'];
              const esImagenUrl = avatarSrc.startsWith('http') || avatarSrc.startsWith('/');
              return esImagenUrl ? <img src={avatarSrc} alt="logo" className="nav-logo" /> : <div className="nav-logo-emoji">{avatarSrc}</div>;
            })()}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px' }}>
              <h1 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', fontWeight: 'bold', whiteSpace: 'nowrap' }}>FINPRO STORE</h1>
              <div className="user-info-display" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
  <span className="role-badge" style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
    🛡️ {usuarioLogueado?.rol.replace(/_/g, ' ').toUpperCase()}
  </span>
</div>
            </div>
          </div>

          {/* BLOQUE CENTRAL: Navegación Unificada con Scroll */}
          <div className="nav-center-container">
            {canScroll && (
              <button className="nav-arrow" onClick={() => handleNavScroll('left')} disabled={navScrollIndex === 0}>
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="nav-actions-wrapper">
              <nav 
                ref={navContainerRef} 
                className="nav-actions"
                style={{
                  transform: `translateX(-${navOffset}px)`,
                  transition: 'transform 0.4s ease-in-out'
                }}
              >
                {navItems.map(item => (
                  <button key={item.pestana} className={`${pestanaActual === item.pestana ? 'nav-btn active' : 'nav-btn'} ${item.className || ''}`} onClick={() => setPestanaActual(item.pestana)} style={item.style}>
                    {item.texto}
                  </button>
                ))}
              </nav>
            </div>
            
           
          </div>

            {/* Botón de Salida */}
            <div className="exit-section" style={{ marginLeft: 'auto' }}>
              <button className="btn-exit" onClick={handleLogout} style={{ border: '1px solid rgba(239, 68, 68, 0.6)', boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)', padding: '8px 15px', fontWeight: 'bold' }}>
                🚪 SALIR
              </button>
            </div>
        </header>
      )}

      <main className="main-content">
        {/* VISTA ALMACÉN */}
        {pestanaActual === 'almacen' && (
          <div className="inventory-view fade-in">
            
            {/* === BLOQUE DE TOTALES (VISIBILIDAD POR PERMISO) === */}
            {tienePermiso(PERMISSIONS.VER_FINANZAS) && (
              <div className="flex-mobile-stack" style={{ 
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
        
          <div className="search-container-modern flex-mobile-stack" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0 }}>
              {/* --- BUSCADOR CON FUERZA Y PROFUNDIDAD --- */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#020617',
              border: '1px solid #334155',
              borderRadius: '8px',
              minHeight: '42px',
              padding: '0 15px',
              flex: 1,
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
            }}>

              <style>{`
                #input-borrado-total {
                  background: transparent !important;
                  background-color: transparent !important;
                  border: none !important;
                  box-shadow: none !important;
                  outline: none !important;
                  border-radius: 0 !important;
                  color: #ffffff !important;
                  -webkit-appearance: none !important;
                }
                #input-borrado-total::placeholder {
                  color: #cbd5e1 !important;
                  opacity: 1 !important;
                }
              `}</style>

              {busqueda === "" && (
                <span style={{
                  marginRight: '12px',
                  color: '#e2e8f0',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  🔍
                </span>
              )}

              <input
                id="input-borrado-total"
                type="text"
                placeholder="Buscar por Serie en Almacén..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{
                  flex: 1,
                  width: '100%',
                  padding: 0,
                  margin: 0,
                  fontWeight: '500'
                }}
              />
            </div>

              <div className="filter-controls" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                <button className="btn-show-all" onClick={manejarVerTodo}>📋 VER TODO</button>
                {tienePermiso(PERMISSIONS.FORMATEAR_INVENTARIO) && (
                  <button
                    className="btn-show-all"
                    onClick={() => setMostrarModalFormateo(true)}
                    style={{ 
                      background: '#ef4444', 
                      color: 'white', 
                      border: 'none', 
                      boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)',
                      transition: 'all 0.3s ease-in-out',
                      transform: 'scale(1)'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = '#d03030';
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.6)';
                        e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = '#ef4444';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    🗑️ FORMATEAR
                  </button>
                )}
              </div>
            </div>

            <div className="table-wrapper-global">
              <AlmacenTabla 
                laptops={laptopsFiltradas}
                eliminarProducto={manejarEliminar}
                marcarComoVendido={marcarComoVendido}
                activarEdicion={activarEdicion} 
                actualizarProducto={actualizarProducto}
                usuarioLogueado={usuarioLogueado}
                tienePermiso={tienePermiso}
                busqueda={busqueda}
                setModalImagen={(img) => {
                  setModalImagen(img);
                  setFotoActual(Array.isArray(img) ? img[0] : img);
                }} 
              />
            </div>
          </div>
        )}

        {pestanaActual === 'informes' && (
          <div className="animacion-entrada-seccion">
            <PanelInformes 
              laptops={laptops} 
              manejarGeneracionReporte={manejarGeneracionReporte} 
              cargando={cargando} 
              usuarioLogueado={usuarioLogueado} 
            />
          </div>
        )}

        {/* PESTAÑA DE GESTIÓN DE USUARIOS */}
        {pestanaActual === 'gestion_usuarios' && tienePermiso(PERMISSIONS.GESTIONAR_USUARIOS) && (
          <PanelGestionUsuarios 
            usuarios={listaUsuarios}
            onToggleActivo={(userId, currentState) => handleToggleActivo(userId, currentState)}
            usuarioLogueado={usuarioLogueado}
            rolesConPermisos={rolesConPermisos}
            allPermissions={PERMISSIONS}
            onAddRole={handleAddRole}
            onUpdateRolePermissions={handleUpdateRolePermissions}
            onUpdateUserRole={handleUpdateUserRole}
            onDeleteRole={handleDeleteRole}
            onAddUser={handleCreateUser} // Pasamos la nueva función
            onDeleteUser={handleDeleteUser}
            tienePermiso={tienePermiso}
            // --- NUEVO: Pasamos el manejador y datos para excepciones ---
            onUpdateUserPermissionOverrides={handleUpdateUserPermissionOverrides}
          />
        )}

        {pestanaActual === 'ventas' && (
          <VentasView 
            laptops={laptops}
            busqueda={busqueda}
            setBusqueda={setBusqueda}
            setPestanaActual={setPestanaActual}
            usuarioLogueado={usuarioLogueado}
            setModalImagen={setModalImagen}
            setFotoActual={setFotoActual}
            activarEdicion={tienePermiso(PERMISSIONS.EDITAR_REGISTRO) ? activarEdicion : null}
            manejarEliminar={tienePermiso(PERMISSIONS.ELIMINAR_REGISTRO) ? manejarEliminar : null}
            actualizarProducto={actualizarProducto} // Se usa internamente, no requiere permiso aquí
            tienePermiso={tienePermiso}
          />
        )}

        {pestanaActual === 'registro' && (
          <RegistroVentasView 
            form={form}
            setForm={setForm}
            manejarCambio={manejarCambio}
            manejarCambioModeloAuto={manejarCambioModeloAuto}
            guardarLaptop={guardarLaptop}
            cargando={cargando}
            listaSeriales={listaSeriales}
            setListaSeriales={setListaSeriales}
            iniciarEscaneo={iniciarEscaneo}
            cancelarEdicion={cancelarEdicion}
            editandoId={editandoId}
            usuarioLogueado={usuarioLogueado}
            
            OPCIONES_MARCAS={OPCIONES_MARCAS}
            MODELOS_SUGERIDOS={MODELOS_SUGERIDOS}
            OPCIONES_DESTINO={OPCIONES_DESTINO}
            OPCIONES_ESTADO={OPCIONES_ESTADO}
            setVistaActual={setPestanaActual}
            laptops={laptops}
          />
        )}

        {pestanaActual === 'excel_interno' && (
          <div className="fade-in table-wrapper-global">
            {/* Controles de filtro para Tabla General */}
            <div className="search-container-modern flex-mobile-stack" style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, marginBottom: '15px' }}>
              {/* --- BUSCADOR --- */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                minHeight: '42px',
                padding: '0 15px',
                flex: 1,
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
              }}>
                {busqueda === "" && (
                  <span style={{
                    marginRight: '12px',
                    color: '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    🔍
                  </span>
                )}
                <input
                  id="input-borrado-total-excel" // ID único para este input
                  type="text"
                  placeholder="Buscar en Tabla General..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  style={{
                    flex: 1,
                    width: '100%',
                    padding: 0,
                    margin: 0,
                    fontWeight: '500',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#ffffff',
                    '-webkit-appearance': 'none'
                  }}
                />
              </div>

              <div className="filter-controls" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               
                <button className="btn-show-all" onClick={manejarVerTodo}>📋 VER TODO</button>
                {tienePermiso(PERMISSIONS.FORMATEAR_INVENTARIO) && (
                  <button
                    className="btn-show-all"
                    onClick={() => setMostrarModalFormateo(true)}
                    style={{ 
                      background: '#ef4444', 
                      color: 'white', 
                      border: 'none', 
                      boxShadow: '0 0 10px rgba(239, 68, 68, 0.3)',
                      transition: 'all 0.3s ease-in-out',
                      transform: 'scale(1)'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.background = '#d03030';
                        e.currentTarget.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.6)';
                        e.currentTarget.style.transform = 'scale(1.05)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.background = '#ef4444';
                        e.currentTarget.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    🗑️ FORMATEAR
                  </button>
                )}
              </div>
            </div>
            <HojaReportes 
              laptops={laptopsFiltradas} 
              usuarioLogueado={usuarioLogueado}
              activarEdicion={activarEdicion}
              setModalImagen={setModalImagen}
              fechaFiltro={fechaFiltro}
              setFechaFiltro={setFechaFiltro}
              eliminarProducto={manejarEliminar}
              tienePermiso={tienePermiso}
            />
          </div>
        )}

        {pestanaActual === 'despachos' && (
          <DespachosView 
            laptops={laptops}
            usuarioLogueado={usuarioLogueado}
          />
        )}
      </main>
    </div>
  );
}
export default App;