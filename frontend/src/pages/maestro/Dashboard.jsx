// Dashboard del maestro — "¿qué pasa esta semana?".
// Resumen KPI + tabla por trabajador + accesos rápidos + estado vacío.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  CalendarDays,
  Banknote,
  AlertOctagon,
  CalendarCheck,
  Wallet,
  Calculator,
  UserPlus,
  ArrowRight,
  HardHat,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { saldoDeuda, totalJornadas, valorJornada } from "@/lib/calculo";
import { formatearSemanaLarga } from "@/lib/usuarios";
import { formatCOP } from "@/lib/format";
import {
  diasDeSemana,
  finSemana,
  hoyISO,
  inicioSemana,
} from "@/lib/fechas";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { SemanaDots } from "@/components/shared/SemanaDots";

export default function MaestroDashboard() {
  const { usuario, tenant } = useAuth();
  const { trabajadores, jornadas, movimientos } = useData();

  const inicio = useMemo(() => inicioSemana(hoyISO()), []);
  const fin = useMemo(() => finSemana(inicio), [inicio]);
  const dias = useMemo(() => diasDeSemana(inicio), [inicio]);

  const trabajadoresActivos = useMemo(
    () => trabajadores.filter((t) => t.estado === "activo"),
    [trabajadores],
  );

  // ---------- KPIs ---------------------------------------------------------

  const kpis = useMemo(() => {
    const inicioActual = inicio;
    const finActual = fin;

    const jsSemana = jornadas.filter(
      (j) =>
        j.fecha >= inicioActual &&
        j.fecha <= finActual &&
        trabajadoresActivos.some((t) => t.id === j.trabajadorId),
    );

    // Días marcados (no no_trabajo)
    const diasMarcados = jsSemana.filter((j) => j.tipo !== "no_trabajo").length;
    const diasPosibles = trabajadoresActivos.length * 7;

    // Acumulado a pagar (jornadas no liquidadas)
    const acumuladoAPagar = jsSemana
      .filter((j) => j.liquidacionId === null)
      .reduce((acc, j) => {
        const t = trabajadoresActivos.find((t) => t.id === j.trabajadorId);
        return t ? acc + valorJornada(j, t) : acc;
      }, 0);

    // Deuda total vigente de la cuadrilla (sólo trabajadores activos)
    const deudaTotal = trabajadoresActivos.reduce((acc, t) => {
      const movs = movimientos.filter((m) => m.trabajadorId === t.id);
      return acc + Math.max(0, saldoDeuda(movs));
    }, 0);

    return {
      totalActivos: trabajadoresActivos.length,
      diasMarcados,
      diasPosibles,
      acumuladoAPagar,
      deudaTotal,
    };
  }, [inicio, fin, trabajadoresActivos, jornadas, movimientos]);

  // ---------- Resumen por trabajador ---------------------------------------

  const resumenSemana = useMemo(() => {
    return trabajadoresActivos.map((t) => {
      const jsSem = jornadas.filter(
        (j) =>
          j.trabajadorId === t.id &&
          j.fecha >= inicio &&
          j.fecha <= fin,
      );
      const totalSem = totalJornadas(jsSem, t);
      const movsT = movimientos.filter((m) => m.trabajadorId === t.id);
      const deuda = Math.max(0, saldoDeuda(movsT));
      return { t, jornadas: jsSem, total: totalSem, deuda };
    });
  }, [trabajadoresActivos, jornadas, movimientos, inicio, fin]);

  // ---------- Estado vacío -------------------------------------------------

  if (trabajadoresActivos.length === 0 && trabajadores.length === 0) {
    return <EstadoVacioCuadrilla />;
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <header className="space-y-1">
        <h1 className="display text-2xl font-semibold sm:text-3xl">
          Buenas, {usuario?.nombre?.split(" ")[0]}.
        </h1>
        <p className="text-sm text-muted-foreground">
          {tenant?.nombre} · {formatearSemanaLarga(inicio, fin)}
        </p>
      </header>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Trabajadores activos"
          value={String(kpis.totalActivos)}
          icon={Users}
          tono="primary"
        />
        <KpiCard
          label="Días marcados esta semana"
          value={
            <span className="num">
              {kpis.diasMarcados}{" "}
              <span className="text-base text-muted-foreground">
                / {kpis.diasPosibles}
              </span>
            </span>
          }
          icon={CalendarDays}
          tono="info"
        />
        <KpiCard
          label="Acumulado a pagar esta semana"
          value={<span className="num">{formatCOP(kpis.acumuladoAPagar)}</span>}
          icon={Banknote}
          tono={kpis.acumuladoAPagar > 0 ? "success" : "muted"}
          destacado
        />
        <KpiCard
          label="Deuda total vigente"
          value={<span className="num">{formatCOP(kpis.deudaTotal)}</span>}
          icon={AlertOctagon}
          tono={kpis.deudaTotal > 0 ? "danger" : "muted"}
        />
      </div>

      {/* Tabla resumen */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <CardTitle className="text-base">Resumen de la semana</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/maestro/trabajadores">
              Ver todos <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {resumenSemana.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No tienes trabajadores activos. Crea el primero desde el botón "Agregar
              trabajador".
            </p>
          ) : (
            resumenSemana.map(({ t, jornadas: js, total, deuda }) => (
              <Link
                key={t.id}
                to={`/app/maestro/trabajadores/${t.id}`}
                className="group flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <AvatarIniciales nombre={t.nombre} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{t.nombre}</p>
                    <span className="font-semibold num">{formatCOP(total)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-normal">
                      {t.oficio}
                    </Badge>
                    <span>·</span>
                    <SemanaDots dias={dias} jornadas={js} trabajador={t} size="sm" />
                    {deuda > 0 && (
                      <Badge
                        variant="outline"
                        className="border-destructive/30 text-destructive"
                      >
                        Deuda {formatCOP(deuda)}
                      </Badge>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Accesos rápidos */}
      <div>
        <h2 className="display text-lg font-semibold">Accesos rápidos</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <AccesoRapido
            to="/app/maestro/jornadas"
            label="Marcar días"
            desc="Calendario semanal"
            icon={CalendarCheck}
          />
          <AccesoRapido
            to="/app/maestro/prestamos"
            label="Registrar préstamo"
            desc="Adelantos"
            icon={Wallet}
          />
          <AccesoRapido
            to="/app/maestro/liquidaciones"
            label="Liquidar semana"
            desc="Calcular y pagar"
            icon={Calculator}
          />
          <AccesoRapido
            to="/app/maestro/trabajadores"
            label="Agregar trabajador"
            desc="Nuevo en la cuadrilla"
            icon={UserPlus}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  icon: Icon,
  tono = "primary",
  destacado,
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
    danger: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <Card className={destacado ? "border-primary/30" : undefined}>
      <CardContent className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`mt-2 ${destacado ? "text-3xl" : "text-2xl"} font-bold leading-tight ${tono === "danger" ? "text-destructive" : tono === "success" ? "text-success" : ""}`}>
            {value}
          </p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${toneClasses[tono]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function AccesoRapido({
  to,
  label,
  desc,
  icon: Icon,
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{desc}</p>
      </div>
      <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function EstadoVacioCuadrilla() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card/60 px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <HardHat className="h-9 w-9" />
      </div>
      <h2 className="display mt-4 text-xl font-semibold">Aún no tienes trabajadores</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Crea tu primer trabajador para empezar a marcar jornadas y registrar
        préstamos. Le generaremos un usuario para que pueda ver su información en
        solo lectura.
      </p>
      <Button asChild className="mt-5 min-h-tap">
        <Link to="/app/maestro/trabajadores">
          <UserPlus className="mr-2 h-4 w-4" /> Agregar trabajador
        </Link>
      </Button>
    </div>
  );
}