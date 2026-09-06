// Hooks auxiliares para el portal del trabajador (Fase 8).

import { useMemo } from "react";
import { useAuth } from "./AuthContext";
import { useData } from "./DataContext";

/** Trabajador de la sesión actual (rol 'trabajador'). Garantizado único. */
export function useTrabajadorActual() {
  const { usuario } = useAuth();
  const { trabajadores } = useData();
  return useMemo(() => {
    if (usuario?.rol !== "trabajador") return null;
    return trabajadores[0] ?? null;
  },[usuario?.rol, trabajadores]);
}
