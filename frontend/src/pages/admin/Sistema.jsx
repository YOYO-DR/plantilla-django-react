// Panel de utilidades del sistema — Fase 6.
// Sin localStorage: muestra estado del navegador + conectividad al backend.

import { useEffect, useState } from "react";
import { Database, RefreshCw } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const BACKEND = import.meta.env.VITE_API_URL || "(mismo origen)";

export default function AdminSistema() {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const refrescar = async () => {
    setCargando(true);
    setError(null);
    try {
      const token = localStorage.getItem("jornalpro_access");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const resp = await fetch(`${BACKEND === "(mismo origen)" ? "" : BACKEND}/api/admin/metrics/`, {
        credentials: "include",
        headers,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setInfo(data);
    } catch (e) {
      setError(e.message || "Error");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    refrescar();
  }, []);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="display text-2xl font-semibold sm:text-3xl">Sistema</h1>
        <p className="text-sm text-muted-foreground">
          Estado del backend y conectividad.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Backend</CardTitle>
            <p className="text-xs text-muted-foreground">
              API: <code className="font-mono">{BACKEND}</code>
            </p>
          </div>
          <Database className="h-6 w-6 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={refrescar} disabled={cargando} variant="outline" className="min-h-tap">
            <RefreshCw className="mr-2 h-4 w-4" />
            {cargando ? "Consultando…" : "Consultar /api/admin/metrics/"}
          </Button>

          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              Error: {error}
            </div>
          ) : null}

          {info ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Tenants" value={info.tenants_total} />
              <Stat label="Tenants activos" value={info.tenants_active} />
              <Stat label="Usuarios totales" value={info.users_total} />
              <Stat label="Maestros" value={info.maestros_total} />
              <Stat label="Trabajadores" value={info.trabajadores_total} />
              <Stat label="Jornadas" value={info.workdays_total} />
              <Stat label="Liquidaciones" value={info.liquidaciones_total} />
              <Stat label="Monto liquidado (COP)" value={info.liquidaciones_monto_total} />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sesión del navegador</CardTitle>
          <p className="text-xs text-muted-foreground">
            Sólo metadatos de la sesión activa (sin datos persistidos).
          </p>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted/30 p-3 text-xs">
            {JSON.stringify(
              {
                url: window.location.href,
                cookies_session: document.cookie.includes("refresh_token") ? "presente" : "ausente",
                localStorage_keys: Object.keys(localStorage),
              },
              null,
              2,
            )}
          </pre>
          <Badge variant="outline" className="mt-3">
            Modo: backend-only (sin localStorage)
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}
