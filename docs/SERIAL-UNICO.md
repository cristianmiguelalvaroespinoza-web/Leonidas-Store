# Validación de Números de Serie Únicos (anti-duplicados)

Cada equipo tiene un S/N único. El sistema impide registrar un S/N que ya exista, en **3 niveles**.

---

## Nivel 1 — Base de datos

### ⚠️ Limitación importante de Firestore
Este proyecto usa **Cloud Firestore** (no SQL). Firestore es *schemaless* y **no permite declarar una restricción `UNIQUE`** sobre un campo como sí hace PostgreSQL/MySQL. Por eso la garantía de unicidad no puede declararse en la base como en el enunciado; se implementa con estas dos piezas equivalentes:

1. **Auditoría/migración** — `auditarSerialesDuplicados()` en `src/services/api.js` devuelve `{ SERIAL: [ids duplicados] }`. Sirve para:
   - Detectar duplicados históricos ya existentes y limpiarlos.
   - Verificar la integridad antes de habilitar el registro masivo.
   - Ejecutarse periódicamente como control.

2. **Restricción real en el servidor (recomendada para producción).** Si se quiere que la base *rechace* el duplicado por sí misma (independiente del frontend), hay que mover la escritura a un backend:
   - **Cloud Function** (`onDocumentCreated` de `firebase-functions/v2/firestore`) que consulte `inventario` por serial y, si ya existe, **revierta** la escritura y responda error. Alternativa: una **Cloud Function callable** `crearEquipo` que haga la validación y el `addDoc` (transaccional).
   - Con **App Check + Firestore Rules** se puede además bloquear escrituras directas desde el cliente y obligar a pasar por la función.

   ```
   // Pseudocódigo de la Cloud Function (rechazo en la BD)
   if (yaExisteSerialEnInventario(serial)) {
     await doc.delete();                  // revierte
     throw new HttpsError('already-exists',
       `El número de serie '${serial}' ya se encuentra registrado en el sistema.`);
   }
   ```

### Normalización del campo `serial`
Todo el sistema guarda el serial **normalizado**: `trim()` + `toUpperCase()` + sin espacios. Así la comparación es insensible a mayúsculas y el índice es consistente. Se aplica en `guardarProducto` y `actualizarProducto`.

---

## Nivel 2 — Backend / API (antes del INSERT)

En `src/services/api.js`:

- `buscarInventarioPorSerial(serial, excluirId)` — consulta equivalente a
  `SELECT id FROM equipos WHERE LOWER(numero_serie) = LOWER(?)`, con soporte para excluir el propio documento al editar.
- `errorSerialDuplicado(serial)` — crea el error con **`status = 422`**, `code = 'SERIAL_DUPLICADO'` y el mensaje:
  > `El número de serie 'PF5QZC9D' ya se encuentra registrado en el sistema.`
- `guardarProducto()` — **antes del `addDoc`**, si el serial ya existe lanza el error y **cancela la transacción** (no se escribe nada).
- `actualizarProducto()` — valida también cuando **cambia** el S/N, excluyendo el documento que se está editando.
- `verificarSerialesDuplicados(seriales[])` — para **registros masivos/lotes**: detecta repetidos dentro del propio envío y consulta la base antes de insertar.

`App.jsx` intercepta el error y muestra el mensaje exacto sin perder lo capturado:

```
❌ El número de serie 'PF5QZC9D' ya se encuentra registrado en el sistema.
No se guardó ningún equipo. Usa un número de serie distinto.
```

---

## Nivel 3 — Frontend (tiempo real)

En `src/components/RegistroVentasView.jsx`, cada casilla de **ESCANEAR SERIALES** se valida:

| Disparador | Comportamiento |
|---|---|
| `onChange` | debounce de **500 ms** |
| `Enter` (pistola lectora) | verificación inmediata |
| `onBlur` | verificación inmediata |
| Botón de escaneo (cámara/QR) | escribe el serial y verifica |

Estados por casilla:

- ⏳ **Verificando...** (gris)
- ✔️ **S/N disponible** (verde) → borde/indicador verde
- ⚠️ **Este número de serie ya está registrado** (rojo) → **borde y fondo rojo**

Si cualquier S/N es duplicado:
- Se muestra un aviso global en el pie del formulario.
- El botón **GUARDAR EQUIPO / ACTUALIZAR EQUIPO** queda **deshabilitado** (`disabled` + opacidad reducida).
- También se detecta el mismo S/N repetido dentro de la propia lista de seriales.

Al **editar** un equipo, su propio serial no se considera duplicado (se excluye con `editandoId`).

---

## Notas

- El flujo de **Salida Rápida** (`DespachosView`) **no** bloquea seriales existentes a propósito: allí el S/N se usa para *localizar y actualizar* el equipo que se está despachando. Bloquearlo impediría vender el stock existente.
- Si la verificación falla por red, el formulario **no** bloquea (se prefiere no impedir la operación por un fallo externo); el nivel 2 sigue protegiendo la base.