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

export const workersService = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/workers/${qs ? `?${qs}` : ""}`);
  },
  get: (id) => request(`/workers/${id}/`),
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
