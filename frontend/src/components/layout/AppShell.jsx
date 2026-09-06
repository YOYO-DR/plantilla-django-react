// AppShell: layout raíz para todas las rutas protegidas. Compone Topbar +
// Sidebar (lg+) + BottomNav (móvil) + área de contenido.

import { Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

import { Topbar } from "./Topbar";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";

export function AppShell() {
  const { usuario } = useAuth();
  const rol = usuario?.rol;

  return (<div className="flex min-h-screen flex-col bg-background text-foreground">
      <Topbar />
      <div className="flex flex-1">
        {rol ? <Sidebar rol={rol} /> : null}
        <main className="flex-1 pb-24 lg:pb-8">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      {rol ? <BottomNav rol={rol} /> : null}
    </div>);
}
