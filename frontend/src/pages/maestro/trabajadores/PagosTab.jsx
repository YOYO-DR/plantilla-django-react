// Pestaña "Pagos" del detalle de trabajador (Fase 7).
// Lista las liquidaciones de este trabajador con enlace al comprobante.

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FileText, Lock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useData } from "@/context/DataContext";
import { formatCOP, formatFecha } from "@/lib/format";

export function PagosTab({ trabajador }) {
  const { liquidaciones } = useData();

  const liqs = useMemo(
    () =>
      liquidaciones
        .filter((l) => l.trabajadorId === trabajador.id)
        .sort((a, b) => (a.periodoInicio < b.periodoInicio ? 1 : -1)),
    [liquidaciones, trabajador.id],
  );

  if (liqs.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aún no hay pagos registrados para {trabajador.nombre}.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="display text-base">Historial de pagos</CardTitle>
        <p className="text-xs text-muted-foreground">
          Los pagos son inmutables. Para corregir errores usa un movimiento de ajuste.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pago #</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Devengado</TableHead>
              <TableHead className="text-right">Descontado</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liqs.map((l) => (
              <TableRow key={l.id}>
                <TableCell>
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    #{l.consecutivo}
                  </Badge>
                </TableCell>
                <TableCell>
                  <p className="text-sm">
                    {formatFecha(l.periodoInicio, "dd/MM")} – {formatFecha(l.periodoFin, "dd/MM/yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.modoDescuento === "ninguno"
                      ? "Sin descuento"
                      : l.modoDescuento === "total"
                        ? "Descuento total"
                        : "Descuento parcial"}
                  </p>
                </TableCell>
                <TableCell className="text-right num">{formatCOP(l.subtotalJornadas)}</TableCell>
                <TableCell className="text-right num text-success">
                  {l.montoDescontado > 0 ? formatCOP(l.montoDescontado) : "—"}
                </TableCell>
                <TableCell className="text-right num font-semibold">
                  {formatCOP(l.totalPagado)}
                </TableCell>
                <TableCell>
                  <p className="text-sm">{l.fechaPago ? formatFecha(l.fechaPago, "dd/MM/yyyy") : "—"}</p>
                  {l.estado === "pagada" && (
                    <Badge variant="secondary" className="gap-1">
                      <Lock className="h-3 w-3" /> Pagado
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/app/maestro/pagos/${l.id}`}>
                      <FileText className="mr-1 h-3.5 w-3.5" />
                      Comprobante
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}