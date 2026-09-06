// Utilidades de fechas de JornalPro.
// Todas las fechas de dominio se manejan como string "YYYY-MM-DD" para
// evitar problemas de zona horaria. El locale es es-CO y la zona, America/Bogota.

import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek } from "date-fns";
import { es } from "date-fns/locale";

const PATRON_ISO = "yyyy-MM-dd";
const PATRON_DIA_CORTO = "EEE";

/** Fecha de hoy en formato YYYY-MM-DD en zona local. */
export function hoyISO() {
  return format(new Date(),PATRON_ISO);
}

/** Convierte un Date a string YYYY-MM-DD en zona local. */
export function aISO(date) {
  return format(date,PATRON_ISO);
}

/** Parsea un string YYYY-MM-DD a Date en zona local (inicio del día). */
export function deISO(str) {
  return parseISO(str);
}

/** Lunes (inicio de semana laboral) del lunes de la semana que contiene `iso`. */
export function inicioSemana(iso) {
  const d = parseISO(iso);
  const lunes = startOfWeek(d,{ weekStartsOn: 1, locale: es });
  return format(lunes,PATRON_ISO);
}

/** Domingo (fin de semana laboral) de la semana que contiene `iso`. */
export function finSemana(iso) {
  const d = parseISO(iso);
  const domingo = endOfWeek(d,{ weekStartsOn: 1, locale: es });
  return format(domingo,PATRON_ISO);
}

/** Devuelve los 7 días (lunes a domingo) de la semana que contiene `iso`. */
export function diasDeSemana(isoInicio) {
  const inicio = parseISO(isoInicio);
  const dias = [];
  for (let i = 0; i < 7; i++) {
    dias.push(format(addDays(inicio,i),PATRON_ISO));
  }
  return dias;
}

/** Devuelve todas las fechas ISO entre `desde` y `hasta`, inclusive. */
export function rangoDias(desde,hasta) {
  if (!desde || !hasta) return [];
  const d1 = parseISO(desde);
  const d2 = parseISO(hasta);
  const total = differenceInCalendarDays(d2,d1);
  if (total < 0) return [];
  const out = [];
  for (let i = 0; i <= total; i++) {
    out.push(format(addDays(d1,i),PATRON_ISO));
  }
  return out;
}

/** Nombre corto del día en español capitalizado: "Lun", "Mar", ... */
export function nombreDiaCorto(iso) {
  if (!iso) return "";
  const d = parseISO(iso);
  const txt = format(d,PATRON_DIA_CORTO,{ locale: es });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

/** Compara dos strings YYYY-MM-DD. */
export function esMismoDia(a,b) {
  return !!a && !!b && a === b;
}

/** Rango del mes (primer y último día) del mes que contiene `iso`. */
export function mesActualISO(iso) {
  const ref = iso ? parseISO(iso) : new Date();
  return {
    desde: format(startOfMonth(ref),PATRON_ISO),
    hasta: format(endOfMonth(ref),PATRON_ISO),
  };
}

/** Suma días a una fecha ISO y devuelve string ISO. */
export function sumarDiasISO(iso,dias) {
  return format(addDays(parseISO(iso),dias),PATRON_ISO);
}

/** Resta N semanas completas al inicio de la semana que contiene `iso`. */
export function restarSemanas(iso,semanas) {
  return sumarDiasISO(iso,-7 * semanas);
}

/** ¿Es `iso` anterior a `referencia`? Útil para validar deudas pasadas. */
export function esAntes(iso,referencia) {
  return iso < referencia;
}

/** Diferencia en días entre dos fechas ISO (positivo si b > a). */
export function diferenciaDias(a,b) {
  return differenceInCalendarDays(parseISO(b),parseISO(a));
}
