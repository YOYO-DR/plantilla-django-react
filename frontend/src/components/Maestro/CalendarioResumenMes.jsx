// Resumen comparativo del mes: devengado, días trabajados, medios y
// días con tarifa especial. Compara con el mes anterior.

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { formatCOP } from "@/lib/format";

import { valorJornada } from "@/lib/calculo";

function statsDelMes(jornadasMes,trabajadores) {
  const mapa = new Map(trabajadores.map((t) => [t.id, t]));
  let total = 0;
  let diasCompletos = 0;
  let mediosDias = 0;
  let diasConOverride = 0;
  for (const j of jornadasMes) {
    const t = mapa.get(j.trabajadorId);
    if (!t) continue;
    total += valorJornada(j,t);
    if (j.tipo === "completo") diasCompletos++;
    else if (j.tipo === "medio") mediosDias++;
    if (j.tarifaOverride !== null) diasConOverride++;
  }
  return { total, diasCompletos, mediosDias, diasConOverride };
}

function rangoMes(mesISO) {
  const d = new Date(mesISO + "T00:00:00");
  const desde = mesISO;
  const hasta = new Date(d.getFullYear(),d.getMonth() + 1,0)
    .toISOString()
    .slice(0,10);
  return { desde, hasta };
}

function rangoMesAnterior(mesISO) {
  const d = new Date(mesISO + "T00:00:00");
  const m = d.getMonth();
  const y = d.getFullYear();
  const desde = new Date(y,m - 1,1).toISOString().slice(0,10);
  const hasta = new Date(y,m,0).toISOString().slice(0,10);
  return { desde, hasta };
}

export function CalendarioResumenMes({
  mesInicio,
  jornadas,
  trabajadores,
  trabajador,
}) {
  const stats = useMemo(() => {
    const r = rangoMes(mesInicio);
    const rAnt = rangoMesAnterior(mesInicio);
    const baseActual = trabajador ? [trabajador] : trabajadores;
    const actual = statsDelMes(jornadas.filter((j) => j.fecha >= r.desde && j.fecha <= r.hasta),baseActual,
    );
    const anterior = statsDelMes(jornadas.filter((j) => j.fecha >= rAnt.desde && j.fecha <= rAnt.hasta),baseActual,
    );
    return { actual, anterior };
  },[mesInicio, jornadas, trabajadores, trabajador]);

  const diff = stats.actual.total - stats.anterior.total;
  const pct = stats.anterior.total > 0 ? (diff / stats.anterior.total) * 100 : 0;
  const Icono = diff === 0 ? Minus : diff > 0 ? TrendingUp : TrendingDown;
  const tono =
    diff === 0 ? "text-muted-foreground" : diff > 0 ? "text-success" : "text-destructive";

  return (<Card>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Total del mes" value={formatCOP(stats.actual.total)} primary />
        <Stat label="Días completos" value={String(stats.actual.diasCompletos)} />
        <Stat label="Medios días" value={String(stats.actual.mediosDias)} />
        <Stat label="Días con tarifa especial" value={String(stats.actual.diasConOverride)} />
        <Stat
          label="vs Mes anterior"
          value={
            <span className={`inline-flex items-center gap-1 ${tono}`}>
              <Icono className="h-4 w-4" />
              {pct === 0 ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`}
            </span>
          }
          sublabel={formatCOP(Math.abs(diff))}
        />
      </CardContent>
    </Card>);
}

function Stat({
  label,
  value,
  sublabel,
  primary,
}) {
  return (<div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold leading-tight num ${primary ? "text-primary" : ""}`}>
        {value}
      </p>
      {sublabel && (<p className="mt-0.5 text-xs text-muted-foreground num">{sublabel}</p>)}
    </div>);
}
