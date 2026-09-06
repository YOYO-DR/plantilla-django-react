// Página /app/maestro/pagos. Pestañas: Por liquidar / Historial.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Calculator,
  History,
} from "lucide-react";

import { useData } from "@/context/DataContext";
import { useAuth } from "@/context/AuthContext";
import { formatCOP, formatFecha } from "@/lib/format";
import {
  finSemana,
  hoyISO,
  inicioSemana,
  restarSemanas,
  sumarDiasISO,
} from "@/lib/fechas";

import { HistorialPagos } from "./HistorialPagos";
import { Link } from "react-router-dom";

export default function MaestroPagos() {
  const { trabajadores, jornadas, liquidaciones, movimientos, liquidarMasiva } = useData();
  const { usuario } = useAuth();

  const [tab, setTab] = useState("por-liquidar");

  // Selector de período
  const [periodo, setPeriodo] = useState("actual");
  const [rangoInicio, setRangoInicio] = useState(inicioSemana(hoyISO()));
  const [rangoFin, setRangoFin] = useState(finSemana(hoyISO()));

  const aplicado = useMemo(() => {
    if (periodo === "actual") {
      return { inicio: inicioSemana(hoyISO()), fin: finSemana(hoyISO()) };
    }
    if (periodo === "anterior") {
      const lunesAnt = restarSemanas(inicioSemana(hoyISO()), 1);
      return { inicio: lunesAnt, fin: sumarDiasISO(lunesAnt, 6) };
    }
    return { inicio: rangoInicio, fin: rangoFin };
  }, [periodo, rangoInicio, rangoFin]);

  const activos = useMemo(() => trabajadores.filter((t) => t.estado === "activo"), [trabajadores]);

  // Por liquidar: workers con jornadas pendientes en el período
  const candidatos = useMemo(() => {
    return activos.map((t) => {
      const jsSemana = jornadas.filter(
        (j) => j.trabajadorId === t.id && j.fecha >= aplicado.inicio && j.fecha <= aplicado.fin,
      );
      const pendientes = jsSemana.filter((j) => j.liquidacionId === null);
      const total = pendientes.reduce((acc, j) => {
        return acc + (j.tipo === "completo"
          ? (j.tarifaOverride ?? t.tarifaDiaBase)
          : j.tipo === "medio"
            ? Math.round((j.tarifaOverride ?? t.tarifaDiaBase) * t.factorMedioDia)
            : 0);
      }, 0);
      const movsT = movimientos.filter((m) => m.trabajadorId === t.id && m.liquidacionId === null && m.fecha <= aplicado.fin);
      let saldo = 0;
      for (const m of movsT) {
        if (m.tipo === "prestamo") saldo += m.monto;
        else if (m.tipo === "abono") saldo -= m.monto;
        else {
          const t2 = (m.concepto ?? "").trim();
          saldo += (t2.startsWith("-") ? -1 : 1) * m.monto;
        }
      }
      saldo = Math.max(0, saldo);
      const descuentoEst = Math.min(saldo, total);
      return {
        t,
        jornadas: pendientes,
        subtotal: total,
        dias: pendientes.reduce(
          (acc, j) =>
            acc + (j.tipo === "completo" ? 1 : j.tipo === "medio" ? 0.5 : 0),
          0,
        ),
        saldo,
        estimadoAPagar: Math.max(0, total - descuentoEst),
      };
    }).filter((c) => c.jornadas.length > 0);
  }, [activos, jornadas, movimientos, aplicado]);

  const [seleccion, setSeleccion] = useState([]);

  const totalAPagar = useMemo(() => {
    return candidatos
      .filter((c) => seleccion.includes(c.t.id))
      .reduce((acc, c) => acc + c.estimadoAPagar, 0);
  }, [candidatos, seleccion]);

  const toggleTodos = (sel) => {
    if (sel) setSeleccion(candidatos.map((c) => c.t.id));
    else setSeleccion([]);
  };

  const liquidarSeleccionados = () => {
    if (seleccion.length === 0) {
      toast.info("Selecciona al menos un trabajador.");
      return;
    }
    const result = liquidarMasiva(
      seleccion.map((tId) => {
        const c = candidatos.find((x) => x.t.id === tId);
        return {
          trabajadorId: tId,
          periodoInicio: aplicado.inicio,
          periodoFin: aplicado.fin,
          jornadaIds: c.jornadas.map((j) => j.id),
          modoDescuento: "total",
          observaciones: undefined,
          fechaPago: aplicado.fin,
        };
      }),
    );
    if (result.creadas === 0) {
      toast.error("No se pudo liquidar ninguno. Revisa los datos.");
      return;
    }
    toast.success(`${result.creadas} liquidaciones creadas.`, {
      description: `Total pagado: ${formatCOP(result.totalPagado)} · Descontado de deudas: ${formatCOP(result.totalDescontado)}.`,
    });
    setSeleccion([]);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-2xl font-semibold sm:text-3xl">Pagos</h1>
        <p className="text-sm text-muted-foreground">
          Liquida la semana de tu cuadrilla y consulta el historial de pagos.
        </p>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="por-liquidar" className="min-h-tap">
            <Calculator className="mr-1 h-4 w-4" /> Por liquidar
          </TabsTrigger>
          <TabsTrigger value="historial" className="min-h-tap">
            <History className="mr-1 h-4 w-4" /> Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="por-liquidar" className="space-y-4">
          {/* Selector de período */}
          <Card>
            <CardContent className="flex flex-wrap items-end justify-between gap-3 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Período</p>
                  <Select value={periodo} onValueChange={(v) => setPeriodo(v)}>
                    <SelectTrigger className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="actual">Semana actual</SelectItem>
                      <SelectItem value="anterior">Semana anterior</SelectItem>
                      <SelectItem value="libre">Rango libre…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {periodo === "libre" && (
                  <>
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Desde</p>
                      <Input
                        type="date"
                        value={rangoInicio}
                        onChange={(e) => setRangoInicio(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">Hasta</p>
                      <Input
                        type="date"
                        value={rangoFin}
                        onChange={(e) => setRangoFin(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatFecha(aplicado.inicio, "dd/MM")} – {formatFecha(aplicado.fin, "dd/MM/yyyy")}
              </p>
            </CardContent>
          </Card>

          {candidatos.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No hay jornadas pendientes en este período.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={seleccion.length === candidatos.length}
                  onCheckedChange={(v) => toggleTodos(!!v)}
                  id="todos"
                />
                <label htmlFor="todos" className="cursor-pointer">
                  Seleccionar todos
                </label>
              </div>

              {candidatos.map((c) => (
                <Card
                  key={c.t.id}
                  className={`transition-colors ${
                    seleccion.includes(c.t.id) ? "border-primary/40 bg-primary/5" : ""
                  }`}
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    <Checkbox
                      checked={seleccion.includes(c.t.id)}
                      onCheckedChange={(v) => {
                        if (v) setSeleccion((p) => [...p, c.t.id]);
                        else setSeleccion((p) => p.filter((x) => x !== c.t.id));
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{c.t.nombre}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.t.oficio} · {c.dias.toFixed(1)} días · subtotal{" "}
                        <span className="num">{formatCOP(c.subtotal)}</span> · deuda{" "}
                        <span className="num text-destructive">{formatCOP(c.saldo)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Estimado a pagar</p>
                      <p className="display text-base font-bold num text-primary">
                        {formatCOP(c.estimadoAPagar)}
                      </p>
                      <Button
                        asChild
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs"
                      >
                        <Link to={`/app/maestro/trabajadores/${c.t.id}`}>
                          Ver detalle
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Barra fija inferior */}
          {candidatos.length > 0 && (
            <div className="sticky bottom-16 z-30 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:bottom-0 sm:mx-0 sm:px-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm">
                  {seleccion.length} seleccionado
                  {seleccion.length === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-3">
                  <p className="text-sm">
                    Total:{" "}
                    <strong className="num text-primary">{formatCOP(totalAPagar)}</strong>
                  </p>
                  <Button
                    onClick={liquidarSeleccionados}
                    disabled={seleccion.length === 0}
                    className="min-h-tap"
                  >
                    Liquidar seleccionados
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="historial">
          <HistorialPagos
            trabajadores={trabajadores}
            liquidaciones={liquidaciones.filter((l) => l.estado === "pagada")}
            usuario={usuario}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
