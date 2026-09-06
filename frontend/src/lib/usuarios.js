// Helpers de soporte para la capa de UI de usuarios.

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

/** "Semana del 1 al 7 de septiembre de 2024" */
export function formatearSemanaLarga(inicioISO,finISO) {
  const i = parseISO(inicioISO);
  const f = parseISO(finISO);
  const mesI = format(i,"MMMM",{ locale: es });
  const mesF = format(f,"MMMM",{ locale: es });
  if (mesI === mesF) {
    return `Semana del ${format(i,"d",{ locale: es })} al ${format(f,"d 'de' MMMM 'de' yyyy",{ locale: es },
    )}`;
  }
  return `Semana del ${format(i,"d 'de' MMMM",{ locale: es })} al ${format(f,"d 'de' MMMM 'de' yyyy",{ locale: es },
  )}`;
}

/** Formatea un número entero con separador de miles "es-CO". Entrada: number. */
export function numeroMiles(n) {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("es-CO");
}

/** Parsea un string con formato "85.000" o "85000" a número. */
export function parseMiles(s) {
  const limpio = s.replace(/\./g,"").replace(/[^0-9]/g,"");
  return limpio === "" ? 0 : parseInt(limpio,10);
}
