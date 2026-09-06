// AuthContext — Fase 6 / Integración backend-only.
//
// Fuente de verdad: `authStore` (Zustand) que es donde `authService.login`
// guarda el access token + user. Esta capa expone la API legacy
// (usuario, tenant, trabajador, sesion) para los componentes existentes
// sin reescribir cada page.

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { useAuthStore } from "@/store/authStore";
import { organizationsService } from "@/api/organizationsService";
import { authService } from "@/api/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const authStore = useAuthStore();
  const user = authStore.user;
  const accessToken = authStore.accessToken;
  const [cargando, setCargando] = useState(true);
  const [tenant, setTenant] = useState(null);
  const [trabajador, setTrabajador] = useState(null);

  // Hidratar sesión al montar — siempre llamar /api/auth/me/ para tener
  // worker_profile_id y organization_id al día (el store persistido puede
  // tener el shape antiguo si el backend cambió desde el último login).
  useEffect(() => {
    let cancelado = false;
    async function bootstrap() {
      try {
        if (!accessToken) {
          setCargando(false);
          return;
        }
        try {
          const fresh = await authService.me();
          if (!cancelado) authStore.setUser(fresh);
        } catch (_) {
          // refresh failed o token expirado: el guard de rutas se encargará.
        }
        const u = useAuthStore.getState().user;
        if (u?.organization_id) {
          try {
            const t = await organizationsService.me();
            if (!cancelado) setTenant(t);
          } catch (_) {
            if (!cancelado) setTenant(null);
          }
        } else if (!cancelado) {
          setTenant(null);
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    }
    bootstrap();
    return () => {
      cancelado = true;
    };
  }, [accessToken]);

  const value = useMemo(
    () => ({
      sesion: user ? { iniciadaEn: new Date().toISOString() } : null,
      usuario: user
        ? {
            id: user.id,
            email: user.email,
            nombre: user.name || user.email,
            rol: user.groups?.includes("AdminPlataforma")
              ? "admin"
              : user.groups?.includes("Maestro")
                ? "maestro"
                : user.groups?.includes("Trabajador")
                  ? "trabajador"
                  : "trabajador",
            tenantId: user.organization_id ?? null,
            // El backend no devuelve trabajadorId aún; se resuelve desde /api/users/<id>/ si hace falta.
            trabajadorId: user.worker_profile_id ?? null,
          }
        : null,
      tenant,
      trabajador,
      cargando,
      iniciarSesion: async (email, password) => {
        try {
          await authService.login(email, password);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      },
      cerrarSesion: async () => {
        await authService.logout();
        setTenant(null);
        setTrabajador(null);
      },
      actualizarPerfil: () => {
        // TODO: implementar PATCH /api/users/<id>/ cuando se exponga el endpoint
      },
      cambiarPassword: () => ({ ok: false, error: "Pendiente backend" }),
      generarPassword: () => Math.random().toString(36).slice(-10),
    }),
    [user, tenant, trabajador, cargando],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
