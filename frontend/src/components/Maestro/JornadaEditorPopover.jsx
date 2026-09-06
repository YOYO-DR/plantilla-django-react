// Popover de edición fina de una jornada. Se usa desde la grilla y desde
// la pestaña de detalle. Auto-guarda cada cambio, sin botón "Guardar".
// Un día liquidado (R7) abre el popover en modo sólo lectura.

import { useEffect, useMemo, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";
import { Check, CircleDot, Minus, Lock, Trash2 } from "lucide-react";

import { formatCOP, formatNumero } from "@/lib/format";
import { numeroMiles, parseMiles } from "@/lib/usuarios";

export function JornadaEditorPopover({
  jornada,
  trabajador,
  children,
  open,
  onOpenChange,
  onChange,
  onDelete,
}) {
  const liquidada = jornada?.liquidacionId != null;

  // Estado local del popover
  const [tipo, setTipo] = useState(jornada?.tipo ?? "completo");
  const [tarifaOverride, setTarifaOverride] = useState(jornada?.tarifaOverride ?? null);
  const [tarifaTexto, setTarifaTexto] = useState(
    jornada?.tarifaOverride != null ? numeroMiles(jornada.tarifaOverride) : "",
  );
  const [notas, setNotas] = useState(jornada?.notas ?? "");

  // Resetear estado cuando cambia la jornada externa (ej. al cerrar y abrir)
  useEffect(() => {
    if (!open) return;
    setTipo(jornada?.tipo ?? "completo");
    setTarifaOverride(jornada?.tarifaOverride ?? null);
    setTarifaTexto(
      jornada?.tarifaOverride != null ? numeroMiles(jornada.tarifaOverride) : "",
    );
    setNotas(jornada?.notas ?? "");
  },[open, jornada?.id, jornada?.tipo, jornada?.tarifaOverride, jornada?.notas]);

  // Derivados
  const tarifaAplicada = useMemo(() => tarifaOverride ?? trabajador.tarifaDiaBase, [tarifaOverride, trabajador.tarifaDiaBase, tipo]);
  const valorResultado = useMemo(() => {
    if (tipo === "no_trabajo") return 0;
    if (tipo === "medio") return Math.round(tarifaAplicada * trabajador.factorMedioDia);
    return tarifaAplicada;
  },[tipo, tarifaAplicada, trabajador.factorMedioDia]);

  // Notificar cambios fuera (auto-guardado)
  const emitir = (
    nuevoTipo = tipo,
    nuevaTarifa = tarifaOverride,
    nuevasNotas = notas,
  ) => {
    if (liquidada) return;
    if (nuevoTipo === "no_trabajo") {
      // Si se marca "no trabajó", limpiamos override (no aporta valor)
      onChange({
        tipo: "no_trabajo",
        tarifaOverride: null,
        notas: nuevasNotas || undefined,
      });
      return;
    }
    onChange({
      tipo: nuevoTipo,
      tarifaOverride: nuevaTarifa,
      notas: nuevasNotas || undefined,
    });
  };

  return (<Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 space-y-3" align="start">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Editar día</p>
          {liquidada && (<span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Liquidada
            </span>)}
        </div>

        {/* Tipo */}
        <div className="space-y-1.5">
          <Label>Tipo de día</Label>
          <ToggleGroup
            
            value={tipo}
            onValueChange={(v) => {
              if (!v || liquidada) return;
              setTipo(v);
              emitir(v);
            }}
            disabled={liquidada}
            className="grid grid-cols-3 gap-1.5"
          >
            <ToggleGroupItem
              value="completo"
              aria-label="Completo"
              className="data-[state=on]:bg-success/15 data-[state=on]:text-success"
            >
              <Check className="mr-1 h-3.5 w-3.5" /> Completo
            </ToggleGroupItem>
            <ToggleGroupItem
                          value="medio"
                          aria-label="Medio día"
                          className="data-[state=on]:bg-info/15 data-[state=on]:text-info"
                        >
                          <CircleDot className="mr-1 h-3.5 w-3.5" /> Medio
                        </ToggleGroupItem>
            <ToggleGroupItem
              value="no_trabajo"
              aria-label="No trabajó"
              className="data-[state=on]:bg-muted-strong/15 data-[state=on]:text-muted-strong"
            >
              <Minus className="mr-1 h-3.5 w-3.5" /> No trabajo
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Tarifa especial */}
        {tipo !== "no_trabajo" && (<div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="tarifa-override">Tarifa especial para este día</Label>
              <span className="text-xs text-muted-foreground">
                Base</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                id="tarifa-override"
                inputMode="numeric"
                placeholder={numeroMiles(trabajador.tarifaDiaBase)}
                value={tarifaTexto}
                disabled={liquidada}
                onChange={(e) => {
                  const text = e.target.value;
                  if (!/^[\d.]*$/.test(text)) return;
                  setTarifaTexto(text);
                  if (text === "") {
                    setTarifaOverride(null);
                    emitir(tipo,null,notas);
                  } else {
                    const num = parseMiles(text);
                    setTarifaOverride(num);
                    emitir(tipo,num,notas);
                  }
                }}
                className="num"
              />
              {tarifaOverride !== null && !liquidada && (<Button
                  
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTarifaOverride(null);
                    setTarifaTexto("");
                    emitir(tipo,null,notas);
                  }}
                >
                  Quitar
                </Button>)}
            </div>
          </div>)}

        {/* Notas */}
        <div className="space-y-1.5">
          <Label htmlFor="notas">Notas</Label>
          <Textarea
            id="notas"
            rows={2}
            placeholder="Ej. Trabajo bajo lluvia, obra especial…"
            value={notas}
            disabled={liquidada}
            onChange={(e) => {
              setNotas(e.target.value);
              emitir(tipo,tarifaOverride,e.target.value);
            }}
          />
        </div>

        <Separator />

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Valor del día</p>
            <p className="display text-3xl font-bold num">
              {formatNumero(valorResultado) === "0" ? "—" : formatCOP(valorResultado)}
            </p>
            {tipo !== "no_trabajo" && tarifaOverride !== null && (<p className="mt-1 inline-flex items-center gap-1 text-xs text-warning">
                ⚡ Tarifa especial aplicada
              </p>)}
          </div>
          {jornada && !liquidada && onDelete && (<Button
              
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={onDelete}
              aria-label="Borrar la jornada"
            >
              <Trash2 className="h-4 w-4" />
            </Button>)}
        </div>

        {liquidada && (<p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            La jornada forma parte de una liquidación pagada y no puede modificarse.
          </p>)}
      </PopoverContent>
    </Popover>);
}
