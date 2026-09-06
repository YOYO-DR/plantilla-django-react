// Pantalla temporal de diagnóstico (Fase 1). Se elimina en la Fase 12.
// Verifica las funciones puras de `src/lib/calculo.ts` y muestra el estado de
// cada clave de localStorage con un botón para limpiar todo.

import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { CheckCircle2, XCircle, Trash2, FlaskConical, Database } from "lucide-react";

import {
  calcularDescuento,
  construirDetalleLiquidacion,
  saldoDeuda,
  totalJornadas,
  valorJornada,
} from "@/lib/calculo";
import { formatCOP } from "@/lib/format";

// ---------------------------------------------------------------------------
// Casos de prueba para `calculo.ts`
// ---------------------------------------------------------------------------

const TRABAJADOR_BASE = {
  id: "trb_test",
  tenantId: "tnt_test",
  usuarioId: "usr_test",
  nombre: "Trabajador Test",
  oficio: "Oficial",
  tarifaDiaBase: 85000,
  factorMedioDia: 0.5,
  fechaIngreso: "2024-01-01",
  estado: "activo",
};

function jornada(
  tipo,
  tarifaOverride = null,
  fecha = "2024-09-02",
) {
  return {
    id: `jrn_${fecha}_${tipo}_${tarifaOverride ?? "x"}`,
    tenantId: TRABAJADOR_BASE.tenantId,
    trabajadorId: TRABAJADOR_BASE.id,
    fecha,
    tipo,
    tarifaOverride,
    liquidacionId: null,
    registradoPor: "usr_test",
    registradoEn: "2024-09-02T07:00:00.000Z",
  };
}

const CASOS = [
  {
    id: "r1-completo",
    categoria: "R1 — Valor de jornada",
    nombre: "Día completo con tarifa base",
    ejecutar: () => {
      const v = valorJornada(jornada("completo"), TRABAJADOR_BASE);
      return { esperado: 85000, resultado: v, pasa: v === 85000 };
    },
  },
  {
    id: "r1-medio",
    categoria: "R1 — Valor de jornada",
    nombre: "Medio día con tarifa base (factor 0.5)",
    ejecutar: () => {
      const v = valorJornada(jornada("medio"), TRABAJADOR_BASE);
      return { esperado: 42500, resultado: v, pasa: v === 42500 };
    },
  },
  {
    id: "r1-override",
    categoria: "R1 — Valor de jornada",
    nombre: "Día completo con override (120.000)",
    ejecutar: () => {
      const v = valorJornada(jornada("completo", 120000), TRABAJADOR_BASE);
      return { esperado: 120000, resultado: v, pasa: v === 120000 };
    },
  },
  {
    id: "r1-override-medio",
    categoria: "R1 — Valor de jornada",
    nombre: "Medio día con override (100.000 → 50.000)",
    ejecutar: () => {
      const v = valorJornada(jornada("medio", 100000), TRABAJADOR_BASE);
      return { esperado: 50000, resultado: v, pasa: v === 50000 };
    },
  },
  {
    id: "r1-no-trabajo",
    categoria: "R1 — Valor de jornada",
    nombre: "Día no trabajado vale 0 incluso con override",
    ejecutar: () => {
      const v = valorJornada(jornada("no_trabajo", 150000), TRABAJADOR_BASE);
      return { esperado: 0, resultado: v, pasa: v === 0 };
    },
  },
  {
    id: "r1-total-semana",
    categoria: "R1 — Valor de jornada",
    nombre: "Total semana (5 completos + 2 medios)",
    ejecutar: () => {
      const js = [
        jornada("completo", null, "2024-09-02"),
        jornada("completo", null, "2024-09-03"),
        jornada("completo", null, "2024-09-04"),
        jornada("completo", null, "2024-09-05"),
        jornada("completo", null, "2024-09-06"),
        jornada("medio", null, "2024-09-07"),
        jornada("medio", null, "2024-09-08"),
      ];
      const t = totalJornadas(js, TRABAJADOR_BASE);
      return { esperado: 85000 * 5 + 42500 * 2, resultado: t, pasa: t === 85000 * 5 + 42500 * 2 };
    },
  },
  {
    id: "r5-total-deuda-mayor",
    categoria: "R5 — Descuento en liquidación",
    nombre: "Descuento TOTAL con deuda (200.000) mayor al pago (85.000)",
    ejecutar: () => {
      const r = calcularDescuento("total", 0, 200000, 85000);
      return {
        esperado: { montoDescontado: 85000, deudaPendiente: 115000, esValido: true },
        resultado: r,
        pasa:
          r.montoDescontado === 85000 &&
          r.deudaPendiente === 115000 &&
          r.esValido === true,
      };
    },
  },
  {
    id: "r5-parcial-valido",
    categoria: "R5 — Descuento en liquidación",
    nombre: "Descuento PARCIAL válido (30.000 sobre deuda 80.000 / subtotal 90.000)",
    ejecutar: () => {
      const r = calcularDescuento("parcial", 30000, 80000, 90000);
      return {
        esperado: { montoDescontado: 30000, deudaPendiente: 50000, esValido: true },
        resultado: r,
        pasa:
          r.montoDescontado === 30000 &&
          r.deudaPendiente === 50000 &&
          r.esValido === true,
      };
    },
  },
  {
    id: "r5-parcial-invalido",
    categoria: "R5 — Descuento en liquidación",
    nombre: "Descuento PARCIAL inválido (monto > techo)",
    ejecutar: () => {
      const r = calcularDescuento("parcial", 200000, 80000, 90000);
      return {
        esperado: { esValido: false },
        resultado: r,
        pasa: r.esValido === false,
      };
    },
  },
  {
    id: "r5-parcial-cero",
    categoria: "R5 — Descuento en liquidación",
    nombre: "Descuento PARCIAL con monto 0 (inválido)",
    ejecutar: () => {
      const r = calcularDescuento("parcial", 0, 80000, 90000);
      return {
        esperado: { esValido: false },
        resultado: r,
        pasa: r.esValido === false,
      };
    },
  },
  {
    id: "r5-ninguno",
    categoria: "R5 — Descuento en liquidación",
    nombre: "Modo NINGUNO deja la deuda intacta",
    ejecutar: () => {
      const r = calcularDescuento("ninguno", 0, 50000, 90000);
      return {
        esperado: { montoDescontado: 0, deudaPendiente: 50000, esValido: true },
        resultado: r,
        pasa:
          r.montoDescontado === 0 &&
          r.deudaPendiente === 50000 &&
          r.esValido === true,
      };
    },
  },
  {
    id: "r4-saldo-prestamos-abonos",
    categoria: "R4 — Saldo de deuda",
    nombre: "Saldo = Σ préstamos − Σ abonos + ajustes",
    ejecutar: () => {
      const movs = [
        mov("prestamo", 50000, "Préstamo lunes"),
        mov("prestamo", 30000, "Préstamo miércoles"),
        mov("abono", 20000, "Abono viernes"),
        mov("ajuste", 5000, "Ajuste por materiales"),
        mov("ajuste", 2000, "-Descuento por daño herramienta"),
      ];
      const s = saldoDeuda(movs);
      // 50000 + 30000 − 20000 + 5000 − 2000 = 63000
      return { esperado: 63000, resultado: s, pasa: s === 63000 };
    },
  },
  {
    id: "detalle-liquidacion",
    categoria: "Detalle liquidación",
    nombre: "Detalle ordena por fecha y excluye no_trabajo",
    ejecutar: () => {
      const js = [
        jornada("completo", null, "2024-09-05"),
        jornada("medio", null, "2024-09-02"),
        jornada("no_trabajo", null, "2024-09-03"),
        jornada("completo", 100000, "2024-09-04"),
      ];
      const d = construirDetalleLiquidacion(js, TRABAJADOR_BASE);
      const ok =
        d.length === 3 &&
        d[0].fecha === "2024-09-02" &&
        d[1].fecha === "2024-09-04" &&
        d[2].fecha === "2024-09-05" &&
        d[1].esOverride === true;
      return {
        esperado: "3 líneas ordenadas (sept-02, sept-04 override, sept-05)",
        resultado: d,
        pasa: ok,
      };
    },
  },
];

function mov(
  tipo,
  monto,
  concepto,
) {
  return {
    id: `mov_${tipo}_${monto}_${concepto.length}`,
    tenantId: TRABAJADOR_BASE.tenantId,
    trabajadorId: TRABAJADOR_BASE.id,
    fecha: "2024-09-02",
    tipo,
    monto,
    concepto,
    liquidacionId: null,
    registradoPor: "usr_test",
    registradoEn: "2024-09-02T07:00:00.000Z",
  };
}

// ---------------------------------------------------------------------------
// Vista
// ---------------------------------------------------------------------------

export default function Diagnostico() {
  const resultados = CASOS.map((c) => ({ ...c, ...c.ejecutar() }));
  const pasaron = resultados.filter((r) => r.pasa).length;
  const fallaron = resultados.length - pasaron;
  const refrescar = () => window.location.reload();
  const limpiar = () => {
    if (window.confirm("¿Cerrar sesión y limpiar cookies?")) {
      fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(() => {
        window.location.href = "/login";
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h1 className="display text-lg font-semibold leading-none">
                JornalPro · Diagnóstico
              </h1>
              <p className="text-xs text-muted-foreground">
                Pantalla temporal — Fase 1. No usar en flujos de negocio.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Volver al inicio</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="container space-y-8 py-8">
        {/* Resumen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Resumen de pruebas
              <Badge variant={fallaron === 0 ? "default" : "destructive"}>
                {pasaron}/{resultados.length} OK
              </Badge>
            </CardTitle>
            <CardDescription>
              Casos mínimos exigidos por la Fase 1: completo, medio, override completo,
              override medio, no trabajo, descuento total con deuda &gt; pago, parcial válido y parcial inválido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="my-2" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Kpi label="Casos ejecutados" value={String(resultados.length)} />
              <Kpi label="Pasaron" value={String(pasaron)} tone="success" />
              <Kpi label="Fallaron" value={String(fallaron)} tone={fallaron ? "destructive" : "muted"} />
              <Kpi
                label="Fase"
                value="1 — Fundación"
                tone="info"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabla de casos */}
        <Card>
          <CardHeader>
            <CardTitle>Casos de cálculo (R1, R4, R5)</CardTitle>
            <CardDescription>
              Cada caso compara el valor esperado contra lo que devuelve la función
              pura correspondiente de <code className="font-mono text-xs">calculo.ts</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Caso</TableHead>
                  <TableHead className="text-right">Esperado</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.pasa ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.categoria}
                    </TableCell>
                    <TableCell className="font-medium">{r.nombre}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatearEsperado(r.esperado)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatearResultado(r.resultado)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Storage eliminado en Fase 6: la app es backend-only. */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" /> Sesión activa
            </CardTitle>
            <CardDescription>
              La app no usa localStorage. La persistencia es 100% backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Modo: backend-only</Badge>
              <Button onClick={refrescar} variant="ghost" size="sm" className="min-h-tap">
                Refrescar página
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={limpiar}
                className="min-h-tap"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Cerrar sesión
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Para limpiar sesión, se invalida el refresh token en el backend
              y se redirige a /login.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Diagnóstico generado automáticamente · hora local {new Date().toLocaleString("es-CO")}
        </p>

        {/* Helper usado por el KPI: celdas de dinero que se rendericen en formato COP */}
        <span className="hidden">{formatCOP(0)}</span>
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone = "muted",
}) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-info/10 text-info",
  };
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span
          className={`inline-flex h-6 items-center rounded px-2 text-xs font-medium ${tones[tone]}`}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function formatearEsperado(v) {
  if (typeof v === "number") return v.toLocaleString("es-CO");
  if (typeof v === "object" && v !== null) {
    try {
      return JSON.stringify(v)
        .replace(/[{}"]/g, "")
        .replace(/,/g, ", ");
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function formatearResultado(v) {
  if (typeof v === "number") return v.toLocaleString("es-CO");
  if (typeof v === "object" && v !== null) {
    try {
      return JSON.stringify(v)
        .replace(/[{}"]/g, "")
        .replace(/,/g, ", ");
    } catch {
      return String(v);
    }
  }
  return String(v);
}