// Guarda de ruta: si no hay sesión redirige a /login guardando la URL de
// destino; si el rol no está permitido muestra la página 403.

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import AccesoDenegado from "@/pages/errors/AccesoDenegado";

export function RutaProtegida({ rolesPermitidos }) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();

  if (!user || !accessToken) {
    const destino = location.pathname + location.search;
    return <Navigate to={`/login?destino=${encodeURIComponent(destino)}`} replace />;
  }

  const grupos = user.groups || [];
  const isStaff = user.is_staff;
  const tieneAlgunRol = rolesPermitidos.length === 0
    || rolesPermitidos.some((r) => grupos.includes(r) || (r === "admin" && isStaff));

  if (!tieneAlgunRol) {
    return <AccesoDenegado />;
  }

  return <Outlet />;
}
