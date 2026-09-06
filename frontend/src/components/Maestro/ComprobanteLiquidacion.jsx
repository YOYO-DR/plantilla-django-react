// Comprobante imprimible de una liquidación. Documento limpio, con
// @media print que oculta navegación y sidebar.

import { useNavigate } from "react-router-dom";
import { Printer, Share2, ArrowLeft, Lock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";

import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { formatCOP, formatFecha, formatFechaLarga } from "@/lib/format";

export function ComprobanteLiquidacion({
  liquidacion,
  trabajadores,
  usuarios,
}) {
  const { tenant, usuario } = useAuth();
  const navigate = useNavigate();
  const { todosLosUsuarios } = useData();

  const trabajador = trabajadores.find((t) => t.id === liquidacion.trabajadorId);
  const usuarioT = usuarios.find((u) => u.id === trabajador?.usuarioId)
    ?? todosLosUsuarios.find((u) => u.id === trabajador?.usuarioId);
  const creadoPor =
    todosLosUsuarios.find((u) => u.id === liquidacion.creadoPor);

  const datosMaestro = creadoPor?.nombre ?? usuario?.nombre ?? "—";
  const telefonoT = trabajador?.telefono?.replace(/[^0-9]/g,"") ?? "";

  const imprimir = () => {
    if (typeof window !== "undefined") window.print();
  };

  const compartirWhatsApp = () => {
    if (!telefonoT) {
      navigate("/app/maestro/pagos");
      return;
    }
    const msg = encodeURIComponent([
        `*Comprobante de pago #${liquidacion.consecutivo}*`,
        `${tenant?.nombre ?? "Cuadrilla"} · ${formatFechaLarga(liquidacion.fechaPago ?? liquidacion.periodoFin)}`,
        "",
        `Trabajador: ${trabajador?.nombre}`,
        `Período: ${formatFecha(liquidacion.periodoInicio,"dd/MM/yyyy")} – ${formatFecha(liquidacion.periodoFin,"dd/MM/yyyy")}`,
        "",
        `Devengado: ${formatCOP(liquidacion.subtotalJornadas)}`,
        liquidacion.montoDescontado > 0
          ? `Descuento deuda: −${formatCOP(liquidacion.montoDescontado)}`
          : "Sin descuento de deuda",
        `*Total pagado: ${formatCOP(liquidacion.totalPagado)}*`,
        "",
        `Saldo de deuda después: ${formatCOP(liquidacion.saldoDeudaDespues)}`,
        "",
        `Registrado por ${datosMaestro}.`,
      ].join("\n"),
    );
    window.open(`https://wa.me/${telefonoT}?text=${msg}`,"_blank");
  };

  return (<div className="space-y-4 print:space-y-0">
      {/* Acciones — ocultas en impresión */}
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button
          variant="ghost"
          onClick={() => navigate("/app/maestro/pagos")}
          className="min-h-tap"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Pagos
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={imprimir} className="min-h-tap">
            <Printer className="mr-2 h-4 w-4" /> Imprimir
          </Button>
          <Button onClick={compartirWhatsApp} className="min-h-tap">
            <Share2 className="mr-2 h-4 w-4" /> Compartir WhatsApp
          </Button>
        </div>
      </div>

      {/* Comprobante */}
      <Card className="mx-auto max-w-2xl print:shadow-none print:border-0">
        <CardContent className="p-6 print:p-8">
          <header className="mb-6 flex items-start justify-between gap-3 border-b pb-4">
            <div className="flex items-center gap-3">
              <Logo className="bg-primary text-primary-foreground" />
              <div>
                <p className="display text-lg font-semibold">
                  {tenant?.nombre ?? "Cuadrilla"}
                </p>
                <p className="text-xs text-muted-foreground">{tenant?.ciudad ?? ""}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Comprobante</p>
              <p className="display text-xl font-bold">
                #{String(liquidacion.consecutivo).padStart(3,"0")}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFecha(liquidacion.fechaPago ?? liquidacion.periodoFin,"dd 'de' MMMM 'de' yyyy")}
              </p>
            </div>
          </header>

          <section className="mb-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Trabajador</p>
              <p className="font-medium">{trabajador?.nombre ?? "—"}</p>
              {usuarioT && (<p className="text-xs text-muted-foreground">@{usuarioT.usuario}</p>)}
              {trabajador?.documento && (<p className="text-xs text-muted-foreground">CC {trabajador.documento}</p>)}
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Período</p>
              <p>
                {formatFecha(liquidacion.periodoInicio,"dd/MM/yyyy")} –{" "}
                {formatFecha(liquidacion.periodoFin,"dd/MM/yyyy")}
              </p>
              <p className="text-xs text-muted-foreground">
                {liquidacion.detalle.length} jornada
                {liquidacion.detalle.length === 1 ? "" : "s"} trabajada
                {liquidacion.detalle.length === 1 ? "" : "s"}
              </p>
            </div>
          </section>

          <section className="mb-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2">Fecha</th>
                  <th>Tipo</th>
                  <th className="text-right">Tarifa</th>
                  <th className="text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {liquidacion.detalle.map((l) => (<tr key={l.fecha} className="border-b">
                    <td className="py-1.5">{formatFecha(l.fecha,"dd/MM/yyyy")}</td>
                    <td>
                      {l.tipo === "completo"
                        ? "Día completo"
                        : l.tipo === "medio"
                          ? "Medio día"
                          : "—"}
                      {l.esOverride && (<span className="ml-1 text-warning">⚡</span>)}
                    </td>
                    <td className="text-right num">
                      {formatCOP(l.tarifaAplicada)}
                    </td>
                    <td className="text-right num font-medium">
                      {formatCOP(l.valor)}
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </section>

          <section className="mb-5 space-y-1 rounded-md bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Devengado</span>
              <span className="num">{formatCOP(liquidacion.subtotalJornadas)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Descuento de deuda ({etiquetaModo(liquidacion.modoDescuento)})
              </span>
              <span className="num text-success">
                {liquidacion.montoDescontado > 0
                  ? `− ${formatCOP(liquidacion.montoDescontado)}`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base">
              <strong>Total pagado</strong>
              <strong className="num text-primary">{formatCOP(liquidacion.totalPagado)}</strong>
            </div>
          </section>

          <section className="mb-5 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Deuda antes
              </p>
              <p className="num">{formatCOP(liquidacion.saldoDeudaAntes)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Deuda después
              </p>
              <p className="num font-semibold">{formatCOP(liquidacion.saldoDeudaDespues)}</p>
            </div>
          </section>

          {liquidacion.observaciones && (<section className="mb-5 rounded-md border bg-card p-3 text-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Observaciones
              </p>
              <p className="mt-1 italic">"{liquidacion.observaciones}"</p>
            </section>)}

          <footer className="flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> Comprobante inmutable · registrado por {datosMaestro}
            </span>
            <span className="num">
              {trabajador?.oficio}
            </span>
          </footer>
        </CardContent>
      </Card>
    </div>);
}

function etiquetaModo(m) {
  switch (m) {
    case "ninguno":
      return "Sin descuento";
    case "total":
      return "Total";
    case "parcial":
      return "Parcial";
  }
}
