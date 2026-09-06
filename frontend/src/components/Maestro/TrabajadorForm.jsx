// Formulario reutilizable para crear y editar un trabajador.
// La lógica vive aquí; el contenedor Dialog/Sheet vive en TrabajadorFormDialog.

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Copy, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

import { useData } from "@/context/DataContext";
import { formatCOP } from "@/lib/format";
import { parseMiles } from "@/lib/usuarios";
import { hoyISO } from "@/lib/fechas";

const OFICIOS = ["Ayudante", "Oficial", "Contratista", "Maestro", "Otro"];

const schema = z.object({
  nombre: z.string().trim().min(3,"Mínimo 3 caracteres"),
  documento: z.string().trim().optional().or(z.literal("")),
  telefono: z.string().trim().optional().or(z.literal("")),
  oficio: z.string().min(1,"Selecciona o escribe un oficio"),
  tarifaDiaBase: z
    .coerce.number({ invalid_type_error: "Ingresa un número" })
    .int("Sin decimales")
    .positive("La tarifa debe ser mayor a 0"),
  factorMedioDia: z.coerce.number().min(0.1).max(1),
  fechaIngreso: z.string().min(1,"Requerido"),
  notas: z.string().trim().optional().or(z.literal("")),
  // opcionales — solo requeridos en modo "crear" (validación adicional abajo)
  usuario: z.string().trim().optional(),
  password: z.string().optional(),
});

export function TrabajadorForm({ modo, trabajador, onGuardado }) {
  const isCrear = modo === "crear";
  const {
    crearTrabajador,
    actualizarTrabajador,
    inferirUsuarioDesdeNombre,
    generarPassword,
  } = useData();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: isCrear
      ? {
          nombre: "",
          documento: "",
          telefono: "",
          oficio: "Ayudante",
          tarifaDiaBase: 80000,
          factorMedioDia: 0.5,
          fechaIngreso: hoyISO(),
          notas: "",
          usuario: "",
          password: "",
        }
      : {
          nombre: trabajador?.nombre ?? "",
          documento: trabajador?.documento ?? "",
          telefono: trabajador?.telefono ?? "",
          oficio: trabajador?.oficio ?? "Ayudante",
          tarifaDiaBase: trabajador?.tarifaDiaBase ?? 80000,
          factorMedioDia: trabajador?.factorMedioDia ?? 0.5,
          fechaIngreso: trabajador?.fechaIngreso ?? hoyISO(),
          notas: trabajador?.notas ?? "",
          usuario: "(no editable)",
          password: "(no editable)",
        },
  });

  const { register, handleSubmit, watch, setValue, formState, reset } = form;
  const oficioValor = watch("oficio") ?? "";
  const tarifaDiaBase = Number(watch("tarifaDiaBase")) || 0;
  const factorMedioDia = Number(watch("factorMedioDia")) || 0;
  const nombreValor = watch("nombre") ?? "";

  // Estado local para los campos numéricos formateados
  const [tarifaTexto, setTarifaTexto] = useState(isCrear ? "80.000" : String(trabajador?.tarifaDiaBase ?? 0));
  const [factorTexto, setFactorTexto] = useState(String(trabajador?.factorMedioDia ?? 0.5));
  const [otroOficio, setOtroOficio] = useState("");

  const esOtroOficio =
    !OFICIOS.includes(oficioValor) && oficioValor !== "";

  // Sugerir usuario automaticamente al escribir nombre (solo en crear)
  useEffect(() => {
    if (!isCrear) return;
    if (!nombreValor || nombreValor.trim().length < 3) return;
    const sugerido = inferirUsuarioDesdeNombre(nombreValor);
    setValue("usuario",sugerido,{ shouldDirty: false });

  },[nombreValor, isCrear]);

  // Generar password por defecto la primera vez (solo crear)
  useEffect(() => {
    if (!isCrear) return;
    const current = watch("password") ?? "";
    if (!current) setValue("password",generarPassword(10));

  },[isCrear]);

  const valorMedioDia = useMemo(() => Math.round(tarifaDiaBase * factorMedioDia),[tarifaDiaBase, factorMedioDia],
  );

  const onValid = handleSubmit((data) => {
    const oficioFinal = esOtroOficio
      ? (otroOficio || "").trim() || oficioValor
      : oficioValor;

    if (!oficioFinal) {
      setValue("oficio","",{ shouldValidate: true });
      return;
    }

    try {
      if (isCrear) {
        // Validaciones manuales de campos de acceso
        const usuario = (data.usuario ?? "").trim();
        const password = data.password ?? "";
        if (usuario.length < 3) {
          setValue("usuario","",{ shouldValidate: true });
          toast.error("El usuario debe tener al menos 3 caracteres");
          return;
        }
        if (password.length < 6) {
          setValue("password","",{ shouldValidate: true });
          toast.error("La contraseña debe tener al menos 6 caracteres");
          return;
        }

        const r = crearTrabajador({
          nombre: data.nombre.trim(),
          documento: data.documento?.trim() || undefined,
          telefono: data.telefono?.trim() || undefined,
          oficio: oficioFinal,
          tarifaDiaBase: data.tarifaDiaBase,
          factorMedioDia: data.factorMedioDia,
          fechaIngreso: data.fechaIngreso,
          notas: data.notas?.trim() || undefined,
          usuario,
          password,
        });

        toast.success(`Trabajador "${r.trabajador.nombre}" creado.`,{
          description: `Usuario: ${r.usuario.usuario} · Contraseña: ${password}`,
          duration: 12000,
          action: {
            label: (<span className="inline-flex items-center gap-1">
                <Copy className="h-3 w-3" /> Copiar
              </span>),
            onClick: () => {
              navigator.clipboard
                .writeText(`Usuario: ${r.usuario.usuario}\nContraseña: ${password}`)
                .then(() => toast.success("Credenciales copiadas al portapapeles"))
                .catch(() => toast.error("No se pudo copiar"));
            },
          },
        });

        onGuardado?.({ credenciales: { usuario: r.usuario.usuario, password } });
        reset();
      } else if (trabajador) {
        actualizarTrabajador(trabajador.id,{
          nombre: data.nombre.trim(),
          documento: data.documento?.trim() || undefined,
          telefono: data.telefono?.trim() || undefined,
          oficio: oficioFinal,
          tarifaDiaBase: data.tarifaDiaBase,
          factorMedioDia: data.factorMedioDia,
          fechaIngreso: data.fechaIngreso,
          notas: data.notas?.trim() || undefined,
        });
        toast.success(`Cambios guardados para "${data.nombre}".`);
                onGuardado?.({});
              }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    }
  });

  // Errores específicos del campo (los fusionamos para superar la limitación
  // de zodResolver con campos opcionales en el schema unificado)
  const errUsuario = isCrear && (!watch("usuario") || String(watch("usuario")).trim().length < 3)
    ? "Mínimo 3 caracteres"
    : null;
  const errPassword = isCrear && (!watch("password") || String(watch("password")).length < 6)
    ? "Mínimo 6 caracteres"
    : null;

  return (
    <form onSubmit={onValid} className="space-y-5">
      {/* Datos básicos */}
      <section className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="nombre">Nombre completo</Label>
          <Input
            id="nombre"
            placeholder="Ej. Duván Riascos"
            {...register("nombre")}
            aria-invalid={!!formState.errors.nombre}
          />
          {formState.errors.nombre && (
            <p className="text-xs text-destructive">{formState.errors.nombre.message}</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="documento">Documento (cédula)</Label>
            <Input id="documento" placeholder="1234567" {...register("documento")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input id="telefono" placeholder="3001234567" {...register("telefono")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="oficio">Oficio</Label>
          <Select
            value={OFICIOS.includes(oficioValor) ? oficioValor : "__otro__"}
            onValueChange={(v) => {
              if (v === "__otro__") {
                setValue("oficio", otroOficio || "__requerido__", { shouldValidate: true });
              } else {
                setValue("oficio", v, { shouldValidate: true });
              }
            }}
          >
            <SelectTrigger id="oficio" className="w-full">
              <SelectValue placeholder="Selecciona oficio" />
            </SelectTrigger>
            <SelectContent>
              {OFICIOS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
              <SelectItem value="__otro__">Otro…</SelectItem>
            </SelectContent>
          </Select>
          {esOtroOficio && (
            <Input
              placeholder="Escribe el oficio"
              value={otroOficio}
              onChange={(e) => {
                setOtroOficio(e.target.value);
                setValue("oficio", e.target.value, { shouldValidate: true });
              }}
              className="mt-1"
            />
          )}
          {formState.errors.oficio && (
            <p className="text-xs text-destructive">{formState.errors.oficio.message}</p>
          )}
        </div>

        {/* Tarifa + factor + medio día */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tarifaDiaBase">Tarifa por día (COP)</Label>
            <Input
              id="tarifaDiaBase"

              inputMode="numeric"
              placeholder="85.000"
              value={tarifaTexto}
              onChange={(e) => {
                const text = e.target.value;
                if (!/^[\d.]*$/.test(text)) return;
                setTarifaTexto(text);
                const num = parseMiles(text);
                setValue("tarifaDiaBase", num, { shouldValidate: true });
              }}
              className="num"
              aria-invalid={!!formState.errors.tarifaDiaBase}
            />
            <p className="text-xs text-muted-foreground">
              Medio día: <strong className="text-foreground num">{formatCOP(valorMedioDia)}</strong>
            </p>
            {formState.errors.tarifaDiaBase && (
              <p className="text-xs text-destructive">
                {formState.errors.tarifaDiaBase.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fechaIngreso">Fecha de ingreso</Label>
            <Input id="fechaIngreso"
                    id="factorMedioDia"

                    inputMode="decimal"
                    value={factorTexto}
                    onChange={(e) => {
                      const text = e.target.value;
                      if (!/^[0-9.]*$/.test(text)) return;
                      setFactorTexto(text);
                      const num = parseFloat(text);
                      if (Number.isFinite(num)) {
                        setValue("factorMedioDia", num, { shouldValidate: true });
                      }
                    }}
                    className="num w-24"
                  />
                  <span className="text-xs text-muted-foreground">Por defecto 0.5</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notas">Notas</Label>
                <Textarea
                  id="notas"
                  placeholder="Información adicional del trabajador"
                  rows={2}
                  {...register("notas")}
                />
              </div>
              <Accordion type="single" collapsible className="rounded-md border bg-card/50 px-3">
                <AccordionItem value="opciones" className="border-none">
                  <AccordionTrigger className="text-sm">Opciones avanzadas</AccordionTrigger>
                  <AccordionContent className="space-y-3 pb-3">
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      {/* Aviso en edición */}
      {!isCrear && (
        <Alert className="border-warning/30 bg-warning/5">
          <Info className="h-4 w-4 text-warning" />
          <AlertDescription className="text-xs">
            Cambiar la <strong>tarifa base</strong> solo afecta a los días que se marquen
            desde ahora. Las jornadas ya registradas conservan su valor calculado.
          </AlertDescription>
        </Alert>
      )}

      {/* Acceso del trabajador (solo crear) */}
      {isCrear && (
        <section className="space-y-3 rounded-md border border-dashed bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Acceso del trabajador</h3>
              <p className="text-xs text-muted-foreground">
                Con estos datos el trabajador podrá entrar a consultar sus días y su
                deuda. No podrá modificar nada.
              </p>
            </div>
            <Badge variant="secondary" className="text-[10px] uppercase">Solo crear</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="usuario">Usuario</Label>
              <Input
                id="usuario"
                placeholder="duvan.riascos"
                className="font-mono"
                {...register("usuario")}
                aria-invalid={!!errUsuario}
              />
              {errUsuario && <p className="text-xs text-destructive">{errUsuario}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="password"

                  className="font-mono"
                  {...register("password")}
                  aria-invalid={!!errPassword}
                />
                <Button

                  variant="outline"
                  size="icon"
                  className="min-h-tap min-w-tap"
                  onClick={() =>
                    setValue("password", generarPassword(10), { shouldValidate: true })
                  }
                  aria-label="Generar nueva contraseña"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              {errPassword && <p className="text-xs text-destructive">{errPassword}</p>}
            </div>
          </div>
        </section>
      )}

      {/* Footer con submit */}
      <div className="sticky bottom-0 -mx-4 sm:-mx-6 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex items-center justify-end gap-2">
          <Button type="submit">
            {isCrear ? "Crear trabajador" : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </form>
  );
}
