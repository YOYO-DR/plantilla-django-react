// "Mis pagos" — lista de liquidaciones recibidas por el trabajador (sólo lectura).

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FileText, Lock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { useData } from "@/context/DataContext";
import { useTrabajadorActual } from "@/context/useTrabajadorActual";
import { formatCOP, formatFecha } from "@/lib/format";

export default function TrabajadorPagos() {
  const { liquidaciones } = useData();
  const t = useTrabajadorActual();

  const ordenadas = useMemo(() => {
    return [...liquidaciones]
      .filter((l) => l.estado === "pagada")
      .sort((a, b) => (a.periodoInicio < b.periodoInicio ? 1 : -1));
  }, [liquidaciones]);

  const totalesAnio = useMemo(() => {
    const anioActual = String(new Date().getFullYear());
    let devengado = 0;
    let descontado = 0;
    let pagado = 0;
    for (const l of ordenadas) {
      if ((l.fechaPago ?? l.creadoEn).startsWith(anioActual)) {
        devengado += l.subtotalJornadas;
        descontado += l.montoDescontado;
        pagado += l.totalPagado;
      }
    }
    return { devengado, descontado, pagado };
  }, [ordenadas]);

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
        <h1 className="display text-2xl font-semibold sm:text-3xl">Mis pagos</h1>
        <p className="text-sm text-muted-foreground">
          Historial de pagos realizados por tu maestro.
        </p>
      </header>

      {/* Totales del año */}
      <Card>
        <CardContent className="grid grid-cols-3 gap-2 p-3 text-center">
          <Stat label="Devengado" value={formatCOP(totalesAnio.devengado)} />
          <Stat label="Descontado" value={formatCOP(totalesAnio.descontado)} />
          <Stat label="Recibido" value={formatCOP(totalesAnio.pagado)} primary />
        </CardContent>
      </Card>

      {ordenadas.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aún no tienes pagos registrados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {ordenadas.map((l) => (
            <FilaPago key={l.id} l={l} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilaPago({ l }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <Badge variant="outline" className="border-primary/40 text-primary">
              Pago #{l.consecutivo}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatFecha(l.fechaPago ?? l.periodoFin, "dd 'de' MMMM 'de' yyyy")}
          </span>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Período</p>
          <p className="text-sm">
            {formatFecha(l.periodoInicio, "dd 'de' MMM")} –{" "}
            {formatFecha(l.periodoFin, "dd 'de' MMM 'de' yyyy")}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/30 p-3 text-center">
          <Stat label="Devengado" value={formatCOP(l.subtotalJornadas)} />
          <Stat label="Descontado" value={formatCOP(l.montoDescontado)} />
          <Stat label="Pagado" value={formatCOP(l.totalPagado)} primary />
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="gap-1">
            <Lock className="h-3 w-3" /> Comprobante inmutable
          </Badge>
          <Button asChild variant="outline" size="sm">
            <Link to={`/app/trabajador/pagos/${l.id}`}>
              <FileText className="mr-1 h-4 w-4" /> Ver comprobante
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  primary,
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`num text-base font-bold ${primary ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}