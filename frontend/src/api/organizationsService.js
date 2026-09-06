import { useAuthStore } from "@/store/authStore";
import { ApiError } from "./workersService";

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
    let body = null;
    try {
      body = await resp.json();
    } catch {
      // sin body JSON
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

export const organizationsService = {
  list: () => request("/organizations/"),
  get: (id) => request(`/organizations/${id}/`),
  me: async () => {
    const me = await request("/auth/me/");
    if (!me.organization_id) return null;
    return request(`/organizations/${me.organization_id}/`);
  },
  // F2: crear/actualizar/activar/suspender un tenant. Solo admin plataforma.
  create: (data) =>
    request("/organizations/", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id, data) =>
    request(`/organizations/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};
