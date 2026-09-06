// Helpers para operar montos Decimal del backend sin pasar por Number.
//
// El backend devuelve montos como string "1234.56" (Decimal). Hacer
// parseFloat y operar con ellos mete drift de FP. Aquí convertimos a
// centavos (entero) y operamos sobre enteros.

export function toCents(amount) {
  if (amount == null) return 0;
  const s = String(amount);
  const [ent, dec = ""] = s.split(".");
  const padded = (dec + "00").slice(0, 2);
  const sign = ent.startsWith("-") ? -1 : 1;
  const absEnt = ent.replace("-", "") || "0";
  return sign * (parseInt(absEnt, 10) * 100 + parseInt(padded || "0", 10));
}

export function fromCents(c) {
  const sign = c < 0 ? "-" : "";
  const abs = Math.abs(c);
  const ent = Math.floor(abs / 100);
  const dec = abs % 100;
  return `${sign}${ent}.${String(dec).padStart(2, "0")}`;
}

// Suma una lista de montos (strings Decimales o números) en centavos.
export function sumCents(amounts) {
  let total = 0;
  for (const a of amounts) total += toCents(a);
  return total;
}
