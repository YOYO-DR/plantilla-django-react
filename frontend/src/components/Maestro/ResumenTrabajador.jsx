// Fila de trabajador en el dashboard del maestro.
//
// Recibe un objeto "trabajador" con su balance ya resuelto (pasado como
// prop desde el padre para evitar N+1 de useQuery dentro del componente).
// El padre es responsable de haber llamado /api/workers/{id}/balance/
// antes de pasar la fila aquí.

import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { formatCOP } from "@/lib/format";

export function ResumenTrabajador({ resumen, dias }) {
  const { t, balance, deudaCents, diasCents } = resumen;
  return (
    <Link
      to={`/app/maestro/trabajadores/${t.id}`}
      className="group flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <AvatarIniciales nombre={t.nombre} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium">{t.nombre}</p>
          <span className="font-semibold num">
            {balance ? formatCOP(balance.adeudado_workdays) : "—"}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="font-normal">
            {t.oficio}
          </Badge>
          {dias ? (
            <span className="num">
              {dias.length} día{dias.length === 1 ? "" : "s"} esta semana
            </span>
          ) : null}
          {deudaCents > 0 ? (
            <Badge
              variant="outline"
              className="border-destructive/30 text-destructive"
            >
              Deuda {formatCOP(balance?.saldo_prestamos ?? 0)}
            </Badge>
          ) : null}
          {diasCents > 0 ? (
            <Badge variant="outline" className="border-info/30 text-info">
              Devengado semana {formatCOP(diasCents)}
            </Badge>
          ) : null}
        </div>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
