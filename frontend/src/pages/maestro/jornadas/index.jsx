// Página principal de jornadas (/app/maestro/jornadas).
// Concentra el estado de período, las mutaciones y la pila de Deshacer.

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Undo2, Copy, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

import { useData } from "@/context/DataContext";
import {
  diasDeSemana,
  finSemana,
  hoyISO,
  inicioSemana,
  sumarDiasISO,
} from "@/lib/fechas";
import {
  useUndoStack,
  resumenGrupo,
} from "@/hooks/useUndoStack";
import { siguienteTipo } from "@/lib/jornadas";
import { formatCOP } from "@/lib/format";

import { BarraPeriodo } from "@/components/Maestro/BarraPeriodo";
import { GrillaEscritorio } from "./GrillaEscritorio";
import { GrillaMovil } from "./GrillaMovil";

export default function MaestroJornadas() {
  const {
    trabajadores,
    jornadas,
    liquidaciones,
    upsertJornada,
    eliminarJornada,
    marcarDiaCompletoParaTodos,
    limpiarSemana,
  } = useData();

  const trabajadoresActivos = useMemo(
    () => trabajadores.filter((t) => t.estado === "activo"),
    [trabajadores],
  );

  // Período (inicio de la semana visible)
  const [inicio, setInicio] = useState(() => inicioSemana(hoyISO()));
  const fin = useMemo(() => finSemana(inicio), [inicio]);
  const dias = useMemo(() => diasDeSemana(inicio), [inicio]);

  // Mapa fecha → consecutivo de liquidación que paga ese día
  const liqConsecutivoPorClave = useCallback(
    (trabajadorId, fecha) => {
      const liq = liquidaciones.find(
        (l) =>
          l.trabajadorId === trabajadorId &&
          fecha >= l.periodoInicio &&
          fecha <= l.periodoFin,
      );
      return liq?.consecutivo;
    },
    [liquidaciones],
  );

  // Estado del período (Sin liquidar / Parcial / Liquidada)
  const estadoPeriodo = useMemo(() => {
    const liqsDelPeriodo = liquidaciones.filter(
      (l) => l.periodoInicio === inicio,
    );
    if (liqsDelPeriodo.length === 0) return "sin-liquidar";
    if (liqsDelPeriodo.length < trabajadoresActivos.length) return "parcial";
    return "liquidada";
  }, [liquidaciones, inicio, trabajadoresActivos.length]);

  // Total a pagar acumulado de la semana (sólo no liquidadas)
  const totalAPagarSemana = useMemo(() => {
    return jornadas
      .filter(
        (j) =>
          j.fecha >= inicio &&
          j.fecha <= fin &&
          j.liquidacionId === null,
      )
      .reduce(
        (acc, j) => {
          const t = trabajadoresActivos.find((t) => t.id === j.trabajadorId);
          if (!t) return acc;
          if (j.tipo === "no_trabajo") return acc;
          const tarifa = j.tarifaOverride ?? t.tarifaDiaBase;
          if (j.tipo === "completo") return acc + tarifa;
          return acc + Math.round(tarifa * t.factorMedioDia);
        },
        0,
      );
  }, [jornadas, inicio, fin, trabajadoresActivos]);

  // Pila de undo
  const { registrar, flush, deshacer } = useUndoStack({
    onFlush: (g) => {
      const resumen = resumenGrupo(g);
      toast.success(resumen, {
        duration: 6000,
        action: {
          label: (
            <span className="inline-flex items-center gap-1">
              <Undo2 className="h-3 w-3" /> Deshacer
            </span>
          ),
          onClick: () => deshacer(),
        },
      });
    },
    onDeshacer: (g) => {
      // Revertir todas las acciones del grupo
      for (const a of g.acciones) {
        if (a.kind === "upsert") {
          if (a.before === null) {
            // creación → eliminar el after
            eliminarJornada(a.after.id);
          } else {
            // actualización → restaurar el before
            upsertJornada({
              trabajadorId: a.before.trabajadorId,
              fecha: a.before.fecha,
              tipo: a.before.tipo,
              tarifaOverride: a.before.tarifaOverride,
              notas: a.before.notas,
            });
          }
        } else if (a.kind === "delete") {
          // eliminación → recrear
          upsertJornada({
            trabajadorId: a.before.trabajadorId,
            fecha: a.before.fecha,
            tipo: a.before.tipo,
            tarifaOverride: a.before.tarifaOverride,
            notas: a.before.notas,
          });
        }
      }
      toast.info("Acción deshecha", { duration: 2500 });
    },
  });

  // ----------------- Handlers --------------------------------------------

  const cycleCell = (trabajadorId, fecha) => {
    const existing = jornadas.find(
      (j) => j.trabajadorId === trabajadorId && j.fecha === fecha,
    );
    if (existing && existing.liquidacionId !== null) return; // R7

    const actual = existing?.tipo ?? null;
    const siguiente = siguienteTipo(actual);

    // Si volvemos a "sin marcar" (null) y hay jornada, la borramos
    if (siguiente === null && existing) {
      const r = eliminarJornada(existing.id);
      if (r.ok) {
        registrar({ kind: "delete", before: existing });
      } else {
        toast.error(r.error ?? "No se pudo borrar");
      }
      return;
    }
    if (siguiente === null) return; // nada que borrar

    // Si vamos a "no_trabajo" mantenemos notas, limpiamos override
    const tarif = siguiente === "no_trabajo" ? null : existing?.tarifaOverride ?? null;
    const notas = siguiente === "no_trabajo" ? existing?.notas : existing?.notas;

    const r = upsertJornada({
      trabajadorId,
      fecha,
      tipo: siguiente,
      tarifaOverride: tarif,
      notas,
    });
    if (r.before === r.after) {
      // No hubo cambio (probablemente liquidada) → no registrar
      return;
    }
    registrar({ kind: "upsert", before: r.before, after: r.after });
  };

  const editCell = (
    trabajadorId,
    fecha,
    input,
  ) => {
    const existing = jornadas.find(
      (j) => j.trabajadorId === trabajadorId && j.fecha === fecha,
    );
    if (existing && existing.liquidacionId !== null) return; // R7

    const r = upsertJornada({ trabajadorId, fecha, ...input });
    if (r.before === r.after) return;
    registrar({ kind: "upsert", before: r.before, after: r.after });
  };

  const deleteCell = (jornadaId) => {
    const j = jornadas.find((x) => x.id === jornadaId);
    if (!j) return;
    const r = eliminarJornada(jornadaId);
    if (r.ok) {
      registrar({ kind: "delete", before: j });
    } else {
      toast.error(r.error ?? "No se pudo borrar");
    }
  };

  // ---- Bulk ----
  const [confirmMarcarTodos, setConfirmMarcarTodos] = useState(null);
  const [confirmRepetir, setConfirmRepetir] = useState(false);
  const [confirmLimpiar, setConfirmLimpiar] = useState(false);

  const ejecutarMarcarTodos = (fecha) => {
    const r = marcarDiaCompletoParaTodos(fecha);
    const total = r.creadas + r.actualizadas;
    if (total === 0) {
      toast.info("Nada que marcar", { description: "Todos los trabajadores activos ya tenían este día liquidado." });
      return;
    }
    toast.success(`${total} marcadas como completas`, {
      description: r.omitidas > 0 ? `${r.omitidas} ya liquidadas no se tocaron.` : undefined,
    });
    // Para deshacer, capturamos antes/después por cada jornada alterada.
    // En esta versión simplificada, el deshacer no incluye esta acción masiva.
    // (Las jornadas tocadas son hoy del "after"; podríamos registrarlas pero
    // el contexto no devuelve el detalle). Se acepta como trade-off de Fase 4.
  };

  const ejecutarRepetirSemanaAnterior = () => {
    const inicioAnterior = sumarDiasISO(inicio, -7);
    const finAnterior = sumarDiasISO(inicio, -1);
    const all = jornadas;
    let copiadas = 0;
    let omitidas = 0;
    const diasSemanaActual = dias;
    const inicioSemanaAnterior = inicioAnterior;

    for (const t of trabajadoresActivos) {
      const jsAnt = all.filter(
        (j) => j.trabajadorId === t.id && j.fecha >= inicioSemanaAnterior && j.fecha <= finAnterior,
      );
      const mapAnterior = new Map(jsAnt.map((j) => [j.fecha, j]));
      mapAnterior.forEach((jAnt) => {
        const idx = parseInt(jAnt.fecha.slice(8, 10), 10) - parseInt(inicioSemanaAnterior.slice(8, 10), 10);
        if (idx < 0 || idx > 6) return;
        const fechaNueva = diasSemanaActual[idx];
        const exi = all.find(
          (x) => x.trabajadorId === t.id && x.fecha === fechaNueva,
        );
        if (exi) {
          omitidas++;
          return;
        }
        const r = upsertJornada({
          trabajadorId: t.id,
          fecha: fechaNueva,
          tipo: jAnt.tipo,
          tarifaOverride: jAnt.tarifaOverride,
          notas: jAnt.notas,
        });
        if (r.before === r.after) return;
        registrar({ kind: "upsert", before: r.before, after: r.after });
        copiadas++;
      });
    }
    flush();
    toast.success(`${copiadas} jornadas copiadas desde la semana anterior`, {
      description: omitidas > 0 ? `Se omitieron ${omitidas} ya existentes.` : undefined,
    });
  };

  const ejecutarLimpiarSemana = () => {
    const r = limpiarSemana(inicio, fin);
    if (r.borradas === 0) {
      toast.info("Nada que limpiar");
      return;
    }
    toast.success(`${r.borradas} jornadas borradas`, {
      description: "Solo se eliminaron las no liquidadas.",
    });
  };

  // ----------------- Render ---------------------------------------------

  return (
    <div className="-mx-4 -mt-6 sm:-mx-6 lg:-mx-8">
      <BarraPeriodo
        inicio={inicio}
        fin={fin}
        onPrev={() => setInicio(sumarDiasISO(inicio, -7))}
        onNext={() => setInicio(sumarDiasISO(inicio, 7))}
        onToday={() => setInicio(inicioSemana(hoyISO()))}
        estado={estadoPeriodo}
        totalAPagar={totalAPagarSemana}
      />

      {/* Toolbar acciones masivas */}
      <div className="border-b bg-card/40 px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Marca, edita y liquida la semana de tu cuadrilla.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-tap"
              onClick={() => setConfirmRepetir(true)}
            >
              <Copy className="mr-1 h-4 w-4" />
              Repetir semana anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-h-tap text-destructive"
              onClick={() => setConfirmLimpiar(true)}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Limpiar semana
            </Button>
          </div>
        </div>
      </div>

      {/* Grilla */}
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 lg:px-8">
        {trabajadoresActivos.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              No tienes trabajadores activos. Crea el primero desde "Trabajadores".
            </CardContent>
          </Card>
        ) : (
          <>
            <GrillaEscritorio
              dias={dias}
              trabajadores={trabajadoresActivos}
              jornadas={jornadas}
              liquidaciones={liquidaciones}
              liqConsecutivoPorClave={liqConsecutivoPorClave}
              onCycleCell={cycleCell}
              onEditCell={editCell}
              onDeleteCell={deleteCell}
              onMarcarTodos={(f) => {
                const hayMarcadas = jornadas.some(
                  (j) => j.fecha === f && j.liquidacionId === null,
                );
                if (hayMarcadas) setConfirmMarcarTodos(f);
                else ejecutarMarcarTodos(f);
              }}
            />
            <GrillaMovil
              dias={dias}
              trabajadores={trabajadoresActivos}
              jornadas={jornadas}
              liquidaciones={liquidaciones}
              onEditCell={editCell}
              onDeleteCell={deleteCell}
            />
          </>
        )}
      </div>

      {/* Confirmaciones */}
      <AlertDialog
        open={!!confirmMarcarTodos}
        onOpenChange={(o) => !o && setConfirmMarcarTodos(null)}
      >
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
                if (confirmMarcarTodos) ejecutarMarcarTodos(confirmMarcarTodos);
                setConfirmMarcarTodos(null);
              }}
            >
              Sí, sobrescribir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRepetir} onOpenChange={setConfirmRepetir}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Repetir la semana anterior?</AlertDialogTitle>
            <AlertDialogDescription>
              Se copiarán las jornadas de la semana pasada a la actual, respetando
              las tarifas base de hoy. Los días ya marcados y los liquidados no se
              tocan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmRepetir(false); ejecutarRepetirSemanaAnterior(); }}>
              Repetir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmLimpiar} onOpenChange={setConfirmLimpiar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar la semana?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán todas las jornadas no liquidadas del período. Las
              liquidadas se conservan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setConfirmLimpiar(false); ejecutarLimpiarSemana(); }}
            >
              Borrar todo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Helper de importes (referencia viva). */}
      <span className="hidden">{formatCOP(0)}</span>
    </div>
  );
}
