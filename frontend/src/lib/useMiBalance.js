// Hook: trae el balance del trabajador autenticado.
//
// Lee el id de AuthContext (vino de /auth/me/ como worker_profile_id) y
// dispara GET /api/workers/{id}/balance/. Devuelve { balance, isLoading,
// isError, error } listo para pintar.
//
// El backend aplica el scoping por organización y rol; el trabajador solo
// puede leer SU propio balance.

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { workersService } from "@/api/workersService";

export function useMiBalance() {
  const { usuario } = useAuth();
  const id = usuario?.trabajadorId ?? null;
  return useQuery({
    queryKey: ["balance", id],
    queryFn: () => workersService.balance(id),
    enabled: id != null,
    retry: false,
  });
}
