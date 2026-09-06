// Página /app/maestro/deudas.
//
// F1: alta de préstamo + lista con saldo real + historial de abonos.
//
// Fuente de verdad: GET /api/loans/ — cada préstamo trae su
// `outstanding_balance` y sus `payment_details` ya calculados por el
// backend. La UI agrega por trabajador y muestra KPIs globales.
// Cálculo de saldo en cliente: solo suma de campos ya calculados por el
// servidor, no se recalcula nada.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Wallet,
  TrendingDown,
  Banknote,
  Calendar,
  AlertOctagon,
  ListTree,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { DialogoMovimiento } from "@/components/Maestro/DialogoMovimiento";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useData } from "@/context/DataContext";
import { workersService } from "@/api/workersService";
import { formatCOP, formatFecha } from "@/lib/format";
import { hoyISO } from "@/lib/fechas";
import { parseApiError } from "@/api/errorMessage";
import { toCents, fromCents } from "@/lib/cents";

export default function MaestroDeudas() {
  const { trabajadores } = useData();
  const [ctx, setCtx] = useState({ abierto: false, trabajadorId: null });
  const [historialDe, setHistorialDe] = useState(null);

  const activos = useMemo(
    () => trabajadores.filter((t) => t.estado === "activo"),
    [trabajadores],
  );

  const loansQ = useQuery({
    queryKey: ["loans"],
    queryFn: () => workersService.listLoans(),
  });

  // Backend devuelve paginado o array según DRF. Acepta ambos.
  const loans = useMemo(() => {
    const d = loansQ.data;
    if (Array.isArray(d)) return d;
    if (d && Array.isArray(d.results)) return d.results;
    return [];
  }, [loansQ.data]);

  // Agrupa por trabajador. La suma en centavos evita FP drift.
  const filas = useMemo(() => {
    const map = new Map();
    for (const t of activos) {
      map.set(t.id, {
        t,
        saldoCents: 0,
        totalPrestadoCents: 0,
        ultimo: null,
        loansCount: 0,
      });
    }
    for (const loan of loans) {
      const f = map.get(loan.worker);
      if (!f) continue;
      const cents = toCents(loan.outstanding_balance);
      const amountCents = toCents(loan.amount);
      f.saldoCents += cents;
      f.totalPrestadoCents += amountCents;
      f.loansCount += 1;
      if (!f.ultimo || loan.date > f.ultimo.date) f.ultimo = loan;
    }
    return Array.from(map.values());
  }, [activos, loans]);

  // KPIs agregados.
  const kpis = useMemo(() => {
    const conDeuda = filas.filter((f) => f.saldoCents > 0);
    const totalDeudaCents = filas.reduce((acc, f) => acc + f.saldoCents, 0);
    const promedioCents =
      conDeuda.length > 0 ? Math.round(totalDeudaCents / conDeuda.length) : 0;
    const mesActual = hoyISO().slice(0, 7);
    let prestamosMesCents = 0;
    for (const l of loans) {
      if ((l.date || "").slice(0, 7) === mesActual) {
        prestamosMesCents += toCents(l.amount);
      }
    }
    return {
      conDeuda: conDeuda.length,
      totalDeuda: fromCents(totalDeudaCents),
      promedio: fromCents(promedioCents),
      prestamosMes: fromCents(prestamosMesCents),
      mesActual,
    };
  }, [filas, loans]);

  const ordenados = useMemo(
    () => [...filas].sort((a, b) => b.saldoCents - a.saldoCents),
    [filas],
  );

  // Lista plana de préstamos con saldo > 0, para la sección de actividad reciente.
  const prestamosActivos = useMemo(
    () =>
      loans
        .filter((l) => toCents(l.outstanding_balance) > 0)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
    [loans],
  );

  // ---- Estados de carga / error / vacío ------------------------------

  if (loansQ.isLoading) {
    return <EstadoCargando />;
  }
  if (loansQ.isError) {
    const err = parseApiError(loansQ.error);
    return (
      <EstadoError
        mensaje={err.message}
        onReintentar={() => loansQ.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-2xl font-semibold sm:text-3xl">Deudas</h1>
        <p className="text-sm text-muted-foreground">
          Préstamos y abonos de toda tu cuadrilla.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Deuda total"
          value={formatCOP(kpis.totalDeuda)}
          icon={Wallet}
          tone="danger"
        />
        <Kpi
          label="Trabajadores con deuda"
          value={String(kpis.conDeuda)}
          icon={TrendingDown}
          tone="warning"
        />
        <Kpi
          label="Promedio por deudor"
          value={formatCOP(kpis.promedio)}
          icon={Banknote}
          tone="muted"
        />
        <Kpi
          label={`Préstamos de ${kpis.mesActual}`}
          value={formatCOP(kpis.prestamosMes)}
          icon={Calendar}
          tone="primary"
        />
      </div>

      <div className="space-y-2">
        {activos.length === 0 ? (
          <EstadoVacioCuadrilla />
        ) : ordenados.every((f) => f.loansCount === 0) ? (
          <EstadoVacioSinPrestamos />
        ) : (
          ordenados.map((fila) => {
            const { t, saldoCents, totalPrestadoCents, ultimo, loansCount } = fila;
            const alDia = saldoCents === 0;
            const abonadoCents = Math.max(0, totalPrestadoCents - saldoCents);
            const progreso =
              totalPrestadoCents > 0
                ? Math.min(100, Math.round((abonadoCents / totalPrestadoCents) * 100))
                : 0;
            return (
              <Card
                key={t.id}
                className={`transition-colors ${alDia ? "opacity-70" : ""}`}
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
                  <AvatarIniciales nombre={t.nombre} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/app/maestro/trabajadores/${t.id}`}
                        className="font-medium hover:underline"
                      >
                        {t.nombre}
                      </Link>
                      <Badge variant="outline">{t.oficio}</Badge>
                      {loansCount > 0 && (
                        <Badge variant="outline" className="font-normal">
                          {loansCount} préstamo{loansCount === 1 ? "" : "s"}
                        </Badge>
                      )}
                      {alDia && loansCount > 0 && (
                        <Badge variant="default" className="bg-success/15 text-success">
                          Al día
                        </Badge>
                      )}
                    </div>
                    {loansCount > 0 && (
                      <>
                        <div className="mt-1 flex items-center gap-2">
                          <Progress value={progreso} className="h-1.5 flex-1" />
                          <span className="text-xs text-muted-foreground num">
                            {progreso}% abonado
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Total prestado:{" "}
                          <span className="num">
                            {formatCOP(fromCents(totalPrestadoCents))}
                          </span>
                          {" · "}Último:{" "}
                          {ultimo
                            ? `${formatFecha(ultimo.date, "dd/MM/yyyy")}${ultimo.reason ? ` (${ultimo.reason})` : ""}`
                            : "—"}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="display text-2xl font-bold leading-none num">
                      <span
                        className={
                          alDia
                            ? "text-muted-foreground"
                            : "text-destructive"
                        }
                      >
                        {formatCOP(fromCents(saldoCents))}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">saldo</p>
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setCtx({ abierto: true, trabajadorId: t.id })
                        }
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Prestar
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/app/maestro/trabajadores/${t.id}`}>
                          Ver historial
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <DialogoMovimiento
        open={ctx.abierto}
        onOpenChange={(o) => setCtx((prev) => ({ ...prev, abierto: o }))}
        modo="prestamo"
        trabajadorId={ctx.trabajadorId}
        nombreTrabajador={
          ctx.trabajadorId
            ? activos.find((x) => x.id === ctx.trabajadorId)?.nombre
            : undefined
        }
      />

      {/* Préstamos activos con su historial de abonos. */}
      {prestamosActivos.length > 0 && (
        <section className="space-y-2">
          <h2 className="display text-lg font-semibold">Préstamos activos</h2>
          <p className="text-sm text-muted-foreground">
            Cada préstamo muestra sus abonos. Toca "Ver abonos" para abrir el
            historial completo.
          </p>
          <div className="space-y-2">
            {prestamosActivos.map((loan) => {
              const t = activos.find((x) => x.id === loan.worker);
              const totalAbonadoCents = (loan.payment_details ?? []).reduce(
                (acc, d) => acc + toCents(d.paid_amount),
                0,
              );
              const abonosCount = (loan.payment_details ?? []).length;
              return (
                <Card key={loan.id}>
                  <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {t?.nombre ?? `Trabajador #${loan.worker}`}
                        <span className="ml-2 text-xs text-muted-foreground">
                          Préstamo #{loan.id}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFecha(loan.date, "dd/MM/yyyy")}
                        {loan.reason ? ` · ${loan.reason}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-xs text-muted-foreground">Abonado</p>
                        <p className="num text-sm font-semibold">
                          {formatCOP(fromCents(totalAbonadoCents))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {abonosCount === 0
                            ? "sin abonos"
                            : `${abonosCount} abono${abonosCount === 1 ? "" : "s"}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Saldo</p>
                        <p className="num text-base font-bold text-destructive">
                          {formatCOP(loan.outstanding_balance)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setHistorialDe(loan)}
                      >
                        <ListTree className="mr-1 h-3.5 w-3.5" /> Ver abonos
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Dialog: historial de abonos por préstamo. */}
      <Dialog
        open={!!historialDe}
        onOpenChange={(o) => !o && setHistorialDe(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Préstamo #{historialDe?.id} — abonos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Otorgado</p>
              <p className="num text-base font-semibold">
                {formatCOP(historialDe?.amount ?? 0)}
              </p>
              <p className="text-xs text-muted-foreground">
                Saldo pendiente:{" "}
                <span className="num text-destructive">
                  {formatCOP(historialDe?.outstanding_balance ?? 0)}
                </span>
              </p>
            </div>
            {historialDe?.payment_details?.length ? (
              <ul className="space-y-1">
                {historialDe.payment_details.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded border bg-card px-3 py-1.5"
                  >
                    <span>
                      Pago #{d.loan?.id ?? d.id}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {d.loan?.reason ?? ""}
                      </span>
                    </span>
                    <span className="num font-semibold">
                      {formatCOP(d.paid_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Este préstamo aún no tiene abonos.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone = "muted" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    danger: "bg-destructive/10 text-destructive",
    warning: "bg-warning/10 text-warning",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold num">{value}</p>
        </div>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-md ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function EstadoCargando() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-md bg-muted" />
    </div>
  );
}

function EstadoError({ mensaje, onReintentar }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertOctagon className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{mensaje}</p>
        <Button onClick={onReintentar} variant="outline">
          Reintentar
        </Button>
      </CardContent>
    </Card>
  );
}

function EstadoVacioCuadrilla() {
  return (
    <Card>
      <CardContent className="py-10 text-center text-muted-foreground">
        No tienes trabajadores activos para mostrar.
      </CardContent>
    </Card>
  );
}

function EstadoVacioSinPrestamos() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Wallet className="h-10 w-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Ningún trabajador tiene préstamos registrados todavía.
        </p>
        <p className="text-xs text-muted-foreground">
          Usa el botón "Prestar" en cada fila para registrar uno nuevo.
        </p>
      </CardContent>
    </Card>
  );
}
