// Listado de cuadrillas (tenants) — Fase 10 §10.2.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, MapPin, Phone, Power, PowerOff, Eye } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useData } from "@/context/DataContext";
import { formatFecha } from "@/lib/format";
import { CrearTenantDialog } from "@/components/admin/CrearTenantDialog";

export default function AdminTenants() {
  const {
    todosLosTenants,
    todosLosUsuarios,
    trabajadores,
    jornadas,
    liquidaciones,
    suspenderTenant,
    activarTenant,
    esAdminPlataforma,
  } = useData();
  const [crearOpen, setCrearOpen] = useState(false);
  const [confirmSuspender, setConfirmSuspender] = useState(null);

  const tenantsPorEstado = useMemo(() => {
    const activos = todosLosTenants.filter((t) => t.estado === "activo").length;
    const suspendidos = todosLosTenants.length - activos;
    return { activos, suspendidos };
  }, [todosLosTenants]);

  const ultimaActividadPorTenant = useMemo(() => {
    const map = new Map();
    for (const t of todosLosTenants) {
      let ultima = t.creadoEn;
      for (const l of liquidaciones.filter((l) => l.tenantId === t.id)) {
        const fp = l.fechaPago ?? l.creadoEn;
        if (fp > ultima) ultima = fp;
      }
      map.set(t.id, ultima);
    }
    return map;
  }, [todosLosTenants, liquidaciones]);

  const trabajadoresPorTenant = useMemo(() => {
    const map = new Map();
    for (const t of todosLosTenants) map.set(t.id, 0);
    for (const w of trabajadores) map.set(w.tenantId, (map.get(w.tenantId) ?? 0) + 1);
    return map;
  }, [todosLosTenants, trabajadores]);

  const jornadasPorTenant = useMemo(() => {
    const map = new Map();
    for (const t of todosLosTenants) map.set(t.id, 0);
    for (const j of jornadas) map.set(j.tenantId, (map.get(j.tenantId) ?? 0) + 1);
    return map;
  }, [todosLosTenants, jornadas]);

  const masterDe = (tenantId) =>
    todosLosUsuarios.find((u) => u.id === tenants.find((t) => t.id === tenantId)?.maestroUsuarioId) ?? null;

  const tenants = todosLosTenants;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="display text-2xl font-semibold sm:text-3xl">Cuadrillas</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{tenantsPorEstado.activos}</span> activas
            {" · "}
            <span className="font-semibold text-foreground">{tenantsPorEstado.suspendidos}</span> suspendidas
          </p>
        </div>
        {esAdminPlataforma && (
          <Button onClick={() => setCrearOpen(true)} className="min-h-tap">
            <Plus className="mr-2 h-4 w-4" /> Crear cuadrilla
          </Button>
        )}
      </header>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cuadrilla</TableHead>
              <TableHead>Maestro</TableHead>
              <TableHead className="text-right">Trabajadores</TableHead>
              <TableHead className="text-right">Jornadas</TableHead>
              <TableHead>Última actividad</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  Aún no hay cuadrillas registradas.
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((t) => {
                const maestro = masterDe(t.id);
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="font-medium">{t.nombre}</div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {t.ciudad && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {t.ciudad}
                          </span>
                        )}
                        {t.telefono && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {t.telefono}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{maestro?.nombre ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {maestro ? (
                          <span className="font-mono">@{maestro.usuario}</span>
                        ) : (
                          <span className="text-destructive">sin maestro</span>
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="text-right num">{trabajadoresPorTenant.get(t.id) ?? 0}</TableCell>
                    <TableCell className="text-right num">{jornadasPorTenant.get(t.id) ?? 0}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatFecha((ultimaActividadPorTenant.get(t.id) ?? t.creadoEn).slice(0, 10), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.estado === "activo" ? "default" : "secondary"} className="capitalize">
                        {t.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="space-x-1 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/app/admin/tenants/${t.id}`}>
                          <Eye className="mr-1 h-3.5 w-3.5" /> Ver
                        </Link>
                      </Button>
                      {esAdminPlataforma && (t.estado === "activo" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-warning"
                          onClick={() => setConfirmSuspender(t.id)}
                        >
                          <PowerOff className="mr-1 h-3.5 w-3.5" /> Suspender
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-success"
                          onClick={() => {
                            activarTenant(t.id);
                            toast.success(`${t.nombre} reactivada.`);
                          }}
                        >
                          <Power className="mr-1 h-3.5 w-3.5" /> Reactivar
                        </Button>
                      ))}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <CrearTenantDialog open={crearOpen} onOpenChange={setCrearOpen} />

      <AlertDialog open={!!confirmSuspender} onOpenChange={(o) => !o && setConfirmSuspender(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Suspender esta cuadrilla?</AlertDialogTitle>
            <AlertDialogDescription>
              El maestro y sus trabajadores no podrán iniciar sesión hasta que la
              reactives. Todo el historial (jornadas, préstamos, pagos) se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmSuspender) return;
                const tn = tenants.find((x) => x.id === confirmSuspender);
                suspenderTenant(confirmSuspender);
                toast.success(`${tn?.nombre ?? "Cuadrilla"} suspendida.`);
                setConfirmSuspender(null);
              }}
            >
              Sí, suspender
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
