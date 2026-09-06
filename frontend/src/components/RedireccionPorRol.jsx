// Redirige al espacio de su rol. Si no hay sesión, va a /login.

import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export function RedireccionPorRol() {
  const { sesion, usuario, cargando } = useAuth();

  if (cargando) {
    return (<div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Cargando…
        </div>
      </div>);
  }

  if (!sesion || !usuario) {
    return <Navigate to="/login" replace />;
  }

  if (usuario.rol === "admin") return <Navigate to="/app/admin" replace />;
  if (usuario.rol === "maestro") return <Navigate to="/app/maestro" replace />;
  if (usuario.rol === "trabajador") return <Navigate to="/app/trabajador" replace />;
  return <Navigate to="/" replace />;
}
