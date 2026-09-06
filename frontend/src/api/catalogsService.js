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
  if (!resp.ok) throw new Error("Error");
  return resp.json();
}

export const catalogsService = {
  workdayTypes: () =>
    request("/catalogs/workday-types/").then((r) => r.results ?? r),
  paymentStatuses: () =>
    request("/catalogs/payment-statuses/").then((r) => r.results ?? r),
  tiposMovimientoDeuda: () =>
    request("/catalogs/tipos-movimiento-deuda/").then((r) => r.results ?? r),
  paymentMethods: () =>
    request("/catalogs/payment-methods/").then((r) => r.results ?? r),
};
