import { useAuthStore } from "@/store/authStore";

const BASE = import.meta.env.VITE_API_URL || "";

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
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.detail || "Error");
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
  remove: (id) => request(`/workers/${id}/`, { method: "DELETE" }),
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
};
