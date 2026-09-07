import { useAuthStore } from "@/store/authStore";

const BASE = import.meta.env.VITE_API_URL || "";

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const access = useAuthStore.getState().accessToken;
  if (access) headers["Authorization"] = `Bearer ${access}`;
  const resp = await fetch(`${BASE}/api${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  if (!resp.ok) {
    let body = null;
    try {
      body = await resp.json();
    } catch {
      // respuesta sin body JSON; dejamos body=null.
    }
    const msg =
      (body && typeof body === "object" && typeof body.detail === "string"
        ? body.detail
        : null) || `Error ${resp.status}`;
    throw new ApiError(msg, resp.status, body);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

// Normaliza la respuesta del backend (WorkerProfileSerializer) al shape
// que espera el frontend legacy. El backend devuelve:
//
//   { id, user: { id, name, email, ... }, id_document, hire_date, is_active }
//
// El frontend espera:
//
//   { id, nombre, estado, oficio, documento, usuarioId, tarifaDiaBase }
//
// `oficio` y `tarifaDiaBase` ya no existen como campos directos en el
// backend (oficio era del modelo legacy, tarifaDiaBase vive en WorkerRate).
// Los dejamos como string vacío / 0 para no romper el render de la lista;
// la UI los muestra vacíos y ya.
function _normalizeWorker(w) {
  return {
    // `id` como string: useParams() devuelve string, y la comparación
    // `t.id === id` con tipos distintos siempre fallaba (Detalle.jsx).
    id: String(w.id),
    nombre: w.user?.name ?? "",
    email: w.user?.email ?? "",
    estado: w.is_active ? "activo" : "inactivo",
    oficio: "",
    documento: w.id_document ?? "",
    usuarioId: w.user?.id ?? null,
    tarifaDiaBase: 0,
    hire_date: w.hire_date ?? null,
    is_active: w.is_active,
  };
}

function _unwrapPaginated(data) {
  if (Array.isArray(data)) return data.map(_normalizeWorker);
  if (data && Array.isArray(data.results))
    return data.results.map(_normalizeWorker);
  return [];
}

export const workersService = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/workers/${qs ? `?${qs}` : ""}`).then(_unwrapPaginated);
  },
  get: (id) =>
    request(`/workers/${id}/`).then(_normalizeWorker),
  create: (data) =>
    request("/workers/", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) =>
    request(`/workers/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id) =>
    request(`/workers/${id}/`, { method: "DELETE" }),
  resetPassword: (id) =>
    request(`/workers/${id}/reset-password/`, { method: "POST" }),
  balance: (id) => request(`/workers/${id}/balance/`),
  bulkMark: ({ date, workday_type_id, worker_ids }) =>
    request("/workdays/bulk-mark/", {
      method: "POST",
      body: JSON.stringify({ date, workday_type_id, worker_ids }),
    }),
  bulkCopy: ({ from_start, from_end, to_start }) =>
    request("/workdays/bulk-copy/", {
      method: "POST",
      body: JSON.stringify({ from_start, from_end, to_start }),
    }),
  bulkClear: ({ start, end }) =>
    request("/workdays/bulk-clear/", {
      method: "POST",
      body: JSON.stringify({ start, end }),
    }),
  registerPayment: (data) =>
    request("/payments/", { method: "POST", body: JSON.stringify(data) }),
  previewPayment: (data) =>
    request("/payments/preview/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  voidPayment: (id) =>
    request(`/payments/${id}/void/`, { method: "POST" }),
  // Pagos (lista y detalle). El serializer ampliado por el backend trae
  // voided_at, voided_by (con nombre) y los detalles workday/loan anidados.
  listPayments: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/payments/${qs ? `?${qs}` : ""}`);
  },
  getPayment: (id) => request(`/payments/${id}/`),
  // Préstamos
  listLoans: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/loans/${qs ? `?${qs}` : ""}`);
  },
  createLoan: (data) =>
    request("/loans/", { method: "POST", body: JSON.stringify(data) }),
};
