// Fila expandida por día en móvil (3 botones grandes + tarifa especial + borrar).

import { useState } from "react";
import { Check, CircleDot, Minus, Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCOP } from "@/lib/format";
import { valorJornada } from "@/lib/calculo";
import { esHoy, etiquetaTipo } from "@/lib/jornadas";
import { nombreDiaCorto } from "@/lib/fechas";

import { JornadaEditorPopover } from "@/components/Maestro/JornadaEditorPopover";

export function FilaDiaMovil({ fecha, jornada, trabajador, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const cerrado = !!jornada?.liquidacionId;

  const valor = jornada ? valorJornada(jornada, trabajador) : 0;
  const tipoActual = jornada?.tipo ?? null;

  const setTipo = (t) => {
    if (cerrado) return;
    onChange({
      tipo: t,
      tarifaOverride: jornada?.tarifaOverride ?? null,
      notas: jornada?.notas,
    });
  };

  return (
    <div
      className={cn(
        "rounded-md border bg-card p-3",
        esHoy(fecha) && "border-primary/40 bg-primary/5",
        cerrado && "opacity-70",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs uppercase text-muted-foreground">
            {nombreDiaCorto(fecha)} <span className="font-mono text-foreground">{fecha.slice(8, 10)}</span>
            {esHoy(fecha) && <span className="ml-2 inline-flex text-primary">(hoy)</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {etiquetaTipo(tipoActual)}
            {jornada?.tarifaOverride != null && (
              <Badge variant="outline" className="ml-1 border-warning/40 text-warning">
                ⚡ especial
              </Badge>
            )}
          </p>
        </div>
        <span className="text-base font-bold num">
          {valor > 0 ? formatCOP(valor) : "—"}
        </span>
      </div>

      {/* 3 botones grandes */}
      {!cerrado && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <BotonTipo
            label="Completo"
            active={tipoActual === "completo"}
            onClick={() => setTipo("completo")}
            color="success"
            icon={Check}
          />
          <BotonTipo
            label="Medio"
            active={tipoActual === "medio"}
            onClick={() => setTipo("medio")}
            color="info"
            icon={CircleDot}
          />
          <BotonTipo
            label="No trabajó"
            active={tipoActual === "no_trabajo"}
            onClick={() => setTipo("no_trabajo")}
            color="muted"
            icon={Minus}
          />
        </div>
      )}

      {!cerrado && (
        <div className="mt-2 flex items-center justify-between">
          <JornadaEditorPopover
            jornada={jornada}
            trabajador={trabajador}
            open={open}
            onOpenChange={setOpen}
            onChange={onChange}
            onDelete={onDelete}
          >
            <Button variant="outline" size="sm" className="min-h-tap">
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Tarifa especial
            </Button>
          </JornadaEditorPopover>
          {jornada && onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="text-destructive"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Borrar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function BotonTipo({
  label,
  active,
  onClick,
  color,
  icon: Icon,
}) {
  const tones = {
    success: "bg-success text-success-foreground border-success",
    info: "bg-info text-info-foreground border-info",
    muted: "bg-muted-strong text-white border-muted-strong",
  };
  const inactiveTones = {
    success: "border-success/40 text-success hover:bg-success/10",
    info: "border-info/40 text-info hover:bg-info/10",
    muted: "border-muted-strong/40 text-muted-strong hover:bg-muted",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-tap flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold transition-colors",
        active ? tones[color] : inactiveTones[color],
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
