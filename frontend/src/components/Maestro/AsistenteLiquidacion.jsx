// Asistente de liquidación en 3 pasos: revisar días → deuda → confirmar.
// Implementa R5, R6 y R7.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Check,
  CircleDot,
  Minus,
  Sparkles,
  AlertTriangle,
  ExternalLink } from "lucide-react";

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
  DialogTitle } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from "@/components/ui/alert-dialog";

import { useData } from "@/context/DataContext";
import {
  calcularDescuento,
  construirDetalleLiquidacion,
  subtotalDeDetalle,
} from "@/lib/calculo";
import { formatCOP, formatFecha } from "@/lib/format";
import { numeroMiles, parseMiles } from "@/lib/usuarios";
import { useMediaQuery } from "@/components/shared/useMediaQuery";

export function AsistenteLiquidacion({
  open,
  onOpenChange,
  trabajador,
  periodoInicio,
  periodoFin,
  jornadas,
  onConfirmado,
}) {
  const esMovil = useMediaQuery("(max-width: 1023px)");
  const navigate = useNavigate();
  const { movimientos, crearLiquidacion } = useData();

  const [paso, setPaso] = useState(1);
  const [modo, setModo] = useState("ninguno");
  const [montoManualTexto, setMontoManualTexto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [fechaPago, setFechaPago] = useState(periodoFin);
  const [confirmar, setConfirmar] = useState(false);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setPaso(1);
      setModo("ninguno");
      setMontoManualTexto("");
      setObservaciones("");
      setFechaPago(periodoFin);
      setConfirmar(false);
    }
  },[open, periodoFin]);

  // Saldo al cierre del período (sólo movimientos manuales anteriores o =)
  const saldo = useMemo(() => {
    const movsT = movimientos.filter((m) =>
        m.trabajadorId === trabajador.id &&
        m.liquidacionId === null &&
        m.fecha <= periodoFin,
    );
    let s = 0;
    for (const m of movsT) {
      if (m.tipo === "prestamo") s += m.monto;
      else if (m.tipo === "abono") s -= m.monto;
      else {
        const trim = (m.concepto ?? "").trim();
        s += (trim.startsWith("-") ? -1 : 1) * m.monto;
      }
    }
    return Math.max(0,s);
  },[movimientos, trabajador.id, periodoFin]);

  // Detalle y subtotal
  const detalle = useMemo(() => construirDetalleLiquidacion(jornadas,trabajador),[jornadas, trabajador],
  );
  const subtotal = useMemo(() => subtotalDeDetalle(detalle),[detalle]);

  const montoManual = parseMiles(montoManualTexto);
  const descuentoRes = useMemo(() => calcularDescuento(modo,montoManual,saldo,subtotal),[modo, montoManual, saldo, subtotal],
  );

  const descuento = descuentoRes.montoDescontado;
  const totalPagado = Math.max(0,subtotal - descuento);
  const deudaDespues = Math.max(0,saldo - descuento);

  const onConfirmar = () => {
    const r = crearLiquidacion({
      trabajadorId: trabajador.id,
      periodoInicio,
      periodoFin,
      jornadaIds: jornadas.map((j) => j.id),
      modoDescuento: modo,
      montoManual: modo === "parcial" ? Math.round(montoManual) : undefined,
      observaciones: observaciones.trim() || undefined,
      fechaPago,
    });
    if (!r.ok || !r.liquidacion) {
      toast.error(r.error ?? "Error al liquidar");
      return;
    }
    toast.success(`Liquidación #${r.liquidacion.consecutivo} creada.`,{
      description: `Total pagado: ${formatCOP(r.liquidacion.totalPagado)}.`,
      action: {
        label: (
            <span className="inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Comprobante
            </span>
          ),
        onClick: () => navigate(`/app/maestro/pagos/${r.liquidacion.id}`),
      },
    });
    setConfirmar(false);
    onOpenChange(false);
    onConfirmado?.(r.liquidacion);
  };

  const contenido = (<div className="space-y-5">
      {/* Encabezado fijo del trabajador y período */}
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
        <p>
          <strong>{trabajador.nombre}</strong> ·{" "}
          <span className="text-muted-foreground">{trabajador.oficio}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Período–{" "}
          {formatFecha(periodoFin,"dd/MM/yyyy")}
        </p>
        <div className="mt-2 flex items-center gap-2">
          {[1, 2, 3].map((n) => (<span
              key={n}
              className={`h-2 flex-1 rounded-full ${
                n <= paso ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Paso 1 — revisar días */}
      {paso === 1 && (<div className="space-y-3">
          <h3 className="display text-base font-semibold">Revisar días</h3>
          {detalle.length === 0 ? (<p className="rounded-md border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
              No hay jornadas pendientes en este período.
            </p>) : (<Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Día</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Tarifa</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalle.map((l) => (<TableRow key={l.fecha}>
                    <TableCell className="text-sm">{formatFecha(l.fecha,"dd/MM")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatFecha(l.fecha,"EEE")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {l.tipo === "completo" ? (<Check className="h-4 w-4 text-success" />) : l.tipo === "medio" ? (<CircleDot className="h-4 w-4 text-info" />) : (<Minus className="h-4 w-4 text-muted-strong" />)}
                        <span className="text-xs">
                          {l.tipo === "completo"
                            ? "Completo"
                            : l.tipo === "medio"
                              ? "Medio"
                              : "—"}
                        </span>
                        {l.esOverride && (<Sparkles className="h-3.5 w-3.5 text-warning" />)}
                      </div>
                    </TableCell>
                    <TableCell
                      className={`text-right num ${l.esOverride ? "text-warning" : ""}`}
                    >
                      {formatCOP(l.tarifaAplicada)}
                    </TableCell>
                    <TableCell className="text-right num font-semibold">
                      {formatCOP(l.valor)}
                    </TableCell>
                  </TableRow>))}
              </TableBody>
            </Table>)}
          {detalle.length > 0 && (<div className="flex justify-end rounded-md border bg-primary/5 px-3 py-2 text-sm">
              <span className="mr-2 text-muted-foreground">Subtotal devengado</span>
              <strong className="num text-primary">{formatCOP(subtotal)}</strong>
            </div>)}
        </div>)}

      {/* Paso 2 — deuda */}
      {paso === 2 && (<div className="space-y-3">
          <h3 className="display text-base font-semibold">Descuento de deuda</h3>
          <div className="rounded-md border bg-card p-3">
            <p className="text-xs text-muted-foreground">Saldo actual</p>
            <p className="display text-2xl font-bold num text-destructive">
              {formatCOP(saldo)}
            </p>
          </div>

          <div className="space-y-2">
            {([
                {
                  key: "ninguno",
                  titulo: "No descontar nada",
                  desc: `Pagas el subtotal completo · deuda queda en ${formatCOP(saldo)}.`,
                },
                {
                  key: "total",
                  titulo: "Descontar toda la deuda",
                  desc: `Descuenta ${formatCOP(Math.min(saldo,subtotal))}.`,
                },
                {
                  key: "parcial",
                  titulo: "Descontar una parte",
                  desc: "Indica el monto a descontar.",
                },
              ]).map((op) => (<button
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
              </button>))}
          </div>

          {modo === "parcial" && (<div className="space-y-2 rounded-md border bg-muted/30 p-3">
              <Label htmlFor="montoManual">Monto a descontar (COP)</Label>
              <Input
                id="montoManual"
                inputMode="numeric"
                placeholder="0"
                value={montoManualTexto}
                onChange={(e) => {
                  const text = e.target.value;
                  if (!/^[\d.]*$/.test(text)) return;
                  setMontoManualTexto(text);
                }}
                className="num"
                aria-invalid={!descuentoRes.esValido}
              />
              {!descuentoRes.esValido && descuentoRes.mensaje && (<p className="text-xs text-destructive">{descuentoRes.mensaje}</p>)}
              <div className="flex flex-wrap gap-1">
                {[0.25, 0.5, 0.75].map((p) => (<Button
                    key={p}

                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs num"
                    onClick={() =>
                      setMontoTextoPorcentaje(subtotal,saldo,p)
                    }
                  >
                    {Math.round(p * 100)}%
                  </Button>))}
                <Button

                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setMontoManualTexto(numeroMiles(Math.min(saldo,subtotal)));
                  }}
                >
                  Techo ({formatCOP(Math.min(saldo,subtotal))})
                </Button>
              </div>
            </div>)}

          {saldo > subtotal && descuento > 0 && (<div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p>
                La deuda (<strong className="num">{formatCOP(saldo)}</strong>) es mayor al
                pago (<strong className="num">{formatCOP(subtotal)}</strong>). Se
                descontará <strong className="num">{formatCOP(descuento)}</strong> y quedará
                pendiente <strong className="num">{formatCOP(deudaDespues)}</strong>.
              </p>
            </div>)}

          <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-3 text-center">
            <Celda label="Devengado" valor={subtotal} />
            <Celda label="Descuento" valor={descuento} tone="success" />
            <Celda label="A pagar" valor={totalPagado} tone="primary" highlight />
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Deuda después: <span className="num font-semibold">{formatCOP(deudaDespues)}</span>
          </p>
        </div>
      )}

      {/* Paso 3 — confirmar */}
      {paso === 3 && (<div className="space-y-3">
          <h3 className="display text-base font-semibold">Confirmar pago</h3>
          <div className="space-y-2 rounded-md border bg-card p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Devengado</span>
              <span className="num font-semibold">{formatCOP(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Descuento</span>
              <span className="num text-success">{formatCOP(descuento)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base">
              <strong>A pagar</strong>
              <strong className="num text-primary">{formatCOP(totalPagado)}</strong>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fechaPago">Fecha de pago</Label>
              <Input
                id="fechaPago"

                value={fechaPago}
                onChange={(e) => setFechaPago(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Deuda después</Label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm num">
                {formatCOP(deudaDespues)}
              </div>
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
            <Badge variant="outline">Modo</Badge>
            {descuento > 0 && <Badge variant="outline">Jornadas a bloquear: {jornadas.length}</Badge>}
          </div>
        </div>)}

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <Button
          variant="ghost"
          onClick={() =>
            paso === 1
              ? onOpenChange(false)
              : setPaso(paso - 1)
          }
        >
          {paso === 1 ? "Cancelar" : "← Anterior"}
        </Button>
        {paso < 3 ? (<Button
            onClick={() => {
              if (paso === 2 && modo === "parcial" && !descuentoRes.esValido) {
                toast.error(descuentoRes.mensaje ?? "Monto inválido");
                return;
              }
              setPaso(paso + 1);
            }}
            className="min-h-tap"
          >
            Siguiente →
          </Button>) : (<Button
            onClick={() => setConfirmar(true)}
            className="min-h-tap"
            variant="default"
          >
            Confirmar pago
          </Button>)}
      </div>

      {/* Confirmación final */}
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar esta liquidación?</AlertDialogTitle>
            <AlertDialogDescription>
              Al confirmar, las <strong>{jornadas.length} jornadas</strong> del período
              quedarán <strong>bloqueadas</strong>
              {descuento > 0 && (<>
                  {" "}y se descontarán <strong className="num">{formatCOP(descuento)}</strong> de la deuda
                </>)}
              . El comprobante será inmutable. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmar}>
              Sí, liquidar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

  function setMontoTextoPorcentaje(subtotal,saldo,p) {
    const candidato = Math.round(subtotal * p);
    const techo = Math.min(saldo,subtotal);
    const capped = Math.max(0,Math.min(candidato,techo));
    setMontoManualTexto(numeroMiles(capped));
  }

  // Render condicional Dialog/Sheet
  const Title = () => (<>
      {paso === 1 && "Paso 1 · Revisar días"}
      {paso === 2 && "Paso 2 · Deuda"}
      {paso === 3 && "Paso 3 · Confirmar"}
    </>);
  const Desc = () => (<>
      {paso === 1 && "Verifica las jornadas que vas a liquidar."}
      {paso === 2 && "Decide cuánto descuento aplicar a la deuda."}
      {paso === 3 && "Confirma el pago."}
    </>);

  if (esMovil) {
    return (<Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[100dvh] overflow-y-auto rounded-t-xl p-0">
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
      </Sheet>);
  }

  return (<Dialog open={open} onOpenChange={onOpenChange}>
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
    </Dialog>);
}

function Celda({
  label,
  valor,
  tone,
  highlight,
}) {
  const t = {
    muted: "text-muted-foreground",
    success: "text-success",
    primary: "text-primary",
  }[tone ?? "muted"];
  return (<div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold num ${t} ${highlight ? "text-2xl" : ""}`}>
        {formatCOP(valor)}
      </p>
    </div>);
}
