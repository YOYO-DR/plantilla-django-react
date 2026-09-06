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
};
