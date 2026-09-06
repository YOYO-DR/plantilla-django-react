// Celda de un día en la grilla semanal (escritorio).
// - Clic normal: cicla el estado (sin marcar → completo → medio → no_trabajo).
// - Clic derecho / botón "⋮": abre el editor fino.
// - Si está liquidada (R7): bloqueada, candado, no clicable.
// - Días futuros: atenuados pero operativos.

import { useState } from "react";
import { Check, CircleDot, Minus, Lock, MoreVertical } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatCOP } from "@/lib/format";
import { valorJornada, tarifaEfectiva } from "@/lib/calculo";
import { claseColor, esFuturo, esHoy } from "@/lib/jornadas";

export function JornadaCelda({
  tipo,
  jornada,
  trabajador,
  fecha,
  onCycle,
  onOpenEditor,
  cerradoPorLiquidacion,
  liquidacionConsecutivo,
}) {
  const [pressed, setPressed] = useState(false);

  const color = claseColor(tipo,{
    override: jornada?.tarifaOverride != null,
    liquidada: cerradoPorLiquidacion,
  });

  const valor = jornada ? valorJornada(jornada,trabajador) : 0;
  const tarif = jornada ? tarifaEfectiva(jornada,trabajador) : 0;
void tarif;

  const Icon =
      !jornada || tipo === null ? null : tipo === "completo" ? Check : tipo === "medio" ? CircleDot : Minus;

  const futura = esFuturo(fecha);

  // Celdas bloqueadas
  if (cerradoPorLiquidacion) {
    return (<Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn("relative flex h-full min-h-tap cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1 text-center opacity-70",color.fondo,color.borde,color.texto,
            )}
          >
            <Lock className="h-3 w-3" />
            <span className="text-[10px] leading-none">Liquidada</span>
            {liquidacionConsecutivo && (<span className="text-[9px] leading-none">#{liquidacionConsecutivo}</span>)}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {liquidacionConsecutivo
            ? `Ya liquidada en el pago #${liquidacionConsecutivo}`
            : "Día liquidado, no se puede modificar."}
        </TooltipContent>
      </Tooltip>);
  }

  const Hoy = tipo !== null && esHoy(fecha);

  return (<Tooltip>
      <TooltipTrigger asChild>
        <div className="group relative h-full">
          <button

            onClick={(e) => {
              e.preventDefault();
              onCycle();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onOpenEditor();
            }}
            onMouseDown={() => setPressed(true)}
            onMouseUp={() => setPressed(false)}
            onMouseLeave={() => setPressed(false)}
            className={cn("relative flex h-full min-h-tap w-full flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1.5 text-center transition-transform",color.fondo,color.borde,color.texto,futura && "opacity-60",pressed && "scale-95",Hoy && "ring-2 ring-primary/50","hover:brightness-95",
            )}
            aria-label={
              tipo
                ? `${fecha}: ${tipo}, ${formatCOP(valor)}`
                : `${fecha}: sin marcar`
            }
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : (<span className="h-3.5 w-3.5 rounded-full border border-dashed border-current opacity-60" />)}
            <span className="num text-[10px] font-semibold leading-none">
              {tipo === "no_trabajo" || tipo === null
                ? "—"
                : formatCOP(valor).replace("$ ","$")}
            </span>
            {jornada?.tarifaOverride != null && (<span
                className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-warning ring-1 ring-card"
                aria-hidden
              />)}
          </button>
          <button

            onClick={(e) => {
              e.stopPropagation();
              onOpenEditor();
            }}
            className="absolute -bottom-1 left-1/2 hidden h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-background text-muted-foreground shadow ring-1 ring-border group-hover:flex"
            aria-label="Editar día"
          >
            <MoreVertical className="h-3 w-3" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {tipo ? (<div className="text-xs">
            <div className="font-medium">
              {tipo === "completo" ? "Día completo" : tipo === "medio" ? "Medio día" : "No trabajó"}
            </div>
            {tipo !== "no_trabajo" && (<>
                <div className="text-muted-foreground">Tarifa</div>
                <div className="text-muted-foreground">Valor: {formatCOP(valor)}</div>
              </>)}
            {jornada?.tarifaOverride != null && (<div className="text-warning">⚡ Tarifa especial</div>)}
            {jornada?.notas && <div className="mt-0.5 italic">{jornada.notas}</div>}
          </div>) : (<span>Día sin marcar · clic para registrar</span>)}
      </TooltipContent>
    </Tooltip>);
}
