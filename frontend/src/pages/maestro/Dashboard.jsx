// Dashboard del maestro — "¿qué pasa esta semana?".
//
// Regla del plan: los montos vienen del backend. Cada tarjeta pinta un
// agregado de /api/workers/{id}/balance/ (sin recalcular nada en cliente).
// Conteo de jornadas sí es client-side, pero no es monto.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  CalendarDays,
  Banknote,
  AlertOctagon,
  CalendarCheck,
  Wallet,
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
import { useWorkersBalances } from "@/lib/useWorkersBalances";
import { fromCents, toCents } from "@/lib/cents";
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
  const { trabajadores, jornadas } = useData();

  const inicio = useMemo(() => inicioSemana(hoyISO()), []);
  const fin = useMemo(() => finSemana(inicio), [inicio]);
  const dias = useMemo(() => diasDeSemana(inicio), [inicio]);

  const activos = useMemo(
    () => trabajadores.filter((t) => t.estado === "activo"),
    [trabajadores],
  );

  const { balances, isLoading: balancesLoading } = useWorkersBalances(
    activos.map((t) => t.id),
  );

  // ---- KPIs agregados a partir del balance del backend ------------------

  const kpis = useMemo(() => {
    let adeudadoCents = 0;
    let prestamosCents = 0;
    for (const t of activos) {
      const b = balances[t.id];
      if (!b) continue;
      adeudadoCents += toCents(b.adeudado_workdays);
      prestamosCents += toCents(b.saldo_prestamos);
    }

    // Días marcados esta semana (no requiere monto).
    const idsActivos = new Set(activos.map((t) => t.id));
    const enSemana = jornadas.filter(
      (j) =>
        j.fecha >= inicio &&
        j.fecha <= fin &&
        idsActivos.has(j.trabajadorId) &&
        j.tipo !== "no_trabajo",
    );

    return {
      totalActivos: activos.length,
      adeudado: fromCents(adeudadoCents),
      prestamos: fromCents(prestamosCents),
      diasMarcados: enSemana.length,
      diasPosibles: activos.length * 7,
    };
  }, [activos, balances, jornadas, inicio, fin]);

  // ---- Resumen por trabajador -------------------------------------------

  const resumenSemana = useMemo(() => {
    return activos.map((t) => {
      const jsSem = jornadas.filter(
        (j) =>
          j.trabajadorId === t.id &&
          j.fecha >= inicio &&
          j.fecha <= fin,
      );
      const b = balances[t.id];
      return {
        t,
        balance: b,
        dias: jsSem,
        deudaCents: b ? toCents(b.saldo_prestamos) : 0,
      };
    });
  }, [activos, balances, jornadas, inicio, fin]);

  // ---- Estados vacíos -------------------------------------------------

  if (activos.length === 0 && trabajadores.length === 0) {
    return <EstadoVacioCuadrilla />;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="display text-2xl font-semibold sm:text-3xl">
          Buenas, {usuario?.nombre?.split(" ")[0] ?? "maestro"}.
        </h1>
        <p className="text-sm text-muted-foreground">
          {tenant?.nombre} · {formatearSemanaLarga(inicio, fin)}
        </p>
      </header>

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
          label="Total pendiente por pagar"
          value={
            <span className="num">
              {balancesLoading ? "…" : formatCOP(kpis.adeudado)}
            </span>
          }
          icon={Banknote}
          tono={toCents(kpis.adeudado) > 0 ? "success" : "muted"}
          destacado
        />
        <KpiCard
          label="Préstamos activos"
          value={
            <span className="num">
              {balancesLoading ? "…" : formatCOP(kpis.prestamos)}
            </span>
          }
          icon={AlertOctagon}
          tono={toCents(kpis.prestamos) > 0 ? "danger" : "muted"}
        />
      </div>

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
              No tienes trabajadores activos. Crea el primero desde el botón
              "Agregar trabajador".
            </p>
          ) : (
            resumenSemana.map(({ t, balance, dias: js, deudaCents }) => (
              <Link
                key={t.id}
                to={`/app/maestro/trabajadores/${t.id}`}
                className="group flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <AvatarIniciales nombre={t.nombre} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium">{t.nombre}</p>
                    <span className="font-semibold num">
                      {balance ? formatCOP(balance.adeudado_workdays) : "…"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="font-normal">
                      {t.oficio}
                    </Badge>
                    <span>·</span>
                    <SemanaDots dias={dias} jornadas={js} trabajador={t} size="sm" />
                    {deudaCents > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-destructive/30 text-destructive"
                      >
                        Deuda {formatCOP(balance.saldo_prestamos)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Separator />

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

function KpiCard({ label, value, icon: Icon, tono = "primary", destacado }) {
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
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p
            className={`mt-2 ${
              destacado ? "text-3xl" : "text-2xl"
            } font-bold leading-tight ${
              tono === "danger"
                ? "text-destructive"
                : tono === "success"
                  ? "text-success"
                  : ""
            }`}
          >
            {value}
          </p>
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${toneClasses[tono]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function AccesoRapido({ to, label, desc, icon: Icon }) {
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
      <h2 className="display mt-4 text-xl font-semibold">
        Aún no tienes trabajadores
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Crea tu primer trabajador para empezar a marcar jornadas y registrar
        préstamos. Le generaremos un usuario para que pueda ver su información
        en solo lectura.
      </p>
      <Button asChild className="mt-5 min-h-tap">
        <Link to="/app/maestro/trabajadores">
          <UserPlus className="mr-2 h-4 w-4" /> Agregar trabajador
        </Link>
      </Button>
    </div>
  );
}
