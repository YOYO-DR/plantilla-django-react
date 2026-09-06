// Pestaña "Mi cuadrilla" (sólo maestro). Datos básicos + resumen.

import { useMemo } from "react";
import { Building2, Phone, MapPin, Wallet, Calendar, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { formatCOP } from "@/lib/format";

export function MiCuadrillaTab() {
  const { tenant } = useAuth();
  const { trabajadores, liquidaciones } = useData();

  const activos = useMemo(
    () => trabajadores.filter((t) => t.estado === "activo").length,
    [trabajadores],
  );
  const liquidacionesPagadas = useMemo(
    () => liquidaciones.filter((l) => l.estado === "pagada"),
    [liquidaciones],
  );
  const semanasRegistradas = new Set(
    liquidacionesPagadas.map((l) => l.periodoInicio),
  ).size;
  const totalPagadoHistorico = liquidacionesPagadas.reduce(
    (acc, l) => acc + l.totalPagado,
    0,
  );

  if (!tenant) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="display text-base">Mi cuadrilla</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo icon={Building2} label="Nombre" value={tenant.nombre} />
          <Campo icon={MapPin} label="Ciudad" value={tenant.ciudad ?? "—"} />
          <Campo icon={Phone} label="Teléfono" value={tenant.telefono ?? "—"} />
        </div>

        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Tarifa base sugerida</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="display text-2xl font-bold num">$ 80.000</span>
            <span className="text-sm text-muted-foreground">por día · ajustable al crear</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Sugerencia para nuevos trabajadores; siempre editable.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResStat icon={Users} label="Activos" value={String(activos)} />
          <ResStat icon={Calendar} label="Semanas registradas" value={String(semanasRegistradas)} />
          <ResStat icon={Wallet} label="Total pagado histórico" value={formatCOP(totalPagadoHistorico)} highlight />
          <ResStat icon={Building2} label="Estado" value="Activa" />
        </div>

        <p className="text-xs text-muted-foreground">
          La edición detallada de la cuadrilla y las tarifas sugeridas por oficio se entregarán
          en la Fase 11 (panel del admin).
        </p>
      </CardContent>
    </Card>
  );
}

function Campo({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="rounded-md border bg-card/60 p-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function ResStat({
  icon: Icon,
  label,
  value,
  highlight,
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className={`mt-1 text-lg font-bold num ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}