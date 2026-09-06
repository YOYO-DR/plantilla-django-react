// Componente reutilizable de saludo para dashboards placeholder.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";

export function Saludo({ rol, titulo }) {
  const { usuario, tenant, trabajador } = useAuth();

  return (<Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="display text-2xl">
            ¡Hola,{usuario?.nombre?.split(" ")[0]}!
          </CardTitle>
          <Badge variant="secondary" className="capitalize">
            {rol}
          </Badge>
        </div>
        <CardDescription>
          {titulo ?? "Esta vista se ampliará en las siguientes fases."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {tenant?.nombre && <p>Tenant activo: <strong className="text-foreground">{tenant.nombre}</strong></p>}
        {trabajador?.oficio && (<p>Oficio: <strong className="text-foreground">{trabajador.oficio}</strong></p>)}
        <p className="pt-2 text-xs text-muted-foreground/80">
          El ruteo y la sesión funcionan correctamente. Las pantallas de gestión de
          trabajadores,jornadas y liquidaciones se entregarán en las Fases 3 a 11.
        </p>
      </CardContent>
    </Card>);
}
