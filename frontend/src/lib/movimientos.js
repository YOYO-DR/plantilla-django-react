// Helpers puros para préstamos / abonos (Fase 6).
// El saldo siempre se deriva de los movimientos — nunca se guarda en Trabajador.

import { saldoDeuda, valorJornada } from "./calculo";

/**
 * Regla R6 + Fase 6 §6.5:
 * - Un movimiento con `liquidacionId` quedó congelado por R6 (no se toca).
 * - Un movimiento manual cae dentro de un período liquidado → también está
 *   congelado: su corrección se hace con un movimiento `ajuste` compensatorio.
 * - Si no hay liquidación pagada que abarque la fecha, es editable / borrable.
 */
export function esMovimientoEditable(mov,liquidaciones,
) {
  if (mov.liquidacionId !== null) return false;
  const absorbida = liquidaciones.some((l) =>
      l.trabajadorId === mov.trabajadorId &&
      l.estado === "pagada" &&
      l.periodoInicio <= mov.fecha &&
      l.periodoFin >= mov.fecha,
  );
  return !absorbida;
}

/**
 * Saldo histórico en una fecha: igual a `saldoDeuda` pero restringido a
 * movimientos con `fecha <= hasta`.
 */
export function saldoHastaFecha(movimientos,hasta,
) {
  return Math.max(0,saldoDeuda(movimientos.filter((m) => m.fecha <= hasta)));
}

/** Total prestado por el maestro (sólo movimientos tipo 'prestamo'). */
export function totalPrestado(movimientos) {
  return movimientos
    .filter((m) => m.tipo === "prestamo")
    .reduce((acc,m) => acc + m.monto,0);
}

/** Total abonado, incluyendo los descuentos automáticos de liquidaciones. */
export function totalAbonado(movimientos) {
  return movimientos
    .filter((m) => m.tipo === "abono")
    .reduce((acc,m) => acc + m.monto,0);
}

/** Total abonado sólo de movimientos manuales (no ligados a liquidación). */
export function totalAbonadoManual(movimientos) {
  return movimientos
    .filter((m) => m.tipo === "abono" && m.liquidacionId === null)
    .reduce((acc,m) => acc + m.monto,0);
}

/** Préstamos en un mes (YYYY-MM) — usado en KPIs. */
export function prestamosDelMes(movimientos,mesISO,
) {
  return movimientos
    .filter((m) =>
        m.tipo === "prestamo" && m.fecha.startsWith(mesISO.slice(0,7)),
    )
    .reduce((acc,m) => acc + m.monto,0);
}

/**
 * Cálculo incremental del saldo paso a paso para alimentar la línea de tiempo.
 * Devuelve un array paralelo con saldo vigente después de CADA movimiento
 * (movimientos en orden cronológico ascendente).
 */
export function evolucionSaldos(movimientos) {
  const ordenados = [...movimientos].sort((a,b) =>
    a.fecha === b.fecha ? (a.tipo === "abono" ? -1 : 1) : 1,
  );
  let acc = 0;
  return ordenados.map((m) => {
    if (m.tipo === "prestamo") acc += m.monto;
    else if (m.tipo === "abono") acc -= m.monto;
    else {
      const trim = (m.concepto ?? "").trim();
      const signo = trim.startsWith("-") ? -1 : 1;
      acc += signo * m.monto;
    }
    if (acc < 0) acc = 0;
    return { mov: m, saldo: acc };
  });
}

/** Resumen rápido de un trabajador: saldo, total prestado, total abonado, último movimiento. */
export function resumenDeuda(movimientos) {
  const ordenados = [...movimientos].sort((a,b) =>
    a.fecha > b.fecha ? -1 : 1,
  );
  return {
    saldo: Math.max(0,saldoDeuda(movimientos)),
    totalPrestado: totalPrestado(movimientos),
    totalAbonado: totalAbonado(movimientos),
    ultimoMovimiento: ordenados[0] ?? null,
  };
}

/** Valor del pago estimado para un período: devengado − min(saldo, devengado). */
export function pagoEstimado(jornadas,trabajador,saldo,
) {
  const subtotal = jornadas.reduce((acc,j) => acc + valorJornada(j,trabajador),0);
  const descuento = Math.min(saldo,subtotal);
  return { subtotal, descuento, aPagar: Math.max(0,subtotal - descuento) };
}
