// Avatar con iniciales a partir del nombre. Reutilizable en listados, dashboard
// y detalle.

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { iniciales } from "@/lib/format";

const TAMAÑOS = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

export function AvatarIniciales({ nombre, className, size = "md" }) {
  return (<Avatar className={cn(TAMAÑOS[size],className)}>
      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
        {iniciales(nombre)}
      </AvatarFallback>
    </Avatar>);
}
