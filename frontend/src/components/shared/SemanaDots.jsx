// 7 puntos (lun→dom) que resumen la asistencia de un trabajador en una semana:
//   - verde   = día completo
//   - azul    = medio día
//   - gris    = no trabajó (registrado como tal)
//   - vacío   = día sin marca (borde punteado)
//   - anillo  = tarifa especial (override)
// Apunta a tooltip con la fecha, tipo y (si aplica) tarifa aplicada.

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { valorJornada, tarifaEfectiva } from "@/lib/calculo";
import { formatCOP } from "@/lib/format";
import { nombreDiaCorto } from "@/lib/fechas";

export function SemanaDots({ dias, jornadas, trabajador, size = "md", className }) {
  const dot = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  const ringSize = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";

  return (<div className={cn("flex items-center gap-1.5",className)} aria-label="Resumen de la semana">
      {dias.map((fecha) => {
        const j = jornadas.find((x) => x.fecha === fecha);
        const dow = nombreDiaCorto(fecha);

        if (!j) {
          return (<Tooltip key={fecha}>
              <TooltipTrigger asChild>
                <div
                  className={cn(dot,"rounded-full border border-dashed border-muted-foreground/50",
                  )}
                  aria-label={`${dow} ${fecha} sin marca`}
                />
              </TooltipTrigger>
              <TooltipContent>{dow} · sin marcar</TooltipContent>
            </Tooltip>);
        }

        const color =
          j.tipo === "completo"
            ? "bg-success"
            : j.tipo === "medio"
              ? "bg-info"
              : "bg-muted-strong";

        const valor = valorJornada(j,trabajador);
        const tarif = tarifaEfectiva(j,trabajador);
void tarif;

        return (<Tooltip key={fecha}>
            <TooltipTrigger asChild>
              <div className="relative">
                <div
                  className={cn(dot,"rounded-full",color)}
                  aria-label={`${dow} ${fecha} ${j.tipo}`}
                />
                {j.tarifaOverride !== null && (<span
                    className={cn(ringSize,"absolute -right-0.5 -top-0.5 rounded-full bg-warning ring-2 ring-card",
                    )}
                    aria-hidden
                  />)}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <div className="font-medium">
                  {dow} · {j.tipo === "no_trabajo" ? "No trabajó" : j.tipo}
                </div>
                {j.tipo !== "no_trabajo" && (<>
                    <div className="text-muted-foreground">Tarifa</div>
                    <div className="text-muted-foreground">Valor: {formatCOP(valor)}</div>
                  </>)}
                {j.tarifaOverride !== null && (<div className="text-warning">⚡ Tarifa especial</div>)}
                {j.notas && <div className="mt-0.5 italic">{j.notas}</div>}
              </div>
            </TooltipContent>
          </Tooltip>);
      })}
    </div>);
}
