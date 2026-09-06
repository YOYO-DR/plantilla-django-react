// Pila de acciones para deshacer. Las acciones consecutivas se acumulan en
// un mismo grupo (batch) y se desahacen como una unidad. El grupo se cierra
// tras `flushAfterMs` de inactividad o al invocar `flush()` manualmente.

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_GRUPOS = 10;
const FLUSH_AFTER_MS = 700;

export function useUndoStack(opts) {
  const [gruposCerrados, setGruposCerrados] = useState([]);
  const grupoActualRef = useRef(null);
  const timerRef = useRef(null);
  const idCounter = useRef(0);

  const cancelarTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const cerrarGrupo = useCallback(() => {
    cancelarTimer();
    const g = grupoActualRef.current;
    grupoActualRef.current = null;
    if (!g || g.acciones.length === 0) return null;
    setGruposCerrados((prev) => {
      const next = [...prev, g];
      return next.length > MAX_GRUPOS ? next.slice(-MAX_GRUPOS) : next;
    });
    opts?.onFlush?.(g);
    return g;
  }, [opts]);

  const agendarCerrar = useCallback(() => {
    cancelarTimer();
    timerRef.current = window.setTimeout(() => {
      cerrarGrupo();
    }, FLUSH_AFTER_MS);
  }, [cerrarGrupo]);

  const registrar = useCallback(
    (a) => {
      if (grupoActualRef.current) {
        grupoActualRef.current.acciones.push(a);
      } else {
        idCounter.current += 1;
        grupoActualRef.current = {
          id: idCounter.current,
          ts: Date.now(),
          acciones: [a],
        };
      }
      agendarCerrar();
    },
    [agendarCerrar],
  );

  const flush = useCallback(() => cerrarGrupo(), [cerrarGrupo]);

  const deshacer = useCallback(() => {
    let target = null;
    setGruposCerrados((prev) => {
      if (prev.length === 0) return prev;
      target = prev[prev.length - 1];
      opts?.onDeshacer?.(target);
      return prev.slice(0, -1);
    });
    return target;
  }, [opts]);

  const deshacerGrupo = useCallback(
    (id) => {
      let target = null;
      setGruposCerrados((prev) => {
        const idx = prev.findIndex((g) => g.id === id);
        if (idx === -1) return prev;
        target = prev[idx];
        opts?.onDeshacer?.(target);
        return [...prev.slice(0, idx), ...prev.slice(idx + 1)];
      });
      return target;
    },
    [opts],
  );

  useEffect(() => {
    return () => cancelarTimer();
  }, []);

  return {
    registrar,
    flush,
    deshacer,
    deshacerGrupo,
    gruposCerrados,
  };
}

/** Genera un resumen humano a partir de un grupo de acciones. */
export function resumenGrupo(g) {
  let upserts = 0;
  let deletes = 0;
  for (const a of g.acciones) {
    if (a.kind === "upsert") upserts += 1;
    else deletes += 1;
  }
  if (deletes === 0) return `${upserts} jornada${upserts === 1 ? "" : "s"} actualizada${upserts === 1 ? "" : "s"}`;
  if (upserts === 0) return `${deletes} jornada${deletes === 1 ? "" : "s"} borrada${deletes === 1 ? "" : "s"}`;
  return `${upserts} actualizada${upserts === 1 ? "" : "s"} · ${deletes} borrada${deletes === 1 ? "" : "s"}`;
}