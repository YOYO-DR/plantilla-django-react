// Dashboard global del admin de plataforma (Fase 10 §10.1).
// Agrega datos cross-tenant via `todosLosTenants` y las colecciones
// que DataContext ahora expone completas para rol `admin`.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Users,
  CalendarDays,
  Banknote,
  AlertOctagon,
  ChevronRight,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { useData } from "@/context/DataContext";
import { formatCOP, formatFecha } from "@/lib/format";
import { saldoDeuda } from "@/lib/calculo";
import { resumirSemanaParaChart } from "@/lib/adminStats";

export default function AdminDashboard() {
  const {
    todosLosTenants,
    todosLosUsuarios,
    trabajadores,
    jornadas,
    movimientos,
    liquidaciones,
  } = useData();

  const kpis = useMemo(() => {
    const tenantsActivos = todosLosTenants.filter((t) => t.estado === "activo").length;
    const maestros = todosLosUsuarios.filter((u) => u.rol === "maestro").length;
    const trabT = trabajadores.length;
    const mes = new Date().toISOString().slice(0, 7);
    const jornadasMes = jornadas.filter(
      (j) => j.fecha.startsWith(mes) && j.liquidacionId === null,
    ).length;
    const pagadas = liquidaciones.filter((l) => l.estado === "pagada");
    const pagosMes = pagadas.reduce((acc, l) => {
      const fp = l.fechaPago ?? l.creadoEn;
      if (fp.startsWith(mes)) return acc + l.totalPagado;
      return acc;
    }, 0);
    let deudaTotal = 0;
    for (const t of trabajadores) {
      const ms = movimientos.filter((m) => m.trabajadorId === t.id && m.liquidacionId === null);
      deudaTotal += Math.max(0, saldoDeuda(ms));
    }
    return {
      tenantsActivos,
      maestros,
      trabajadores: trabT,
      jornadasMes,
      pagosMes,
      deudaTotal,
    };
  }, [todosLosTenants, todosLosUsuarios, trabajadores, jornadas, movimientos, liquidaciones]);

  // Gráficas
  const jornadasPorSemana = useMemo(
    () => resumirSemanaParaChart(jornadas, new Date(), 10),
    [jornadas],
  );

  const pagosPorTenant = useMemo(() => {
    const inicioMes = startOfMonth(new Date()).toISOString().slice(0, 10);
    const finMes = endOfMonth(new Date()).toISOString().slice(0, 10);
    const map = new Map();
    for (const t of todosLosTenants) map.set(t.id, 0);
    for (const l of liquidaciones) {
      if (l.estado !== "pagada") continue;
      const t = todosLosTenants.find((x) => x.id === l.tenantId);
      if (!t) continue;
      const fp = l.fechaPago ?? l.creadoEn;
      if (fp >= inicioMes && fp <= finMes) {
        map.set(t.id, (map.get(t.id) ?? 0) + l.totalPagado);
      }
    }
    return Array.from(map.entries()).map(([id, monto]) => ({
      nombre: todosLosTenants.find((t) => t.id === id)?.nombre ?? id,
      monto,
    }));
  }, [liquidaciones, todosLosTenants]);

  const crecimientoTrabajadores = useMemo(() => {
    const counts = [];
    const semanas = 10;
    for (let i = semanas - 1; i >= 0; i--) {
      const inicio = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1, locale: es });
      const fin = parseISO(inicio.toISOString().slice(0, 10));
      // En esta versión los trabajadores son creados al inicio del seed,
      // así que el crecimiento es plano — dejamos la forma intacta.
      const total = trabajadores.filter(
        (t) => t.fechaIngreso <= fin.toISOString().slice(0, 10),
      ).length;
      counts.push({
        semana: format(inicio, "dd MMM", { locale: es }),
        total,
      });
    }
    return counts;
  }, [trabajadores]);

  // Actividad reciente — últimas 8
  const actividad = useMemo(() => {
    const out = [];
    for (const l of liquidaciones) {
      if (l.estado !== "pagada") continue;
      const t = todosLosTenants.find((x) => x.id === l.tenantId);
      const trab = trabajadores.find((x) => x.id === l.trabajadorId);
      out.push({
        ts: new Date(l.fechaPago ?? l.creadoEn).getTime(),
        tipo: "Pago",
        label: `Pago #${l.consecutivo} · ${t?.nombre ?? "?"} · ${trab?.nombre ?? "?"}`,
        ref: `/app/admin/tenants/${l.tenantId}`,
      });
    }
    for (const t of trabajadores) {
      out.push({
        ts: new Date(t.fechaIngreso).getTime(),
        tipo: "Alta",
        label: `Alta: ${t.nombre} (${todosLosTenants.find((x) => x.id === t.tenantId)?.nombre ?? "?"})`,
        ref: `/app/admin/tenants/${t.tenantId}`,
      });
    }
    for (const m of movimientos.filter((m) => m.tipo === "prestamo").slice(-30)) {
      const t = trabajadores.find((x) => x.id === m.trabajadorId);
      out.push({
        ts: new Date(m.fecha).getTime(),
        tipo: "Préstamo",
        label: `Préstamo · ${t?.nombre ?? "?"} · ${formatCOP(m.monto)}`,
        ref: `/app/admin/tenants/${m.tenantId}`,
      });
    }
    out.sort((a, b) => b.ts - a.ts);
    return out.slice(0, 12);
  }, [liquidaciones, trabajadores, movimientos, todosLosTenants]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="display text-2xl font-semibold sm:text-3xl">Panel de plataforma</h1>
        <p className="text-sm text-muted-foreground">
          Vista agregada de todas las cuadrillas, maestros y liquidaciones.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Cuadrillas activas" value={String(kpis.tenantsActivos)} icon={Building2} tone="primary" />
        <Kpi label="Maestros" value={String(kpis.maestros)} icon={Users} tone="info" />
        <Kpi label="Trabajadores" value={String(kpis.trabajadores)} icon={Users} tone="muted" />
        <Kpi label="Jornadas (mes)" value={String(kpis.jornadasMes)} icon={CalendarDays} tone="muted" />
        <Kpi label="Pagado (mes)" value={formatCOP(kpis.pagosMes)} icon={Banknote} tone="success" />
        <Kpi label="Deuda vigente" value={formatCOP(kpis.deudaTotal)} icon={AlertOctagon} tone="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Jornadas por semana */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jornadas registradas por semana</CardTitle>
            <p className="text-xs text-muted-foreground">Últimas 10 semanas · todas las cuadrillas</p>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={jornadasPorSemana}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="semana" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "0.8rem",
                    }}
                  />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Crecimiento */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crecimiento de trabajadores</CardTitle>
            <p className="text-xs text-muted-foreground">Total acumulado por semana (últimas 10)</p>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={crecimientoTrabajadores}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="semana" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "0.8rem",
                    }}
                  />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--info))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pago del mes por tenant */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pagado este mes por cuadrilla</CardTitle>
            <p className="text-xs text-muted-foreground">Suma de liquidaciones pagadas con fecha de pago en el mes actual.</p>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={pagosPorTenant}
                  layout="vertical"
                  margin={{ left: 12, right: 24, top: 8, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    fontSize={11}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) => formatCOP(v)}
                  />
                  <YAxis type="category" dataKey="nombre" fontSize={11} width={140} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "0.8rem",
                    }}
                    formatter={(v) => formatCOP(Number(v))}
                  />
                  <Bar dataKey="monto" fill="hsl(var(--success))" radius={[0, 4, 4, 0]}>
                    {pagosPorTenant.map((_, i) => (
                      <Cell key={i} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actividad reciente */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Actividad reciente</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/admin/tenants">Ver cuadrillas</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {actividad.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin actividad reciente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuándo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actividad.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{formatFecha(new Date(it.ts).toISOString().slice(0, 10), "dd/MM/yyyy")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{it.tipo}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{it.label}</TableCell>
                    <TableCell>
                      <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                        <Link to={it.ref}>
                          Ver <ChevronRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
    danger: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-bold num">{value}</p>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardContent>
    </Card>
  );
}
