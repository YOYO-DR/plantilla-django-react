// Pestaña Resumen: tarjetas con KPIs del mes + mini historial de las
// últimas 4 semanas.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Wallet, CalendarDays, Banknote, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SemanaDots } from "@/components/shared/SemanaDots";

import { useData } from "@/context/DataContext";
import { formatCOP } from "@/lib/format";
import {
  diasDeSemana,
  finSemana,
  inicioSemana,
  mesActualISO,
  restarSemanas,
} from "@/lib/fechas";
import { saldoDeuda, totalJornadas } from "@/lib/calculo";

export function ResumenTab({ trabajador }) {
  const { jornadas, movimientos } = useData();

  const jsTrabajador = useMemo(
    () => jornadas.filter((j) => j.trabajadorId === trabajador.id),
    [jornadas, trabajador.id],
  );
  const movsTrabajador = useMemo(
    () => movimientos.filter((m) => m.trabajadorId === trabajador.id),
    [movimientos, trabajador.id],
  );

  // Mes actual
  const mesActual = useMemo(() => mesActualISO(), []);
  const jornadasMes = jsTrabajador.filter(
    (j) => j.fecha >= mesActual.desde && j.fecha <= mesActual.hasta,
  );
  const diasTrabajadosMes = jornadasMes.filter((j) => j.tipo !== "no_trabajo").length;
  const devengadoMes = totalJornadas(jornadasMes, trabajador);
  const deudaActual = Math.max(0, saldoDeuda(movsTrabajador));

  // Promedio semanal: últimas 4 semanas, suma de valor de jornadas / 4
  const promedioSemanal = useMemo(() => {
    const inicio = restarSemanas(inicioSemana(new Date().toISOString()), 3);
    const fin = finSemana(new Date().toISOString());
    const lista = jsTrabajador.filter((j) => j.fecha >= inicio && j.fecha <= fin);
    return lista.length === 0 ? 0 : totalJornadas(lista, trabajador) / 4;
  }, [jsTrabajador, trabajador]);

  // 4 últimas semanas
  const semanas = useMemo(() => {
    const out = [];
    for (let i = 3; i >= 0; i--) {
      const hoy = new Date().toISOString();
      const inicio = restarSemanas(inicioSemana(hoy), i);
      const fin = finSemana(inicio);
      out.push({ key: `${inicio}_${i}`, inicio, fin, dias: diasDeSemana(inicio) });
    }
    return out;
  }, []);

  const tarjetas = [
    {
      label: "Devengado del mes",
      value: formatCOP(devengadoMes),
      icon: Banknote,
      color: "text-success",
    },
    {
      label: "Días trabajados (mes)",
      value: String(diasTrabajadosMes),
      icon: CalendarDays,
      color: "text-info",
    },
    {
      label: "Deuda actual",
      value: formatCOP(deudaActual),
      icon: Wallet,
      color: deudaActual > 0 ? "text-destructive" : "text-muted-foreground",
    },
    {
      label: "Promedio / semana",
      value: formatCOP(promedioSemanal),
      icon: TrendingUp,
      color: "text-primary",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <Card key={t.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{t.label}</p>
                <p className={`mt-1 text-xl font-semibold num ${t.color}`}>{t.value}</p>
              </div>
              <t.icon className={`h-8 w-8 opacity-50 ${t.color}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas 4 semanas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {semanas.map((s) => {
            const jornadasSem = jsTrabajador.filter((j) => j.fecha >= s.inicio && j.fecha <= s.fin);
            const totalSem = totalJornadas(jornadasSem, trabajador);
            const pagada = jornadasSem.length > 0 && jornadasSem.every((j) => j.liquidacionId !== null);
            return (
              <div
                key={s.key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <SemanaDots dias={s.dias} jornadas={jornadasSem} trabajador={trabajador} />
                  <span className="text-xs text-muted-foreground">
                    {s.inicio.slice(8, 10)}/{s.inicio.slice(5, 7)} – {s.fin.slice(8, 10)}/
                    {s.fin.slice(5, 7)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {pagada && jornadasSem.length > 0 ? (
                    <Badge variant="outline" className="border-success/30 text-success">
                      Pagada
                    </Badge>
                  ) : jornadasSem.length > 0 ? (
                    <Badge variant="outline">Pendiente</Badge>
                  ) : (
                    <Badge variant="secondary">Sin días</Badge>
                  )}
                  <span className="font-semibold num">{formatCOP(totalSem)}</span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Salto rápido</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="secondary">Oficio: {trabajador.oficio}</Badge>
          <Badge variant="secondary">Tarifa día: {formatCOP(trabajador.tarifaDiaBase)}</Badge>
          <Badge variant="secondary">Medio día: {formatCOP(Math.round(trabajador.tarifaDiaBase * trabajador.factorMedioDia))}</Badge>
          <Badge variant="secondary">
            Factor: <span className="ml-1 num">{trabajador.factorMedioDia}</span>
          </Badge>
          <Link
            to={`/app/maestro/jornadas?trabajador=${trabajador.id}`}
            className="text-xs text-primary hover:underline ml-auto self-center"
          >
            Ver todas las jornadas →
          </Link>
        </CardContent>
        <Skeleton className="hidden" />
      </Card>
    </div>
  );
}
