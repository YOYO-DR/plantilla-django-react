// Pestaña "Seguridad" — cambio de contraseña + cerrar sesión.

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Lock, LogOut } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import { useAuth } from "@/context/AuthContext";

const passwordSchema = z
  .object({
    actual: z.string().min(1, "Ingresa tu contraseña actual"),
    nueva: z.string().min(6, "Mínimo 6 caracteres"),
    confirmar: z.string().min(6, "Mínimo 6 caracteres"),
  })
  .refine((d) => d.nueva === d.confirmar, {
    path: ["confirmar"],
    message: "Las contraseñas no coinciden",
  });

export function SeguridadTab() {
  const { usuario, cambiarPassword, cerrarSesion } = useAuth();

  const form = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { actual: "", nueva: "", confirmar: "" },
  });

  const onSubmit = (data) => {
    if (!usuario) return;
    const r = cambiarPassword(data.actual, data.nueva);
    if (r.ok === false) {
      toast.error(r.error);
      return;
    }
    toast.success("Contraseña actualizada");
    form.reset();
  };

  const nueva = form.watch("nueva");
  const fuerza = fuerzaPassword(nueva ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="display text-base">Seguridad</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="actual">Contraseña actual</Label>
            <Input
              id="actual"
              type="password"
              autoComplete="current-password"
              {...form.register("actual")}
              aria-invalid={!!form.formState.errors.actual}
            />
            {form.formState.errors.actual && (
              <p className="text-xs text-destructive">{form.formState.errors.actual.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nueva">Nueva contraseña</Label>
            <Input
              id="nueva"
              type="password"
              autoComplete="new-password"
              {...form.register("nueva")}
              aria-invalid={!!form.formState.errors.nueva}
            />
            <Progress value={fuerza} className="h-1.5" />
            <p className="text-xs text-muted-foreground">
              Fuerza: {etiquetaFuerza(fuerza)} (mínimo 6 caracteres)
            </p>
            {form.formState.errors.nueva && (
              <p className="text-xs text-destructive">{form.formState.errors.nueva.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmar">Confirmar nueva contraseña</Label>
            <Input
              id="confirmar"
              type="password"
              autoComplete="new-password"
              {...form.register("confirmar")}
              aria-invalid={!!form.formState.errors.confirmar}
            />
            {form.formState.errors.confirmar && (
              <p className="text-xs text-destructive">{form.formState.errors.confirmar.message}</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            La contraseña se guarda hasheada en el backend (Django + Argon2). El navegador
            solo retiene el access token (memoria) y el refresh token (cookie HttpOnly).
          </p>
          <div className="flex justify-end">
            <Button type="submit">
              <Lock className="mr-2 h-4 w-4" /> Cambiar contraseña
            </Button>
          </div>
        </form>

        <Separator />

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Sesión</h3>
          <p className="text-xs text-muted-foreground">
            Tu sesión está activa en este navegador. Ciérrala si vas a usar otro
            equipo o si compartes el dispositivo.
          </p>
          <Button variant="outline" onClick={cerrarSesion} className="min-h-tap">
            <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Mide la fortaleza (0–100) según longitud y variedad. */
function fuerzaPassword(s) {
  if (!s) return 0;
  let score = 0;
  score += Math.min(40, s.length * 4);
  if (/[a-z]/.test(s)) score += 12;
  if (/[A-Z]/.test(s)) score += 14;
  if (/[0-9]/.test(s)) score += 14;
  if (/[^A-Za-z0-9]/.test(s)) score += 20;
  return Math.min(100, score);
}

function etiquetaFuerza(score) {
  if (score < 30) return "Débil";
  if (score < 60) return "Aceptable";
  if (score < 80) return "Buena";
  return "Excelente";
}