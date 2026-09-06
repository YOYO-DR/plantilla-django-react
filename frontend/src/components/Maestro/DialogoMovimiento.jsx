// Diálogo unificado para registrar un movimiento de deuda (préstamo, abono o
// ajuste). El modo se selecciona desde el padre. Aplica R4: nunca permite
// un abono mayor al saldo actual.

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from "@/components/ui/select";

import { useData } from "@/context/DataContext";
import { numeroMiles, parseMiles } from "@/lib/usuarios";
import { formatCOP } from "@/lib/format";
import { hoyISO } from "@/lib/fechas";
import { useMediaQuery } from "@/components/shared/useMediaQuery";

const CONCEPTOS_PRESTAMO = [
  "Préstamo para mercado",
  "Adelanto de quincena",
  "Préstamo de salud",
  "Préstamo para arriendo",
  "Transporte",
  "Herramienta",
  "Otro…",
];

const CONCEPTOS_ABONO = [
  "Abono en efectivo",
  "Abono por transferencia",
  "Otro…",
];

const CONCEPTOS_AJUSTE = [
  "-Corrección saldo",
  "-Compensa préstamo previo",
  "+Compensa abono previo",
  "Otro…",
];

const RAPIDOS_PRESTAMO = [50000, 100000, 200000];

const MovimientoSchema = z.object({
  fecha: z.string().min(1),
  monto: z.coerce.number().positive("Ingresa un monto mayor a 0"),
  concepto: z.string().trim().min(3,"Describe el concepto"),
  notas: z.string().trim().optional().or(z.literal("")),
});

export function DialogoMovimiento({
  open,
  onOpenChange,
  modo,
  trabajadorId,
  nombreTrabajador,
  saldoActual,
  onGuardado,
}) {
  const { trabajadores, registrarMovimiento } = useData();
  const esMovil = useMediaQuery("(max-width: 1023px)");

  const conceptosPorModo =
    modo === "prestamo"
      ? CONCEPTOS_PRESTAMO
      : modo === "abono"
        ? CONCEPTOS_ABONO
        : CONCEPTOS_AJUSTE;

  const [tId, setTId] = useState(trabajadorId ?? "");
  const [montoTexto, setMontoTexto] = useState("");
  const [otroConcepto, setOtroConcepto] = useState("");

  useEffect(() => {
    if (open) {
      setTId(trabajadorId ?? "");
      setMontoTexto("");
      setOtroConcepto("");
    }
  },[open, trabajadorId]);

  const form = useForm({
    resolver: zodResolver(MovimientoSchema),
    defaultValues: { fecha: hoyISO(), monto: 0, concepto: "", notas: "" },
  });

  const montoNum = Number(form.watch("monto")) || 0;

  const errorAbonoExcedido =
    modo === "abono" && montoNum > saldoActual
      ? `El abono no puede ser mayor a la deuda actual (${formatCOP(saldoActual)}).`
      : null;

  const nuevoSaldo = useMemo(() => {
    if (modo === "prestamo") return saldoActual + montoNum;
    if (modo === "abono") return Math.max(0,saldoActual - montoNum);
    // ajuste: signo según prefijo del concepto
    const trim = (form.watch("concepto") ?? "").trim();
    const signo = trim.startsWith("-") ? -1 : 1;
    return Math.max(0,saldoActual + signo * montoNum);
  },[saldoActual, modo, montoNum, form.watch("concepto")]);


  const onSubmit = (data) => {
    if (!tId) {
      toast.error("Selecciona un trabajador.");
      return;
    }
    if (modo === "abono" && data.monto > saldoActual) {
      toast.error(errorAbonoExcedido ?? "Monto inválido");
      return;
    }
    const conceptoFinal = (() => {
      if (data.concepto === "Otro…") return otroConcepto.trim() || "Movimiento";
      return data.concepto;
    })();
    try {
      registrarMovimiento({
        trabajadorId: tId,
        fecha: data.fecha,
        tipo: modo,
        monto: Math.round(data.monto),
        concepto: conceptoFinal,
        notas: data.notas?.trim() || undefined,
      });
      toast.success(`${tituloModo(modo)} registrado.`,{
        description:
          modo === "prestamo"
            ? `Nuevo saldo: ${formatCOP(nuevoSaldo)}.`
            : modo === "abono"
              ? `Nuevo saldo: ${formatCOP(nuevoSaldo)}.`
              : `Ajuste aplicado.`,
      });
      onGuardado?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    }
  };

  const titulo = tituloModo(modo);

  const contenido = (<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {!trabajadorId && (<div className="space-y-1.5">
          <Label>Trabajador</Label>
          <Select value={tId} onValueChange={setTId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona trabajador" />
            </SelectTrigger>
            <SelectContent>
              {trabajadores
                .filter((t) => t.estado === "activo")
                .map((t) => (<SelectItem key={t.id} value={t.id}>
                    {t.nombre}
                  </SelectItem>))}
            </SelectContent>
          </Select>
        </div>)}

      {nombreTrabajador && (<div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="text-xs text-muted-foreground">Trabajador</p>
          <p className="font-semibold">{nombreTrabajador}</p>
        </div>)}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fecha">Fecha</Label>
          <Input
            id="fecha"

            {...form.register("fecha")}
            aria-invalid={!!form.formState.errors.fecha}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="monto">Monto (COP)</Label>
          <Input
            id="monto"
            inputMode="numeric"
            placeholder={modo === "abono" ? "0" : "50.000"}
            value={montoTexto}
            onChange={(e) => {
              const text = e.target.value;
              if (!/^[\d.]*$/.test(text)) return;
              setMontoTexto(text);
              const n = parseMiles(text);
              form.setValue("monto",n,{ shouldValidate: true });
            }}
            className="num"
            aria-invalid={!!form.formState.errors.monto || !!errorAbonoExcedido}
          />
          {modo === "prestamo" && (<div className="mt-1 flex flex-wrap gap-1">
              {RAPIDOS_PRESTAMO.map((v) => (<Button
                  key={v}

                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs num"
                  onClick={() => {
                    setMontoTexto(numeroMiles(v));
                    form.setValue("monto",v,{ shouldValidate: true });
                  }}
                >
                  {formatCOP(v)}
                </Button>))}
            </div>)}
          {modo === "abono" && saldoActual > 0 && (<Button

              variant="outline"
              size="sm"
              className="mt-1 h-7 text-xs"
              onClick={() => {
                setMontoTexto(numeroMiles(saldoActual));
                form.setValue("monto",saldoActual,{ shouldValidate: true });
              }}
            >
              Abonar todo ({formatCOP(saldoActual)})
            </Button>)}
          {errorAbonoExcedido ? (<p className="text-xs text-destructive">{errorAbonoExcedido}</p>) : form.formState.errors.monto ? (<p className="text-xs text-destructive">{form.formState.errors.monto.message}</p>) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="concepto">Concepto</Label>
        <Select
          value={form.watch("concepto") ?? ""}
          onValueChange={(v) => form.setValue("concepto",v,{ shouldValidate: true })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Elige o escribe el concepto" />
          </SelectTrigger>
          <SelectContent>
            {conceptosPorModo.map((c) => (<SelectItem key={c} value={c}>
                {c}
              </SelectItem>))}
          </SelectContent>
        </Select>
        {(form.watch("concepto") === "Otro…" || form.watch("concepto") === undefined) && (<Input
            placeholder="Describe el concepto…"
            value={otroConcepto}
            onChange={(e) => {
              setOtroConcepto(e.target.value);
              form.setValue("concepto",e.target.value,{ shouldValidate: true });
            }}
          />)}
        {form.formState.errors.concepto && (<p className="text-xs text-destructive">{form.formState.errors.concepto.message}</p>)}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notas">Notas (opcional)</Label>
        <Textarea id="notas" rows={2} {...form.register("notas")} />
      </div>

      {/* Resumen en vivo */}
      <div className="rounded-md border border-dashed bg-muted/30 p-3 text-sm">
        <p className="text-xs text-muted-foreground">{nombreTrabajador ?? "Trabajador"} pasará de deber</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="text-base num font-semibold">{formatCOP(saldoActual)}</span>
          <span className="text-muted-foreground">→</span>
          <span className="text-xl num font-bold text-foreground">{formatCOP(nuevoSaldo)}</span>
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!!errorAbonoExcedido}>
          Registrar {modo}
        </Button>
      </div>
    </form>
  );

  if (esMovil) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[100dvh] overflow-y-auto rounded-t-xl p-0">
          <SheetHeader className="sticky top-0 z-10 border-b bg-background/95 px-4 py-4">
            <SheetTitle className="display text-lg">{titulo}</SheetTitle>
            <SheetDescription>
              {modo === "abono"
                ? `Saldo actual: ${formatCOP(saldoActual)}`
                : "Registra un movimiento de deuda."}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 py-4">{contenido}</div>
        </SheetContent>
      </Sheet>);
  }

  return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-full max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-background/95 px-6 py-4">
          <DialogTitle className="display text-lg">{titulo}</DialogTitle>
          <DialogDescription>
            {modo === "abono"
              ? `Saldo actual: ${formatCOP(saldoActual)}`
              : "Registra un movimiento de deuda."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(92vh-100px)] overflow-y-auto px-6 py-4">
          {contenido}
        </div>
      </DialogContent>
    </Dialog>);
}

function tituloModo(modo) {
  switch (modo) {
    case "prestamo":
      return "Registrar préstamo";
    case "abono":
      return "Registrar abono";
    case "ajuste":
      return "Registrar ajuste";
  }
}
