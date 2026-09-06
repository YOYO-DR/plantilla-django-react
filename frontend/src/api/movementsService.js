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

export const movementsService = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/movimientos-deuda/${qs ? `?${qs}` : ""}`);
  },
  get: (id) => request(`/movimientos-deuda/${id}/`),
  create: (data) =>
    request("/movimientos-deuda/", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) =>
    request(`/movimientos-deuda/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (id) => request(`/movimientos-deuda/${id}/`, { method: "DELETE" }),
};
