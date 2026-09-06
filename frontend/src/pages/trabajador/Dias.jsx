// "Mis días" — calendario solo lectura + lista cronológica del mes.
// El Calendario se reutiliza (Fase 5) en modo soloLectura=true.

import { useMemo, useState } from "react";
import { Calendario } from "@/components/Maestro/Calendario";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useData } from "@/context/DataContext";
import { useTrabajadorActual } from "@/context/useTrabajadorActual";
import { formatCOP, formatFecha } from "@/lib/format";
import { valorJornada } from "@/lib/calculo";

export default function TrabajadorDias() {
  const { jornadas } = useData();
  const t = useTrabajadorActual();

  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));

  const jornadasMes = useMemo(() => {
    if (!t) return [];
    return jornadas
      .filter((j) => j.trabajadorId === t.id && j.fecha.startsWith(mes))
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [jornadas, t, mes]);

  const totales = useMemo(() => {
    let total = 0;
    let completos = 0;
    let medios = 0;
    let conOverride = 0;
    for (const j of jornadasMes) {
      if (!t) continue;
      total += valorJornada(j, t);
      if (j.tipo === "completo") completos++;
      else if (j.tipo === "medio") medios++;
      if (j.tarifaOverride !== null) conOverride++;
    }
    return { total, completos, medios, conOverride };
  }, [jornadasMes, t]);

  if (!t) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No se encontró tu información.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="display text-2xl font-semibold sm:text-3xl">Mis días</h1>
        <p className="text-sm text-muted-foreground">
          Calendario de los días que te han marcado. Tocar un día abre el detalle.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="space-y-1">
              <Label htmlFor="mes">Mes</Label>
              <Input
                id="mes"
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Stat label="Días completos" value={totales.completos} />
              <Stat label="Medios" value={totales.medios} />
              <Stat label="Tarifa especial" value={totales.conOverride} />
              <Stat label="Total" value={formatCOP(totales.total)} highlight />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendario reutilizado en modo soloLectura */}
      <div className="rounded-md border bg-card p-2">
        <div className="mb-2 px-2 text-xs text-muted-foreground">
          Mes: <span className="num">{mes}</span>
        </div>
        <Calendario
          trabajadores={[]}
          jornadas={jornadas.filter((j) => j.trabajadorId === t.id && j.fecha.startsWith(mes))}
          onEditCell={() => {}}
          soloLectura
          trabajadorFijoId={t.id}
        />
      </div>

      {/* Lista cronológica */}
      <Card>
        <CardContent className="p-0">
          {jornadasMes.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No tienes días registrados en este mes.
            </p>
          ) : (
            <ul className="divide-y">
              {jornadasMes.map((j) => {
                const valor = valorJornada(j, t);
                const liquidada = j.liquidacionId !== null;
                return (
                  <li key={j.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{formatFecha(j.fecha, "EEEE d 'de' MMM")}</p>
                      <p className="text-xs text-muted-foreground">
                        {j.tipo === "completo"
                          ? "Día completo"
                          : j.tipo === "medio"
                            ? "Medio día"
                            : "No trabajado"}
                        {j.tarifaOverride !== null && (
                          <Badge variant="outline" className="ml-2 border-warning/40 text-warning">
                            ⚡ especial
                          </Badge>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num font-semibold">{valor > 0 ? formatCOP(valor) : "—"}</p>
                      <Badge
                        variant={liquidada ? "secondary" : "outline"}
                        className="mt-1 text-[10px]"
                      >
                        {liquidada ? "Pagado" : "Pendiente"}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num text-base font-semibold ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}