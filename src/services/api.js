import { db } from '../firebase'; 
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs, orderBy, serverTimestamp, writeBatch } from "firebase/firestore";
import emailjs from '@emailjs/browser';
import { CONFIG } from '../constants/config';

/* ============================================================================
   🔒 VALIDACIÓN DE NÚMEROS DE SERIE ÚNICOS (ANTI-DUPLICADOS)
   ----------------------------------------------------------------------------
   Cada S/N debe existir una sola vez en el inventario. Se normaliza siempre
   a mayúsculas y sin espacios para comparar de forma insensible.
   ============================================================================ */

/** Normaliza un serial: mayúsculas, sin espacios. */
export const normalizarSerial = (serial) =>
  String(serial || '').trim().toUpperCase().replace(/\s+/g, '');

/**
 * Busca un documento del inventario cuyo serial coincida (ignorando
 * mayúsculas/espacios) con el indicado.
 * @param {string} serial
 * @param {string|null} excluirId - ID a ignorar (útil al editar un equipo).
 * @returns {Promise<object|null>} El documento encontrado o null.
 */
export const buscarInventarioPorSerial = async (serial, excluirId = null) => {
  const objetivo = normalizarSerial(serial);
  if (!objetivo) return null;

  // Consulta exacta (aprovecha el índice del campo `serial`)
  const q = query(collection(db, "inventario"), where("serial", "==", String(serial).trim().toUpperCase()));
  const snap = await getDocs(q);

  for (const d of snap.docs) {
    if (excluirId && d.id === excluirId) continue;
    return { fireId: d.id, ...d.data() };
  }
  return null;
};

/**
 * Lanza un error de validación con el "código 422" y el mensaje estándar
 * que pide el requerimiento. Sirve para abortar la transacción.
 */
export const errorSerialDuplicado = (serial) => {
  const err = new Error(
    `El número de serie '${serial}' ya se encuentra registrado en el sistema.`
  );
  err.code = 'SERIAL_DUPLICADO';
  err.status = 422;
  return err;
};

/**
 * Verifica una lista de seriales antes de insertar (registro individual o por lotes).
 * - Ignora los seriales vacíos.
 * - Detecta repetidos DENTRO de la propia lista.
 * - Consulta la base por cada serial informado.
 * @returns {Promise<string|null>} Devuelve el serial duplicado o null si todo ok.
 */
export const verificarSerialesDuplicados = async (seriales = []) => {
  const normalizados = seriales.map(s => normalizarSerial(s)).filter(Boolean);

  // 1) Duplicados dentro del propio envío
  const vistos = new Set();
  for (const s of normalizados) {
    if (vistos.has(s)) return s;
    vistos.add(s);
  }

  // 2) Duplicados ya existentes en la base de datos
  for (const s of normalizados) {
    const existente = await buscarInventarioPorSerial(s);
    if (existente) return s;
  }

  return null;
};

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
// 🛡️ ANTES DEL INSERT se valida que el S/N no exista (registro individual).
export const guardarProducto = async (datos) => {
  // --- Validación de S/N duplicado (nivel 2: abortar la transacción) ---
  if (datos.serial && normalizarSerial(datos.serial)) {
    const serial = normalizarSerial(datos.serial);
    const existente = await buscarInventarioPorSerial(serial);
    if (existente) throw errorSerialDuplicado(serial);
  }

  const datosConFechaCrea = {
    ...datos,
    serial: datos.serial ? normalizarSerial(datos.serial) : datos.serial,
    estado: datos.estado || "ALMACEN", // Por defecto entra a almacén
    fechaCreacion: serverTimestamp() 
  };
  return await addDoc(collection(db, "inventario"), datosConFechaCrea);
};

// 2. ACTUALIZAR: Para cambios de precio, estado (VENDIDO) o specs
// 🛡️ Si cambia el S/N, se valida que el nuevo no pertenezca a otro equipo.
export const actualizarProducto = async (fireId, datos) => {
  if (datos.serial && normalizarSerial(datos.serial)) {
    const serial = normalizarSerial(datos.serial);
    // Se excluye el propio documento para no "duplicarse" a sí mismo
    const existente = await buscarInventarioPorSerial(serial, fireId);
    if (existente) throw errorSerialDuplicado(serial);
  }

  const datosNormalizados = datos.serial
    ? { ...datos, serial: normalizarSerial(datos.serial) }
    : datos;

  return await updateDoc(doc(db, "inventario", fireId), datosNormalizados);
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

// 3.b ELIMINAR EN LOTE (borrado masivo desde la TABLA GENERAL)
// Recibe el ARREGLO de IDs (fireId) y los borra con writeBatch.
// Firestore admite máx. 500 escrituras por batch, así que se trocea en lotes
// de 400 para dejar margen y evitar fallos con selecciones grandes.
export const eliminarProductosMasivo = async (ids = []) => {
  // Se limpian y deduplican los IDs: nada de undefined ni de valores vacíos
  const idsValidos = [...new Set(ids.filter(Boolean))];

  if (idsValidos.length === 0) return { eliminados: 0 };

  const TAMANO_LOTE = 400;
  const lotes = [];
  for (let i = 0; i < idsValidos.length; i += TAMANO_LOTE) {
    lotes.push(idsValidos.slice(i, i + TAMANO_LOTE));
  }

  try {
    for (const lote of lotes) {
      const batch = writeBatch(db);
      lote.forEach((id) => {
        batch.delete(doc(db, "inventario", id));
      });
      await batch.commit();
    }

    console.log(`🗑️ Eliminación masiva completada: ${idsValidos.length} equipo(s).`);
    return { eliminados: idsValidos.length };
  } catch (error) {
    console.error("Error en la eliminación masiva:", error);
    throw error;
  }
};
// 4. SUSCRIPCIÓN EN TIEMPO REAL
/**
 * AUDITORÍA DE DUPLICADOS (nivel 1 de la validación de S/N únicos).
 * Devuelve un mapa { SERIAL_NORMALIZADO: [ids de documentos duplicados] }
 * sólo con los seriales que aparecen en más de un documento.
 * Se usa desde el script de migración (ver docs/SERIAL-UNICO.md).
 */
export const auditarSerialesDuplicados = async () => {
  const mapa = new Map();
  const snap = await getDocs(collection(db, "inventario"));

  snap.docs.forEach(d => {
    const serial = normalizarSerial(d.data().serial);
    if (!serial) return; // los equipos sin serial no cuentan
    if (!mapa.has(serial)) mapa.set(serial, []);
    mapa.get(serial).push(d.id);
  });

  const duplicados = {};
  mapa.forEach((ids, serial) => {
    if (ids.length > 1) duplicados[serial] = ids;
  });
  return duplicados;
};

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