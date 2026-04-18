import { db } from '../firebase'; 
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp } from "firebase/firestore";
import emailjs from '@emailjs/browser';
import { CONFIG } from '../constants/config';

// --- CLOUDINARY (Gestión de Fotos de Laptops) ---
export const subirACloudinary = async (archivo) => {
  if (!archivo) return null;
  try {
    const formData = new FormData();
    formData.append('file', archivo);
    formData.append('upload_preset', CONFIG.CLOUDINARY_PRESET); 
    const res = await fetch(CONFIG.CLOUDINARY_URL, { method: 'POST', body: formData });
    const data = await res.json();
    return data.secure_url; 
  } catch (error) {
    console.error("Error al subir a Cloudinary:", error);
    return null;
  }
};

// --- SINCRONIZACIÓN LOCAL (LOGS) ---
export const sincronizarConExcel = async (datos) => {
  try {
    const payloadLimpio = {
      fecha: datos.fecha || new Date().toLocaleDateString('es-PE'),
      hora: datos.hora || new Date().toLocaleTimeString(),
      serial: datos.serial || "",
      marca: datos.marca || "",
      modelo: datos.modelo || "",
      cpu: datos.procesador || "", 
      ram: datos.ram || "",
      gen: datos.generacion || datos.gen || "", 
      almacenamiento: datos.almacenamiento || datos.disco || "", 
      gpu: datos.gpu || "",
      precio: datos.precio || 0,
      responsable: datos.responsable || "",
      estado: datos.estado || "ALMACEN"
    };

    console.log("✅ Datos preparados para Reporte Local:", payloadLimpio.marca, payloadLimpio.modelo);
    return true; 
  } catch (error) {
    console.error("Error en preparación de datos:", error);
  }
};

// --- EMAILJS (Envío de Informes de Leonidas Store) ---
export const enviarInformeEmail = (templateParams) => {
  // Utilizamos los IDs desde el archivo centralizado de configuración
  return emailjs.send(
    CONFIG.EMAILJS_SERVICE_ID, 
    CONFIG.EMAILJS_TEMPLATE_ID, 
    templateParams, 
    CONFIG.EMAILJS_PUBLIC_KEY
  );
};

// --- FIREBASE CRUD ---

// 1. GUARDAR: Incluye timestamp de servidor para auditoría
export const guardarProducto = async (datos) => {
  const datosConFechaCrea = {
    ...datos,
    estado: datos.estado || "ALMACEN", // Por defecto entra a almacén
    fechaCreacion: serverTimestamp() 
  };
  return await addDoc(collection(db, "inventario"), datosConFechaCrea);
};

// 2. ACTUALIZAR: Para cambios de precio, estado (VENDIDO) o specs
export const actualizarProducto = async (fireId, datos) => {
  return await updateDoc(doc(db, "inventario", fireId), datos);
};

// 3. ELIMINAR
export const eliminarProducto = async (id, serial = "S/N") => {
  try {
    const docRef = doc(db, "inventario", id); 
    await deleteDoc(docRef);
    console.log(`🗑️ Equipo con Serial ${serial} eliminado.`);
    return true;
  } catch (error) {
    console.error("Error al eliminar:", error);
    throw error;
  }
};
// 4. SUSCRIPCIÓN EN TIEMPO REAL
export const suscribirseAInventario = (callback) => {
  // Ordenamos por fecha del documento para ver los ingresos más nuevos primero
  const q = query(collection(db, "inventario"), orderBy("fecha", "desc"));
  
  return onSnapshot(q, (snapshot) => {
    const datosArray = snapshot.docs.map(doc => ({ 
      fireId: doc.id, 
      ...doc.data() 
    }));
    callback(datosArray);
  }, (error) => {
    console.error("Error en suscripción de Firebase:", error);
  });
};