// Pagos del trabajador — solo lectura.
//
// Lista los pagos del trabajador desde GET /api/payments/?worker=X. Sin
// acciones de escritura; cada fila enlaza al comprobante.

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, Receipt, Info, Ban } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
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

import { useAuth } from "@/context/AuthContext";
import { workersService } from "@/api/workersService";
import { formatCOP, formatFecha } from "@/lib/format";
import { parseApiError } from "@/api/errorMessage";

export default function TrabajadorPagos() {
  const { usuario } = useAuth();
  const id = usuario?.trabajadorId ?? null;

  const paymentsQ = useQuery({
    queryKey: ["payments", "by-worker", id],
    queryFn: () => workersService.listPayments({ worker: id }),
    enabled: id != null,
    retry: false,
  });

  if (!id) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          No se encontró tu información de trabajador.
        </CardContent>
      </Card>
    );
  }

  if (paymentsQ.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-2 py-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </CardContent>
      </Card>
    );
  }
  if (paymentsQ.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-destructive">
          {parseApiError(paymentsQ.error).message}
        </CardContent>
      </Card>
    );
  }

  const lista = (Array.isArray(paymentsQ.data) ? paymentsQ.data : paymentsQ.data?.results ?? []).slice().sort((a, b) =>
    a.payment_date < b.payment_date ? 1 : -1,
  );

  return (
    <div className="space-y-5 pb-4">
      <header className="space-y-1">
        <h1 className="display text-2xl font-semibold sm:text-3xl">Mis pagos</h1>
        <p className="text-sm text-muted-foreground">
          Pagos que te ha registrado tu maestro. Los anulados se siguen
          mostrando para auditoría.
        </p>
      </header>

      {lista.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Aún no tienes pagos.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((p) => {
                  const anulado = !!p.voided_at;
                  return (
                    <TableRow
                      key={p.id}
                      className={anulado ? "opacity-60" : undefined}
                    >
                      <TableCell className="num text-muted-foreground">
                        #{p.id}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {formatFecha(p.payment_date, "dd/MM/yyyy")}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.payment_method ? `#${p.payment_method}` : "—"}
                      </TableCell>
                      <TableCell className="text-right num font-semibold">
                        {formatCOP(p.total_amount)}
                      </TableCell>
                      <TableCell>
                        {anulado ? (
                          <Badge variant="destructive" className="gap-1">
                            <Ban className="h-3 w-3" /> Anulado
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Vigente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/app/trabajador/comprobante/${p.id}`}>
                            <FileText className="mr-1 h-3.5 w-3.5" /> Comprobante
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Esta pantalla es solo de consulta. No tienes acción sobre tus pagos.
        </span>
      </div>
    </div>
  );
}
