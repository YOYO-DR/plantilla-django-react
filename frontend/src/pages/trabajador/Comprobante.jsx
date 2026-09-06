// Comprobante del trabajador — solo lectura.
//
// Detalle de un pago del trabajador: GET /api/payments/{id}/. Sin
// acciones; el comprobante es inmutable. Si está anulado se muestra
// el badge y la fecha de anulación.

import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Ban, CalendarDays, Banknote, Info } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { workersService } from "@/api/workersService";
import { formatCOP, formatFecha, formatFechaLarga } from "@/lib/format";
import { parseApiError } from "@/api/errorMessage";

export default function TrabajadorComprobante() {
  const { id } = useParams();
  const navigate = useNavigate();

  const pagoQ = useQuery({
    queryKey: ["payment", id],
    queryFn: () => workersService.getPayment(id),
    enabled: id != null,
  });

  if (pagoQ.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8">
          <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }
  if (pagoQ.isError) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          asChild
          className="min-h-tap w-fit -ml-2"
        >
          <button onClick={() => navigate("/app/trabajador/pagos")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Mis pagos
          </button>
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-destructive">
            {parseApiError(pagoQ.error).message}
          </CardContent>
        </Card>
      </div>
    );
  }

  const p = pagoQ.data;
  const anulado = !!p?.voided_at;

  return (
    <div className="space-y-4 pb-4">
      <Button
        variant="ghost"
        asChild
        className="min-h-tap w-fit -ml-2"
      >
        <button onClick={() => navigate("/app/trabajador/pagos")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Mis pagos
        </button>
      </Button>

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Comprobante</p>
              <h1 className="display text-2xl font-semibold">Pago #{p.id}</h1>
              <p className="text-sm text-muted-foreground">
                {formatFechaLarga(p.payment_date)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="display text-3xl font-bold num text-primary">
                {formatCOP(p.total_amount)}
              </p>
              {anulado ? (
                <Badge variant="destructive" className="mt-1 gap-1">
                  <Ban className="h-3 w-3" /> Anulado
                </Badge>
              ) : (
                <Badge variant="secondary" className="mt-1">
                  Vigente
                </Badge>
              )}
            </div>
          </div>

          {anulado && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-semibold">Pago anulado</p>
              <p className="text-xs text-muted-foreground">
                {formatFecha(p.voided_at, "dd/MM/yyyy HH:mm")}
                {p.voided_by ? ` · ${p.voided_by}` : ""}
              </p>
            </div>
          )}

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4" /> Jornadas cubiertas
            </h3>
            {p.workday_details?.length ? (
              <ul className="space-y-1 text-sm">
                {p.workday_details.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded border bg-card px-3 py-1.5"
                  >
                    <span>
                      {formatFecha(d.workday?.date, "dd/MM/yyyy")} ·{" "}
                      <span className="text-muted-foreground">
                        {d.workday?.workday_type?.name ?? "—"}
                      </span>
                    </span>
                    <span className="num font-semibold">
                      {formatCOP(d.applied_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Este pago no cubre jornadas.
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Banknote className="h-4 w-4" /> Abonos a préstamos
            </h3>
            {p.loan_details?.length ? (
              <ul className="space-y-1 text-sm">
                {p.loan_details.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between rounded border bg-card px-3 py-1.5"
                  >
                    <span>
                      Préstamo #{d.loan?.id}
                      {d.loan?.reason ? (
                        <span className="ml-2 text-muted-foreground">
                          {d.loan.reason}
                        </span>
                      ) : null}
                    </span>
                    <span className="num font-semibold">
                      {formatCOP(d.paid_amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Este pago no abona préstamos.
              </p>
            )}
          </section>

          {p.notes ? (
            <p className="text-xs text-muted-foreground">
              <strong>Notas:</strong> {p.notes}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Este comprobante es solo de consulta. Es inmutable.</span>
      </div>
    </div>
  );
}
