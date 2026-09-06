// BottomNav: navegación inferior fija en móvil (<lg). Máximo 5 ítems con
// ícono + etiqueta. Los ítems se derivan del rol para mantener paridad con Sidebar.

import { NavLink } from "react-router-dom";
import {
  CalendarDays,
  Wallet,
  Calculator,
  BarChart3,
  Users,
  Building2,
  LayoutDashboard,
  User } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS_POR_ROL = {
  maestro: [
    { to: "/app/maestro", label: "Inicio", icon: LayoutDashboard },
    { to: "/app/maestro/trabajadores", label: "Cuadrilla", icon: Users },
    { to: "/app/maestro/jornadas", label: "Jornadas", icon: CalendarDays },
    { to: "/app/maestro/liquidaciones", label: "Liquidar", icon: Calculator },
    { to: "/app/perfil", label: "Perfil", icon: User },
  ],
  trabajador: [
    { to: "/app/trabajador", label: "Inicio", icon: LayoutDashboard },
    { to: "/app/trabajador/dias", label: "Mis días", icon: CalendarDays },
    { to: "/app/trabajador/deuda", label: "Mi deuda", icon: Wallet },
    { to: "/app/trabajador/pagos", label: "Mis pagos", icon: Calculator },
    { to: "/app/perfil", label: "Perfil", icon: User },
  ],
  admin: [
    { to: "/app/admin", label: "Panel", icon: BarChart3 },
    { to: "/app/admin/tenants", label: "Tenants", icon: Building2 },
    { to: "/app/admin/usuarios", label: "Usuarios", icon: Users },
    { to: "/app/perfil", label: "Perfil", icon: User },
  ],
};

export function BottomNav({ rol }) {
  const items = ITEMS_POR_ROL[rol];

  return (<nav
      className="fixed inset-x-0 bottom-0 z-30 grid border-t bg-card/95 backdrop-blur lg:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map((it) => {
        const isIndex = it.to.split("/").filter(Boolean).length === 2;
        return (<NavLink
            key={it.to}
            to={it.to}
            end={isIndex}
            className={({ isActive }) =>
              cn("flex min-h-tap flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors", isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )
            }
          >
            <it.icon className="h-5 w-5" />
            <span className="truncate">{it.label}</span>
          </NavLink>);
      })}
    </nav>);
}
