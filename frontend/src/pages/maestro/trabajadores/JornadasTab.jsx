// Pestaña "Jornadas" del detalle de trabajador. Filtro por mes, listado
// cronológico, totales al pie, y popover reutilizable para editar.

import { useMemo, useState } from "react";
import { Check, CircleDot, Minus, Pencil, Lock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { useData } from "@/context/DataContext";
import { formatCOP, formatFechaLarga } from "@/lib/format";
import { etiquetaTipo } from "@/lib/jornadas";
import { tarifaEfectiva, valorJornada } from "@/lib/calculo";

import { JornadaEditorPopover } from "@/components/Maestro/JornadaEditorPopover";

export function JornadasTab({ trabajador }) {
  const { jornadas, liquidaciones, upsertJornada, eliminarJornada } = useData();

  // Filtro de mes (YYYY-MM)
  const [mes, setMes] = useState(() => {
    const hoy = new Date().toISOString().slice(0, 7);
    return hoy;
  });
  const [editorAbierto, setEditorAbierto] = useState(null); // jornada.id

  // Liquidaciones del trabajador (para identificar días pagados)
  const liquidacionesT = useMemo(
    () => liquidaciones.filter((l) => l.trabajadorId === trabajador.id),
    [liquidaciones, trabajador.id],
  );

  const jornadasMes = useMemo(() => {
    return jornadas
      .filter((j) => j.trabajadorId === trabajador.id && j.fecha.startsWith(mes))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [jornadas, trabajador.id, mes]);

  const totales = useMemo(() => {
    let totalValor = 0;
    let diasCompletos = 0;
    let diasMedios = 0;
    let diasNoTrabajados = 0;
    let pendientes = 0;
    let liquidadas = 0;
    for (const j of jornadasMes) {
      totalValor += valorJornada(j, trabajador);
      if (j.tipo === "completo") diasCompletos++;
      else if (j.tipo === "medio") diasMedios++;
      else diasNoTrabajados++;
      if (j.liquidacionId !== null) liquidadas++;
      else pendientes++;
    }
    return {
      totalValor,
      diasCompletos,
      diasMedios,
      diasNoTrabajados,
      pendientes,
      liquidadas,
    };
  }, [jornadasMes, trabajador]);

  const liqConsecutivoPara = (liquacionId) => {
    if (!liquacionId) return undefined;
    return liquidacionesT.find((l) => l.id === liquacionId)?.consecutivo;
  };

  const handleEdit = (j) => (input) => {
    upsertJornada({ trabajadorId: j.trabajadorId, fecha: j.fecha, ...input });
  };

  const handleDelete = (j) => () => {
    const r = eliminarJornada(j.id);
    if (!r.ok) {
      // Sin toast deps para no inflar — el popover ya avisa en modo readonly.
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end justify-between gap-3 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="mes">Mes</Label>
            <Input
              id="mes"
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              className="w-44"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {jornadasMes.length} jornada{jornadasMes.length === 1 ? "" : "s"} en {mes}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {jornadasMes.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No hay jornadas registradas en este mes para {trabajador.nombre}.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Tarifa</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jornadasMes.map((j) => {
                  const liquidada = j.liquidacionId !== null;
                  const cons = liqConsecutivoPara(j.liquidacionId);
                  const Icon =
                    j.tipo === "completo" ? Check : j.tipo === "medio" ? CircleDot : Minus;
                  return (
                    <TableRow key={j.id} className={liquidada ? "bg-muted/30" : undefined}>
                      <TableCell>
                        <div className="text-sm">{formatFechaLarga(j.fecha)}</div>
                        <div className="text-xs text-muted-foreground">{j.fecha}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Icon
                            className={
                              j.tipo === "completo"
                                ? "h-4 w-4 text-success"
                                : j.tipo === "medio"
                                  ? "h-4 w-4 text-info"
                                  : "h-4 w-4 text-muted-strong"
                            }
                          />
                          <span className="text-sm">{etiquetaTipo(j.tipo)}</span>
                          {j.tarifaOverride !== null && (
                            <Badge variant="outline" className="border-warning/40 text-warning">⚡ especial</Badge>
                          )}
                        </div>
                        {j.notas && (
                          <p className="mt-1 text-xs text-muted-foreground italic">
                            "{j.notas}"
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-right num text-sm">
                        {formatCOP(tarifaEfectiva(j, trabajador))}
                      </TableCell>
                      <TableCell className="text-right num text-sm font-semibold">
                        {formatCOP(valorJornada(j, trabajador))}
                      </TableCell>
                      <TableCell>
                        {liquidada ? (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" />
                            Liquidada #{cons}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!liquidada ? (
                          <JornadaEditorPopover
                            jornada={j}
                            trabajador={trabajador}
                            open={editorAbierto === j.id}
                            onOpenChange={(o) => setEditorAbierto(o ? j.id : null)}
                            onChange={handleEdit(j)}
                            onDelete={handleDelete(j)}
                          >
                            <Button variant="ghost" size="icon" aria-label="Editar" className="min-h-tap min-w-tap">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </JornadaEditorPopover>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Totales del mes */}
      <Card>
        <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Tot label="Días completos" value={String(totales.diasCompletos)} />
          <Tot label="Medios días" value={String(totales.diasMedios)} />
          <Tot label="No trabajó" value={String(totales.diasNoTrabajados)} />
          <Tot
            label="Valor del mes"
            value={formatCOP(totales.totalValor)}
            tone="primary"
          />
        </CardContent>
        <CardContent className="border-t px-4 py-3 text-xs text-muted-foreground">
          {totales.liquidadas} liquidadas · {totales.pendientes} pendientes
        </CardContent>
      </Card>
    </div>
  );
}

function Tot({
  label,
  value,
  tone = "muted",
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold num ${tone === "primary" ? "text-primary" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
