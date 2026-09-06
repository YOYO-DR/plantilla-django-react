// Pestaña Acceso: gestión de credenciales del trabajador.
//
// Fase D1:
// - El campo de contraseña NUNCA pinta un valor que venga de un GET.
//   Solo se muestra el resultado de un reset (POST .../reset-password/),
//   una sola vez, hasta que se recargue la página.
// - Quitamos `useState(usuario.password)` y `generarPassword` del cliente.
//   La contraseña la genera el backend.
// - Activar/desactivar y resetear password pasan por TanStack Query
//   mutations que invalidan la query de workers.

import { useState } from "react";
import { Copy, KeyRound, ShieldCheck, ShieldOff, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import { useData } from "@/context/DataContext";

export function AccesoTab({ trabajador, usuario }) {
  const {
    activarTrabajador,
    desactivarTrabajador,
    resetearPasswordUsuario,
  } = useData();

  // Solo se rellena tras un reset exitoso. Inicialmente vacío para que
  // el campo aparezca enmascarado.
  const [pwNuevo, setPwNuevo] = useState("");
  const [mostrar, setMostrar] = useState(false);

  const resetPassword = async () => {
    try {
      const resp = await resetearPasswordUsuario(usuario.id);
      setPwNuevo(resp.initial_password);
      setMostrar(true);
      toast.success("Nueva contraseña generada", {
        description:
          "Cópiala y compártela con el trabajador por un canal seguro. " +
          "El backend la guarda hasheada; no se vuelve a mostrar.",
      });
    } catch (e) {
      toast.error("No se pudo restablecer la contraseña", {
        description: e.message || "Inténtalo de nuevo.",
      });
    }
  };

  const toggleEstado = (activo) => {
    if (!trabajador?.id) return;
    const mut = activo ? activarTrabajador : desactivarTrabajador;
    mut(trabajador.id, {})
      .then(() =>
        toast.success(activo ? "Acceso activado" : "Acceso desactivado", {
          description: activo
            ? "El trabajador podrá iniciar sesión de nuevo."
            : "El trabajador no podrá iniciar sesión hasta que lo reactives.",
        }),
      )
      .catch((e) =>
        toast.error("No se pudo cambiar el estado", {
          description: e.message || "Inténtalo de nuevo.",
        }),
      );
  };

  const copiar = (texto, label = "Copiado al portapapeles") => {
    if (!texto) return;
    navigator.clipboard
      .writeText(texto)
      .then(() => toast.success(label))
      .catch(() => toast.error("No se pudo copiar"));
  };

  const accesoActivo = usuario.estado === "activo";
  // Si el backend no expone "estado" en /api/users/{id}/, caemos al flag
  // is_active. Para D1 asumimos que el GET expone al menos uno de los dos.
  const isActive = accesoActivo || usuario.is_active;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciales de acceso</CardTitle>
          <CardDescription>
            Con estas credenciales el trabajador puede entrar a JornalPro en modo solo
            lectura.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Usuario</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={usuario.usuario || usuario.email}
                className="font-mono"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-tap min-w-tap"
                onClick={() =>
                  copiar(usuario.usuario || usuario.email, "Usuario copiado")
                }
                aria-label="Copiar usuario"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Contraseña</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={
                  pwNuevo
                    ? mostrar
                      ? pwNuevo
                      : "•".repeat(Math.max(8, pwNuevo.length))
                    : "••••••••"
                }
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-tap min-w-tap"
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
                disabled={!pwNuevo}
              >
                {mostrar ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-tap min-w-tap"
                onClick={() => copiar(pwNuevo, "Contraseña copiada")}
                disabled={!pwNuevo}
                aria-label="Copiar contraseña"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                onClick={resetPassword}
                className="min-h-tap"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {pwNuevo ? "Generar otra" : "Restablecer"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              La contraseña nunca se muestra en un GET. Solo aparece aquí
              tras un "Restablecer" y desaparece al recargar la página.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estado del acceso</CardTitle>
          <CardDescription>
            Puedes suspender o reactivar el inicio de sesión del trabajador sin
            eliminarlo de la cuadrilla.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isActive ? (
                <Badge variant="default" className="gap-1.5">
                  <ShieldCheck className="h-3 w-3" /> Activo
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1.5">
                  <ShieldOff className="h-3 w-3" /> Suspendido
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {isActive
                  ? "El trabajador puede iniciar sesión."
                  : "El trabajador no puede iniciar sesión."}
              </span>
            </div>
          </div>
          <Switch
            checked={!!isActive}
            onCheckedChange={(v) => toggleEstado(v)}
            aria-label="Cambiar estado de acceso"
          />
        </CardContent>
      </Card>
    </div>
  );
}
