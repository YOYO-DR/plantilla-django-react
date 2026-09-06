// Mensajes de error del backend, normalizados para mostrar al usuario.
//
// Distingue tres casos:
//
//   - 400 (validación): el maestro puede corregir lo que escribió.
//     Suele llegar como {field: ["..."]} o {detail: "..."}.
//   - 409 (conflicto de negocio): NO es un error de tecleo, es una
//     regla de dominio (sobrepago, doble anulación, préstamo ya
//     pagado). El mensaje del backend es el mensaje que mostramos.
//   - Otros (404, 401, 403, 500...): fallback al detail genérico.
//
// El backend de JornalPro sigue la convención DRF: ``response.data``
// siempre trae ``detail`` o un mapa por campo.

/**
 * Extrae un mensaje legible desde un error de fetch (o similar).
 *
 * @param {unknown} err — Error o lo que sea que llegó.
 * @param {{ status?: number, body?: unknown }} [meta]
 *   Opcional. Si el caller tiene ya ``status``/``body`` (e.g. vía
 *   fetch crudo), los pasa para clasificar sin parsear el Error.
 * @returns {{ status: number | null, message: string, fieldErrors: Record<string, string[]> | null }}
 */
export function parseApiError(err, meta = {}) {
  const status = meta.status ?? err?.status ?? null;
  const body = meta.body ?? err?.body ?? null;

  if (status === 400) {
    return { status, message: fieldMessage(body), fieldErrors: extractFieldErrors(body) };
  }
  if (status === 409) {
    return { status, message: detailMessage(body) ?? "Conflicto: la operación no es válida en el estado actual.", fieldErrors: null };
  }
  if (status === 403) {
    return { status, message: detailMessage(body) ?? "No tienes permiso para esta acción.", fieldErrors: null };
  }
  if (status === 404) {
    return { status, message: detailMessage(body) ?? "No encontrado.", fieldErrors: null };
  }
  if (status && status >= 500) {
    return { status, message: "Error del servidor. Inténtalo de nuevo.", fieldErrors: null };
  }
  // Sin status conocido: usar message del Error o fallback genérico.
  return {
    status,
    message: err?.message || "Algo salió mal.",
    fieldErrors: null,
  };
}

function detailMessage(body) {
  if (!body) return null;
  if (typeof body === "string") return body;
  if (typeof body.detail === "string") return body.detail;
  // DRF a veces devuelve `detail` como objeto/lista.
  if (body.detail) return JSON.stringify(body.detail);
  return null;
}

function extractFieldErrors(body) {
  if (!body || typeof body !== "object") return null;
  const out = {};
  for (const [key, val] of Object.entries(body)) {
    if (key === "detail") continue;
    if (Array.isArray(val)) {
      if (val.length > 0) out[key] = val.map(String);
    } else if (typeof val === "string") {
      out[key] = [val];
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function fieldMessage(body) {
  if (!body) return "Datos inválidos.";
  const detail = detailMessage(body);
  if (detail) return detail;
  const fields = extractFieldErrors(body);
  if (!fields) return "Datos inválidos.";
  const first = Object.entries(fields)[0];
  if (!first) return "Datos inválidos.";
  return `${first[0]}: ${first[1][0]}`;
}
