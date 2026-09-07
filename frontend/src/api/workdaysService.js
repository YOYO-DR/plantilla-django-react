import { useAuthStore } from "@/store/authStore";

const BASE = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const access = useAuthStore.getState().accessToken;
  if (access) headers["Authorization"] = `Bearer ${access}`;
  const resp = await fetch(`${BASE}/api${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || "Error");
  }
  if (resp.status === 204) return null;
  return resp.json();
}

// La API devuelve {id, worker, workday_type, payment_status, date,
// applied_rate}, pero la grilla semanal y el dashboard leen el shape
// legacy {trabajadorId, fecha, tipo, tarifaOverride, liquidacionId}.
// Sin esta traducción esos campos llegan `undefined`: la grilla pinta la
// semana vacía aunque las jornadas existan, y el KPI de días marcados da 0.
//
// `trabajadorId` va como string porque workersService normaliza los ids a
// string, y las pantallas cruzan ambos con `Set.has` y `===`.
const TIPO_POR_ID = { 1: "completo", 2: "medio" };

function _normalizeWorkday(w) {
  return {
    id: String(w.id),
    trabajadorId: String(w.worker),
    fecha: w.date,
    tipo: TIPO_POR_ID[w.workday_type] ?? "completo",
    tarifaOverride: w.applied_rate != null ? Number(w.applied_rate) : null,
    // `payment_status` 1 es Pendiente; cualquier otro implica pago asociado.
    liquidacionId: w.payment_status === 1 ? null : w.payment_status,
    workday_type: w.workday_type,
    payment_status: w.payment_status,
  };
}

function _unwrapWorkdays(data) {
  if (Array.isArray(data)) return data.map(_normalizeWorkday);
  if (Array.isArray(data?.results)) {
    return { ...data, results: data.results.map(_normalizeWorkday) };
  }
  return data;
}

export const workdaysService = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/workdays/${qs ? `?${qs}` : ""}`).then(_unwrapWorkdays);
  },
  get: (id) => request(`/workdays/${id}/`),
  create: (data) =>
    request("/workdays/", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) =>
    request(`/workdays/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id) => request(`/workdays/${id}/`, { method: "DELETE" }),
};
