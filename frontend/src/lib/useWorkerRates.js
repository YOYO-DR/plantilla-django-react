// Hook que dispara GET /api/worker-rates/?worker=X para cada id dado,
// en paralelo. Devuelve un map {workerId: amount} con la tarifa vigente.
//
// Sigue el mismo patrón N+1 que useWorkersBalances. Para una
// cuadrilla de hasta ~40 está bien; si crece, pedir un endpoint
// agregado al backend.

import { useQueries } from "@tanstack/react-query";
import { workersService } from "@/api/workersService";

export function useWorkerRates(workerIds) {
  const ids = Array.isArray(workerIds) ? workerIds : [];
  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["worker-rate", id],
      queryFn: () =>
        workersService.listRates({ worker: id }).then((r) => {
          // Endpoint paginado: {results: [...]} o array. Devolver la
          // tarifa vigente (la de valid_until null más reciente).
          const list = Array.isArray(r) ? r : r?.results ?? [];
          const valid = list.filter((x) => x.valid_until == null);
          return valid[0] ?? list[0] ?? null;
        }),
      // El id llega como string (workersService lo normaliza para que
      // `t.id === useParams().id` funcione), y Number.isFinite("1") es
      // false: comprobado sobre el valor convertido, no sobre el crudo.
      enabled: Number.isFinite(Number(id)),
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

  return { rates: map, isLoading, isError };
}
