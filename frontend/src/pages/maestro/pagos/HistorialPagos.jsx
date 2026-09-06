// Historial de pagos — lista, filtros, y acción de anular.
//
// F1 (alcance cerrado):
// - Lista de pagos desde GET /api/payments/, paginada por filtro de fecha
//   y trabajador en cliente (el backend ya soporta filtros, los usamos).
// - Filtro por estado: vigentes / anulados / todos. Los anulados se siguen
//   viendo en la lista, marcados como tal — un pago anulado es un
//   registro de auditoría, no se esconde (Anexo B, decisión cerrada).
// - Acción "Anular" con POST /api/payments/{id}/void/. Soft-delete: el
//   backend marca voided_at + voided_by y revierte saldos.
//
// Bloqueado por serializer ampliado:
// - Desglose por jornada (workday_details) y por préstamo (loan_details)
//   dentro de cada fila. El backend ya está ampliando el serializer;
//   cuando llegue el payload, se enchufa en la sección "Detalle" sin
//   tocar el resto.
// - voided_by con nombre del usuario. Hoy solo sabemos que el pago fue
//   anulado (voided_at presente), no por quién. Cuando llegue el campo,
//   lo pintamos junto a la fecha.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Lock, RotateCcw, Ban, History, ListTree, CalendarDays, Banknote } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useData } from "@/context/DataContext";
import { workersService } from "@/api/workersService";
import { parseApiError } from "@/api/errorMessage";
import { formatCOP, formatFecha } from "@/lib/format";

export function HistorialPagos() {
  const { trabajadores, usuario } = useData();
  const qc = useQueryClient();

  const [fTrabajador, setFTrabajador] = useState("todos");
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [estado, setEstado] = useState("vigentes");
  const [aAnular, setAAnular] = useState(null);
  const [detalleDe, setDetalleDe] = useState(null);

  // Pedimos todos los pagos de la org (con filtros por fecha). El backend
  // aplica el scoping por organización; el de fecha va en el query string.
  const rangoMes = useMemo(() => {
    if (!mes) return {};
    const [y, m] = mes.split("-");
    const inicio = `${y}-${m}-01`;
    const lastDay = new Date(Number(y), Number(m), 0).getDate();
    const fin = `${y}-${m}-${String(lastDay).padStart(2, "0")}`;
    return { payment_date__gte: inicio, payment_date__lte: fin };
  }, [mes]);

  const workersQ = useQuery({
    queryKey: ["workers"],
    queryFn: () => workersService.list(),
    enabled: false, // ya viene del DataContext, solo si quisiéramos forzar refetch
  });
  // Usamos los trabajadores del DataContext; listamos pagos por org y
  // filtramos en cliente por trabajador para no saturar el backend con
  // N queries si el maestro cambia el filtro a menudo.
  const paymentsQ = useQuery({
    queryKey: ["payments", rangoMes],
    queryFn: () => workersService.listPayments(rangoMes),
  });

  const voidMut = useMutation({
    mutationFn: (id) => workersService.voidPayment(id),
    onSuccess: () => {
      toast.success("Pago anulado. Los saldos se revertieron.");
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
      qc.invalidateQueries({ queryKey: ["workdays"] });
      setAAnular(null);
    },
    onError: (err) => {
      const parsed = parseApiError(err);
      toast.error(parsed.message);
    },
  });

  const trabajadoresMap = useMemo(() => {
    const m = new Map();
    for (const t of trabajadores) m.set(t.id, t);
    return m;
  }, [trabajadores]);

  const filtrados = useMemo(() => {
    const lista = paymentsQ.data ?? [];
    return lista
      .filter((p) => {
        if (fTrabajador !== "todos" && p.worker !== Number(fTrabajador)) return false;
        if (estado === "vigentes" && p.voided_at) return false;
        if (estado === "anulados" && !p.voided_at) return false;
        return true;
      })
      .sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1));
  }, [paymentsQ.data, fTrabajador, estado]);

  const cancelarAnular = () => {
    setAAnular(null);
  };
  const confirmarAnular = () => {
    if (!aAnular) return;
    voidMut.mutate(aAnular.id);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-3 sm:grid-cols-[1fr_1fr_1fr]">
          <div className="space-y-1">
            <Label className="text-xs">Trabajador</Label>
            <Select value={fTrabajador} onValueChange={setFTrabajador}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {trabajadores.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mes</Label>
            <Input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vigentes">Vigentes</SelectItem>
                <SelectItem value="anulados">Anulados</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {paymentsQ.isLoading ? (
        <Card>
          <CardContent className="space-y-2 py-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </CardContent>
        </Card>
      ) : paymentsQ.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Ban className="h-10 w-10 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {parseApiError(paymentsQ.error).message}
            </p>
            <Button variant="outline" onClick={() => paymentsQ.refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <History className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {estado === "anulados"
                ? "No hay pagos anulados en este período."
                : estado === "vigentes"
                  ? "No hay pagos vigentes en este período."
                  : "No hay pagos que coincidan con el filtro."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Trabajador</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-44"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((p) => {
                  const t = trabajadoresMap.get(p.worker);
                  const anulado = !!p.voided_at;
                  return (
                    <TableRow
                      key={p.id}
                      className={anulado ? "opacity-60" : undefined}
                    >
                      <TableCell className="num text-muted-foreground">
                        #{p.id}
                      </TableCell>
                      <TableCell className="font-medium">
                        {t?.nombre ?? "—"}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {formatFecha(p.payment_date, "dd/MM/yyyy")}
                        </p>
                        {p.notes ? (
                          <p className="text-xs text-muted-foreground">
                            {p.notes}
                          </p>
                        ) : null}
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
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" /> Vigente
                          </Badge>
                        )}
                        {anulado && p.voided_at ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatFecha(p.voided_at, "dd/MM/yyyy HH:mm")}
                            {p.voided_by ? (
                              <>
                                {" · "}
                                {p.voided_by}
                              </>
                            ) : null}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/app/maestro/pagos/${p.id}`}>
                              <FileText className="mr-1 h-3.5 w-3.5" />{" "}
                              Comprobante
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetalleDe(p)}
                          >
                            <ListTree className="mr-1 h-3.5 w-3.5" /> Detalle
                          </Button>
                          {!anulado && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => setAAnular(p)}
                            >
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />{" "}
                              Anular
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={!!aAnular}
        onOpenChange={(o) => {
          if (!o) cancelarAnular();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Anular este pago?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a anular el pago{" "}
              <strong>#{aAnular?.id}</strong> por{" "}
              <strong className="num">
                {formatCOP(aAnular?.total_amount ?? 0)}
              </strong>
              . Los saldos se revertirán: las jornadas cubiertas vuelven a
              quedar pendientes y los préstamos abonados recuperan el saldo.
              El comprobante queda marcado como anulado por auditoría;{" "}
              <strong>esta acción no se puede deshacer</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voidMut.isPending}>
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarAnular}
              disabled={voidMut.isPending}
            >
              {voidMut.isPending ? "Anulando…" : "Sí, anular"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detalle del pago (desglose) */}
      <Dialog
        open={!!detalleDe}
        onOpenChange={(o) => !o && setDetalleDe(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Pago #{detalleDe?.id}
              {detalleDe?.voided_at ? (
                <Badge variant="destructive" className="ml-2">
                  Anulado
                </Badge>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {formatCOP(detalleDe?.total_amount ?? 0)} ·{" "}
              {formatFecha(detalleDe?.payment_date, "dd/MM/yyyy")}
            </DialogDescription>
          </DialogHeader>

          <section className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="h-4 w-4" />
              Jornadas cubiertas
            </h4>
            {detalleDe?.workday_details?.length ? (
              <ul className="space-y-1 text-sm">
                {detalleDe.workday_details.map((d) => (
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
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <Banknote className="h-4 w-4" />
              Abonos a préstamos
            </h4>
            {detalleDe?.loan_details?.length ? (
              <ul className="space-y-1 text-sm">
                {detalleDe.loan_details.map((d) => (
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

          {detalleDe?.notes ? (
            <p className="text-xs text-muted-foreground">
              <strong>Notas:</strong> {detalleDe.notes}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
