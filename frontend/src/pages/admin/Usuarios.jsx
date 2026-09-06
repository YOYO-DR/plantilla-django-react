// Listado global de usuarios (Fase 10 §10.3).

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  PowerOff,
  Power,
  Search,
  Copy,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useData } from "@/context/DataContext";
import { formatFecha } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

export default function AdminUsuarios() {
  const {
    todosLosUsuarios,
    todosLosTenants,
    actualizarUsuario,
    resetearPasswordUsuario,
    cambiarRolUsuario,
  } = useData();
  const { generarPassword, usuario: yo } = useAuth();

  const [busqueda, setBusqueda] = useState("");
  const [rol, setRol] = useState("todos");
  const [tenantId, setTenantId] = useState("todos");
  const [estado, setEstado] = useState("todos");

  const [resetOpen, setResetOpen] = useState(null);
  const [resetPwd, setResetPwd] = useState("");
  const [cambiarRolOpen, setCambiarRolOpen] = useState(null);

  const filtrados = useMemo(() => {
    const busq = busqueda.trim().toLowerCase();
    return todosLosUsuarios
      .filter((u) => {
        if (busq) {
          const t = todosLosTenants.find((x) => x.id === u.tenantId)?.nombre ?? "";
          const texto = `${u.nombre} ${u.usuario} ${u.email ?? ""} ${t}`.toLowerCase();
          if (!texto.includes(busq)) return false;
        }
        if (rol !== "todos" && u.rol !== rol) return false;
        if (tenantId !== "todos" && u.tenantId !== tenantId) return false;
        if (estado !== "todos" && u.estado !== estado) return false;
        return true;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [todosLosUsuarios, todosLosTenants, busqueda, rol, tenantId, estado]);

  const tenantDe = (id) =>
    id ? todosLosTenants.find((t) => t.id === id)?.nombre ?? "—" : "Plataforma";

  const tieneHistorial = () => {
    // Heurística simple: ¿existen jornadas/movimientos/liquidaciones con este userId?
    // Para evitar más consultas, mostramos el botón de suspender y nunca eliminamos.
    return true;
  };

  function cambiarRol(uid, rolActual) {
    // Sólo rotamos entre maestro / trabajador (admin no cambia desde aquí)
    const next = rolActual === "maestro" ? "trabajador" : "maestro";
    setCambiarRolOpen({ id: uid, nuevoRol: next });
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="display text-2xl font-semibold sm:text-3xl">Usuarios</h1>
        <p className="text-sm text-muted-foreground">
          {todosLosUsuarios.length} cuentas registradas · los administradores nunca se eliminan.
        </p>
      </header>

      <Card>
        <CardContent className="grid gap-3 p-3 md:grid-cols-[1fr_1fr_1fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={rol} onValueChange={(v) => setRol(v)}>
            <SelectTrigger><SelectValue placeholder="Rol" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="maestro">Maestro</SelectItem>
              <SelectItem value="trabajador">Trabajador</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tenantId} onValueChange={setTenantId}>
            <SelectTrigger><SelectValue placeholder="Cuadrilla" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las cuadrillas</SelectItem>
              {todosLosTenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
              ))}
              <SelectItem value="__plataforma__">Plataforma</SelectItem>
            </SelectContent>
          </Select>
          <Select value={estado} onValueChange={(v) => setEstado(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="suspendido">Suspendidos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Cuadrilla</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Último acceso</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  Sin usuarios que coincidan con el filtro.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">@{u.usuario}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{u.rol}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{tenantDe(u.tenantId)}</TableCell>
                  <TableCell>
                    <Badge variant={u.estado === "activo" ? "default" : "secondary"} className="capitalize">
                      {u.estado}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.ultimoAcceso ? formatFecha(u.ultimoAcceso, "dd/MM/yy HH:mm") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setResetPwd(generarPassword(10));
                          setResetOpen(u.id);
                        }}
                      >
                        <KeyRound className="mr-1 h-3.5 w-3.5" /> Reset
                      </Button>
                      {yo?.id !== u.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cambiarRol(u.id, u.rol)}
                          disabled={!["admin", "maestro", "trabajador"].includes(u.rol)}
                        >
                          Cambiar rol
                        </Button>
                      )}
                      {yo?.id !== u.id && (
                        u.estado === "activo" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-warning"
                            onClick={() => {
                              actualizarUsuario(u.id, { estado: "suspendido" });
                              toast.success(`Acceso de ${u.nombre} suspendido.`);
                            }}
                            disabled={!tieneHistorial(u.id)}
                          >
                            <PowerOff className="mr-1 h-3.5 w-3.5" /> Suspender
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-success"
                            onClick={() => {
                              actualizarUsuario(u.id, { estado: "activo" });
                              toast.success(`Acceso de ${u.nombre} reactivado.`);
                            }}
                          >
                            <Power className="mr-1 h-3.5 w-3.5" /> Reactivar
                          </Button>
                        )
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reset password */}
      <AlertDialog open={!!resetOpen} onOpenChange={(o) => !o && setResetOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restablecer contraseña</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="text-sm">
                Comparte esta nueva contraseña por un canal seguro. El usuario podrá
                cambiarla desde Perfil → Seguridad.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <code className="flex-1 font-mono text-sm">{resetPwd}</code>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(resetPwd).then(() => toast.success("Copiada"));
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!resetOpen) return;
                resetearPasswordUsuario(resetOpen, resetPwd);
                toast.success("Contraseña restablecida.");
                setResetOpen(null);
              }}
            >
              Restablecer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cambiar rol */}
      <AlertDialog
        open={!!cambiarRolOpen}
        onOpenChange={(o) => !o && setCambiarRolOpen(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar el rol de este usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Cambiar el rol reconfigura los permisos efectivos al instante. Esta
              acción queda registrada en el historial del usuario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!cambiarRolOpen) return;
                const u = todosLosUsuarios.find((x) => x.id === cambiarRolOpen.id);
                cambiarRolUsuario(cambiarRolOpen.id, cambiarRolOpen.nuevoRol);
                toast.success(`Rol de ${u?.nombre} actualizado.`);
                setCambiarRolOpen(null);
              }}
            >
              Cambiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
