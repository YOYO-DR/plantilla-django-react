// Formateadores puros para JornalPro. Sin dependencias de React.
// COP se formatea con Intl.NumberFormat('es-CO', ...).
// - Dinero: $ 85.000 — separador de miles con punto, sin decimales.
// - Fechas: dd/MM/yyyy por defecto y "sábado, 5 de septiembre" en versión larga.

import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const fmtCOP = new Intl.NumberFormat("es-CO",{
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const fmtCOPNumber = new Intl.NumberFormat("es-CO",{
  maximumFractionDigits: 0,
});

const fmtCOPCompact = new Intl.NumberFormat("es-CO",{
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Formatea un número o string Decimal como peso colombiano: 85000 -> "$ 85.000".
 *  Acepta strings del backend (Decimal como "85000.00") además de numbers.
 */
export function formatCOP(n) {
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "$ 0";
  return fmtCOP.format(Math.round(v));
}

/** Variante numérica sin símbolo: 85000 -> "85.000". */
export function formatNumero(n) {
  if (!Number.isFinite(n)) return "0";
  return fmtCOPNumber.format(Math.round(n));
}

/** Forma compacta para KPIs y tarjetas: 85000000 -> "$ 85 M". */
export function formatCOPCorto(n) {
  if (!Number.isFinite(n) || n === 0) return "$ 0";
  // Se compone con prefijo "$ " + número compacto en es-CO.
  return `$ ${fmtCOPCompact.format(n)}`;
}

/** Formato corto de fecha dd/MM/yyyy por defecto. Acepta patron custom de date-fns. */
export function formatFecha(iso,patron= "dd/MM/yyyy") {
  if (!iso) return "—";
  try {
    return format(parseISO(iso),patron,{ locale: es });
  } catch {
    return iso;
  }
}

/** Fecha larga en español, p. ej.: "sábado, 5 de septiembre". */
export function formatFechaLarga(iso) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso),"EEEE, d 'de' MMMM",{ locale: es });
  } catch {
    return iso;
  }
}

/** Iniciales a partir de un nombre completo: "Jairo Pérez" -> "JP". */
export function iniciales(nombre) {
  if (!nombre) return "?";
  const partes = nombre
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0,2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

/** Nombre del mes en español, p. ej.: "septiembre". */
export function nombreMes(iso) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso),"MMMM",{ locale: es });
  } catch {
    return iso;
  }
}

/** Año como string, p. ej.: "2024". */
export function anio(iso) {
  if (!iso) return "—";
  try {
    return format(parseISO(iso),"yyyy");
  } catch {
    return iso;
  }
}
