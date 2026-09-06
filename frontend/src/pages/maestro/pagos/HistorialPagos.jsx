// Subcomponente: tabla con filtros e historial navegable al comprobante.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Lock } from "lucide-react";

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

import { formatCOP, formatFecha } from "@/lib/format";

export function HistorialPagos({ trabajadores, liquidaciones }) {
  const [fTrabajador, setFTrabajador] = useState("todos");
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7));
  const [tipo, setTipo] = useState("pagada");

  const trabajadoresMap = useMemo(
    () => new Map(trabajadores.map((t) => [t.id, t])),
    [trabajadores],
  );

  const filtradas = useMemo(() => {
    return liquidaciones
      .filter((l) => {
        if (fTrabajador !== "todos" && l.trabajadorId !== fTrabajador) return false;
        if (tipo !== "todos" && l.estado !== tipo) return false;
        if (mes) {
          const mesPago = (l.fechaPago ?? l.creadoEn).slice(0, 7);
          if (mesPago !== mes) return false;
        }
        return true;
      })
      .sort((a, b) => (a.periodoInicio < b.periodoInicio ? 1 : -1));
  }, [liquidaciones, fTrabajador, tipo, mes]);

  const totales = useMemo(() => {
    return filtradas.reduce(
      (acc, l) => ({
        devengado: acc.devengado + l.subtotalJornadas,
        descontado: acc.descontado + l.montoDescontado,
        pagado: acc.pagado + l.totalPagado,
      }),
      { devengado: 0, descontado: 0, pagado: 0 },
    );
  }, [filtradas]);

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
                  <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mes</Label>
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pagada">Pagada</SelectItem>
                <SelectItem value="borrador">Borrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {filtradas.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No hay liquidaciones que coincidan con el filtro.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Trabajador</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Devengado</TableHead>
                  <TableHead className="text-right">Descontado</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((l) => {
                  const t = trabajadoresMap.get(l.trabajadorId);
                  return (
                    <TableRow key={l.id}>
                      <TableCell>
                        <Badge variant="outline" className="border-primary/40 text-primary">
                          #{l.consecutivo}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{t?.nombre ?? "—"}</TableCell>
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
                        <p className="text-sm">
                          {l.fechaPago ? formatFecha(l.fechaPago, "dd/MM/yyyy") : "—"}
                        </p>
                        {l.estado === "pagada" && (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" /> Inmutable
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link to={`/app/maestro/pagos/${l.id}`}>
                            <FileText className="mr-1 h-3.5 w-3.5" /> Comprobante
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {filtradas.length > 0 && (
        <Card>
          <CardContent className="grid grid-cols-3 gap-2 p-3 text-sm">
            <Tot label="Devengado" value={formatCOP(totales.devengado)} />
            <Tot label="Descontado" value={formatCOP(totales.descontado)} />
            <Tot label="Pagado" value={formatCOP(totales.pagado)} highlight />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Tot({ label, value, highlight }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold num ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
