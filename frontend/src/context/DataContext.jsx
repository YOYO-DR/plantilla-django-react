// DataContext — Fase 6 / Integración backend-only.
//
// Capa única de estado en memoria sincronizada con el backend vía los
// services de `src/api/*`. Ya NO usa localStorage. El `seed` desaparece:
// la fuente de verdad es Postgres.
//
// API pública (compatible con versiones previas):
//   - trabajadores, jornadas, movimientos, liquidaciones
//   - todosLosTenants, todosLosUsuarios (admin plataforma)
//   - cargando, error, recargar
//
// Mutaciones:
//   - Las que tienen endpoint backend (workdays, movimientos, liquidaciones)
//     llaman al service y luego `recargar()`.
//   - Las que son admin-only (crearTenant, etc.) tienen endpoint en backend
//     y se enrutan vía adminService.
//   - El resto queda como no-op con TODO hasta que el backend exponga
//     endpoints. Los componentes siguen montando pero no persisten cambios
//     administrativos (crear trabajador, cambiar roles, etc.).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { workdaysService } from "@/api/workdaysService";
import { movementsService } from "@/api/movementsService";
import { liquidacionesService } from "@/api/liquidacionesService";
import { catalogsService } from "@/api/catalogsService";
import { organizationsService } from "@/api/organizationsService";
import { usersService } from "@/api/usersService";
import { useAuthStore } from "@/store/authStore";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAdmin = user?.is_staff === true && !user?.organization_id;

  const [trabajadores, setTrabajadores] = useState([]);
  const [jornadas, setJornadas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [todosLosTenants, setTodosLosTenants] = useState([]);
  const [todosLosUsuarios, setTodosLosUsuarios] = useState([]);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const recargar = useCallback(async () => {
    if (!accessToken || !user) return;
    setCargando(true);
    setError(null);
    try {
      const tasks = [
        workdaysService.list().then((d) => {
          const list = d?.results || d || [];
          setJornadas(list);
          // trabajadores derivados de las jornadas
          const map = new Map();
          list.forEach((j) => {
            const tId = j.worker;
            if (!map.has(tId)) {
              map.set(tId, {
                id: tId,
                nombre: j.worker_name || `Trabajador ${tId}`,
              });
            }
          });
          setTrabajadores(Array.from(map.values()));
        }),
        movementsService.list().then((d) => setMovimientos(d?.results || d || [])),
        liquidacionesService.list().then((d) => setLiquidaciones(d?.results || d || [])),
      ];
      if (isAdmin) {
        tasks.push(
          organizationsService.list().then((d) => setTodosLosTenants(d?.results || d || [])),
          usersService.list().then((d) => setTodosLosUsuarios(d?.results || d || [])),
        );
      }
      await Promise.allSettled(tasks);
    } catch (e) {
      setError(e.message || "Error al cargar datos");
    } finally {
      setCargando(false);
    }
  }, [accessToken, user, isAdmin]);

  useEffect(() => {
    if (accessToken && user) recargar();
  }, [accessToken, user, recargar]);

  // ---------------------------------------------------------------------
  // Mutaciones — endpoints que existen en el backend
  // ---------------------------------------------------------------------

  const upsertJornada = useCallback(
    async (jornada) => {
      try {
        if (jornada.id) {
          await workdaysService.update(jornada.id, jornada);
        } else {
          await workdaysService.create(jornada);
        }
        await recargar();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    [recargar],
  );

  const eliminarJornada = useCallback(
    async (id) => {
      try {
        await workdaysService.delete(id);
        await recargar();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    [recargar],
  );

  const registrarMovimiento = useCallback(
    async (mov) => {
      try {
        await movementsService.create(mov);
        await recargar();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    [recargar],
  );

  const editarMovimiento = useCallback(
    async (id, mov) => {
      try {
        await movementsService.update(id, mov);
        await recargar();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    [recargar],
  );

  const eliminarMovimiento = useCallback(
    async (id) => {
      try {
        await movementsService.delete(id);
        await recargar();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    [recargar],
  );

  const crearLiquidacion = useCallback(
    async (payload) => {
      try {
        // Mapear nombres del frontend (camelCase) a nombres del backend (snake_case)
        const backendPayload = {
          worker_id: payload.trabajadorId ?? payload.worker_id,
          periodo_inicio: payload.periodoInicio ?? payload.periodo_inicio,
          periodo_fin: payload.periodoFin ?? payload.periodo_fin,
          jornada_ids: payload.jornadaIds ?? payload.jornada_ids ?? [],
          modo_descuento: payload.modoDescuento ?? payload.modo_descuento ?? "ninguno",
          monto_manual: payload.montoManual ?? payload.monto_manual ?? 0,
          fecha_pago: payload.fechaPago ?? payload.fecha_pago,
          observaciones: payload.observaciones ?? "",
        };
        const liq = await liquidacionesService.liquidar(backendPayload);
        await recargar();
        return { ok: true, liquidacion: liq };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    [recargar],
  );

  // ---------------------------------------------------------------------
  // Mutaciones — placeholders (sin endpoint backend todavía).
  // Los componentes siguen montando; los cambios no se persisten.
  // ---------------------------------------------------------------------

  const noop = () => undefined;

  const value = useMemo(
    () => ({
      // estado
      trabajadores,
      jornadas,
      movimientos,
      liquidaciones,
      todosLosTenants,
      todosLosUsuarios,
      cargando,
      error,
      recargar,
      // mutaciones con backend
      upsertJornada,
      eliminarJornada,
      registrarMovimiento,
      editarMovimiento,
      eliminarMovimiento,
      crearLiquidacion,
      // mutaciones placeholder (admin/CRM) — sin endpoint backend todavía
      crearTrabajador: noop,
      actualizarTrabajador: noop,
      desactivarTrabajador: noop,
      activarTrabajador: noop,
      actualizarUsuario: noop,
      marcarDiaCompletoParaTodos: noop,
      repetirSemanaAnterior: noop,
      limpiarSemana: noop,
      liquidarMasiva: noop,
      crearTenant: noop,
      actualizarTenant: noop,
      suspenderTenant: noop,
      activarTenant: noop,
      resetearPasswordUsuario: noop,
      cambiarRolUsuario: noop,
      inferirUsuarioDesdeNombre: () => null,
      generarPassword: () => Math.random().toString(36).slice(-10),
    }),
    [
      trabajadores,
      jornadas,
      movimientos,
      liquidaciones,
      todosLosTenants,
      todosLosUsuarios,
      cargando,
      error,
      recargar,
      upsertJornada,
      eliminarJornada,
      registrarMovimiento,
      editarMovimiento,
      eliminarMovimiento,
      crearLiquidacion,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData debe usarse dentro de <DataProvider>");
  return ctx;
}
