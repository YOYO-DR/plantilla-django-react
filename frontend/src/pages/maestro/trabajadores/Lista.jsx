// Listado de trabajadores del maestro con búsqueda, filtros y orden.
// Tabla en escritorio, tarjetas en móvil.

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { saldoDeuda } from "@/lib/calculo";
import { formatCOP } from "@/lib/format";
import {
  ArrowUpDown,
  Plus,
  Search,
  X,
  ChevronRight,
  UserX2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { TrabajadorFormDialog } from "@/components/Maestro/TrabajadorFormDialog";

export default function ListaTrabajadores() {
  const { trabajadores, movimientos, todosLosUsuarios } = useData();
  const navigate = useNavigate();

  const [busqueda, setBusqueda] = useState("");
  const [oficio, setOficio] = useState("todos");
  const [estado, setEstado] = useState("activo");
  const [orden, setOrden] = useState("nombre");
  const [dialogAbierto, setDialogAbierto] = useState(false);

  // Usuarios por id para mostrar el username de acceso en la tabla
  const usuariosPorId = useMemo(() => {
    const m = new Map();
    for (const u of todosLosUsuarios) m.set(u.id, u);
    return m;
  }, [todosLosUsuarios]);

  // Saldos por trabajador (calculados desde movimientos)
  const saldosPorId = useMemo(() => {
    const m = new Map();
    for (const t of trabajadores) {
      const movs = movimientos.filter((mv) => mv.trabajadorId === t.id);
      m.set(t.id, Math.max(0, saldoDeuda(movs)));
    }
    return m;
  }, [trabajadores, movimientos]);

  // Oficios únicos (derivados de los datos)
  const oficios = useMemo(() => {
    const set = new Set();
    for (const t of trabajadores) set.add(t.oficio);
    return Array.from(set).sort();
  }, [trabajadores]);

  // Filtrado + ordenado
  const filtrados = useMemo(() => {
    const busq = busqueda.trim().toLowerCase();
    let lista = trabajadores.filter((t) => {
      if (estado !== "todos" && t.estado !== estado) return false;
      if (oficio !== "todos" && t.oficio !== oficio) return false;
      if (busq) {
        const u = usuariosPorId.get(t.usuarioId);
        const texto = `${t.nombre} ${t.documento ?? ""} ${u?.usuario ?? ""}`.toLowerCase();
        if (!texto.includes(busq)) return false;
      }
      return true;
    });

    lista = lista.sort((a, b) => {
      if (orden === "nombre") return a.nombre.localeCompare(b.nombre, "es");
      if (orden === "tarifa-asc") return a.tarifaDiaBase - b.tarifaDiaBase;
      if (orden === "tarifa-desc") return b.tarifaDiaBase - a.tarifaDiaBase;
      const sa = saldosPorId.get(a.id) ?? 0;
      const sb = saldosPorId.get(b.id) ?? 0;
      return sb - sa;
    });

    return lista;
  }, [trabajadores, busqueda, oficio, estado, orden, usuariosPorId, saldosPorId]);

  const totalActivos = trabajadores.filter((t) => t.estado === "activo").length;
  const totalInactivos = trabajadores.filter((t) => t.estado === "inactivo").length;

  const limpiarFiltros = () => {
    setBusqueda("");
    setOficio("todos");
    setEstado("activo");
  };

  const hayFiltros = busqueda !== "" || oficio !== "todos" || estado !== "activo";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display text-2xl font-semibold sm:text-3xl">Trabajadores</h1>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{totalActivos}</span> activos
            {" · "}
            <span className="font-semibold text-foreground">{totalInactivos}</span> inactivos
          </p>
        </div>
        <Button onClick={() => setDialogAbierto(true)} className="min-h-tap">
          <Plus className="mr-2 h-4 w-4" />
          Agregar trabajador
        </Button>
      </header>

      {/* Filtros */}
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, documento o usuario…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={oficio} onValueChange={setOficio}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Oficio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los oficios</SelectItem>
              {oficios.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={estado} onValueChange={(v) => setEstado(v)}>
            <SelectTrigger className="w-full sm:w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="inactivo">Inactivos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={orden} onValueChange={(v) => setOrden(v)}>
            <SelectTrigger className="w-full sm:w-44">
              <ArrowUpDown className="mr-1 h-4 w-4 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nombre">Ordenar por nombre</SelectItem>
              <SelectItem value="tarifa-asc">Tarifa (menor a mayor)</SelectItem>
              <SelectItem value="tarifa-desc">Tarifa (mayor a menor)</SelectItem>
              <SelectItem value="deuda-desc">Deuda (mayor a menor)</SelectItem>
            </SelectContent>
          </Select>
          {hayFiltros && (
            <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
              <X className="mr-1 h-4 w-4" /> Limpiar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Listado */}
      {filtrados.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <UserX2 className="h-10 w-10 text-muted-foreground/40" />
            <div>
              <p className="font-medium">No hay trabajadores que coincidan con el filtro.</p>
              <p className="text-sm text-muted-foreground">
                Ajusta los filtros o limpia para ver toda la cuadrilla.
              </p>
            </div>
            {hayFiltros && (
              <Button variant="outline" size="sm" onClick={limpiarFiltros}>
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tabla (desktop ≥md) */}
          <div className="hidden rounded-md border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Trabajador</TableHead>
                  <TableHead>Oficio</TableHead>
                  <TableHead className="text-right">Tarifa día</TableHead>
                  <TableHead className="text-right">Deuda</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((t) => (
                  <FilaTabla
                    key={t.id}
                    t={t}
                    usuario={usuariosPorId.get(t.usuarioId)}
                    deuda={saldosPorId.get(t.id) ?? 0}
                    onClick={() => navigate(`/app/maestro/trabajadores/${t.id}`)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Tarjetas (móvil) */}
          <div className="space-y-2 md:hidden">
            {filtrados.map((t) => (
              <TarjetaTrabajador
                key={t.id}
                t={t}
                usuario={usuariosPorId.get(t.usuarioId)}
                deuda={saldosPorId.get(t.id) ?? 0}
                onClick={() => navigate(`/app/maestro/trabajadores/${t.id}`)}
              />
            ))}
          </div>
        </>
      )}

      <TrabajadorFormDialog
        open={dialogAbierto}
        onOpenChange={setDialogAbierto}
        modo="crear"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function FilaTabla({
  t,
  usuario,
  deuda,
  onClick,
}) {
  return (
    <TableRow
      className="cursor-pointer"
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <AvatarIniciales nombre={t.nombre} />
          <div className="min-w-0">
            <p className="truncate font-medium">{t.nombre}</p>
            <p className="truncate text-xs text-muted-foreground">
              {usuario ? (
                <span className="font-mono">@{usuario.usuario}</span>
              ) : (
                <span>Sin acceso</span>
              )}
              {t.documento && <> · {t.documento}</>}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>{t.oficio}</TableCell>
      <TableCell className="text-right num">{formatCOP(t.tarifaDiaBase)}</TableCell>
      <TableCell className="text-right">
        {deuda > 0 ? (
          <span className="font-semibold text-destructive num">{formatCOP(deuda)}</span>
        ) : (
          <span className="text-muted-foreground">$ 0</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant={t.estado === "activo" ? "default" : "secondary"}
          className={t.estado === "inactivo" ? "bg-muted text-muted-foreground" : ""}
        >
          {t.estado === "activo" ? "Activo" : "Inactivo"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}

function TarjetaTrabajador({
  t,
  usuario,
  deuda,
  onClick,
}) {
  return (
    <Link
      to="#"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
    >
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="flex items-center gap-3 p-3">
          <AvatarIniciales nombre={t.nombre} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-medium">{t.nombre}</p>
              <Badge variant={t.estado === "activo" ? "default" : "secondary"}>
                {t.estado === "activo" ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {t.oficio} · <span className="num">{formatCOP(t.tarifaDiaBase)}</span>/día
              {usuario && (
                <>
                  {" · "}
                  <span className="font-mono">@{usuario.usuario}</span>
                </>
              )}
            </p>
            {deuda > 0 && (
              <p className="mt-0.5 text-xs">
                Deuda:{" "}
                <span className="font-semibold text-destructive num">{formatCOP(deuda)}</span>
              </p>
            )}
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}