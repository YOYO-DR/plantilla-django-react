// Pestaña "Cuenta" del perfil de usuario (Fase 9).
// Avatar con upload a Data URL, edición de nombre/teléfono/email y metadatos.

import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { iniciales, formatFecha } from "@/lib/format";

const MAX_AVATAR_BYTES = 600_000; // ~600 KB suficiente para avatares Data URL

export function CuentaTab() {
  const { usuario, tenant, actualizarPerfil } = useAuth();
  const { trabajadores } = useData();
  const [avatarSrc, setAvatarSrc] = useState(null);
  const inputRef = useRef(null);
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(usuario?.nombre ?? "");
  const [telefono, setTelefono] = useState(usuario?.telefono ?? "");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [errorEmail, setErrorEmail] = useState(null);

  if (!usuario) return null;

  const isTrabajador = usuario.rol === "trabajador";
  const t = isTrabajador
    ? trabajadores.find((x) => x.id === usuario.trabajadorId) ?? null
    : null;

  const onPickAvatar = () => inputRef.current?.click();

  const onAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !usuario) return;
    if (!file.type.startsWith("image/")) {
      toast.error("El archivo debe ser una imagen.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("La imagen es muy pesada. Usa una menor a 500 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setAvatarSrc(dataUrl);
      toast.success("Avatar actualizado (sólo en memoria — sin backend todavía).");
    };
    reader.onerror = () => toast.error("No se pudo leer la imagen.");
    reader.readAsDataURL(file);
  };

  const onQuitarAvatar = () => {
    if (!usuario) return;
    setAvatarSrc(null);
    toast.success("Avatar restablecido a iniciales.");
  };

  const onGuardar = () => {
    setErrorEmail(null);
    if (email && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
      setErrorEmail("Email inválido");
      return;
    }
    actualizarPerfil({
      nombre: nombre.trim(),
      telefono: telefono.trim() || undefined,
      email: email.trim() || undefined,
    });
    toast.success("Datos actualizados");
    setEditando(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="display text-base">Cuenta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Avatar */}
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="h-20 w-20">
            {avatarSrc ? (
              <AvatarImage src={avatarSrc} alt={usuario.nombre} />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-xl font-semibold">
              {iniciales(usuario.nombre)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="text-sm font-medium">{usuario.nombre}</p>
            <p className="text-xs text-muted-foreground">
              @{usuario.usuario} · <Badge variant="outline" className="capitalize">{usuario.rol}</Badge>
            </p>
            <div className="flex gap-2 pt-1">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={onAvatarChange}
                className="hidden"
                aria-label="Subir imagen"
              />
              <Button type="button" size="sm" variant="outline" onClick={onPickAvatar}>
                <Camera className="mr-1 h-3.5 w-3.5" /> Cambiar imagen
              </Button>
              {avatarSrc && (
                <Button type="button" size="sm" variant="ghost" onClick={onQuitarAvatar}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Quitar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Las imágenes viven en este navegador.</p>
          </div>
        </div>

        <Separator />

        {/* Datos editables */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="usuario">Usuario de acceso</Label>
            <Input
              id="usuario"
              value={usuario.usuario}
              readOnly
              className="bg-muted/50 font-mono"
              aria-readonly
            />
            <p className="text-xs text-muted-foreground">
              El usuario no se puede cambiar. Contacta al administrador de plataforma si es necesario.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={!editando}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                disabled={!editando}
                placeholder="3001234567"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!editando}
                placeholder="tunombre@correo.com"
                aria-invalid={!!errorEmail}
              />
              {errorEmail && <p className="text-xs text-destructive">{errorEmail}</p>}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {!editando ? (
              <Button type="button" onClick={() => setEditando(true)}>Editar</Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={onGuardar}>Guardar</Button>
              </>
            )}
          </div>
        </div>

        {/* Metadatos */}
        <Separator />
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <Meta label="Rol" value={<Badge variant="outline" className="capitalize">{usuario.rol}</Badge>} />
          <Meta label="Cuadrilla" value={tenant?.nombre ?? "—"} />
          <Meta label="Cuenta creada" value={usuario.creadoEn ? formatFecha(usuario.creadoEn, "dd/MM/yyyy") : "—"} />
          <Meta label="Último acceso" value={usuario.ultimoAcceso ? formatFecha(usuario.ultimoAcceso, "dd/MM/yyyy HH:mm") : "—"} />
        </div>

        {/* Bloque sólo-lectura para trabajador */}
        {isTrabajador && t && (
          <>
            <Separator />
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Datos del trabajador
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Meta label="Oficio" value={t.oficio} />
                <Meta label="Tarifa día" value={<span className="num">{`$ ${t.tarifaDiaBase.toLocaleString("es-CO")}`}</span>} />
                <Meta label="Ingresó" value={formatFecha(t.fechaIngreso, "dd/MM/yyyy")} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Solo tu maestro puede cambiar estos datos.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}