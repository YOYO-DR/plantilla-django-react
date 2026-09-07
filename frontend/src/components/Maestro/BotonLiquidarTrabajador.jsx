// Wrapper compartido que monta el AsistenteLiquidacion con un único botón.
//
// Usado en dos puntos de entrada (Detalle.jsx cabecera, pagos/index.jsx Por
// liquidar) para no duplicar la lógica de apertura del modal ni
// desincronizar el contrato del wizard.

import { useState } from "react";
import { Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AsistenteLiquidacion } from "@/components/Maestro/AsistenteLiquidacion";

export function BotonLiquidarTrabajador({
  trabajador,
  variant = "default",
  size = "sm",
  label = "Liquidar",
  showIcon = true,
}) {
  const [open, setOpen] = useState(false);
  if (!trabajador) return null;
  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className="min-h-tap"
      >
        {showIcon && <Calculator className="mr-1.5 h-4 w-4" />}
        {label}
      </Button>
      <AsistenteLiquidacion
        open={open}
        onOpenChange={setOpen}
        trabajador={trabajador}
      />
    </>
  );
}
