// Grilla semanal para escritorio (md+). Tabla con primera columna sticky,
// columnas diarias clicables, fila de totales al pie.

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCOP, formatNumero } from "@/lib/format";
import { nombreDiaCorto } from "@/lib/fechas";
import { esHoy } from "@/lib/jornadas";
import { valorJornada } from "@/lib/calculo";

import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { JornadaCelda } from "@/components/Maestro/JornadaCelda";
import { JornadaEditorPopover } from "@/components/Maestro/JornadaEditorPopover";

export function GrillaEscritorio({
  dias,
  trabajadores,
  jornadas,
  liqConsecutivoPorClave,
  onCycleCell,
  onEditCell,
  onDeleteCell,
  onMarcarTodos,
}) {
  const [confirmando, setConfirmando] = useState(null);
  const [popoverCell, setPopoverCell] = useState(null);

  const jornadaEn = (tId, fecha) =>
    jornadas.find((j) => j.trabajadorId === tId && j.fecha === fecha) ?? null;

  // Totales por día: suma de valor de la jornada (incluye liquidadas, refleja
  // el trabajo real hecho)
  const totalesPorDia = dias.map((fecha) =>
    trabajadores.reduce((acc, t) => {
      const j = jornadaEn(t.id, fecha);
      return j ? acc + valorJornada(j, t) : acc;
    }, 0),
  );

  const granTotal = totalesPorDia.reduce((a, b) => a + b, 0);

  return (
    <div className="hidden rounded-md border bg-card md:block">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-44" />
            {dias.map((d) => (
              <col key={d} />
            ))}
            <col className="w-16" />
            <col className="w-28" />
          </colgroup>
          <thead className="bg-muted/60 text-xs uppercase tracking-wider">
            <tr>
              <th className="sticky left-0 z-10 bg-muted/60 px-2 py-2 text-left">Trabajador</th>
              {dias.map((d) => (
                <th key={d} className="px-1 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      const hayMarcadas = jornadas.some(
                        (j) => j.fecha === d && j.liquidacionId === null,
                      );
                      if (hayMarcadas) setConfirmando(d);
                      else onMarcarTodos(d);
                    }}
                    className={`mx-auto flex min-h-tap w-full flex-col items-center rounded-md px-1 py-1 hover:bg-background ${
                      esHoy(d) ? "bg-primary/15 text-primary" : ""
                    }`}
                    title="Marcar día completo a todos los trabajadores activos"
                  >
                    <span className="font-semibold">{nombreDiaCorto(d)}</span>
                    <span className="num text-xs font-normal">{d.slice(8, 10)}</span>
                  </button>
                </th>
              ))}
              <th className="px-1 py-2 text-center">Días</th>
              <th className="px-2 py-2 text-right">Total semana</th>
            </tr>
          </thead>
          <tbody>
            {trabajadores.length === 0 ? (
              <tr>
                <td colSpan={2 + dias.length + 1} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No tienes trabajadores activos. Crea el primero desde "Trabajadores".
                </td>
              </tr>
            ) : (
              trabajadores.map((t) => {
                const jsT = jornadas.filter(
                  (j) =>
                    j.trabajadorId === t.id &&
                    j.fecha >= dias[0] &&
                    j.fecha <= dias[dias.length - 1],
                );
                const diasContados =
                  jsT.filter((j) => j.tipo === "completo").length +
                  jsT.filter((j) => j.tipo === "medio").length * 0.5;
                const totalSemana = jsT.reduce(
                  (acc, j) => acc + valorJornada(j, t),
                  0,
                );

                return (
                  <tr key={t.id} className="border-t">
                    <td className="sticky left-0 z-10 bg-card px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <AvatarIniciales nombre={t.nombre} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{t.nombre}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t.oficio} · <span className="num">{formatCOP(t.tarifaDiaBase)}</span>
                          </p>
                        </div>
                      </div>
                    </td>
                    {dias.map((fecha) => {
                      const j = jornadaEn(t.id, fecha);
                      const liqCons = j ? liqConsecutivoPorClave(t.id, fecha) : undefined;
                      const isOpen =
                        !!popoverCell &&
                        popoverCell.tId === t.id &&
                        popoverCell.fecha === fecha;

                      return (
                        <td key={fecha} className="px-1 py-1 align-middle">
                          <div className="relative mx-auto h-14 w-full max-w-[88px]">
                            <JornadaCelda
                              jornada={j}
                              tipo={j?.tipo ?? null}
                              trabajador={t}
                              fecha={fecha}
                              cerradoPorLiquidacion={!!j && j.liquidacionId !== null}
                              liquidacionConsecutivo={liqCons}
                              onCycle={() => onCycleCell(t.id, fecha)}
                              onOpenEditor={() => setPopoverCell({ tId: t.id, fecha })}
                            />
                            <JornadaEditorPopover
                              jornada={j}
                              trabajador={t}
                              open={isOpen}
                              onOpenChange={(o) =>
                                setPopoverCell(o ? { tId: t.id, fecha } : null)
                              }
                              onChange={(input) => onEditCell(t.id, fecha, input)}
                              onDelete={j ? () => onDeleteCell(j.id) : undefined}
                            >
                              <span className="hidden" />
                            </JornadaEditorPopover>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-1 py-1 text-center text-sm num">{diasContados.toFixed(1)}</td>
                    <td className="px-2 py-1 text-right">
                      <span className="text-sm font-bold num">{formatCOP(totalSemana)}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {trabajadores.length > 0 && (
            <tfoot className="border-t-2 bg-muted/40 text-sm font-bold">
              <tr>
                <td className="sticky left-0 z-10 bg-muted/40 px-2 py-2">Total del día</td>
                {dias.map((fecha, i) => (
                  <td key={fecha} className="px-1 py-2 text-center text-xs num">
                    {formatNumero(totalesPorDia[i])}
                  </td>
                ))}
                <td></td>
                <td className="px-2 py-2 text-right num text-base">{formatCOP(granTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <AlertDialog open={!!confirmando} onOpenChange={(o) => !o && setConfirmando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Marcar día completo a todos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta columna ya tiene días marcados. Sobrescribirlos reemplazará el
              trabajo que ya registraste este día. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmando) onMarcarTodos(confirmando);
                setConfirmando(null);
              }}
            >
              Sí, sobrescribir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}