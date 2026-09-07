// Detalle de un trabajador del maestro. Header + Tabs (Resumen, Jornadas,
// Deuda, Pagos, Acceso). Las pestañas están en archivos separados para que
// las fases siguientes reemplacen solo su contenido.

import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Pencil,
  UserMinus,
  UserCheck,
  Phone,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { useData } from "@/context/DataContext";
import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { TrabajadorFormDialog } from "@/components/Maestro/TrabajadorFormDialog";
import { BotonLiquidarTrabajador } from "@/components/Maestro/BotonLiquidarTrabajador";
import { formatCOP, formatFechaLarga } from "@/lib/format";

import { ResumenTab } from "./ResumenTab";
import { JornadasTab, DeudaTab, PagosTab } from "./placeholders";
import { AccesoTab } from "./AccesoTab";

export default function DetalleTrabajador() {
  const { id } = useParams();
  const {
    trabajadores,
    todosLosUsuarios,
    desactivarTrabajador,
    activarTrabajador,
  } = useData();

  const [tab, setTab] = useState("resumen");
  const [dialogEditar, setDialogEditar] = useState(false);
  const [confirmDesactivar, setConfirmDesactivar] = useState(false);

  const trabajador = useMemo(
    () => trabajadores.find((t) => t.id === id) ?? null,
    [trabajadores, id],
  );

  const usuario = useMemo(
    () =>
      trabajador ? todosLosUsuarios.find((u) => u.id === trabajador.usuarioId) ?? null : null,
    [todosLosUsuarios, trabajador],
  );

  if (!trabajador) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild className="min-h-tap w-fit">
          <Link to="/app/maestro/trabajadores">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al listado
          </Link>
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Trabajador no encontrado.
          </CardContent>
        </Card>
      </div>
    );
  }

  const desactivar = () => {
    desactivarTrabajador(trabajador.id);
    setConfirmDesactivar(false);
    toast.success(`${trabajador.nombre} quedó inactivo.`);
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" asChild className="min-h-tap w-fit -ml-2">
        <Link to="/app/maestro/trabajadores">
          <ArrowLeft className="mr-2 h-4 w-4" /> Trabajadores
        </Link>
      </Button>

      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-6">
          <AvatarIniciales nombre={trabajador.nombre} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="display truncate text-2xl font-semibold">{trabajador.nombre}</h1>
              <Badge
                variant={trabajador.estado === "activo" ? "default" : "secondary"}
                className="capitalize"
              >
                {trabajador.estado}
              </Badge>
              <Badge variant="outline">{trabajador.oficio}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Tarifa día:{" "}
              <span className="font-semibold num text-foreground">{formatCOP(trabajador.tarifaDiaBase)}</span>
              {" · "}
              Medio día:{" "}
              <span className="font-semibold num text-foreground">
                {formatCOP(Math.round(trabajador.tarifaDiaBase * trabajador.factorMedioDia))}
              </span>
              {" · "}
              Ingresó el {formatFechaLarga(trabajador.fechaIngreso)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {trabajador.documento && (
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3 w-3" /> {trabajador.documento}
                </span>
              )}
              {trabajador.telefono && (
                <a
                  href={`tel:${trabajador.telefono}`}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Phone className="h-3 w-3" /> {trabajador.telefono}
                </a>
              )}
              {usuario && (
                <span className="inline-flex items-center gap-1 font-mono">
                  · @{usuario.usuario}
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <BotonLiquidarTrabajador trabajador={trabajador} />
            <Button variant="outline" className="min-h-tap" onClick={() => setDialogEditar(true)}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>

            {trabajador.estado === "activo" ? (
              <AlertDialog open={confirmDesactivar} onOpenChange={setConfirmDesactivar}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="min-h-tap text-destructive">
                    <UserMinus className="mr-2 h-4 w-4" /> Desactivar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Desactivar a {trabajador.nombre}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      El trabajador pasará a estado <strong>inactivo</strong>: ya no
                      aparecerá en la marcación de días y su usuario de acceso quedará
                      <strong> suspendido</strong>. Su historial (jornadas, préstamos y
                      liquidaciones) se conserva íntegro y podrá reactivarlo cuando
                      quieras.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={desactivar}>
                      Desactivar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button
                variant="outline"
                className="min-h-tap"
                onClick={() => {
                  activarTrabajador(trabajador.id);
                  toast.success(`${trabajador.nombre} fue reactivado.`);
                }}
              >
                <UserCheck className="mr-2 h-4 w-4" /> Reactivar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pestañas */}
      <Tabs value={tab} onValueChange={(v) => setTab(v)} className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="resumen" className="min-h-tap">Resumen</TabsTrigger>
          <TabsTrigger value="jornadas" className="min-h-tap">Jornadas</TabsTrigger>
          <TabsTrigger value="deuda" className="min-h-tap">Deuda</TabsTrigger>
          <TabsTrigger value="pagos" className="min-h-tap">Pagos</TabsTrigger>
          <TabsTrigger value="acceso" className="min-h-tap">Acceso</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <ResumenTab trabajador={trabajador} />
        </TabsContent>
        <TabsContent value="jornadas">
          <JornadasTab trabajador={trabajador} />
        </TabsContent>
        <TabsContent value="deuda">
          <DeudaTab trabajador={trabajador} />
        </TabsContent>
        <TabsContent value="pagos">
          <PagosTab trabajador={trabajador} />
        </TabsContent>
        <TabsContent value="acceso">
          {usuario ? (
            <AccesoTab trabajador={trabajador} usuario={usuario} />
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Este trabajador no tiene un usuario asociado.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <TrabajadorFormDialog
        open={dialogEditar}
        onOpenChange={setDialogEditar}
        modo="editar"
        trabajador={trabajador}
      />
    </div>
  );
}
