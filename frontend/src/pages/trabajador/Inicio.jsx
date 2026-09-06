// Inicio del portal del trabajador (Fase 8 / R8 sólo lectura).
// Diseñada para el celular: tipografía grande, tarjetas compactas.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  TrendingUp,
  CheckCircle2,
  Receipt,
  Info,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { useTrabajadorActual } from "@/context/useTrabajadorActual";
import { formatCOP, formatFecha } from "@/lib/format";
import {
  diasDeSemana,
  finSemana,
  hoyISO,
  inicioSemana,
  nombreDiaCorto,
} from "@/lib/fechas";
import { totalJornadas, saldoDeuda } from "@/lib/calculo";

export default function TrabajadorInicio() {
  const { usuario, tenant } = useAuth();
  const { jornadas, movimientos, liquidaciones } = useData();
  const t = useTrabajadorActual();

  const inicio = useMemo(() => inicioSemana(hoyISO()), []);
  const fin = useMemo(() => finSemana(inicio), [inicio]);
  const dias = useMemo(() => diasDeSemana(inicio), [inicio]);

  const jsSemana = useMemo(
    () => jornadas.filter((j) => j.fecha >= inicio && j.fecha <= fin),
    [jornadas, inicio, fin],
  );
  const diasCompletos = jsSemana.filter((j) => j.tipo === "completo").length;
  const mediosDias = jsSemana.filter((j) => j.tipo === "medio").length;
  const totalSemana = useMemo(() => {
    if (!t) return 0;
    return totalJornadas(jsSemana, t);
  }, [jsSemana, t]);

  const saldo = useMemo(() => Math.max(0, saldoDeuda(movimientos)), [movimientos]);
  const ultimoMov = useMemo(() => {
    return [...movimientos].sort((a, b) => (a.fecha > b.fecha ? -1 : 1))[0] ?? null;
  }, [movimientos]);

  const ultimoPago = useMemo(() => {
    return [...liquidaciones]
      .filter((l) => l.estado === "pagada")
      .sort((a, b) =>
        (a.fechaPago ?? a.creadoEn) > (b.fechaPago ?? b.creadoEn) ? -1 : 1,
      )[0] ?? null;
  }, [liquidaciones]);

  if (!t) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No se encontró tu información de trabajador.
        </CardContent>
      </Card>
    );
  }

  const medioDiaValor = Math.round(t.tarifaDiaBase * t.factorMedioDia);

  return (
    <div className="space-y-5 pb-4">
      {/* Encabezado */}
      <header className="space-y-1">
        <p className="text-base text-muted-foreground">Hola, {t.nombre.split(" ")[0]}.</p>
        <h1 className="display text-2xl font-semibold sm:text-3xl">
          Esta es tu info en {tenant?.nombre ?? "tu cuadrilla"}.
        </h1>
        {usuario?.nombre && (
          <p className="text-sm text-muted-foreground">
            Registrada por <strong>{usuario.nombre}</strong>.
          </p>
        )}
      </header>

      {/* Tarjeta principal — esta semana llevas */}
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
            {formatCOP(totalSemana)}
          </p>
          <p className="text-sm text-muted-foreground">
            {diasCompletos} {diasCompletos === 1 ? "día completo" : "días completos"} ·{" "}
            {mediosDias} medio{mediosDias === 1 ? "" : "s"}
          </p>
          <Separator />
          <div className="grid grid-cols-7 gap-1.5">
            {dias.map((fecha) => {
              const j = jsSemana.find((x) => x.fecha === fecha);
              const tipo = j?.tipo ?? null;
              const colors = {
                completo: "bg-success text-success-foreground border-success",
                medio: "bg-info text-info-foreground border-info",
                no_trabajo: "bg-muted-strong/30 text-muted-foreground border-muted-strong/40",
                "": "border-dashed border-muted-foreground/40 text-muted-foreground",
              };
              const colorKey = tipo ?? "";
              return (
                <div
                  key={fecha}
                  className={`flex h-12 flex-col items-center justify-center rounded-md border text-[10px] font-semibold ${colors[colorKey]}`}
                  title={`${fecha} · ${tipo ?? "sin marca"}`}
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

      {/* Otras tarjetas */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Deuda */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Tu deuda
              </p>
            </div>
            {saldo === 0 ? (
              <p className="inline-flex items-center gap-2 text-2xl font-bold text-success">
                <CheckCircle2 className="h-6 w-6" /> Estás al día
              </p>
            ) : (
              <p className="display text-3xl font-bold num text-destructive">
                {formatCOP(saldo)}
              </p>
            )}
            {ultimoMov && (
              <p className="text-xs text-muted-foreground">
                Último movimiento: {ultimoMov.tipo === "prestamo" ? "Préstamo" : "Abono"} ·{" "}
                {formatFecha(ultimoMov.fecha, "dd/MM/yyyy")}
              </p>
            )}
            <Button asChild variant="outline" className="min-h-tap w-full">
              <Link to="/app/trabajador/deuda">Ver detalle</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Jornal */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Tu jornal
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold num">{formatCOP(t.tarifaDiaBase)}</p>
              <p className="text-xs text-muted-foreground">Día completo</p>
              <p className="text-base font-semibold num">
                {formatCOP(medioDiaValor)}{" "}
                <span className="text-xs text-muted-foreground">medio día</span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">Definido por tu maestro.</p>
          </CardContent>
        </Card>

        {/* Último pago */}
        <Card className="sm:col-span-2">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Último pago
              </p>
            </div>
            {ultimoPago ? (
              <div className="space-y-1">
                <p className="display text-3xl font-bold num text-primary">
                  {formatCOP(ultimoPago.totalPagado)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Pago #{ultimoPago.consecutivo} ·{" "}
                  {formatFecha(ultimoPago.fechaPago ?? ultimoPago.periodoFin, "dd 'de' MMMM 'de' yyyy")}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aún no hay pagos registrados.</p>
            )}
            <Button asChild variant="outline" className="min-h-tap w-full">
              <Link to="/app/trabajador/pagos">Ver mis pagos</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Esta información la registra tu maestro. Si ves algo que no cuadra, háblalo
          directamente con él.
        </span>
      </div>
    </div>
  );
}