// Núcleo puro del dominio de JornalPro.
// Estas funciones implementan las reglas de negocio R1..R5 de la Fase 0.
// Sin dependencias de React ni de storage: cualquier consumidor (UI, tests,
// futuras APIs) las puede llamar directamente.

// ---------------------------------------------------------------------------
// R1 / R2 — Valor de una jornada
// ---------------------------------------------------------------------------

/**
 * Tarifa efectiva para una jornada.
 * Si la jornada tiene `tarifaOverride` no nulo, ese valor reemplaza la base.
 */
export function tarifaEfectiva(j,t) {
  return j.tarifaOverride ?? t.tarifaDiaBase;
}

/**
 * Valor monetario de una jornada aplicando R1:
 * - completo => tarifaEfectiva
 * - medio    => round(tarifaEfectiva * factorMedioDia)
 * - no_trabajo => 0
 */
export function valorJornada(j,t) {
  if (j.tipo === "no_trabajo") return 0;
  const tarifa = tarifaEfectiva(j,t);
  if (j.tipo === "completo") return tarifa;
  // medio
  return Math.round(tarifa * t.factorMedioDia);
}

/** Suma el valor de todas las jornadas que recibe. Útil para subtotales. */
export function totalJornadas(jornadas,t) {
  return jornadas.reduce((acc,j) => acc + valorJornada(j,t),0);
}

// ---------------------------------------------------------------------------
// R4 — Saldo de deuda
// ---------------------------------------------------------------------------

/**
 * Saldo de deuda de un trabajador a partir de sus movimientos.
 * saldo = Σ(prestamos) − Σ(abonos) + Σ(ajustes con signo según concepto)
 *
 * Reglas:
 * - `monto` siempre se guarda positivo.
 * - `ajuste` puede sumar o restar: si el concepto empieza por "-" lo restamos.
 * - El saldo nunca puede ser negativo por la validación al registrar abonos.
 */
export function saldoDeuda(movimientos) {
  return movimientos.reduce((acc,m) => {
    if (m.tipo === "prestamo") return acc + m.monto;
    if (m.tipo === "abono") return acc - m.monto;
    // ajuste: signo según prefijo explícito en el concepto
    const trim = (m.concepto ?? "").trim();
    const signo = trim.startsWith("-") ? -1 : 1;
    return acc + signo * m.monto;
  },0);
}

/** Solo los movimientos que no pertenecen a una liquidación cerrada. */
export function movimientosAbiertos(movimientos) {
  return movimientos.filter((m) => m.liquidacionId === null);
}

/** Préstamos abiertos (sin abono vinculado) — útil para vistas. */
export function prestamosAbiertos(movimientos) {
  return movimientosAbiertos(movimientos).reduce((acc,m) => {
    if (m.tipo === "prestamo") return acc + m.monto;
    return acc;
  },0);
}

// ---------------------------------------------------------------------------
// R5 — Cálculo del descuento en la liquidación
// ---------------------------------------------------------------------------

/**
 * Reglas:
 * - ninguno: 0
 * - total:   min(saldoDeudaAntes, subtotalJornadas)
 * - parcial: 0 < montoManual <= min(saldo, subtotal)
 * No genera pago negativo: el descuento tope es el subtotal.
 */
export function calcularDescuento(modo,montoManual,saldo,subtotal,
) {
  const techo = Math.max(0,Math.min(saldo,subtotal));

  if (modo === "ninguno") {
    return {
      montoDescontado: 0,
      deudaPendiente: Math.max(0,saldo),
      esValido: true,
    };
  }

  if (modo === "total") {
    const aplicado = Math.min(saldo,subtotal);
    return {
      montoDescontado: aplicado,
      deudaPendiente: Math.max(0,saldo - aplicado),
      esValido: true,
    };
  }

  // parcial
  if (!Number.isFinite(montoManual) || montoManual <= 0) {
    return {
      montoDescontado: 0,
      deudaPendiente: Math.max(0,saldo),
      esValido: false,
      mensaje: "El monto debe ser mayor a 0.",
    };
  }
  if (montoManual > techo) {
    return {
      montoDescontado: 0,
      deudaPendiente: Math.max(0,saldo),
      esValido: false,
      mensaje: `El monto no puede superar ${techo}.`,
    };
  }
  return {
    montoDescontado: Math.round(montoManual),
    deudaPendiente: Math.max(0,saldo - Math.round(montoManual)),
    esValido: true,
  };
}

// ---------------------------------------------------------------------------
// Detalle de liquidación (snapshot inmutable)
// ---------------------------------------------------------------------------

/**
 * Construye el detalle línea por línea que se congela en la liquidación.
 * Ordena por fecha ascendente. Excluye jornadas no_trabajo (que no aportan valor).
 */
export function construirDetalleLiquidacion(jornadas,t,
) {
  const filtradas = jornadas.filter((j) => j.tipo !== "no_trabajo");
  const ordenadas = [...filtradas].sort((a,b) =>
    a.fecha < b.fecha ? -1 : 1,
  );
  return ordenadas.map((j) => ({
    fecha: j.fecha,
    tipo: j.tipo,
    tarifaAplicada: tarifaEfectiva(j,t),
    valor: valorJornada(j,t),
    esOverride: j.tarifaOverride !== null,
  }));
}

/** Suma de líneas de un detalle ya construido. */
export function subtotalDeDetalle(detalle) {
  return detalle.reduce((acc,l) => acc + l.valor,0);
}

/** Total a pagar = subtotal - descuento. Nunca negativo. */
export function totalAPagar(subtotal,descuento) {
  return Math.max(0,subtotal - descuento);
}
