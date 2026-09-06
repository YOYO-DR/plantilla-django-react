// Pestaña Acceso: gestión de credenciales del trabajador (username, estado,
// reset de contraseña).

import { useState } from "react";
import { Copy, KeyRound, Power, ShieldCheck, ShieldOff, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import { useData } from "@/context/DataContext";
import { formatFecha } from "@/lib/format";

export function AccesoTab({ trabajador, usuario }) {
  const { actualizarUsuario, generarPassword } = useData();
  const [mostrar, setMostrar] = useState(false);
  const [pwActual, setPwActual] = useState(usuario.password);

  const resetPassword = () => {
    const nuevo = generarPassword(10);
    actualizarUsuario(usuario.id, { password: nuevo });
    setPwActual(nuevo);
    setMostrar(true);
    toast.success("Nueva contraseña generada", {
      description: "Cópiala y compártela con el trabajador por un canal seguro.",
    });
  };

  const toggleEstado = (activo) => {
    actualizarUsuario(usuario.id, { estado: activo ? "activo" : "suspendido" });
    toast.success(
      activo ? "Acceso activado" : "Acceso desactivado",
      {
        description: activo
          ? "El trabajador podrá iniciar sesión de nuevo."
          : "El trabajador no podrá iniciar sesión hasta que lo reactives.",
      },
    );
  };

  const copiar = (texto, label = "Copiado al portapapeles") => {
    navigator.clipboard
      .writeText(texto)
      .then(() => toast.success(label))
      .catch(() => toast.error("No se pudo copiar"));
  };

  const accesoActivo = usuario.estado === "activo";

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
                value={usuario.usuario}
                className="font-mono"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-tap min-w-tap"
                onClick={() => copiar(usuario.usuario, "Usuario copiado")}
                aria-label="Copiar usuario"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Contraseña actual</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={mostrar ? pwActual : "•".repeat(Math.max(8, pwActual.length))}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-tap min-w-tap"
                onClick={() => setMostrar((v) => !v)}
                aria-label={mostrar ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="min-h-tap min-w-tap"
                onClick={() => copiar(pwActual, "Contraseña copiada")}
                aria-label="Copiar contraseña"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button type="button" onClick={resetPassword} className="min-h-tap">
                <KeyRound className="mr-2 h-4 w-4" />
                Restablecer
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              La contraseña se guarda hasheada en el backend. El "Restablecer" del
              prototipo la regenera a un valor aleatorio y la muestra una sola vez;
              en producción se enviará por correo.
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
              {accesoActivo ? (
                <Badge variant="default" className="gap-1.5">
                  <ShieldCheck className="h-3 w-3" /> Activo
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1.5">
                  <ShieldOff className="h-3 w-3" /> Suspendido
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {accesoActivo
                  ? "El trabajador puede iniciar sesión."
                  : "El trabajador NO puede iniciar sesión."}
              </span>
            </div>
            {usuario.creadoEn && (
              <p className="text-xs text-muted-foreground">
                Creado: {formatFecha(usuario.creadoEn, "dd/MM/yyyy")}
                {usuario.ultimoAcceso && (
                  <> · Último acceso: {formatFecha(usuario.ultimoAcceso, "dd/MM/yyyy HH:mm")}</>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Power className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">{accesoActivo ? "Desactivar acceso" : "Activar acceso"}</Label>
            <Switch
              checked={accesoActivo}
              onCheckedChange={toggleEstado}
              aria-label="Alternar acceso"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del trabajador (informativo)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Nombre</p>
            <p className="font-medium">{usuario.nombre}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Rol</p>
            <p className="font-medium capitalize">{usuario.rol}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Tenant</p>
            <p className="font-medium">{trabajador.tenantId}</p>
          </div>
          <div>
            <p className="text-muted-foreground">TrabajadorId</p>
            <p className="font-mono text-xs">{trabajador.id}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}