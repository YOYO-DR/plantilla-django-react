// Login a dos columnas (escritorio) / apilado (móvil).
// Bloque de credenciales demo clicables agrupadas por rol.

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  HardHat,
  Hammer,
  ShieldCheck,
  Loader2,
  ArrowRight,
  Info,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/layout/Logo";

import { authService } from "@/api/authService";

const loginSchema = z.object({
  usuario: z.string().min(1, "Ingresa tu usuario"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

const CREDENCIALES_GRUPO = [
  {
    titulo: "Administrador de plataforma",
    icono: ShieldCheck,
    items: [{ usuario: "admin", password: "admin123", nombre: "Soporte JornalPro", rol: "admin" }],
  },
  {
    titulo: "Maestros",
    icono: HardHat,
    items: [
      { usuario: "jairo", password: "maestro123", nombre: "Jairo Restrepo", rol: "maestro", extra: "Cali" },
      { usuario: "wilson", password: "maestro123", nombre: "Wilson Cárdenas", rol: "maestro", extra: "Palmira" },
    ],
  },
  {
    titulo: "Trabajadores",
    icono: Hammer,
    items: [
      { usuario: "carlos", password: "obra123", nombre: "Carlos Mosquera", rol: "trabajador" },
      { usuario: "duvan", password: "obra123", nombre: "Duván Riascos", rol: "trabajador" },
      { usuario: "edinson", password: "obra123", nombre: "Édinson Palacios", rol: "trabajador" },
      { usuario: "wilmar", password: "obra123", nombre: "Wilmar Angulo", rol: "trabajador" },
      { usuario: "freddy", password: "obra123", nombre: "Freddy Caicedo", rol: "trabajador" },
      { usuario: "yeison", password: "obra123", nombre: "Yeison Bonilla", rol: "trabajador" },
    ],
  },
];

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const destino = params.get("destino");
  const [cargando, setCargando] = useState(false);
  const [mostrarPass, setMostrarPass] = useState(false);

  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { usuario: "", password: "" },
  });

  const enviar = async (data) => {
    setCargando(true);
    try {
      const email = String(data.usuario).includes("@")
        ? data.usuario
        : `${data.usuario}@jornalpro.dev`;
      const user = await authService.login(email, data.password);
      toast.success("Sesión iniciada");
      if (user.groups?.includes("AdminPlataforma")) {
        navigate("/app/admin", { replace: true });
      } else if (user.groups?.includes("Maestro")) {
        navigate("/app/maestro", { replace: true });
      } else if (user.groups?.includes("Trabajador")) {
        navigate("/app/trabajador", { replace: true });
      } else {
        navigate(destino && destino.startsWith("/") ? destino : "/app", { replace: true });
      }
    } catch (err) {
      const msg = err.message || "Usuario o contraseña incorrectos.";
      toast.error(msg);
      form.setError("password", { message: msg });
    } finally {
      setCargando(false);
    }
  };

  const autocompletar = (c) => {
    form.setValue("usuario", c.usuario);
    form.setValue("password", c.password);
    form.clearErrors();
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Lado izquierdo — marca */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-surface p-10 text-surface-foreground lg:flex">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/30 via-surface to-surface opacity-90" aria-hidden />
        <div className="absolute inset-0 -z-10 opacity-20" aria-hidden>
          <img
            src="/hero.svg"
            alt=""
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>

        <Logo className="bg-primary text-primary-foreground" />

        <div className="space-y-5">
          <h2 className="display text-3xl font-bold leading-tight">
            El cuaderno de obra,
            <br /> ahora en tu bolsillo.
          </h2>
          <p className="max-w-md text-sm text-surface-foreground/70">
            Lleva la nómina semanal de tu cuadrilla desde el celular. Marca
            jornadas, registra préstamos, descuenta deudas y paga el sábado.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge className="bg-primary/20 text-primary-foreground">Mobile-first</Badge>
            <Badge className="bg-primary/20 text-primary-foreground">Multi-tenant</Badge>
            <Badge className="bg-primary/20 text-primary-foreground">COP nativo</Badge>
          </div>
        </div>

        <p className="text-xs text-surface-foreground/50">
          © {new Date().getFullYear()} JornalPro · Plataforma de gestión de jornales
        </p>
      </aside>

      {/* Lado derecho — formulario */}
      <main className="flex items-center justify-center bg-background px-5 py-10 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          {/* Encabezado móvil */}
          <div className="flex items-center justify-between lg:hidden">
            <Logo />
          </div>

          <Card className="border-0 shadow-none sm:border sm:shadow-sm">
            <CardHeader className="space-y-2">
              <CardTitle className="display text-2xl">Inicia sesión</CardTitle>
              <CardDescription>
                Entra con tu usuario y contraseña de la cuadrilla.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={form.handleSubmit(enviar)} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="usuario">Usuario</Label>
                  <Input
                    id="usuario"
                    autoComplete="username"
                    placeholder="p. ej. jairo"
                    {...form.register("usuario")}
                    aria-invalid={!!form.formState.errors.usuario}
                  />
                  {form.formState.errors.usuario && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.usuario.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={mostrarPass ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="pr-10"
                      {...form.register("password")}
                      aria-invalid={!!form.formState.errors.password}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPass((v) => !v)}
                      className="absolute inset-y-0 right-0 flex min-w-tap items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={mostrarPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {mostrarPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button type="submit" disabled={cargando} className="w-full min-h-tap">
                  {cargando ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando…
                    </>
                  ) : (
                    <>
                      Entrar <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>
                  <strong className="text-foreground">Autenticación real</strong> —
                  las credenciales se validan contra el backend Django + SimpleJWT.
                  Para sembrar usuarios de prueba: <span className="font-mono">just manage-direct-db seed_users --yes</span>.
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <Link to="/" className="hover:text-foreground">← Volver al inicio</Link>
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" /> SimpleJWT HttpOnly refresh
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Credenciales demo */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="display text-base">Credenciales de demostración</CardTitle>
              <CardDescription className="text-xs">
                Toca una tarjeta para autocompletar el formulario. Cada una abre un rol distinto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {CREDENCIALES_GRUPO.map((grupo, idx) => (
                <div key={grupo.titulo}>
                  <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <grupo.icono className="h-3.5 w-3.5" />
                    {grupo.titulo}
                  </div>
                  <div className="grid gap-1.5">
                    {grupo.items.map((c) => (
                      <button
                        key={c.usuario + c.password}
                        type="button"
                        onClick={() => autocompletar(c)}
                        className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-left text-xs hover:border-primary/60 hover:bg-primary/5 min-h-tap"
                      >
                        <span className="flex flex-col">
                          <span className="font-medium text-foreground">{c.nombre}</span>
                          <span className="text-muted-foreground">
                            <span className="font-mono">@{c.usuario}</span>
                            {c.extra && <span> · {c.extra}</span>}
                          </span>
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          · · · {c.password.slice(-1)}
                        </span>
                      </button>
                    ))}
                  </div>
                  {idx < CREDENCIALES_GRUPO.length - 1 && <Separator className="mt-3" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
