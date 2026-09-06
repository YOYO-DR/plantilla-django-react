// "Mi deuda" — saldo actual grande, timeline de movimientos y gráfica
// (Fase 8 / R8 sólo lectura).

import { useMemo } from "react";
import { CheckCircle2, ArrowUp, ArrowDown, Sparkles } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useData } from "@/context/DataContext";
import { useTrabajadorActual } from "@/context/useTrabajadorActual";
import { formatCOP, formatFecha } from "@/lib/format";
import { saldoDeuda } from "@/lib/calculo";
import { evolucionSaldos, esMovimientoEditable, totalAbonado, totalPrestado } from "@/lib/movimientos";
import { GraficaEvolucionSaldo } from "@/components/Maestro/GraficaEvolucionSaldo";

export default function TrabajadorDeuda() {
  const { movimientos, liquidaciones } = useData();
  const t = useTrabajadorActual();

  const ordenados = useMemo(
    () => [...movimientos].sort((a, b) => (a.fecha > b.fecha ? -1 : 1)),
    [movimientos],
  );
  const evo = useMemo(() => evolucionSaldos(movimientos), [movimientos]);
  const lineaInversa = [...evo].reverse();

  const liqPorId = useMemo(
    () => new Map(liquidaciones.map((l) => [l.id, l])),
    [liquidaciones],
  );

  if (!t) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No se encontró tu información.
        </CardContent>
      </Card>
    );
  }

  const saldo = Math.max(0, saldoDeuda(movimientos));
  const prestado = totalPrestado(movimientos);
  const abonado = totalAbonado(movimientos);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="display text-2xl font-semibold sm:text-3xl">Mi deuda</h1>
        <p className="text-sm text-muted-foreground">
          Cuánto le debes a tu maestro, de dónde viene y cómo se descuenta.
        </p>
      </header>

      {/* Saldo grande */}
      <Card>
        <CardContent className="space-y-2 p-5 text-center sm:text-left">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Saldo actual</p>
          {saldo === 0 ? (
            <p className="display text-4xl font-bold text-success">
              <CheckCircle2 className="mr-2 inline h-8 w-8" />
              Estás al día
            </p>
          ) : (
            <p className="display text-5xl font-bold num text-destructive">
              {formatCOP(saldo)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4 pt-2 text-sm sm:max-w-md">
            <div>
              <p className="text-muted-foreground">Total prestado</p>
              <p className="num font-semibold">{formatCOP(prestado)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total abonado</p>
              <p className="num font-semibold text-success">{formatCOP(abonado)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Explicación */}
      <Card>
        <CardContent className="prose prose-sm max-w-none p-4 text-sm text-muted-foreground">
          <p>
            Cuando tu maestro te paga la semana, descuenta automáticamente la deuda
            que tengas <strong>más antigua</strong>, hasta donde alcance el pago. Los
            abonos manuales (por ejemplo transferencias a tu cuenta) los registra él
            también.
          </p>
        </CardContent>
      </Card>

      {/* Gráfica */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="display text-base">Evolución del saldo</CardTitle>
        </CardHeader>
        <CardContent>
          <GraficaEvolucionSaldo movimientos={movimientos} fechaISO={new Date().toISOString().slice(0, 10)} />
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="display text-base">Historial</CardTitle>
        </CardHeader>
        <CardContent>
          {ordenados.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin movimientos todavía.
            </p>
          ) : (
            <ol className="relative space-y-3 border-l-2 border-dashed border-border pl-5">
              {lineaInversa.map(({ mov, saldo: saldoLinea }) => {
                const liq = mov.liquidacionId ? liqPorId.get(mov.liquidacionId) : null;
                const Icon =
                  mov.tipo === "prestamo"
                    ? ArrowUp
                    : mov.tipo === "abono"
                      ? ArrowDown
                      : Sparkles;
                const colors = {
                  prestamo: "bg-destructive/15 text-destructive border-destructive/40",
                  abono: "bg-success/15 text-success border-success/40",
                  ajuste: "bg-muted text-muted-foreground border-border",
                };
                return (
                  <li key={mov.id} className="relative">
                    <span
                      className={`absolute -left-[33px] flex h-7 w-7 items-center justify-center rounded-full border ${colors[mov.tipo]}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="rounded-md border bg-card p-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {mov.tipo === "prestamo"
                              ? "Recibiste un préstamo"
                              : mov.tipo === "abono"
                                ? "Recibiste un abono"
                                : "Ajuste"}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {formatFecha(mov.fecha, "dd 'de' MMM 'de' yyyy")}
                            </span>
                          </p>
                          <p className="text-sm text-muted-foreground">{mov.concepto}</p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`num text-base font-bold ${
                              mov.tipo === "prestamo"
                                ? "text-destructive"
                                : mov.tipo === "abono"
                                  ? "text-success"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {mov.tipo === "abono" ? "−" : "+"}
                            {formatCOP(mov.monto)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Saldo: <span className="num font-semibold">{formatCOP(saldoLinea)}</span>
                          </p>
                        </div>
                      </div>
                      {liq && (
                        <Badge
                          variant="outline"
                          className="mt-2 border-primary/40 text-primary"
                        >
                          {liq.consecutivo
                            ? `Descuento en pago #${liq.consecutivo}`
                            : "Descuento en liquidación"}
                        </Badge>
                      )}
                      {!esMovimientoEditable(mov, liquidaciones) && (
                        <Badge variant="secondary" className="ml-1 mt-2 text-[10px]">
                          Cerrado
                        </Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}