// Página única de perfil /app/perfil para los tres roles (Fase 9).
// Muestra pestañas según el rol; "Mi cuadrilla" sólo para maestro.

import { useState } from "react";
import { User, Lock, Settings, Building2 } from "lucide-react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useAuth } from "@/context/AuthContext";
import { iniciales, formatFecha } from "@/lib/format";

import { CuentaTab } from "./CuentaTab";
import { SeguridadTab } from "./SeguridadTab";
import { PreferenciasTab } from "./PreferenciasTab";
import { MiCuadrillaTab } from "./MiCuadrillaTab";

export default function Perfil() {
  const { usuario, tenant, cerrarSesion } = useAuth();
  const [tab, setTab] = useState(
    "cuenta",
  );

  if (!usuario) return null;
  const avatar = null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-4">
        <Avatar className="h-16 w-16">
          {avatar && <AvatarImage src={avatar} alt={usuario.nombre} />}
          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
            {iniciales(usuario.nombre)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h1 className="display text-2xl font-semibold sm:text-3xl">{usuario.nombre}</h1>
          <p className="text-sm text-muted-foreground">
            @{usuario.usuario} · <Badge variant="outline" className="capitalize">{usuario.rol}</Badge>
            {tenant && <> · {tenant.nombre}</>}
          </p>
          {usuario.ultimoAcceso && (
            <p className="mt-1 text-xs text-muted-foreground">
              Último acceso: {formatFecha(usuario.ultimoAcceso, "dd/MM/yyyy HH:mm")}
            </p>
          )}
        </div>
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v)} className="space-y-4">
        <TabsList className="flex h-auto w-full justify-start overflow-x-auto">
          <TabsTrigger value="cuenta" className="min-h-tap">
            <User className="mr-1 h-4 w-4" /> Cuenta
          </TabsTrigger>
          <TabsTrigger value="seguridad" className="min-h-tap">
            <Lock className="mr-1 h-4 w-4" /> Seguridad
          </TabsTrigger>
          <TabsTrigger value="preferencias" className="min-h-tap">
            <Settings className="mr-1 h-4 w-4" /> Preferencias
          </TabsTrigger>
          {usuario.rol === "maestro" && (
            <TabsTrigger value="cuadrilla" className="min-h-tap">
              <Building2 className="mr-1 h-4 w-4" /> Mi cuadrilla
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="cuenta">
          <CuentaTab />
        </TabsContent>
        <TabsContent value="seguridad">
          <SeguridadTab />
        </TabsContent>
        <TabsContent value="preferencias">
          <PreferenciasTab />
        </TabsContent>
        {usuario.rol === "maestro" && (
          <TabsContent value="cuadrilla">
            <MiCuadrillaTab />
          </TabsContent>
        )}
      </Tabs>

      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground">
          <button
            onClick={cerrarSesion}
            className="text-destructive hover:underline"
          >
            Cerrar sesión
          </button>{" "}
          en este navegador.
        </CardContent>
      </Card>
    </div>
  );
}
