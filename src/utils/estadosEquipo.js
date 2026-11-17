// 🛠️ ESTADOS DEL EQUIPO — "PENDIENTE" se muestra como "REPARACIÓN".
// El valor que se guarda en Firestore sigue siendo 'PENDIENTE' (por compatibilidad
// con los registros antiguos y con todos los filtros/funciones existentes), pero en
// la interfaz y en los reportes se muestra como 'REPARACIÓN'. También se acepta
// 'REPARACION' por si algún equipo llegara a guardarse con el nombre nuevo.

const ESTADOS_REPARACION = new Set(['PENDIENTE', 'REPARACION', 'REPARACIÓN']);

// ¿El equipo está en reparación? (acepta PENDIENTE o REPARACION)
export const esReparacion = (estado) =>
  ESTADOS_REPARACION.has(String(estado ?? '').toUpperCase().trim());

// Etiqueta visible de un estado (en mayúsculas). Vacío = STOCK.
export const etiquetaEstado = (estado) => {
  const upper = String(estado ?? '').toUpperCase().trim();
  if (!upper) return 'STOCK';
  return esReparacion(upper) ? 'REPARACIÓN' : upper;
};
