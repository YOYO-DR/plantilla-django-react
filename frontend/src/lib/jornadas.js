// Helpers puros para la UI de jornadas. Sin dependencias React.

import { parseISO } from "date-fns";

/** Sin marcar = null; los 3 estados del modelo en orden de ciclo. */
export const CICLO= [null, "completo", "medio", "no_trabajo"];

/** Siguiente tipo según el ciclo: sin marcar → completo → medio → no_trabajo → sin marcar. */
export function siguienteTipo(actual) {
  const idx = CICLO.indexOf(actual);
  return CICLO[(idx + 1) % CICLO.length];
}

/** ¿El día es hoy (en zona local)? */
export function esHoy(iso) {
  const h = new Date().toISOString().slice(0,10);
  return iso === h;
}

/** ¿La fecha está en el futuro (más allá de hoy)? */
export function esFuturo(iso) {
  const h = new Date().toISOString().slice(0,10);
  return iso > h;
}

/** Convierte un string YYYY-MM-DD a Date a inicio del día local. */
export function aDate(iso) {
  return parseISO(iso);
}

/** Etiqueta corta humana del tipo, en español. */
export function etiquetaTipo(t) {
  switch (t) {
    case "completo":
      return "Completo";
    case "medio":
      return "Medio día";
    case "no_trabajo":
      return "No trabajó";
    case null:
      return "Sin marcar";
  }
}

/** Clases de color semántico para la celda según el tipo. */
export function claseColor(t, opts = {}) {
  if (opts?.liquidada) {
    return {
      fondo: "bg-muted/60",
      texto: "text-muted-foreground",
      borde: "border-muted-foreground/30 border-dashed",
    };
  }
  if (t === "completo") {
    return opts?.override
      ? {
          fondo: "bg-warning/15",
          texto: "text-warning-foreground",
          borde: "border-warning/60 ring-1 ring-warning/60",
        }
      : {
          fondo: "bg-success/15",
          texto: "text-success",
          borde: "border-success/40",
        };
  }
  if (t === "medio") {
    return opts?.override
      ? {
          fondo: "bg-warning/15",
          texto: "text-warning-foreground",
          borde: "border-warning/60 ring-1 ring-warning/60",
        }
      : {
          fondo: "bg-info/15",
          texto: "text-info",
          borde: "border-info/40",
        };
  }
  if (t === "no_trabajo") {
    return {
      fondo: "bg-muted-strong/15",
      texto: "text-muted-strong",
      borde: "border-muted-strong/40",
    };
  }
  return {
    fondo: "bg-muted/30",
    texto: "text-muted-foreground",
    borde: "border-dashed border-muted-foreground/40",
  };
}
