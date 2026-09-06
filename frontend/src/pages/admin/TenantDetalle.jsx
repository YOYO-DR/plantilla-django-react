// Detalle de un tenant para el admin (Fase 10).

import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Building2, Users, Banknote, AlertOctagon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

import { useData } from "@/context/DataContext";
import { formatCOP, formatFecha } from "@/lib/format";
import { saldoDeuda } from "@/lib/calculo";

export default function AdminTenantDetalle() {
  const { id } = useParams();
  const {
    todosLosTenants,
    todosLosUsuarios,
    trabajadores,
    jornadas,
    movimientos,
    liquidaciones,
  } = useData();

  const tenant = todosLosTenants.find((t) => t.id === id);
  const maestro = tenant
    ? todosLosUsuarios.find((u) => u.id === tenant.maestroUsuarioId) ?? null
    : null;

  const trabT = useMemo(
    () => (tenant ? trabajadores.filter((t) => t.tenantId === tenant.id) : []),
    [tenant, trabajadores],
  );
  const liquidacionesT = useMemo(
    () => (tenant ? liquidaciones.filter((l) => l.tenantId === tenant.id) : []),
    [tenant, liquidaciones],
  );
  const jornadasT = useMemo(
    () => (tenant ? jornadas.filter((j) => j.tenantId === tenant.id) : []),
    [tenant, jornadas],
  );

  const totales = useMemo(() => {
    let devengado = 0;
    let descuento = 0;
    let pagado = 0;
    for (const l of liquidacionesT) {
      devengado += l.subtotalJornadas;
      descuento += l.montoDescontado;
      pagado += l.totalPagado;
    }
    let deuda = 0;
    for (const t of trabT) {
      const ms = movimientos.filter((m) => m.trabajadorId === t.id && m.liquidacionId === null);
      deuda += Math.max(0, saldoDeuda(ms));
    }
    return { jornadas: jornadasT.length, devengado, descuento, pagado, deuda };
  }, [liquidacionesT, jornadasT, trabT, movimientos]);

  if (!tenant) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" className="min-h-tap w-fit -ml-2">
          <Link to="/app/admin/tenants">
            <ArrowLeft className="mr-2 h-4 w-4" /> Cuadrillas
          </Link>
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Cuadrilla no encontrada.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" className="min-h-tap w-fit -ml-2">
        <Link to="/app/admin/tenants">
          <ArrowLeft className="mr-2 h-4 w-4" /> Cuadrillas
        </Link>
      </Button>

      <header className="flex flex-wrap items-start gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{tenant.nombre}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{tenant.ciudad ?? "Sin ciudad"}</span>
            {tenant.telefono && <span>· {tenant.telefono}</span>}
            <Badge variant={tenant.estado === "activo" ? "default" : "secondary"} className="capitalize">
              {tenant.estado}
            </Badge>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ResStat icon={Users} label="Trabajadores" value={String(trabT.length)} />
        <ResStat icon={Banknote} label="Pagado total" value={formatCOP(totales.pagado)} />
        <ResStat icon={Banknote} label="Devengado total" value={formatCOP(totales.devengado)} />
        <ResStat icon={AlertOctagon} label="Deuda vigente" value={formatCOP(totales.deuda)} highlight />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Maestro</CardTitle>
        </CardHeader>
        <CardContent>
          {maestro ? (
            <div>
              <p className="font-medium">{maestro.nombre}</p>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono">@{maestro.usuario}</span> ·{" "}
                <Badge variant="outline" className="capitalize">{maestro.rol}</Badge>
              </p>
              {maestro.telefono && (
                <p className="text-sm text-muted-foreground">{maestro.telefono}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sin maestro asignado.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trabajadores ({trabT.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {trabT.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Aún no hay trabajadores registrados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Oficio</TableHead>
                  <TableHead className="text-right">Tarifa</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trabT.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.nombre}</TableCell>
                    <TableCell>{t.oficio}</TableCell>
                    <TableCell className="text-right num">{formatCOP(t.tarifaDiaBase)}</TableCell>
                    <TableCell>
                      <Badge variant={t.estado === "activo" ? "default" : "secondary"} className="capitalize">
                        {t.estado}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de liquidaciones</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {liquidacionesT.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sin pagos aún.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pago #</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Trabajador</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {liquidacionesT
                  .sort((a, b) => (a.periodoInicio < b.periodoInicio ? 1 : -1))
                  .map((l) => {
                    const t = trabT.find((x) => x.id === l.trabajadorId);
                    return (
                      <TableRow key={l.id}>
                        <TableCell>
                          <Badge variant="outline" className="border-primary/40 text-primary">
                            #{l.consecutivo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatFecha(l.periodoInicio, "dd/MM")} – {formatFecha(l.periodoFin, "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-sm">{t?.nombre ?? "—"}</TableCell>
                        <TableCell className="text-right num font-semibold">
                          {formatCOP(l.totalPagado)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {l.fechaPago ? formatFecha(l.fechaPago, "dd/MM/yyyy") : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResStat({
  icon: Icon,
  label,
  value,
  highlight,
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`mt-1 text-xl font-bold num ${highlight ? "text-destructive" : ""}`}>
            {value}
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}