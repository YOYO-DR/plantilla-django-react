// DataContext — Fase D1: TanStack Query como fuente de verdad.
//
// Una query por recurso con su ``queryKey``. Las mutaciones que tienen
// endpoint backend invalidan solo lo afectado. Las que aún no están
// cableadas en D1 siguen como ``noop`` documentadas en el reporte
// (quedan para D2).
//
// API pública preservada: useData() sigue devolviendo
// {trabajadores, jornadas, movimientos, liquidaciones,
//  todosLosTenants, todosLosUsuarios, cargando, error, recargar, ...mutaciones}.

import {
  createContext,
  useContext,
  useMemo,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { workersService } from "@/api/workersService";
import { workdaysService } from "@/api/workdaysService";
import { movementsService } from "@/api/movementsService";
import { liquidacionesService } from "@/api/liquidacionesService";
import { catalogsService } from "@/api/catalogsService";
import { organizationsService } from "@/api/organizationsService";
import { usersService } from "@/api/usersService";
import { useAuthStore } from "@/store/authStore";

const DataContext = createContext(null);

// Query keys centralizadas (invalidación dirigida).
const QK = {
  workers: ["workers"],
  workdays: (params) => ["workdays", params ?? {}],
  movements: ["movements"],
  liquidaciones: ["liquidaciones"],
  catalogs: ["catalogs"],
  organizations: ["organizations"],
  users: ["users"],
  balance: (workerId) => ["balance", workerId],
};

function _unwrap(q) {
  const data = q.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

export function DataProvider({ children }) {
  const qc = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.is_staff === true && !user?.organization_id;

  // ---- Queries por recurso -----------------------------------------

  const workersQ = useQuery({
    queryKey: QK.workers,
    queryFn: () => workersService.list(),
    enabled: !!accessToken,
  });
  const workdaysQ = useQuery({
    queryKey: QK.workdays(),
    queryFn: () => workdaysService.list(),
    enabled: !!accessToken,
  });
  const movementsQ = useQuery({
    queryKey: QK.movements,
    queryFn: () => movementsService.list(),
    enabled: !!accessToken,
  });
  const liquidacionesQ = useQuery({
    queryKey: QK.liquidaciones,
    queryFn: () => liquidacionesService.list(),
    enabled: !!accessToken,
  });
  const catalogsQ = useQuery({
    queryKey: QK.catalogs,
    queryFn: () => catalogsService.getAll(),
    enabled: !!accessToken,
  });
  const organizationsQ = useQuery({
    queryKey: QK.organizations,
    queryFn: () => organizationsService.list(),
    enabled: !!accessToken && isAdmin,
  });
  const usersQ = useQuery({
    queryKey: QK.users,
    queryFn: () => usersService.list(),
    enabled: !!accessToken && isAdmin,
  });

  // ---- Mutaciones cableadas en D1 ---------------------------------

  const crearTrabajadorMut = useMutation({
    mutationFn: (data) => workersService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.workers }),
  });

  const actualizarTrabajadorMut = useMutation({
    mutationFn: ({ id, data }) => workersService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.workers }),
  });

  const activarTrabajadorMut = useMutation({
    mutationFn: ({ id, data }) =>
      workersService.update(id, { ...data, is_active: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.workers }),
  });

  const desactivarTrabajadorMut = useMutation({
    mutationFn: ({ id, data }) =>
      workersService.update(id, { ...data, is_active: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.workers }),
  });

  const resetearPasswordMut = useMutation({
    mutationFn: (id) => workersService.resetPassword(id),
  });

  const bulkMarkMut = useMutation({
    mutationFn: (data) => workersService.bulkMark(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.workdays() }),
  });

  const bulkCopyMut = useMutation({
    mutationFn: (data) => workersService.bulkCopy(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.workdays() }),
  });

  const bulkClearMut = useMutation({
    mutationFn: (data) => workersService.bulkClear(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.workdays() }),
  });

  // ---- Mutaciones admin (F2) --------------------------------------

  const crearTenantMut = useMutation({
    mutationFn: (data) => organizationsService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.organizations }),
  });

  const actualizarTenantMut = useMutation({
    mutationFn: ({ id, data }) => organizationsService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.organizations }),
  });

  const suspenderTenantMut = useMutation({
    mutationFn: (id) => organizationsService.update(id, { is_active: false }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.organizations }),
  });

  const activarTenantMut = useMutation({
    mutationFn: (id) => organizationsService.update(id, { is_active: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.organizations }),
  });

  const actualizarUsuarioMut = useMutation({
    mutationFn: ({ id, data }) => usersService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.users }),
  });

  const cambiarRolUsuarioMut = useMutation({
    mutationFn: ({ id, role }) =>
      usersService.update(id, { groups: [role] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK.users }),
  });

  // ---- Composición del value público -------------------------------

  const value = useMemo(
    () => ({
      // estado (queries)
      trabajadores: _unwrap(workersQ),
      jornadas: _unwrap(workdaysQ),
      movimientos: _unwrap(movementsQ),
      liquidaciones: _unwrap(liquidacionesQ),
      todosLosTenants: _unwrap(organizationsQ),
      todosLosUsuarios: _unwrap(usersQ),
      // flags
      cargando:
        workersQ.isLoading ||
        workdaysQ.isLoading ||
        movementsQ.isLoading ||
        liquidacionesQ.isLoading,
      error:
        workersQ.error ||
        workdaysQ.error ||
        movementsQ.error ||
        liquidacionesQ.error,
      // rol
      esAdminPlataforma: isAdmin,
      // refetch manual
      recargar: () => {
        qc.invalidateQueries({ queryKey: QK.workers });
        qc.invalidateQueries({ queryKey: QK.workdays() });
        qc.invalidateQueries({ queryKey: QK.movements });
        qc.invalidateQueries({ queryKey: QK.liquidaciones });
      },
      // mutaciones cableadas en D1
      crearTrabajador: (data) => crearTrabajadorMut.mutateAsync(data),
      actualizarTrabajador: (id, data) =>
        actualizarTrabajadorMut.mutateAsync({ id, data }),
      activarTrabajador: (id, data) =>
        activarTrabajadorMut.mutateAsync({ id, data }),
      desactivarTrabajador: (id, data) =>
        desactivarTrabajadorMut.mutateAsync({ id, data }),
      resetearPasswordUsuario: (id) => resetearPasswordMut.mutateAsync(id),
      marcarDiaCompletoParaTodos: (data) => bulkMarkMut.mutateAsync(data),
      repetirSemanaAnterior: (data) => bulkCopyMut.mutateAsync(data),
      limpiarSemana: (data) => bulkClearMut.mutateAsync(data),
      // mutaciones admin (F2) — solo el admin plataforma debería llamarlas.
      crearTenant: (data) => crearTenantMut.mutateAsync(data),
      actualizarTenant: (id, data) =>
        actualizarTenantMut.mutateAsync({ id, data }),
      suspenderTenant: (id) => suspenderTenantMut.mutateAsync(id),
      activarTenant: (id) => activarTenantMut.mutateAsync(id),
      actualizarUsuario: (id, data) =>
        actualizarUsuarioMut.mutateAsync({ id, data }),
      cambiarRolUsuario: (id, role) =>
        cambiarRolUsuarioMut.mutateAsync({ id, role }),
      inferirUsuarioDesdeNombre: () => null,
      generarPassword: () => null, // el backend genera la contraseña.
    }),
    [
      workersQ,
      workdaysQ,
      movementsQ,
      liquidacionesQ,
      organizationsQ,
      usersQ,
      isAdmin,
      crearTrabajadorMut,
      actualizarTrabajadorMut,
      activarTrabajadorMut,
      desactivarTrabajadorMut,
      resetearPasswordMut,
      bulkMarkMut,
      bulkCopyMut,
      bulkClearMut,
      crearTenantMut,
      actualizarTenantMut,
      suspenderTenantMut,
      activarTenantMut,
      actualizarUsuarioMut,
      cambiarRolUsuarioMut,
      qc,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData debe usarse dentro de <DataProvider>");
  }
  return ctx;
}
