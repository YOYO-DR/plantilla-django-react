// Diálogo para crear una nueva cuadrilla + su usuario maestro en una sola operación.

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useData } from "@/context/DataContext";

const schema = z.object({
  nombre: z.string().trim().min(3,"Mínimo 3 caracteres"),
  ciudad: z.string().trim().optional(),
  telefono: z.string().trim().optional(),
  maestroNombre: z.string().trim().min(3,"Mínimo 3 caracteres"),
  maestroUsuario: z
    .string()
    .trim()
    .min(3,"Mínimo 3 caracteres")
    .regex(/^[a-z0-9.]+$/i,"Sólo letras, números y puntos"),
  maestroPassword: z.string().min(6,"Mínimo 6 caracteres"),
});

export function CrearTenantDialog({ open, onOpenChange }) {
  const { crearTenant, generarPassword } = useData();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre: "",
      ciudad: "",
      telefono: "",
      maestroNombre: "",
      maestroUsuario: "",
      maestroPassword: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset();
      // password por defecto
      const pwd = generarPassword(10);
      form.setValue("maestroPassword",pwd);
    }
  },[open]);  

  const onSubmit = (data) => {
    try {
      const r = crearTenant({
        nombre: data.nombre,
        ciudad: data.ciudad || undefined,
        telefono: data.telefono || undefined,
        maestroNombre: data.maestroNombre,
        maestroUsuario: data.maestroUsuario.toLowerCase(),
        maestroPassword: data.maestroPassword,
      });
      toast.success(`Cuadrilla "${r.tenant.nombre}" creada.`,{
        description: `Usuario maestro: ${r.maestroUsuario.usuario} · Contraseña: ${data.maestroPassword}`,
        duration: 12000,
        action: {
          label: (<span className="inline-flex items-center gap-1">
              <Copy className="h-3 w-3" /> Copiar
            </span>),
          onClick: () => {
            navigator.clipboard
              .writeText(`Usuario: ${r.maestroUsuario.usuario}\nContraseña: ${data.maestroPassword}`,
              )
              .then(() => toast.success("Credenciales copiadas al portapapeles"))
              .catch(() => toast.error("No se pudo copiar"));
          },
        },
      });
      form.reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear la cuadrilla");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-full max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-background/95 px-6 py-4">
          <DialogTitle className="display text-lg">Crear cuadrilla</DialogTitle>
          <DialogDescription>
            Crea la cuadrilla y el usuario maestro. El maestro podrá crear
            trabajadores después de iniciar sesión.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="max-h-[calc(92vh-100px)] space-y-5 overflow-y-auto px-6 py-4"
        >
          <section className="space-y-3">
            <h3 className="display text-base font-semibold">Datos de la cuadrilla</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" placeholder="Obras del Pacífico" {...form.register("nombre")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input id="ciudad" placeholder="Buenaventura" {...form.register("ciudad")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input id="telefono" placeholder="3001234567" {...form.register("telefono")} />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-md border border-dashed bg-muted/30 p-3">
            <h3 className="display text-base font-semibold">Cuenta del maestro</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="maestroNombre">Nombre completo</Label>
                <Input id="maestroNombre" placeholder="Hernán Pérez" {...form.register("maestroNombre")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maestroUsuario">Usuario</Label>
                <Input id="maestroUsuario" placeholder="hernan" className="font-mono" {...form.register("maestroUsuario")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maestroPassword">Contraseña inicial</Label>
                <div className="flex items-center gap-2">
                  <Input id="maestroPassword" type="text" className="font-mono" {...form.register("maestroPassword")} />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => form.setValue("maestroPassword", generarPassword(10))}
                    aria-label="Generar nueva contraseña"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              El maestro entra con estas credenciales y podrá cambiarlas desde Perfil
              → Seguridad.
            </p>
          </section>

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Crear cuadrilla</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}