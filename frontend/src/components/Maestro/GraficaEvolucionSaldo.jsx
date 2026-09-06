// Mini-chart (recharts) con la evolución del saldo en los últimos 3 meses.

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis } from "recharts";
import { format, startOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { parseISO } from "date-fns";

import { formatCOP } from "@/lib/format";
import { saldoHastaFecha } from "@/lib/movimientos";

export function GraficaEvolucionSaldo({ movimientos, fechaISO }) {
  const data = useMemo(() => {
    const ref = parseISO(fechaISO);
    const meses = [];
    // Tomamos primer día de cada uno de los últimos 3 meses
    for (let i = 2; i >= 0; i--) {
      const d = startOfMonth(subMonths(ref,i));
      const iso = d.toISOString().slice(0,10);
      const fin = format(new Date(d.getFullYear(),d.getMonth() + 1,0),"yyyy-MM-dd");
      const saldo = saldoHastaFecha(movimientos,fin);
      meses.push({
        fecha: iso,
        label: format(d,"MMM",{ locale: es }),
        saldo,
      });
    }
    return meses;
  },[movimientos, fechaISO]);

  return (<div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatCOP(Number(v))}
            width={70}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
            }}
            labelStyle={{ color: "hsl(var(--foreground))" }}
            formatter={(v) => [formatCOP(Number(v)), "Saldo"]}
          />
          <Area
            
            dataKey="saldo"
            stroke="hsl(var(--destructive))"
            strokeWidth={2}
            fill="url(#gradSaldo)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>);
}
