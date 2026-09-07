// DataContext — TanStack Query como fuente de verdad.
//
// Fase D: queries por recurso con su queryKey + mutaciones que llaman al
// backend. Las queries a endpoints eliminados en Fase A (movimientos-deuda,
// liquidaciones, tipos-movimiento-deuda) ya no se disparan; los datos
// respectivos vienen ahora de las queries de loans/payments/workdays.

import {
  createContext,
  useContext,
  useMemo,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { workersService } from "@/api/workersService";
import { workdaysService } from "@/api/workdaysService";
import { loansService } from "@/api/loansService";
import { paymentsService } from "@/api/paymentsService";
import { organizationsService } from "@/api/organizationsService";
import { usersService } from "@/api/usersService";
import { useAuthStore } from "@/store/authStore";

const DataContext = createContext(null);

// Query keys centralizadas (invalidación dirigida).
const QK = {
  workers: ["workers"],
  workdays: (params) => ["workdays", params ?? {}],
  loans: ["loans"],
  payments: ["payments"],
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

// Roles que consumen datos de la organización completa (no solo los suyos).
function _esMaestroOAdmin(user) {
  if (!user) return false;
  const groups = user.groups ?? [];
  return groups.includes("Maestro") || groups.includes("AdminPlataforma");
}

export function DataProvider({ children }) {
  const qc = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.is_staff === true && !user?.organization_id;
  const maestroOAdmin = _esMaestroOAdmin(user);

  // ---- Queries por recurso -----------------------------------------

  // Workers: solo el maestro/admin ve la lista completa. El trabajador
  // ve solo su propio balance vía /api/workers/{id}/balance/.
  const workersQ = useQuery({
    queryKey: QK.workers,
    queryFn: () => workersService.list(),
    enabled: !!accessToken && maestroOAdmin,
  });
  const workdaysQ = useQuery({
    queryKey: QK.workdays(),
    queryFn: () => workdaysService.list(),
    enabled: !!accessToken && maestroOAdmin,
  });
  const loansQ = useQuery({
    queryKey: QK.loans,
    queryFn: () => loansService.list(),
    enabled: !!accessToken && maestroOAdmin,
  });
  const paymentsQ = useQuery({
    queryKey: QK.payments,
    queryFn: () => paymentsService.list(),
    enabled: !!accessToken && maestroOAdmin,
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

  // F8: upsert y eliminar jornadas concretas (no bulk).
  // La grilla semanal usa upsertJornada cuando el maestro marca una celda;
  // eliminarJornada cuando la desmarca. Invalida workdays (lista) y
  // balance (lo que el trabajador tiene por cobrar).
  //
  // Transformamos del shape legacy que usa la grilla ({trabajadorId,
  // fecha, tipo}) al shape que espera el backend ({worker,
  // workday_type_id, date}). Si ya llega con `worker`, se pasa tal cual.
  const _tipoToWorkdayTypeId = {
    completo: 1, // Día completo (catálogo seed)
    medio: 2, // Medio día (catálogo seed)
  };
  const upsertJornadaMut = useMutation({
    mutationFn: (data) => {
      if (data.worker) return workdaysService.create(data); // ya en shape nuevo
      const body = {
        worker: data.trabajadorId,
        // El backend (RegisterPaymentSerializer/workdays create) espera
        // `workday_type` (no `workday_type_id`).
        workday_type: _tipoToWorkdayTypeId[data.tipo],
        date: data.fecha,
        applied_rate: data.tarifaOverride ?? undefined,
        notes: data.notas ?? "",
      };
      return workdaysService.create(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.workdays() });
      qc.invalidateQueries({ queryKey: ["balance"] });
    },
  });

  const eliminarJornadaMut = useMutation({
    mutationFn: (id) => workdaysService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.workdays() });
      qc.invalidateQueries({ queryKey: ["balance"] });
    },
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

  // `movimientos` y `liquidaciones` se mantenían en el value público para no
  // romper consumidores legacy que aún las piden. Las queries a los
  // endpoints eliminados en Fase A ya no se disparan (H3); devolvemos []
  // estable en su lugar.
  const movimientosLegacy = [];
  const liquidacionesLegacy = [];

  const value = useMemo(
    () => ({
      // estado (queries)
      trabajadores: _unwrap(workersQ),
      jornadas: _unwrap(workdaysQ),
      prestamos: _unwrap(loansQ),
      pagos: _unwrap(paymentsQ),
      movimientos: movimientosLegacy,
      liquidaciones: liquidacionesLegacy,
      todosLosTenants: _unwrap(organizationsQ),
      todosLosUsuarios: _unwrap(usersQ),
      // flags
      cargando:
        workersQ.isLoading ||
        workdaysQ.isLoading ||
        loansQ.isLoading ||
        paymentsQ.isLoading,
      error:
        workersQ.error ||
        workdaysQ.error ||
        loansQ.error ||
        paymentsQ.error,
      // rol
      esAdminPlataforma: isAdmin,
      // refetch manual
      recargar: () => {
        qc.invalidateQueries({ queryKey: QK.workers });
        qc.invalidateQueries({ queryKey: QK.workdays() });
        qc.invalidateQueries({ queryKey: QK.loans });
        qc.invalidateQueries({ queryKey: QK.payments });
        qc.invalidateQueries({ queryKey: ["balance"] });
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
      upsertJornada: (data) => upsertJornadaMut.mutateAsync(data),
      eliminarJornada: (id) => eliminarJornadaMut.mutateAsync(id),
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
      loansQ,
      paymentsQ,
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
      upsertJornadaMut,
      eliminarJornadaMut,
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
