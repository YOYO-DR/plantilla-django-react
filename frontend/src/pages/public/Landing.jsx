// Landing pública (Fase 11). 9 secciones, mockups de la app, "Entrar como…".
// Animaciones al scroll con IntersectionObserver (useReveal).

import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ClipboardList,
  Wallet,
  Calculator,
  CalendarCheck,
  ShieldCheck,
  HardHat,
  BookOpen,
  Check,
  ArrowRight,
  Play,
  Loader2,
  Hourglass,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/Logo";

import { useAuth } from "@/context/AuthContext";
import { useReveal } from "@/hooks/useReveal";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------
// Sección 1 — Header sticky
// ------------------------------------------------------------------

const SECCIONES = [
  { id: "problema", label: "El problema" },
  { id: "como-funciona", label: "Cómo funciona" },
  { id: "funcionalidades", label: "Funcionalidades" },
  { id: "roles", label: "Roles" },
  { id: "demo", label: "Probar la demo" },
];

function HeaderLanding() {
  const { sesion } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all",
        scrolled ? "border-b border-border bg-background/90 backdrop-blur" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-2 md:flex">
          {SECCIONES.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {s.label}
            </a>
          ))}
        </nav>
        <Button asChild className="min-h-tap">
          <Link to={sesion ? "/app" : "/login"}>
            {sesion ? "Ir a la app" : "Entrar a la demo"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}

// ------------------------------------------------------------------
// Hook de "Entrar como" — login directo + navegación
// ------------------------------------------------------------------

function useEntrarComo() {
  const navigate = useNavigate();
  const { iniciarSesion } = useAuth();
  return async (usuario, password, destino, label) => {
    const r = await iniciarSesion(usuario, password);
    if (r.ok === false) {
      toast.error(r.error);
      return;
    }
    toast.success(`Sesión iniciada como ${label}`);
    navigate(destino, { replace: true });
  };
}

// ------------------------------------------------------------------
// Mockups (sólo visual, sin DataContext)
// ------------------------------------------------------------------

function MockupGrilla() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-amber-500/10">
      <div className="flex items-center justify-between border-b bg-muted/60 px-3 py-2 text-xs">
        <span className="font-semibold">Semana del 8 al 14 de septiembre</span>
        <span className="rounded bg-warning/10 px-2 py-0.5 text-warning">Sin liquidar</span>
      </div>
      <div className="space-y-2 p-3">
        {/* Encabezado días */}
        <div className="grid grid-cols-[140px_repeat(7,1fr)_60px_80px] gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span />
          {["L 8", "M 9", "M 10", "J 11", "V 12", "S 13", "D 14"].map((d) => (
            <span key={d} className="text-center">
              {d}
            </span>
          ))}
          <span className="text-center">Días</span>
          <span className="text-right">Semana</span>
        </div>
        {/* Fila Carlos */}
        <FilaMock
          nombre="Carlos Mosquera"
          tarifa="$110.000"
          cells={[
            { tipo: "completo" },
            { tipo: "completo" },
            { tipo: "completo" },
            { tipo: "medio" },
            { tipo: "no_trabajo" },
            { tipo: "completo" },
            { tipo: "vacio" },
          ]}
          dias="4.5"
          total="$467.500"
        />
        {/* Fila Duván */}
        <FilaMock
          nombre="Duván Riascos"
          tarifa="$80.000"
          cells={[
            { tipo: "completo" },
            { tipo: "completo" },
            { tipo: "completo" },
            { tipo: "completo" },
            { tipo: "medio", override: true },
            { tipo: "completo" },
            { tipo: "vacio" },
          ]}
          dias="4.5"
          total="$400.000"
          override={1}
        />
      </div>
    </div>
  );
}

function FilaMock({
  nombre,
  tarifa,
  cells,
  dias,
  total,
  override = 0,
}) {
  const cellStyle = (tipo, hasOverride) => {
    const base = {
      completo: "bg-success/15 text-success border-success/40",
      medio: "bg-info/15 text-info border-info/40",
      no_trabajo: "bg-muted-strong/15 text-muted-strong border-muted-strong/30",
      vacio: "border-dashed border-muted-foreground/40 text-muted-foreground",
    };
    return cn(
      base[tipo],
      hasOverride && "ring-1 ring-warning/60",
    );
  };

  return (
    <>
      <div className="grid grid-cols-[140px_repeat(7,1fr)_60px_80px] items-center gap-1 text-xs">
        <div className="truncate px-2">
          <p className="truncate font-medium">{nombre}</p>
          <p className="truncate text-muted-foreground">{tarifa}</p>
        </div>
        {cells.map((c, i) => (
          <div key={i} className={cn(cellStyle(c.tipo, c.override), "relative h-12")}>
            {c.override && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-warning" />
            )}
            <span className="text-[10px]">
              {c.tipo === "no_trabajo"
                ? "—"
                : c.tipo === "vacio"
                  ? ""
                  : c.tipo === "medio"
                    ? "½"
                    : "✓"}
            </span>
          </div>
        ))}
        <span className="text-center num text-xs">{dias}</span>
        <span className="text-right text-xs font-semibold num">{total}</span>
      </div>
      {override > 0 && <span className="block" />}
    </>
  );
}

function MockupTrabajador() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-amber-500/10">
      <div className="border-b bg-primary/5 px-4 py-3">
        <p className="text-xs text-muted-foreground">Hola, Carlos.</p>
        <p className="text-sm font-medium">Construcciones Jairo · Cali</p>
      </div>
      <div className="space-y-3 p-4">
        <div className="rounded-lg border bg-primary/5 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Esta semana llevas
          </p>
          <p className="display text-3xl font-bold num text-primary">$ 467.500</p>
          <p className="text-[11px] text-muted-foreground">4 días completos · 1 medio</p>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {[
              "bg-success",
              "bg-success",
              "bg-success",
              "bg-info",
              "bg-muted-strong/30",
              "bg-success",
              "border-dashed border-muted-foreground/40 bg-transparent",
            ].map((c, i) => (
              <div
                key={i}
                className={cn("h-6 rounded", c)}
                aria-hidden
              />
            ))}
          </div>
        </div>
        <div className="rounded-lg border px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Tu deuda
          </p>
          <p className="num text-xl font-bold text-destructive">$ 80.000</p>
        </div>
        <div className="rounded-lg border px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Tu jornal
          </p>
          <p className="num text-base font-bold">$ 110.000 / día</p>
          <p className="text-[10px] text-muted-foreground">
            Medio día: <span className="num font-semibold">$ 55.000</span>
          </p>
        </div>
        <div className="rounded-lg border px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Último pago
          </p>
          <p className="num text-xl font-bold text-primary">$ 467.500</p>
          <p className="text-[10px] text-muted-foreground">Pago #248 · 6 de sep.</p>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Componentes auxiliares
// ------------------------------------------------------------------

function Reveal({
  children,
  className,
  delayMs = 0,
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
        className,
      )}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

function BloqueTarjeta({
  icon: Icon,
  titulo,
  descripcion,
  tono,
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-md", tones[tono])}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="display text-base font-semibold">{titulo}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{descripcion}</p>
    </div>
  );
}

// ------------------------------------------------------------------
// Sección 2 — Hero
// ------------------------------------------------------------------

function SeccionHero() {
  return (
    <section className="relative isolate overflow-hidden bg-surface text-surface-foreground">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-80"
        aria-hidden
        style={{
          background:
            "radial-gradient(800px 400px at 70% 0%, hsl(var(--primary) / 0.25) 0%, transparent 60%), radial-gradient(600px 300px at 0% 100%, hsl(var(--primary) / 0.18) 0%, transparent 70%)",
        }}
      />
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:py-32">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <HardHat className="h-3.5 w-3.5" /> Para maestros de obra en Colombia
          </span>
          <h1 className="display mt-4 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            El cuaderno de obra,
            <br />
            <span className="text-primary">ahora en tu bolsillo.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-surface-foreground/80 sm:text-lg">
            Lleva en el celular los días, los jornales y la deuda de cada trabajador de tu
            cuadrilla. Sin equivocarse, sin perder el cuaderno.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="min-h-tap">
              <Link to="/login">
                Ver la demo <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-h-tap bg-transparent text-surface-foreground hover:bg-surface-foreground/10">
              <a href="#como-funciona">
                <Play className="mr-2 h-4 w-4" /> Cómo funciona
              </a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-surface-foreground/60">
            Plataforma full-stack — frontend React + backend Django + PostgreSQL.
          </p>
        </Reveal>

        <Reveal delayMs={120} className="relative hidden lg:block">
          <div className="absolute -left-12 top-6 h-full w-[120%] origin-top-left rotate-[-3deg] scale-[0.95]">
            <MockupGrilla />
          </div>
        </Reveal>

        {/* Mockup secundario — móvil */}
        <Reveal className="lg:hidden">
          <MockupTrabajador />
        </Reveal>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// Sección 3 — El problema
// ------------------------------------------------------------------

function SeccionProblema() {
  const tarjetas = [
    {
      icon: BookOpen,
      titulo: "Todo en un cuaderno",
      descripcion: "Una hoja perdida significa un día que nadie cobrará, o que alguien cobrará dos veces.",
    },
    {
      icon: Hourglass,
      titulo: "Cada trabajador cobra distinto",
      descripcion: "Cobramos $80.000 al ayudante, $110.000 al oficial y hasta $140.000 al contratista. Sumar mentalmente ya es un error cada sábado.",
    },
    {
      icon: Wallet,
      titulo: "Los préstamos se olvidan",
      descripcion: "El lunes le presté $50.000 al ayudante. El sábado no apareció en el cuaderno porque cambié la libreta.",
    },
  ];
  return (
    <section id="problema" className="bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            El problema
          </p>
          <h2 className="display mt-2 text-3xl font-bold sm:text-4xl">
            Lo que pasa cada semana en una obra.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            La paga semanal es una de las tareas más críticas de un maestro. Y casi siempre
            depende de algo tan frágil como un cuaderno, un bolígrafo y la memoria.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {tarjetas.map((t, i) => (
            <Reveal key={t.titulo} delayMs={i * 80}>
              <BloqueTarjeta icon={t.icon} titulo={t.titulo} descripcion={t.descripcion} tono="warning" />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// Sección 4 — Cómo funciona
// ------------------------------------------------------------------

function SeccionComoFunciona() {
  const pasos = [
    {
      n: 1,
      icono: Users,
      titulo: "Registra tu cuadrilla",
      desc: "Crea el maestro, los trabajadores, su jornal y la tarifa base. Cada uno con su usuario de acceso.",
      miniatura: "Ilustración del paso 1",
    },
    {
      n: 2,
      icono: CalendarCheck,
      titulo: "Marca los días",
      desc: "Toca la celda de cada obrero en el día que trabajó. Completo, medio o no trabajó. Agrega tarifa especial si la jornada valió más.",
      miniatura: "Ilustración del paso 2",
    },
    {
      n: 3,
      icono: Wallet,
      titulo: "Anota los préstamos",
      desc: "Cuando le prestes $50.000, regístralo en su perfil. Queda como saldo vivo.",
      miniatura: "Ilustración del paso 3",
    },
    {
      n: 4,
      icono: Calculator,
      titulo: "Liquida y paga",
      desc: "El sábado liquidas toda la cuadrilla en una pasada: eliges cuánto descuento aplicar a la deuda y el comprobante queda listo.",
      miniatura: "Ilustración del paso 4",
    },
  ];
  return (
    <section id="como-funciona" className="border-t border-b bg-muted/30 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cómo funciona
          </p>
          <h2 className="display mt-2 text-3xl font-bold sm:text-4xl">
            Cuatro pasos, un solo flujo.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pasos.map((p, i) => (
            <Reveal key={p.n} delayMs={i * 80}>
              <div className="rounded-xl border bg-card p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <p.icono className="h-5 w-5" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="display text-xs uppercase tracking-wider text-primary">
                    Paso {p.n}
                  </span>
                </div>
                <h3 className="display mt-1 text-lg font-semibold">{p.titulo}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
                <div className="mt-3 rounded-md border border-dashed bg-muted/40 px-3 py-6 text-center text-xs text-muted-foreground">
                  {p.miniatura}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// Sección 5 — Funcionalidades
// ------------------------------------------------------------------

function SeccionFuncionalidades() {
  const feats = [
    {
      icon: ClipboardList,
      titulo: "Tarifa por trabajador",
      desc: "Cada uno con su jornal: ayudante, oficial, contratista. Puedes agregar excepciones por día concreto.",
    },
    {
      icon: Hourglass,
      titulo: "Medio día automático",
      desc: "Marca \"Medio\" y JornalPro aplica el factor que definas al trabajador — sin cuentas a mano.",
    },
    {
      icon: CalendarCheck,
      titulo: "Calendario mensual",
      desc: "Vista histórica de toda la cuadrilla o por persona. Un punto ámbar indica tarifa especial y un candado los días ya pagados.",
    },
    {
      icon: Wallet,
      titulo: "Préstamos y abonos",
      desc: "Registra adelantos y descuentos automáticos en el pago. Saldos siempre vivos, calculados a partir de los movimientos.",
    },
    {
      icon: Calculator,
      titulo: "Liquidación con descuento",
      desc: "No descuentes, descuenta todo o descuenta una parte. El comprobante queda inmutable al instante.",
    },
    {
      icon: ShieldCheck,
      titulo: "Portal del trabajador",
      desc: "El obrero entra con su usuario, ve sus días y su deuda. Sólo lectura — nunca puede modificar nada.",
    },
  ];
  return (
    <section id="funcionalidades" className="bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Funcionalidades
          </p>
          <h2 className="display mt-2 text-3xl font-bold sm:text-4xl">
            Todo lo que cabe en el bolsillo.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {feats.map((f, i) => (
            <Reveal key={f.titulo} delayMs={i * 50}>
              <BloqueTarjeta
                icon={f.icon}
                titulo={f.titulo}
                descripcion={f.desc}
                tono={i % 2 === 0 ? "primary" : "muted"}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// Sección 6 — Roles
// ------------------------------------------------------------------

function SeccionRoles() {
  const roles = [
    {
      rol: "Administrador",
      nombre: "admin",
      texto: "admin123",
      color: "bg-primary/10 text-primary",
      bullets: [
        "Ve métricas globales de todas las cuadrillas",
        "Crea nuevos maestros y cuadrillas",
        "Administra usuarios, contraseñas y suspensiones",
      ],
      destino: "/app/admin",
    },
    {
      rol: "Maestro",
      nombre: "jairo",
      texto: "maestro123",
      color: "bg-info/10 text-info",
      bullets: [
        "Crea y edita sus trabajadores",
        "Marca días, registra préstamos y liquida la semana",
        "Comprobantes inmutables para imprimir o compartir",
      ],
      destino: "/app/maestro",
    },
    {
      rol: "Trabajador",
      nombre: "carlos",
      texto: "obra123",
      color: "bg-success/10 text-success",
      bullets: [
        "Mira sus días y su deuda en el celular",
        "Revisa el historial de pagos con comprobante",
        "Modo sólo lectura — no puede modificar nada",
      ],
      destino: "/app/trabajador",
    },
  ];
  return (
    <section id="roles" className="border-t border-b bg-muted/30 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Los tres roles
          </p>
          <h2 className="display mt-2 text-3xl font-bold sm:text-4xl">
            Una app, tres espacios bien diferenciados.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Cada usuario entra a su propio espacio con permisos y pantallas distintas, pero todos
            ven datos coherentes porque comparten el mismo repositorio.
          </p>
        </Reveal>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {roles.map((r, i) => (
            <Reveal key={r.rol} delayMs={i * 100}>
              <div className="rounded-xl border bg-card p-5">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider", r.color)}>
                  {r.rol}
                </span>
                <h3 className="display mt-3 text-lg font-semibold">{r.rol === "Trabajador" ? "Solo lectura" : r.rol === "Maestro" ? "Operación completa" : "Plataforma"}</h3>
                <ul className="mt-3 space-y-2">
                  {r.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 text-success" /> {b}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// Sección 7 — Probar la demo
// ------------------------------------------------------------------

function TarjetaCredencial({
  titulo,
  descripcion,
  usuario,
  password,
  entrar,
  entrando,
}) {
  const copiar = () => {
    navigator.clipboard
      .writeText(`Usuario: ${usuario}\nContraseña: ${password}`)
      .then(() => toast.success("Credenciales copiadas"))
      .catch(() => toast.error("No se pudo copiar"));
  };
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{descripcion}</p>
      <div className="mt-3 space-y-1.5 font-mono text-xs">
        <p>
          <span className="text-muted-foreground">Usuario:</span>{" "}
          <strong className="text-foreground">{usuario}</strong>
        </p>
        <p>
          <span className="text-muted-foreground">Contraseña:</span>{" "}
          <strong className="text-foreground">{password}</strong>
        </p>
      </div>
      <div className="mt-3 flex gap-2">
        <Button onClick={entrar} disabled={entrando} className="min-h-tap flex-1">
          {entrando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
          {entrando ? "Entrando…" : "Entrar como"}
        </Button>
        <Button variant="outline" onClick={copiar} className="min-h-tap" aria-label="Copiar credenciales">
          Copiar
        </Button>
      </div>
    </div>
  );
}

function SeccionDemo() {
  const entrarComo = useEntrarComo();
  const [cargando, setCargando] = useState(null);

  const entrar = (key, usuario, password, destino) => {
    setCargando(key);
    void (async () => {
      await entrarComo(usuario, password, destino, key);
      setCargando(null);
    })();
  };

  return (
    <section id="demo" className="bg-background py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Pruébalo
          </p>
          <h2 className="display mt-2 text-3xl font-bold sm:text-4xl">
            Tres credenciales, tres espacios.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Estas son las cuentas semilla. Toca cualquier tarjeta para entrar y explorar.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Reveal delayMs={0}>
            <TarjetaCredencial
              titulo="Administrador"
              descripcion="Vista global y métricas."
              usuario="admin"
              password="admin123"
              entrar={() => entrar("admin", "admin", "admin123", "/app/admin")}
              entrando={cargando === "admin"}
            />
          </Reveal>
          <Reveal delayMs={80}>
            <TarjetaCredencial
              titulo="Maestro — Jairo"
              descripcion="Construcciones Jairo · Cali"
              usuario="jairo"
              password="maestro123"
              entrar={() => entrar("jairo", "jairo", "maestro123", "/app/maestro")}
              entrando={cargando === "jairo"}
            />
          </Reveal>
          <Reveal delayMs={160}>
            <TarjetaCredencial
              titulo="Trabajador — Carlos"
              descripcion="Oficial · Construcciones Jairo"
              usuario="carlos"
              password="obra123"
              entrar={() => entrar("carlos", "carlos", "obra123", "/app/trabajador")}
              entrando={cargando === "carlos"}
            />
          </Reveal>
        </div>

        <Reveal>
          <div className="mt-12 rounded-xl border bg-card p-5">
            <h3 className="display text-base font-semibold">
              Guion sugerido de recorrido (≈ 5 min)
            </h3>
            <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">1.</strong> Entra como{" "}
                <strong>Jairo</strong> y abre su dashboard.
              </li>
              <li>
                <strong className="text-foreground">2.</strong> Crea un trabajador{" "}
                <em className="text-foreground">"Andrés Lucumí"</em>, oficial, jornal $95.000.
              </li>
              <li>
                <strong className="text-foreground">3.</strong> En la grilla semanal márcale
                lunes a jueves completo, viernes medio y sábado completo con tarifa
                especial de $130.000. Mira el total: <span className="num font-semibold text-foreground">$557.500</span>.
              </li>
              <li>
                <strong className="text-foreground">4.</strong> Regístrale un préstamo de
                $100.000 y líquido la semana con descuento parcial de $60.000.
                Recibirá <span className="num font-semibold text-foreground">$497.500</span> y quedará debiendo{" "}
                <span className="num font-semibold text-foreground">$40.000</span>.
              </li>
              <li>
                <strong className="text-foreground">5.</strong> Imprime o comparte el
                comprobante por WhatsApp.
              </li>
              <li>
                <strong className="text-foreground">6.</strong> Cierra sesión y entra como{" "}
                <strong>andres</strong> / <span className="font-mono">obra123</span>: verás
                sus días y su deuda, pero ningún botón para cambiar nada.
              </li>
            </ol>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// Sección 8 — Detalles técnicos
// ------------------------------------------------------------------

function SeccionStack() {
  return (
    <section className="border-t border-b bg-muted/30 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bajo el capó
          </p>
          <h2 className="display mt-2 text-3xl font-bold sm:text-4xl">Stack y honestidad.</h2>
        </Reveal>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="rounded-xl border bg-card p-5">
              <h3 className="display text-base font-semibold">Construido con</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <li>· React 19 + Vite + Tailwind CSS + shadcn/ui</li>
                <li>· Django 6 + Django REST Framework + SimpleJWT</li>
                <li>· PostgreSQL 18 (con pgbouncer) + Redis 7</li>
                <li>· Docker Compose para todo el stack</li>
                <li>· FullCalendar (v6) para el calendario mensual</li>
                <li>· recharts para los gráficos del panel admin</li>
                <li>· date-fns (locale <span className="font-mono">es</span>)</li>
                <li>· React Hook Form + Zod para formularios</li>
              </ul>
            </div>
          </Reveal>
          <Reveal delayMs={80}>
            <div className="rounded-xl border bg-card p-5">
              <h3 className="display text-base font-semibold">Lo que <em>no</em> es (todavía)</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <li>· No hay notificaciones push ni SMS.</li>
                <li>· No hay reportes PDF exportables todavía (sólo print del comprobante).</li>
                <li>· No hay integración con pasarela de pagos (los pagos se registran manualmente).</li>
              </ul>
              <p className="mt-4 rounded-md border border-info/30 bg-info/5 px-3 py-2 text-xs text-muted-foreground">
                Sistema full-stack: frontend React, backend Django REST, persistencia en
                PostgreSQL. Para crear datos de prueba corre
                <span className="font-mono"> just manage-direct-db seed_users --yes</span>.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------
// Footer
// ------------------------------------------------------------------

function Footer() {
  return (
    <footer className="border-t bg-background py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-center gap-2">
          <Logo />
          <span>·</span>
          <span>Construido para mostrarle el proyecto a un maestro real.</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="hover:text-foreground">Entrar</Link>
          <a href="#problema" className="hover:text-foreground">El problema</a>
          <a href="#funcionalidades" className="hover:text-foreground">Funcionalidades</a>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}

// ------------------------------------------------------------------
// Componente principal
// ------------------------------------------------------------------

export default function Landing() {
  const location = useLocation();
  // Si la URL llega con #seccion, hacer scroll al destino tras montar.
  useEffect(() => {
    const id = location.hash.replace("#", "");
    if (!id) return;
    const target = document.getElementById(id);
    if (target) {
      window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
    }
  }, [location.hash]);

  return (
    <>
      <HeaderLanding />

      {/* Hero (a pantalla completa para emular la página de presentación) */}
      <div className="pt-14">
        <SeccionHero />
      </div>

      <SeccionProblema />
      <SeccionComoFunciona />
      <SeccionFuncionalidades />
      <SeccionRoles />
      <SeccionDemo />
      <SeccionStack />
      <Footer />

      {/* Helper para scroll suave en anclas */}
      <div className="hidden">
        <a href="#" aria-hidden>top</a>
      </div>

      {/* Chevron down flotante en hero — sólo desktop */}
      <a
        href="#problema"
        className="fixed bottom-6 left-1/2 hidden -translate-x-1/2 rounded-full bg-primary/10 px-3 py-2 text-primary shadow-sm backdrop-blur transition-colors hover:bg-primary/20 lg:block"
        aria-label="Ir al problema"
      >
        <ChevronDown className="h-4 w-4" />
      </a>
    </>
  );
}