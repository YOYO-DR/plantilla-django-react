// Inicio del portal del trabajador — solo lectura.
//
// Lee el balance del backend (GET /api/workers/{id}/balance/) y muestra
// los totales oficiales. Cero aritmética en cliente: ni jornadas, ni
// movimientos, ni liquidaciones pasan por aquí.

import { Link } from "react-router-dom";
import {
  Wallet,
  TrendingUp,
  CheckCircle2,
  Receipt,
  Info,
  Wallet2,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { useAuth } from "@/context/AuthContext";
import { useMiBalance } from "@/lib/useMiBalance";
import { formatCOP } from "@/lib/format";
import {
  diasDeSemana,
  finSemana,
  hoyISO,
  inicioSemana,
  nombreDiaCorto,
} from "@/lib/fechas";
import { parseApiError } from "@/api/errorMessage";

export default function TrabajadorInicio() {
  const { usuario, tenant } = useAuth();
  const balanceQ = useMiBalance();

  const inicio = inicioSemana(hoyISO());
  const fin = finSemana(inicio);
  const dias = diasDeSemana(inicio);

  if (!usuario?.trabajadorId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No se encontró tu información de trabajador.
        </CardContent>
      </Card>
    );
  }

  if (balanceQ.isLoading) {
    return <EsqueletoCargando />;
  }
  if (balanceQ.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-destructive">
          {parseApiError(balanceQ.error).message}
        </CardContent>
      </Card>
    );
  }

  const balance = balanceQ.data;
  if (!balance) {
    return null;
  }

  const totalSemanaCents = balance.workdays
    .filter((w) => w.date >= inicio && w.date <= fin)
    .reduce((acc, w) => acc + parseCents(w.pendiente), 0);

  const diasCompletos = balance.workdays.filter(
    (w) =>
      w.date >= inicio &&
      w.date <= fin &&
      w.workday_type?.name?.toLowerCase().includes("completo"),
  ).length;
  const mediosDias = balance.workdays.filter(
    (w) =>
      w.date >= inicio &&
      w.date <= fin &&
      w.workday_type?.name?.toLowerCase().includes("medio"),
  ).length;

  return (
    <div className="space-y-5 pb-4">
      <header className="space-y-1">
        <p className="text-base text-muted-foreground">
          Hola, {(usuario.nombre ?? usuario.email).split(" ")[0]}.
        </p>
        <h1 className="display text-2xl font-semibold sm:text-3xl">
          Esta es tu info en {tenant?.nombre ?? "tu cuadrilla"}.
        </h1>
      </header>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-3 p-5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Esta semana llevas
            </p>
            <Badge variant="default" className="capitalize">
              {nombreDiaCorto(inicio)} – {nombreDiaCorto(fin)}
            </Badge>
          </div>
          <p className="display text-5xl font-bold leading-none num text-primary">
            {formatCOP(fromCents(totalSemanaCents))}
          </p>
          <p className="text-sm text-muted-foreground">
            {diasCompletos} {diasCompletos === 1 ? "día completo" : "días completos"} ·{" "}
            {mediosDias} medio{mediosDias === 1 ? "" : "s"}
          </p>
          <Separator />
          <div className="grid grid-cols-7 gap-1.5">
            {dias.map((fecha) => {
              const j = balance.workdays.find((w) => w.date === fecha);
              const tipo = j?.workday_type?.name?.toLowerCase().includes("medio")
                ? "medio"
                : j?.workday_type?.name?.toLowerCase().includes("completo")
                  ? "completo"
                  : j
                    ? "no_trabajo"
                    : "";
              const colors = {
                completo: "bg-success text-success-foreground border-success",
                medio: "bg-info text-info-foreground border-info",
                no_trabajo: "bg-muted-strong/30 text-muted-foreground border-muted-strong/40",
                "": "border-dashed border-muted-foreground/40 text-muted-foreground",
              };
              return (
                <div
                  key={fecha}
                  className={`flex h-12 flex-col items-center justify-center rounded-md border text-[10px] font-semibold ${colors[tipo]}`}
                  title={`${fecha} · ${j ? j.workday_type.name : "sin marca"}`}
                >
                  <span>{nombreDiaCorto(fecha)}</span>
                  <span className="font-normal">{fecha.slice(8, 10)}</span>
                </div>
              );
            })}
          </div>
          <Button asChild className="min-h-tap w-full">
            <Link to="/app/trabajador/dias">Ver todos mis días</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Tu deuda
              </p>
            </div>
            {parseCents(balance.saldo_prestamos) === 0 ? (
              <p className="inline-flex items-center gap-2 text-2xl font-bold text-success">
                <CheckCircle2 className="h-6 w-6" /> Estás al día
              </p>
            ) : (
              <p className="display text-3xl font-bold num text-destructive">
                {formatCOP(balance.saldo_prestamos)}
              </p>
            )}
            <Button asChild variant="outline" className="min-h-tap w-full">
              <Link to="/app/trabajador/deuda">Ver detalle</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Wallet2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Total adeudado
              </p>
            </div>
            <p className="display text-3xl font-bold num">
              {formatCOP(balance.adeudado_workdays)}
            </p>
            <p className="text-xs text-muted-foreground">
              {balance.pendientes_count} jornadas pendientes
            </p>
            <Button asChild variant="outline" className="min-h-tap w-full">
              <Link to="/app/trabajador/dias">Ver mis días</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Lo que se te entregaría
              </p>
            </div>
            <p className="display text-3xl font-bold num text-primary">
              {formatCOP(balance.neto_a_pagar)}
            </p>
            <p className="text-xs text-muted-foreground">
              jornadas adeudadas + saldo de préstamos. Calculado por el backend.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Esta información la registra tu maestro. Si ves algo que no cuadra,
          háblalo directamente con él.
        </span>
      </div>
    </div>
  );
}

function EsqueletoCargando() {
  return (
    <div className="space-y-4">
      <div className="h-32 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-24 animate-pulse rounded-md bg-muted" />
        <div className="h-24 animate-pulse rounded-md bg-muted" />
      </div>
    </div>
  );
}

// Helpers de centavos (copia mínima; centralizar en /lib/cents si crece).
function parseCents(amount) {
  if (amount == null) return 0;
  const s = String(amount);
  const [ent, dec = ""] = s.split(".");
  const padded = (dec + "00").slice(0, 2);
  const sign = ent.startsWith("-") ? -1 : 1;
  const abs = ent.replace("-", "") || "0";
  return sign * (parseInt(abs, 10) * 100 + parseInt(padded || "0", 10));
}
function fromCents(c) {
  const sign = c < 0 ? "-" : "";
  const abs = Math.abs(c);
  const ent = Math.floor(abs / 100);
  const dec = abs % 100;
  return `${sign}${ent}.${String(dec).padStart(2, "0")}`;
}
