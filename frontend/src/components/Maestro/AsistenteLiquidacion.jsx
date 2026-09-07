// Asistente de liquidación en 3 pasos: revisar días → descuento → confirmar.
//
// Regla de Fase D (plan §2 + Anexo B): los montos vienen del backend. La UI
// no suma nada por su cuenta. Tres fuentes:
//
//   - GET  /api/workers/{id}/balance/        → workdays[], loans[], totales.
//   - POST /api/payments/preview/            → totales en vivo con debounce.
//   - POST /api/payments/                    → registra y devuelve el pago.
//
// El preview re-usa ``RegisterPaymentSerializer`` y comparte la función pura
// de cálculo con el registro, así que ``preview.total_amount`` ==
// ``register.total_amount`` por construcción.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check,
  CircleDot,
  Minus,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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

import { workersService } from "@/api/workersService";
import { catalogsService } from "@/api/catalogsService";
import { formatCOP, formatFecha } from "@/lib/format";
import { numeroMiles, parseMiles } from "@/lib/usuarios";
import { useMediaQuery } from "@/components/shared/useMediaQuery";

const PREVIEW_DEBOUNCE_MS = 300;

export function AsistenteLiquidacion({
  open,
  onOpenChange,
  trabajador,
  onConfirmado,
}) {
  const esMovil = useMediaQuery("(max-width: 1023px)");
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ---- Estado de UI (sin dinero) ---------------------------------

  const [paso, setPaso] = useState(1);
  const [modo, setModo] = useState("ninguno");
  const [fechaPago, setFechaPago] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [paymentMethodId, setPaymentMethodId] = useState(null);
  const [observaciones, setObservaciones] = useState("");
  const [confirmar, setConfirmar] = useState(false);

  // Selección de jornadas (set de ids) y abonos a préstamos (mapa id→string).
  const [selectedWorkdayIds, setSelectedWorkdayIds] = useState(() => new Set());
  const [loanAllocations, setLoanAllocations] = useState({});

  // ---- Balance (fuente de verdad de display) ----------------------

  const balanceQ = useQuery({
    queryKey: ["balance", trabajador?.id],
    queryFn: () => workersService.balance(trabajador.id),
    enabled: open && !!trabajador?.id,
    retry: false,
    // staleTime: 0 fuerza refetch cada vez que el query se vuelve a
    // habilitar (al abrir el wizard). Necesario porque el componente
    // nunca se desmonta — solo cambia `open` — y refetchOnMount no
    // se activa en ese caso.
    staleTime: 0,
  });

  // Catálogo de métodos de pago (para el <select> del paso 3).
  const paymentMethodsQ = useQuery({
    queryKey: ["catalogs", "payment-methods"],
    queryFn: () => catalogsService.paymentMethods(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  // Inicializa selección cuando llega el balance. Mantener el id estable.
  useEffect(() => {
    if (!balanceQ.data) return;
    setSelectedWorkdayIds(
      new Set(balanceQ.data.workdays.map((w) => w.id)),
    );
    const init = {};
    for (const loan of balanceQ.data.loans) init[loan.id] = "0";
    setLoanAllocations(init);
  }, [balanceQ.data]);

  // Default al primer método de pago disponible.
  useEffect(() => {
    if (
      paymentMethodId == null &&
      Array.isArray(paymentMethodsQ.data) &&
      paymentMethodsQ.data.length > 0
    ) {
      setPaymentMethodId(paymentMethodsQ.data[0].id);
    }
  }, [paymentMethodsQ.data, paymentMethodId]);

  // Reset al cerrar.
  useEffect(() => {
    if (!open) {
      setPaso(1);
      setModo("ninguno");
      setObservaciones("");
      setConfirmar(false);
    }
  }, [open]);

  // Atajo UX: aplicar el modo a las allocations (excepto parcial, donde el
  // usuario edita manualmente). Re-corre solo cuando cambia el modo o llega
  // un balance nuevo.
  useEffect(() => {
    if (!balanceQ.data) return;
    if (modo === "parcial") return;
    const next = {};
    for (const loan of balanceQ.data.loans) {
      if (modo === "total") {
        // número → string con separador de miles para el input
        next[loan.id] = numeroMiles(parseFloat(loan.outstanding_balance) || 0);
      } else {
        next[loan.id] = "0";
      }
    }
    setLoanAllocations(next);
  }, [modo, balanceQ.data]);

  // ---- Body del preview (lo que se manda al backend) --------------

  const previewBody = useMemo(() => {
    if (!balanceQ.data || paymentMethodId == null) return null;
    const allocations = [];
    for (const [loanId, raw] of Object.entries(loanAllocations)) {
      const cleaned = String(raw).replace(/\./g, "").replace(",", ".");
      const num = parseFloat(cleaned);
      if (Number.isFinite(num) && num > 0) {
        allocations.push({
          loan: parseInt(loanId, 10),
          amount: cleaned,
        });
      }
    }
    return {
      worker: trabajador.id,
      payment_method: paymentMethodId,
      payment_date: fechaPago,
      workday_ids: [...selectedWorkdayIds],
      loan_allocations: allocations,
    };
  }, [
    balanceQ.data,
    paymentMethodId,
    selectedWorkdayIds,
    loanAllocations,
    fechaPago,
    trabajador.id,
  ]);

  // Debounce del body para no disparar un POST por cada keystroke.
  const [debouncedBody, setDebouncedBody] = useState(null);
  useEffect(() => {
    if (!previewBody) {
      setDebouncedBody(null);
      return;
    }
    const t = setTimeout(
      () => setDebouncedBody(previewBody),
      PREVIEW_DEBOUNCE_MS,
    );
    return () => clearTimeout(t);
  }, [previewBody]);

  // ---- Preview (totales en vivo desde el backend) -----------------

  const previewQ = useQuery({
    queryKey: ["paymentPreview", debouncedBody],
    queryFn: () => workersService.previewPayment(debouncedBody),
    enabled: !!debouncedBody && balanceQ.data != null,
    retry: false,
  });

  // ---- Mutación de registro --------------------------------------

  const registerMut = useMutation({
    mutationFn: (body) => workersService.registerPayment(body),
    onSuccess: (payment) => {
      toast.success(`Pago #${payment.id} registrado.`, {
        description: `Total: ${formatCOP(payment.total_amount)}.`,
        action: {
          label: (
            <span className="inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Comprobante
            </span>
          ),
          onClick: () => navigate(`/app/maestro/pagos/${payment.id}`),
        },
      });
      qc.invalidateQueries({ queryKey: ["balance", trabajador.id] });
      qc.invalidateQueries({ queryKey: ["workdays"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      setConfirmar(false);
      onOpenChange(false);
      onConfirmado?.(payment);
    },
    onError: (err) => {
      toast.error(err?.message ?? "Error al registrar el pago");
    },
  });

  const confirmarPago = () => {
    if (!previewBody) return;
    registerMut.mutate(previewBody);
  };

  // ---- Render ----------------------------------------------------

  const balance = balanceQ.data;
  const preview = previewQ.data;
  const previewError = previewQ.error;

  const toggleWorkday = (id) => {
    setSelectedWorkdayIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setLoanAmount = (loanId, raw) => {
    // Solo dígitos y puntos (separador de miles); el backend parsea el string.
    if (!/^[\d.]*$/.test(raw)) return;
    setLoanAllocations((prev) => ({ ...prev, [loanId]: raw }));
  };

  const contenido = (
    <div className="space-y-5">
      {/* Encabezado fijo del trabajador */}
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <p>
          <strong>{trabajador.nombre}</strong> ·{" "}
          <span className="text-muted-foreground">{trabajador.oficio}</span>
        </p>
        <div className="mt-2 flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-2 flex-1 rounded-full ${
                n <= paso ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Paso 1 — revisar días */}
      {paso === 1 && (
        <div className="space-y-3">
          <h3 className="display text-base font-semibold">Revisar días</h3>

          {/* Panel de balance: fuente de verdad del backend */}
          {balanceQ.isLoading ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
              Cargando balance del backend…
            </p>
          ) : balance ? (
            <div className="rounded-md border border-info/40 bg-info/5 p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Balance oficial del backend
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Jornadas</p>
                  <p className="num font-semibold">
                    {formatCOP(balance.adeudado_workdays)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Préstamos</p>
                  <p className="num font-semibold">
                    {formatCOP(balance.saldo_prestamos)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Neto</p>
                  <p className="num font-semibold text-primary">
                    {formatCOP(balance.neto_a_pagar)}
                  </p>
                </div>
              </div>
              {typeof balance.pendientes_count === "number" ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {balance.pendientes_count} jornadas pendientes
                </p>
              ) : null}
            </div>
          ) : null}

          {!balance ? null : balance.workdays.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              No hay jornadas pendientes.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Día</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Tarifa</TableHead>
                  <TableHead className="text-right">Ya pagado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balance.workdays.map((w) => {
                  const checked = selectedWorkdayIds.has(w.id);
                  return (
                    <TableRow
                      key={w.id}
                      className={checked ? "" : "opacity-60"}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          aria-label={`Marcar jornada ${w.id}`}
                          checked={checked}
                          onChange={() => toggleWorkday(w.id)}
                          className="h-4 w-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatFecha(w.date, "dd/MM")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatFecha(w.date, "EEE")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {w.workday_type?.name?.toLowerCase().includes(
                            "medio",
                          ) ? (
                            <CircleDot className="h-4 w-4 text-info" />
                          ) : w.workday_type?.name?.toLowerCase().includes(
                              "completo",
                            ) ? (
                            <Check className="h-4 w-4 text-success" />
                          ) : (
                            <Minus className="h-4 w-4 text-muted-strong" />
                          )}
                          <span className="text-xs">
                            {w.workday_type?.name ?? "—"}
                          </span>
                        </div>
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
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Subtotal en vivo desde el preview */}
          <div className="flex justify-end rounded-md border bg-primary/5 px-3 py-2 text-sm">
            <span className="mr-2 text-muted-foreground">Subtotal devengado</span>
            <strong className="num text-primary">
              {preview
                ? formatCOP(preview.subtotal_workdays)
                : balance
                  ? formatCOP(balance.adeudado_workdays)
                  : "—"}
            </strong>
          </div>
        </div>
      )}

      {/* Paso 2 — descuento */}
      {paso === 2 && balance && (
        <div className="space-y-3">
          <h3 className="display text-base font-semibold">Descuento de deuda</h3>
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs text-muted-foreground">Saldo actual</p>
            <p className="display text-2xl font-bold num text-destructive">
              {formatCOP(balance.saldo_prestamos)}
            </p>
          </div>

          <div className="space-y-2">
            {([
              {
                key: "ninguno",
                titulo: "No descontar nada",
                desc: "Pagas el subtotal completo, la deuda no se toca.",
              },
              {
                key: "total",
                titulo: "Descontar toda la deuda",
                desc: `Cada préstamo se lleva su saldo completo (${formatCOP(
                  balance.saldo_prestamos,
                )}).`,
              },
              {
                key: "parcial",
                titulo: "Descontar una parte",
                desc: "Editas el monto por préstamo abajo.",
              },
            ]).map((op) => (
              <button
                key={op.key}
                onClick={() => setModo(op.key)}
                className={`w-full rounded-md border p-3 text-left transition-colors ${
                  modo === op.key
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <p className="font-medium">{op.titulo}</p>
                <p className="text-xs text-muted-foreground">{op.desc}</p>
              </button>
            ))}
          </div>

          {/* Lista de préstamos activos (input por préstamo) */}
          {balance.loans.length > 0 && (
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Préstamos activos
              </p>
              {balance.loans.map((loan) => {
                const after =
                  preview?.saldo_prestamos_despues?.[String(loan.id)];
                return (
                  <div
                    key={loan.id}
                    className="grid grid-cols-[1fr_auto] items-center gap-2 rounded border bg-background p-2"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {loan.reason || `Préstamo #${loan.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Saldo:{" "}
                        <span className="num">
                          {formatCOP(loan.outstanding_balance)}
                        </span>
                        {after != null ? (
                          <>
                            {" → "}
                            <span className="num text-success">
                              {formatCOP(after)}
                            </span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <Input
                      inputMode="numeric"
                      placeholder="0"
                      value={loanAllocations[loan.id] ?? "0"}
                      onChange={(e) => setLoanAmount(loan.id, e.target.value)}
                      className="num w-28 text-right"
                      aria-label={`Abono a préstamo ${loan.id}`}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {previewError ? (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-destructive">
                {previewError?.message ?? "El preview rechazó los valores."}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-3 text-center">
            <Celda label="Devengado" valor={preview?.subtotal_workdays} />
            <Celda
              label="Descuento"
              valor={preview?.total_abonos_prestamos}
              tone="success"
            />
            <Celda
              label="A pagar"
              valor={preview?.total_amount}
              tone="primary"
              highlight
            />
          </div>
        </div>
      )}

      {/* Paso 3 — confirmar */}
      {paso === 3 && (
        <div className="space-y-3">
          <h3 className="display text-base font-semibold">Confirmar pago</h3>
          <div className="space-y-2 rounded-md border bg-card p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Devengado</span>
              <span className="num font-semibold">
                {formatCOP(preview?.subtotal_workdays)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descuento</span>
              <span className="num text-success">
                {formatCOP(preview?.total_abonos_prestamos)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base">
              <strong>A pagar</strong>
              <strong className="num text-primary">
                {formatCOP(preview?.total_amount)}
              </strong>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fechaPago">Fecha de pago</Label>
              <Input
                id="fechaPago"
                type="date"
                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paymentMethod">Método de pago</Label>
              <select
                id="paymentMethod"
                value={paymentMethodId ?? ""}
                onChange={(e) =>
                  setPaymentMethodId(
                    e.target.value ? parseInt(e.target.value, 10) : null,
                  )
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {(paymentMethodsQ.data ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observaciones</Label>
            <Textarea
              id="obs"
              rows={3}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Anotaciones opcionales sobre el pago"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">Modo: {modo}</Badge>
            <Badge variant="outline">
              Jornadas a pagar: {selectedWorkdayIds.size}
            </Badge>
            <Badge variant="outline">
              Abonos a préstamo: {preview?.total_abonos_prestamos
                ? formatCOP(preview.total_abonos_prestamos)
                : "$ 0"}
            </Badge>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <Button
          variant="ghost"
          onClick={() => (paso === 1 ? onOpenChange(false) : setPaso(paso - 1))}
        >
          {paso === 1 ? "Cancelar" : "← Anterior"}
        </Button>
        {paso < 3 ? (
          <Button
            onClick={() => setPaso(paso + 1)}
            disabled={
              (paso === 1 &&
                (!balance ||
                  balance.workdays.length === 0 ||
                  selectedWorkdayIds.size === 0)) ||
              (paso === 2 && !preview)
            }
            className="min-h-tap"
          >
            Siguiente →
          </Button>
        ) : (
          <Button
            onClick={() => setConfirmar(true)}
            disabled={!preview || registerMut.isPending}
            className="min-h-tap"
            variant="default"
          >
            Confirmar pago
          </Button>
        )}
      </div>

      {/* Confirmación final */}
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar esta liquidación?</AlertDialogTitle>
            <AlertDialogDescription>
              Al confirmar, las{" "}
              <strong>{selectedWorkdayIds.size} jornadas</strong> marcadas
              quedarán bloqueadas
              {preview?.total_abonos_prestamos &&
              parseFloat(preview.total_abonos_prestamos) > 0 ? (
                <>
                  {" "}
                  y se abonará{" "}
                  <strong className="num">
                    {formatCOP(preview.total_abonos_prestamos)}
                  </strong>{" "}
                  a préstamos
                </>
              ) : null}
              . El comprobante será inmutable. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={registerMut.isPending}>
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarPago}
              disabled={registerMut.isPending}
            >
              {registerMut.isPending ? "Registrando…" : "Sí, liquidar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  // Título/descripción del modal o sheet
  const Title = () => (
    <>
      {paso === 1 && "Paso 1 · Revisar días"}
      {paso === 2 && "Paso 2 · Deuda"}
      {paso === 3 && "Paso 3 · Confirmar"}
    </>
  );
  const Desc = () => (
    <>
      {paso === 1 && "Marca las jornadas que vas a liquidar."}
      {paso === 2 && "Decide cuánto descuento aplicar a la deuda."}
      {paso === 3 && "Confirma el pago."}
    </>
  );

  if (esMovil) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[100dvh] overflow-y-auto rounded-t-xl p-0"
        >
          <SheetHeader className="sticky top-0 z-10 border-b bg-background/95 px-4 py-4">
            <SheetTitle className="display text-lg">
              <Title />
            </SheetTitle>
            <SheetDescription>
              <Desc />
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 py-4">{contenido}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-full max-w-3xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-background/95 px-6 py-4">
          <DialogTitle className="display text-lg">
            <Title />
          </DialogTitle>
          <DialogDescription>
            <Desc />
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-100px)] overflow-y-auto px-6 py-4">
          {contenido}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Celda({ label, valor, tone, highlight }) {
  const t = {
    muted: "text-muted-foreground",
    success: "text-success",
    primary: "text-primary",
  }[tone ?? "muted"];
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={`num font-bold ${t} ${highlight ? "text-2xl" : "text-lg"}`}
      >
        {valor != null ? formatCOP(valor) : "—"}
      </p>
    </div>
  );
}
