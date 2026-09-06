// Sidebar fija visible solo en `lg+`. Ítems según rol.

import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  CreditCard,
  Calculator,
  CalendarRange,
  BarChart3,
  Users,
  Building2,
  LayoutDashboard,
  Database } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS_POR_ROL = {
  maestro: [
    { to: "/app/maestro", label: "Inicio", icon: LayoutDashboard },
    { to: "/app/maestro/trabajadores", label: "Trabajadores", icon: Users },
    { to: "/app/maestro/jornadas", label: "Jornadas", icon: CalendarDays },
    { to: "/app/maestro/calendario", label: "Calendario", icon: CalendarRange },
    { to: "/app/maestro/deudas", label: "Deudas", icon: CreditCard },
    { to: "/app/maestro/pagos", label: "Liquidar", icon: Calculator },
  ],
  trabajador: [
    { to: "/app/trabajador", label: "Mi semana", icon: LayoutDashboard },
    { to: "/app/trabajador/dias", label: "Mis días", icon: CalendarRange },
    { to: "/app/trabajador/deuda", label: "Mi deuda", icon: CreditCard },
    { to: "/app/trabajador/pagos", label: "Mis pagos", icon: Calculator },
  ],
  admin: [
    { to: "/app/admin", label: "Panel", icon: BarChart3 },
    { to: "/app/admin/tenants", label: "Cuadrillas", icon: Building2 },
    { to: "/app/admin/usuarios", label: "Usuarios", icon: Users },
    { to: "/app/admin/sistema", label: "Sistema", icon: Database },
  ],
};

export function Sidebar({ rol }) {
  const items = ITEMS_POR_ROL[rol];

  return (<aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] self-start overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block lg:w-60 lg:shrink-0">
      <nav className="flex flex-col gap-1 px-3 py-4">
        <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
          {rol === "maestro"
            ? "Operación"
            : rol === "trabajador"
              ? "Mi información"
              : "Plataforma"}
        </p>
        {items.map((it) => {
          const isIndex = it.to.split("/").filter(Boolean).length === 2;
          return (<NavLink
              key={it.to}
              to={it.to}
              end={isIndex}
              className={({ isActive }) =>
                cn("flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors min-h-tap", isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )
              }
            >
              <it.icon className="h-4 w-4" />
              <span>{it.label}</span>
            </NavLink>);
        })}
      </nav>
    </aside>);
}
