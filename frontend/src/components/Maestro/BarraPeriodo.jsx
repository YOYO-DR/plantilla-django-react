// Barra sticky con navegación de período y estado de liquidación.
// - Flechas ←/→ para mover semana, "Hoy" para saltar al actual.
// - Estado del período a la derecha: Sin liquidar / Parcial / Liquidada.

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import { formatFechaLarga } from "@/lib/format";
// finSemana is imported via @/lib/fechas but not used directly here.

export function BarraPeriodo({ inicio, fin, onPrev, onNext, onToday, estado, totalAPagar }) {
  return (<div className="sticky top-14 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={onPrev} aria-label="Semana anterior" className="min-h-tap min-w-tap">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onNext} aria-label="Semana siguiente" className="min-h-tap min-w-tap">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onToday} className="min-h-tap">
            <RotateCcw className="mr-1 h-4 w-4" /> Hoy
          </Button>
        </div>

        <div className="min-w-0 flex-1 truncate text-center sm:flex-none">
          <p className="text-sm font-semibold sm:text-base">
            Semana del {formatFechaLarga(inicio).replace(/^[a-záéíóúñ]+,\s*/i,"")} al {formatFechaLarga(fin).replace(/^[a-záéíóúñ]+,\s*/i,"")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {typeof totalAPagar === "number" && totalAPagar > 0 && (<Badge variant="outline" className="hidden border-primary/40 text-primary sm:inline-flex">
              $ {totalAPagar.toLocaleString("es-CO")} <span className="ml-1 text-muted-foreground">a pagar</span>
            </Badge>)}
          <Badge
            variant={
              estado === "liquidada" ? "default" : estado === "parcial" ? "secondary" : "outline"
            }
            className={
              estado === "liquidada"
                ? "bg-success/15 text-success"
                : estado === "sin-liquidar"
                  ? "border-warning/40 text-warning"
                  : ""
            }
          >
            {estado === "liquidada"
              ? "Liquidada"
              : estado === "parcial"
                ? "Liquidación parcial"
                : "Sin liquidar"}
          </Badge>
        </div>
      </div>
    </div>);
}
