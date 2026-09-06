// Diálogo para registrar un préstamo.
//
// F1: solo modo "prestamo". La creación se hace con POST /api/loans/.
// El backend rechaza con 400 si los datos son inválidos y con 409 si hay
// conflicto (e.g. préstamo sobre un trabajador ya pagado, etc.); el
// helper `parseApiError` se usa para mostrar mensajes distintos.
//
// "abono" y "ajuste" eran modos legacy que operaban sobre el viejo
// `MovimientoDeuda`. Se cubren hoy vía el wizard de liquidación.

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useData } from "@/context/DataContext";
import { workersService } from "@/api/workersService";
import { parseApiError } from "@/api/errorMessage";
import { numeroMiles, parseMiles } from "@/lib/usuarios";
import { formatCOP } from "@/lib/format";
import { hoyISO } from "@/lib/fechas";
import { useMediaQuery } from "@/components/shared/useMediaQuery";

const CONCEPTOS_PRESTAMO = [
  "Adelanto de quincena",
  "Mercado",
  "Salud",
  "Arriendo",
  "Transporte",
  "Herramienta",
  "Otro…",
];

const RAPIDOS_PRESTAMO = [50000, 100000, 200000];

const PrestamoSchema = z.object({
  fecha: z.string().min(1, "Selecciona una fecha"),
  monto: z.coerce.number().positive("Ingresa un monto mayor a 0"),
  reason: z.string().trim().min(3, "Describe el motivo (mínimo 3 caracteres)"),
});

export function DialogoMovimiento({
  open,
  onOpenChange,
  modo = "prestamo",
  trabajadorId,
  nombreTrabajador,
  onGuardado,
}) {
  // Por ahora solo se implementa "prestamo". Si alguien nos llama con
  // otro modo, lo rechazamos visiblemente.
  if (modo !== "prestamo") {
    return null;
  }

  const { trabajadores } = useData();
  const qc = useQueryClient();
  const esMovil = useMediaQuery("(max-width: 1023px)");

  const [tId, setTId] = useState(trabajadorId ?? "");
  const [montoTexto, setMontoTexto] = useState("");
  const [otroReason, setOtroReason] = useState("");

  useEffect(() => {
    if (open) {
      setTId(trabajadorId ?? "");
      setMontoTexto("");
      setOtroReason("");
    }
  }, [open, trabajadorId]);

  const form = useForm({
    resolver: zodResolver(PrestamoSchema),
    defaultValues: { fecha: hoyISO(), monto: 0, reason: "" },
  });

  const createMut = useMutation({
    mutationFn: (payload) => workersService.createLoan(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loans"] });
      qc.invalidateQueries({ queryKey: ["balance"] });
      toast.success("Préstamo registrado.");
      onGuardado?.();
      onOpenChange(false);
    },
    onError: (err) => {
      const parsed = parseApiError(err);
      if (parsed.status === 400 && parsed.fieldErrors) {
        // pinta el primer error de campo bajo su input via react-hook-form
        for (const [field, msgs] of Object.entries(parsed.fieldErrors)) {
          form.setError(field, { type: "server", message: msgs.join(", ") });
        }
      }
      toast.error(parsed.message);
    },
  });

  const onSubmit = (data) => {
    if (!tId) {
      toast.error("Selecciona un trabajador.");
      return;
    }
    const reasonFinal =
      data.reason === "Otro…" ? otroReason.trim() || "Préstamo" : data.reason;
    createMut.mutate({
      worker: parseInt(tId, 10),
      amount: String(data.monto),
      date: data.fecha,
      reason: reasonFinal,
    });
  };

  const contenido = (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {!trabajadorId && (
        <div className="space-y-1.5">
          <Label>Trabajador</Label>
          <select
            value={tId}
            onChange={(e) => setTId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="">Selecciona trabajador</option>
            {trabajadores
              .filter((t) => t.estado === "activo")
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
          </select>
          {form.formState.errors.worker ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.worker.message}
            </p>
          ) : null}
        </div>
      )}

      {nombreTrabajador && (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Trabajador</p>
          <p className="font-semibold">{nombreTrabajador}</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"
            type="date"
            {...form.register("fecha")}
            aria-invalid={!!form.formState.errors.fecha}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="monto">Monto (COP)</Label>
          <Input
            id="monto"
            inputMode="numeric"
            placeholder="50.000"
            value={montoTexto}
            onChange={(e) => {
              const text = e.target.value;
              if (!/^[\d.]*$/.test(text)) return;
              setMontoTexto(text);
              const n = parseMiles(text);
              form.setValue("monto", n, { shouldValidate: true });
            }}
            className="num"
            aria-invalid={!!form.formState.errors.monto}
          />
          <div className="mt-1 flex flex-wrap gap-1">
            {RAPIDOS_PRESTAMO.map((v) => (
              <Button
                key={v}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs num"
                onClick={() => {
                  setMontoTexto(numeroMiles(v));
                  form.setValue("monto", v, { shouldValidate: true });
                }}
              >
                {formatCOP(v)}
              </Button>
            ))}
          </div>
          {form.formState.errors.monto ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.monto.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="reason">Motivo</Label>
        <select
          id="reason"
          value={form.watch("reason") ?? ""}
          onChange={(e) =>
            form.setValue("reason", e.target.value, { shouldValidate: true })
          }
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          <option value="">Elige o escribe el motivo</option>
          {CONCEPTOS_PRESTAMO.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {(form.watch("reason") === "Otro…" || !form.watch("reason")) && (
          <Input
            placeholder="Describe el motivo…"
            value={otroReason}
            onChange={(e) => {
              setOtroReason(e.target.value);
              form.setValue("reason", e.target.value, { shouldValidate: true });
            }}
          />
        )}
        {form.formState.errors.reason ? (
          <p className="text-xs text-destructive">
            {form.formState.errors.reason.message}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={createMut.isPending}>
          {createMut.isPending ? "Registrando…" : "Registrar préstamo"}
        </Button>
      </div>
    </form>
  );

  if (esMovil) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[100dvh] overflow-y-auto rounded-t-xl p-0">
          <SheetHeader className="sticky top-0 z-10 border-b bg-background/95 px-4 py-4">
            <SheetTitle className="display text-lg">Registrar préstamo</SheetTitle>
            <SheetDescription>
              Otorga un nuevo préstamo a un trabajador activo.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 py-4">{contenido}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-full max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-background/95 px-6 py-4">
          <DialogTitle className="display text-lg">Registrar préstamo</DialogTitle>
          <DialogDescription>
            Otorga un nuevo préstamo a un trabajador activo.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-100px)] overflow-y-auto px-6 py-4">
          {contenido}
        </div>
      </DialogContent>
    </Dialog>
  );
}
