// Sheet lateral que lista a todos los trabajadores activos de un día, en
// modo "Toda la cuadrilla". Cada fila permite cambiar el tipo del día y
// abrir el editor fino (Tarifa especial).

import { Check, CircleDot, Minus, Pencil, Lock } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { useData } from "@/context/DataContext";
import { formatCOP, formatFechaLarga } from "@/lib/format";
import { valorJornada, tarifaEfectiva } from "@/lib/calculo";

import { JornadaEditorPopover } from "@/components/Maestro/JornadaEditorPopover";

export function CalendarioDetalleDiaSheet({
  abierto,
  onClose,
  fecha,
  trabajadores,
  jornadas,
  onChange,
}) {
  return (<Sheet open={abierto} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {fecha && (<>
            <SheetHeader className="border-b bg-background/95 px-4 py-4">
              <SheetTitle className="display text-lg">
                {formatFechaLarga(fecha)}
              </SheetTitle>
              <SheetDescription>
                Marca o edita el día de cada trabajador.
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {trabajadores.length === 0 ? (<p className="text-sm text-muted-foreground">
                  No hay trabajadores activos en tu cuadrilla.
                </p>) : (trabajadores.map((t) => {
                  const j =
                    jornadas.find((x) => x.trabajadorId === t.id && x.fecha === fecha,
                    ) ?? null;
                  return (<FilaTrabajadorSheet
                      key={t.id}
                      t={t}
                      fecha={fecha}
                      jornada={j}
                      onChange={onChange}
                    />);
                }))}
            </div>
          </>)}
      </SheetContent>
    </Sheet>);
}

function FilaTrabajadorSheet({
  t,
  fecha,
  jornada,
  onChange,
}) {
  const { eliminarJornada } = useData();
  const liquidada = !!jornada?.liquidacionId;
  const valor = jornada ? valorJornada(jornada,t) : 0;
  const tipoActual = jornada?.tipo ?? null;

  const setTipo = (nuevo) => {
    if (liquidada) return;
    const tarif = nuevo === "no_trabajo" ? null : jornada?.tarifaOverride ?? null;
    onChange(t.id,fecha,{
      tipo: nuevo,
      tarifaOverride: tarif,
      notas: jornada?.notas,
    });
  };

  const tabs = [
    { tipo: "completo", label: "Completo", icon: Check, color: "success" },
    { tipo: "medio", label: "Medio", icon: CircleDot, color: "info" },
    { tipo: "no_trabajo", label: "No trabajó", icon: Minus, color: "muted" },
  ];

  return (<Card>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">{t.nombre}</p>
            <p className="text-xs text-muted-foreground">
              {t.oficio} ·{" "}
              <span className="num">{formatCOP(t.tarifaDiaBase)}</span>/día
            </p>
          </div>
          <div className="text-right">
            <p className="text-base font-bold num">{valor > 0 ? formatCOP(valor) : "—"}</p>
            {jornada?.tarifaOverride != null && (<Badge variant="outline" className="border-warning/40 text-warning">
                ⚡ {formatCOP(tarifaEfectiva(jornada,t))}
              </Badge>)}
          </div>
        </div>

        {liquidada ? (<div className="flex items-center justify-center gap-1 rounded-md bg-muted py-2 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            Liquidado — no se puede modificar
          </div>) : (<div className="grid grid-cols-3 gap-1.5">
            {tabs.map((op) => {
              const active = tipoActual === op.tipo;
              const tones = {
                success: active ? "bg-success text-success-foreground border-success" : "border-success/40 text-success hover:bg-success/10",
                info: active ? "bg-info text-info-foreground border-info" : "border-info/40 text-info hover:bg-info/10",
                muted: active ? "bg-muted-strong text-white border-muted-strong" : "border-muted-strong/40 text-muted-strong hover:bg-muted",
              };
              return (<button
                  key={op.tipo}
                  
                  onClick={() => setTipo(op.tipo)}
                  className={`flex min-h-tap flex-col items-center justify-center gap-0.5 rounded-md border py-1.5 text-xs font-semibold transition-colors ${tones[op.color]}`}
                >
                  <op.icon className="h-3.5 w-3.5" />
                  {op.label}
                </button>);
            })}
          </div>)}

        {!liquidada && (<div className="flex items-center justify-end gap-2">
            {jornada && (<Button
                
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => eliminarJornada(jornada.id)}
              >
                Borrar
              </Button>)}
            <JornadaEditorPopover
              jornada={jornada}
              trabajador={t}
              onChange={(input) => onChange(t.id,fecha,input)}
            >
              <Button variant="outline" size="sm">
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Tarifa especial
              </Button>
            </JornadaEditorPopover>
          </div>)}
      </CardContent>
    </Card>);
}
