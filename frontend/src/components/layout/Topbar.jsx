// Topbar oscura con logo, nombre del tenant activo, buscador decorativo,
// toggle de tema y menú de usuario.

import { Link, useNavigate } from "react-router-dom";
import { Moon, Sun, Search, LogOut, User, Settings } from "lucide-react";

import { Logo } from "./Logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { iniciales } from "@/lib/format";

export function Topbar() {
  const { usuario, tenant, cerrarSesion, trabajador } = useAuth();
  const { resolved, toggle } = useTheme();
  const navigate = useNavigate();

  const subtitulo = (() => {
    if (tenant?.nombre) return tenant.nombre;
    if (usuario?.rol === "admin") return "Plataforma JornalPro";
    if (trabajador?.oficio) return `Trabajador · ${trabajador.oficio}`;
    return usuario?.rol === "trabajador" ? "Trabajador" : usuario?.rol ?? "";
  })();

  return (<header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground">
      <Link to="/app" className="flex shrink-0 items-center">
        <Logo />
      </Link>
      <span className="hidden h-6 w-px bg-sidebar-border md:block" aria-hidden />
      <div className="hidden min-w-0 flex-col md:flex">
        <span className="truncate text-xs font-medium uppercase tracking-wide text-sidebar-foreground/60">
          {usuario?.rol}
        </span>
        <span className="truncate text-sm font-semibold capitalize">
          {subtitulo}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/50" />
          <Input
            placeholder="Buscar…"
            disabled
            className="h-9 w-56 border-sidebar-border bg-sidebar-accent pl-8 text-sidebar-foreground placeholder:text-sidebar-foreground/40"
            aria-label="Buscar (próximamente)"
          />
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Cambiar tema"
        >
          {resolved === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex h-9 items-center gap-2 rounded-md px-1 py-1 hover:bg-sidebar-accent"
              aria-label="Menú de usuario"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {iniciales(usuario?.nombre ?? "")}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium md:inline">
                {usuario?.nombre?.split(" ")[0]}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="font-semibold">{usuario?.nombre}</span>
              <span className="text-xs font-normal text-muted-foreground">
                @{usuario?.usuario} · {usuario?.rol}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/app/perfil")}>
              <User className="mr-2 h-4 w-4" /> Mi perfil
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/app/perfil#preferencias")}>
              <Settings className="mr-2 h-4 w-4" /> Preferencias
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={cerrarSesion} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>);
}
