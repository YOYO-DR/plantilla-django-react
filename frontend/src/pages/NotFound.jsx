// Página 404 con el mismo lenguaje visual de JornalPro.

import { Link } from "react-router-dom";
import { Compass, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/layout/Logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="space-y-3">
          <div className="mx-auto">
            <Logo />
          </div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Compass className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle className="display text-2xl">Página no encontrada</CardTitle>
          <CardDescription>
            La ruta que intentaste abrir no existe o se movió. Verifica la URL
            o vuelve al inicio.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Ir al inicio
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">Iniciar sesión</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
