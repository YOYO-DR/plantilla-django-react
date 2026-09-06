// Deuda del trabajador — solo lectura.
//
// Lista los préstamos activos del trabajador desde balance.loans. Cada
// préstamo muestra su saldo real (outstanding_balance). Sin botones de
// escritura — el trabajador no abona, eso lo hace el maestro en el
// wizard de liquidación.

import { Wallet, Info } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { useMiBalance } from "@/lib/useMiBalance";
import { formatCOP, formatFecha } from "@/lib/format";
import { parseApiError } from "@/api/errorMessage";

export default function TrabajadorDeuda() {
  const balanceQ = useMiBalance();

  if (balanceQ.isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }
  if (balanceQ.isError) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-destructive">
          {parseApiError(balanceQ.error).message}
        </CardContent>
      </Card>
    );
  }

  const balance = balanceQ.data;
  const loans = balance?.loans ?? [];

  return (
    <div className="space-y-5 pb-4">
      <header className="space-y-1">
        <h1 className="display text-2xl font-semibold sm:text-3xl">Tu deuda</h1>
        <p className="text-sm text-muted-foreground">
          Préstamos que tu maestro te ha otorgado. El saldo se descuenta
          automáticamente cuando liquida.
        </p>
      </header>

      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-baseline justify-between gap-2 p-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-destructive" />
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Saldo total
            </p>
          </div>
          <p className="display text-3xl font-bold num text-destructive">
            {formatCOP(balance?.saldo_prestamos ?? 0)}
          </p>
        </CardContent>
      </Card>

      {loans.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Wallet className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No tienes préstamos activos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {loans.map((loan) => {
            const totalCents = parseCents(loan.amount);
            const saldoCents = parseCents(loan.outstanding_balance);
            const abonadoCents = Math.max(0, totalCents - saldoCents);
            const progreso =
              totalCents > 0 ? Math.min(100, Math.round((abonadoCents / totalCents) * 100)) : 0;
            return (
              <Card key={loan.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {loan.reason || `Préstamo #${loan.id}`}
                    </p>
                    <p className="text-xs text-muted-foreground num">
                      {formatFecha(loan.date, "dd/MM/yyyy")}
                    </p>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Saldo</p>
                      <p className="num text-xl font-bold text-destructive">
                        {formatCOP(loan.outstanding_balance)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Prestado</p>
                      <p className="num text-base font-semibold">
                        {formatCOP(loan.amount)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={progreso} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground num">
                      {progreso}% abonado
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Tu maestro descuenta los abonos al registrar una liquidación. No
          tienes acción directa sobre esta pantalla.
        </span>
      </div>
    </div>
  );
}

function parseCents(amount) {
  if (amount == null) return 0;
  const s = String(amount);
  const [ent, dec = ""] = s.split(".");
  const padded = (dec + "00").slice(0, 2);
  const sign = ent.startsWith("-") ? -1 : 1;
  const abs = ent.replace("-", "") || "0";
  return sign * (parseInt(abs, 10) * 100 + parseInt(padded || "0", 10));
}
