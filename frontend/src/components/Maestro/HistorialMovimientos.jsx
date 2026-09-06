// Línea de tiempo de movimientos con saldo resultante. Línea por línea se
// muestra el icono por tipo, fecha, concepto, monto y el saldo vigente tras
// aplicar el movimiento.

import { useMemo } from "react";
import { ArrowUp, ArrowDown, Sparkles, Banknote, Lock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCOP, formatFecha } from "@/lib/format";
import { evolucionSaldos, esMovimientoEditable } from "@/lib/movimientos";

export function HistorialMovimientos({
  movimientos,
  liquidacionesT,
  onEdit,
  onDelete,
  onLiquidacionClick,
}) {
  // Evolución paso a paso (ordenada por fecha, restando)
  const lineas = useMemo(() => {
    const evo = evolucionSaldos(movimientos);
    return [...evo].reverse(); // cronológico inverso
  },[movimientos]);

  const mapLiqPorId = useMemo(() => {
    const map = new Map();
    for (const l of liquidacionesT) map.set(l.id,l);
    return map;
  },[liquidacionesT]);

  if (lineas.length === 0) {
    return (<p className="py-8 text-center text-sm text-muted-foreground">
        Sin movimientos registrados todavía.
      </p>);
  }

  return (<ol className="relative space-y-3 border-l-2 border-dashed border-border pl-5">
      {lineas.map(({ mov, saldo }) => {
        const liq = mov.liquidacionId ? mapLiqPorId.get(mov.liquidacionId) : null;
        const editable = esMovimientoEditable(mov,liquidacionesT);
        const Icon =
          mov.tipo === "prestamo"
            ? ArrowUp
            : mov.tipo === "abono"
              ? ArrowDown
              : Sparkles;
        const colorClase =
          mov.tipo === "prestamo"
            ? "bg-destructive/15 text-destructive border-destructive/40"
            : mov.tipo === "abono"
              ? "bg-success/15 text-success border-success/40"
              : "bg-muted text-muted-foreground border-border";

        return (<li key={mov.id} className="relative">
            <span
              className={`absolute -left-[33px] flex h-7 w-7 items-center justify-center rounded-full border ${colorClase}`}
              aria-hidden
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="rounded-md border bg-card p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">
                    {mov.tipo === "prestamo"
                      ? "Préstamo"
                      : mov.tipo === "abono"
                        ? "Abono"
                        : "Ajuste"}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatFecha(mov.fecha,"dd 'de' MMM 'de' yyyy")}
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
                    {mov.tipo === "abono" || (mov.tipo === "ajuste" && mov.concepto.trim().startsWith("-"))
                      ? "−"
                      : "+"}
                    {formatCOP(mov.monto)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Saldo: <span className="num font-semibold">{formatCOP(saldo)}</span>
                  </p>
                </div>
              </div>
              {liq && (
                <div className="mt-2 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-primary/40 text-primary cursor-pointer hover:bg-primary/10"
                    onClick={() => onLiquidacionClick?.(liq.id)}
                  >
                    Pago #{liq.consecutivo}
                  </Badge>
                  {!editable && (<Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" /> Inmutable
                    </Badge>)}
                </div>)}
              {mov.notas && (<p className="mt-1 text-xs italic text-muted-foreground">
                                "{mov.notas}"
                              </p>)}
              {(onEdit || onDelete) && (<div className="mt-2 flex justify-end gap-1">
                  {onEdit && (<Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit?.(mov)}
                      disabled={!editable}
                    >
                      Editar
                    </Button>)}
                  {onDelete && (<Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => onDelete?.(mov)}
                      disabled={!editable}
                    >
                      Borrar
                    </Button>)}
                </div>)}
            </div>
          </li>);
      })}
      {/* Nodo final del timeline */}
      <li className="relative">
        <span
          className="absolute -left-[33px] flex h-7 w-7 items-center justify-center rounded-full border bg-muted text-muted-foreground"
          aria-hidden
        >
          <Banknote className="h-3.5 w-3.5" />
        </span>
        <p className="text-xs text-muted-foreground">Saldo actual</p>
      </li>
    </ol>);
}
