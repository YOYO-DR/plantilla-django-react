// Página /app/maestro/deudas. Lista la deuda de toda la cuadrilla, ordenada
// por saldo descendente. Permite prestar / abonar directamente desde aquí.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ArrowDownToLine, Wallet, TrendingDown, Banknote, Calendar } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { DialogoMovimiento } from "@/components/Maestro/DialogoMovimiento";

import { useData } from "@/context/DataContext";
import { formatCOP, formatFecha } from "@/lib/format";
import {
  prestamosDelMes,
  resumenDeuda,
} from "@/lib/movimientos";
import { hoyISO } from "@/lib/fechas";

export default function MaestroDeudas() {
  const { trabajadores, movimientos } = useData();
  const [ctx, setCtx] = useState({ abierto: false, modo: "prestamo" });

  const activos = useMemo(
    () => trabajadores.filter((t) => t.estado === "activo"),
    [trabajadores],
  );

  const filas = useMemo(() => {
    return activos.map((t) => {
      const movsT = movimientos.filter((m) => m.trabajadorId === t.id);
      const r = resumenDeuda(movsT);
      return {
        t,
        ...r,
        abonado: r.totalPrestado - r.saldo,
        progreso: r.totalPrestado > 0
          ? Math.min(100, Math.round(((r.totalPrestado - r.saldo) / r.totalPrestado) * 100))
          : 0,
      };
    });
  }, [activos, movimientos]);

  // KPIs
  const kpis = useMemo(() => {
    const conDeuda = filas.filter((f) => f.saldo > 0);
    const totalDeuda = filas.reduce((acc, f) => acc + f.saldo, 0);
    const promedio =
      conDeuda.length > 0 ? Math.round(totalDeuda / conDeuda.length) : 0;
    const mes = hoyISO().slice(0, 7);
    const prestamosMes = prestamosDelMes(movimientos, mes);
    return { conDeuda: conDeuda.length, totalDeuda, promedio, prestamosMes };
  }, [filas, movimientos]);

  // Orden: con deuda primero desc, después al día
  const ordenados = useMemo(() => {
    return [...filas].sort((a, b) => b.saldo - a.saldo);
  }, [filas]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-2xl font-semibold sm:text-3xl">Deudas</h1>
        <p className="text-sm text-muted-foreground">
          Préstamos y abonos de toda tu cuadrilla.
        </p>
      </header>

      {/* KPIs */}
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
          label={`Préstamos del mes (${hoyISO().slice(0, 7)})`}
          value={formatCOP(kpis.prestamosMes)}
          icon={Calendar}
          tone="primary"
        />
      </div>

      {/* Lista */}
      <div className="space-y-2">
        {ordenados.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No tienes trabajadores activos para mostrar.
            </CardContent>
          </Card>
        ) : (
          ordenados.map((fila) => {
            const { t, saldo, totalPrestado, abonado, progreso, ultimoMovimiento } = fila;
            const alDia = saldo === 0;
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
                      {alDia && (
                        <Badge variant="default" className="bg-success/15 text-success">
                          Al día
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Progress value={progreso} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground num">
                        {progreso}% abonado
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Total prestado:{" "}
                      <span className="num">{formatCOP(totalPrestado)}</span>
                      {" · "}Último movimiento:{" "}
                      {ultimoMovimiento
                        ? `${formatFecha(ultimoMovimiento.fecha, "dd/MM/yyyy")} (${ultimoMovimiento.concepto})`
                        : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="display text-2xl font-bold leading-none num">
                      <span className={alDia ? "text-muted-foreground" : "text-destructive"}>
                        {formatCOP(saldo)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">saldo</p>
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setCtx({ abierto: true, modo: "prestamo", trabajadorId: t.id })
                        }
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Prestar
                      </Button>
                      <Button
                        size="sm"
                        disabled={saldo === 0}
                        onClick={() =>
                          setCtx({ abierto: true, modo: "abono", trabajadorId: t.id })
                        }
                      >
                        <ArrowDownToLine className="mr-1 h-3.5 w-3.5" /> Abono
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/app/maestro/trabajadores/${t.id}`}>Ver historial</Link>
                      </Button>
                    </div>
                  </div>
                  {!alDia && (
                    <span className="hidden">{abonado}</span>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <DialogoMovimiento
        open={ctx.abierto}
        onOpenChange={(o) => setCtx((prev) => ({ ...prev, abierto: o }))}
        modo={ctx.modo}
        trabajadorId={ctx.trabajadorId}
        saldoActual={
          ctx.trabajadorId
            ? resumenDeuda(
                movimientos.filter((m) => m.trabajadorId === ctx.trabajadorId),
              ).saldo
            : 0
        }
        nombreTrabajador={
          ctx.trabajadorId
            ? activos.find((x) => x.id === ctx.trabajadorId)?.nombre
            : undefined
        }
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone = "muted",
}) {
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
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold num">{value}</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-md ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}