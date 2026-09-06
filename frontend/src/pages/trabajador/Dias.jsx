// Días del trabajador — solo lectura.
//
// Lista todas las jornadas del trabajador (pendientes + pagadas) usando
// el balance del backend (balance.workdays trae solo Pendiente y
// Parcial; los días pagados se ven a través del historial de pagos).
// Sin filtros por ahora; lectura completa del propio periodo.

import { CalendarDays, Info } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useMiBalance } from "@/lib/useMiBalance";
import { formatCOP, formatFecha } from "@/lib/format";
import { parseApiError } from "@/api/errorMessage";

export default function TrabajadorDias() {
  const balanceQ = useMiBalance();

  if (balanceQ.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2 py-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </CardContent>
      </Card>
    );
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

  const workdays = (balanceQ.data?.workdays ?? []).slice().sort((a, b) =>
    a.date < b.date ? 1 : -1,
  );

  return (
    <div className="space-y-5 pb-4">
      <header className="space-y-1">
        <h1 className="display text-2xl font-semibold sm:text-3xl">Mis días</h1>
        <p className="text-sm text-muted-foreground">
          Jornadas pendientes y parciales. Las pagadas aparecen en tu
          historial de pagos.
        </p>
      </header>

      {workdays.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No tienes días pendientes ni parciales.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Tarifa</TableHead>
                  <TableHead className="text-right">Ya pagado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workdays.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <p className="text-sm">{formatFecha(w.date, "dd/MM/yyyy")}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFecha(w.date, "EEEE")}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {w.workday_type?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right num">
                      {formatCOP(w.applied_rate)}
                    </TableCell>
                    <TableCell className="text-right num text-muted-foreground">
                      {formatCOP(w.ya_pagado)}
                    </TableCell>
                    <TableCell className="text-right num font-semibold">
                      {formatCOP(w.pendiente)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Esta pantalla es solo de consulta. Si algo no cuadra, habla con tu
          maestro.
        </span>
      </div>
    </div>
  );
}
