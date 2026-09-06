// Helpers puros del panel admin (Fase 10).

import { startOfWeek, subWeeks } from "date-fns";
import { es } from "date-fns/locale";

/** Suma de jornadas por semana (lun→dom) para los últimos N. */
export function resumirSemanaParaChart(jornadas, referencia, semanas) {
  const out = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const inicio = startOfWeek(subWeeks(referencia,i),{ weekStartsOn: 1, locale: es });
    const inicioStr = inicio.toISOString().slice(0,10);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 6);
    const finStr = fin.toISOString().slice(0,10);
    const total = jornadas.filter((j) => j.fecha >= inicioStr && j.fecha <= finStr,
    ).length;
    out.push({
      semana: `${inicioStr.slice(5,7)}/${inicioStr.slice(8,10)}`,
      total,
    });
  }
  return out;
}
