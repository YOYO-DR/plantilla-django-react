// Genera IDs únicos y legibles para las entidades de dominio.
// Formato: `${prefijo}_${base36(timestamp)}${base36(random)}`.

export function generarId(prefijo) {
  const t = Date.now().toString(36);
  const r = Math.floor(Math.random() * 1e9).toString(36);
  return `${prefijo}_${t}${r}`;
}
