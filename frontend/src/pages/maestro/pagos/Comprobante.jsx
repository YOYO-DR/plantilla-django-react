// Página del comprobante /app/maestro/pagos/:id

import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

import { useData } from "@/context/DataContext";
import { ComprobanteLiquidacion } from "@/components/Maestro/ComprobanteLiquidacion";

export default function PagoComprobantePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { liquidaciones, trabajadores, todosLosUsuarios } = useData();

  const liq = liquidaciones.find((l) => l.id === id);

  if (!liq) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="min-h-tap w-fit -ml-2">
          <button onClick={() => navigate("/app/maestro/pagos")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Pagos
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
