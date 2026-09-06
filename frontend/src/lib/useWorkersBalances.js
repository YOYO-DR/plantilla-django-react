// Hook que dispara GET /api/workers/{id}/balance/ para cada id dado,
// en paralelo (TanStack Query hace batching automático).
//
// Devuelve un map {workerId: balance} listo para agregar o pintar.
//
// Por qué N+1 y no un endpoint agregado: el backend aún no expone un
// dashboard agregado. Mantenerlo simple hasta que se apruebe ampliar
// el backend. Las queries se cachean por (workerId) y se invalidan
// cuando se invalida ["balance"] desde fuera (post-pago, post-préstamo).

import { useQueries } from "@tanstack/react-query";
import { workersService } from "@/api/workersService";

export function useWorkersBalances(workerIds) {
  const ids = Array.isArray(workerIds) ? workerIds : [];
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["balance", id],
      queryFn: () => workersService.balance(id),
      enabled: Number.isFinite(id),
      retry: false,
    })),
  });

  const map = {};
  for (let i = 0; i < ids.length; i += 1) {
    const r = results[i];
    if (r?.data) map[ids[i]] = r.data;
  }
  const isLoading = results.some((r) => r?.isLoading);
  const isError = results.some((r) => r?.isError);

  return { balances: map, isLoading, isError, results };
}
