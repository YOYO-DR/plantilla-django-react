// Página 403 amable, usada cuando un usuario autenticado intenta acceder a una
// ruta de otro rol.

import { Link, useNavigate } from "react-router-dom";
import { ShieldOff, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

export default function AccesoDenegado() {
  const { usuario, cerrarSesion } = useAuth();
  const navigate = useNavigate();
  const inicio = usuario?.rol ? `/app/${usuario.rol}` : "/app";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldOff className="h-6 w-6" />
          </div>
          <CardTitle className="display text-xl">No tienes acceso a esta vista</CardTitle>
          <CardDescription>
            Tu rol actual (<strong className="capitalize">{usuario?.rol}</strong>) no
            tiene permisos para abrir esta ruta. Si crees que es un error, contacta al
            administrador de la plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => navigate(inicio)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Ir a mi inicio
          </Button>
          <Button asChild variant="outline">
            <Link to="/app/perfil">Ver mi perfil</Link>
          </Button>
          <Button onClick={cerrarSesion} variant="ghost">
            Cambiar de usuario
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
