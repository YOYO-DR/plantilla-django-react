// Comprobante de pago en modo lectura para el trabajador (Fase 8).
// Reutiliza el componente ComprobanteLiquidacion de Fase 7.

import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

import { useData } from "@/context/DataContext";
import { useTrabajadorActual } from "@/context/useTrabajadorActual";
import { ComprobanteLiquidacion } from "@/components/Maestro/ComprobanteLiquidacion";

export default function TrabajadorComprobante() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { liquidaciones, trabajadores, todosLosUsuarios } = useData();
  const t = useTrabajadorActual();

  const liq = liquidaciones.find((l) => l.id === id);

  // El trabajador sólo puede ver SU comprobante — R8.
  if (liq && t && liq.trabajadorId !== t.id) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="min-h-tap w-fit -ml-2">
          <button onClick={() => navigate("/app/trabajador/pagos")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Mis pagos
          </button>
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Este comprobante no te pertenece.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!liq) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="min-h-tap w-fit -ml-2">
          <button onClick={() => navigate("/app/trabajador/pagos")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Mis pagos
          </button>
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Comprobante no encontrado.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ComprobanteLiquidacion
      liquidacion={liq}
      trabajadores={trabajadores}
      usuarios={todosLosUsuarios}
    />
  );
}
