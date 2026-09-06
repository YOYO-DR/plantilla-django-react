// Leyenda del calendario: muestra cómo se traducen los colores a estados.

import { Card, CardContent } from "@/components/ui/card";

const PARES = [
  { clase: "bg-success/80", label: "Día completo" },
  { clase: "bg-info/80", label: "Medio día" },
  { clase: "bg-muted", label: "No trabajó" },
  { clase: "bg-warning/80 ring-2 ring-warning/60", label: "Tarifa especial" },
  { clase: "bg-muted striped", label: "Liquidada" },
  { clase: "bg-primary/30", label: "Cuadrilla (resumen)" },
];

export function CalendarioLeyenda() {
  return (<Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
        <span className="font-semibold text-muted-foreground">Leyenda</span> {PARES.map((p) => (<span key={p.label} className="inline-flex items-center gap-1.5">
            <span
              className={`h-3 w-3 rounded-md ${p.clase}`}
              style={
                p.clase.includes("striped")
                  ? {
                      backgroundImage:
                        "repeating-linear-gradient(45deg, transparent 0, transparent 3px, hsl(var(--muted-foreground) / 0.25) 3px, hsl(var(--muted-foreground) / 0.25) 6px)",
                    }
                  : undefined
              }
              aria-hidden
            />
            {p.label}
          </span>))}
      </CardContent>
    </Card>);
}
