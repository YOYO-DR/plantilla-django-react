// Calendario mensual con FullCalendar. Lee del mismo DataContext que la grilla
// semanal (Fase 4) y reutiliza el popover de ajuste fino anclado a la celda clicada.

import { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Lock, Sparkles } from "lucide-react";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from "@/components/ui/select";

import { useData } from "@/context/DataContext";
import { formatCOP } from "@/lib/format";
import { valorJornada } from "@/lib/calculo";

import { JornadaEditorPopover } from "@/components/Maestro/JornadaEditorPopover";
import { CalendarioLeyenda } from "./CalendarioLeyenda";
import { CalendarioResumenMes } from "./CalendarioResumenMes";
import { CalendarioDetalleDiaSheet } from "./CalendarioDetalleDiaSheet";

// Estilos del calendario (carga perezosa desde el chunk de la página).
import "@/styles/fullcalendar.css";

const ID_TODOS = "__all__";

// Tipos locales (FC expone "Dictionary" para extendedProps, usamos unknown
// y validamos en runtime con `modo in extProps`).

// Wrappers tipados (FC espera cualquier objeto; casteamos al pasar)
function asExtProps(p) {
  return p;
}

// Calendar API mínima que necesitamos (tipado local)
function diasDelMes(mesInicio) {
  const d = parseISO(mesInicio);
  const y = d.getFullYear();
  const m = d.getMonth();
  const last = new Date(y,m + 1,0).getDate();
  const out = [];
  for (let i = 1; i <= last; i++) {
    out.push(`${y}-${String(m + 1).padStart(2,"0")}-${String(i).padStart(2,"0")}`,
    );
  }
  return out;
}

function resumenCuadrilla(dia,jornadas,trabajadores,
) {
  const js = jornadas.filter((j) => j.fecha === dia);
  const mapa = new Map(trabajadores.map((t) => [t.id, t]));
  let total = 0;
  let completos = 0;
  let medios = 0;
  let noTrabajados = 0;
  let vacios = 0;
  for (const j of js) {
    const t = mapa.get(j.trabajadorId);
    if (!t) continue;
    total += valorJornada(j,t);
    if (j.tipo === "completo") completos++;
    else if (j.tipo === "medio") medios++;
    else noTrabajados++;
  }
  for (const t of trabajadores) {
    if (!js.some((j) => j.trabajadorId === t.id)) vacios++;
  }
  return { total, completos, medios, noTrabajados, vacios };
}

export function Calendario({
  trabajadores,
  jornadas,
  onEditCell,
  soloLectura = false,
  trabajadorFijoId,
}) {
  const { liquidaciones } = useData();
  const calendarRef = useRef(null);

  const activos = useMemo(() => trabajadores.filter((t) => t.estado === "activo"),[trabajadores],
  );

  const [selector, setSelector] = useState(trabajadorFijoId ?? ID_TODOS);
  const [mesInicio, setMesInicio] = useState(() =>
    new Date().toISOString().slice(0, 8) + "01",
  );

  // Editor anclado al click
  const [popover, setPopover] = useState({
    open: false,
    tId: "",
    fecha: "",
    x: 0,
    y: 0,
  });

  // Sheet de detalle cuadrilla
  const [detalle, setDetalle] = useState({ abierto: false, fecha: null });

  const tIndividual =
    selector === ID_TODOS ? null : activos.find((t) => t.id === selector) ?? null;

  const titulo = useMemo(() =>
      format(parseISO(mesInicio),"MMMM 'de' yyyy",{ locale: es }).replace(/^./,(s) => s.toUpperCase(),
      ),[mesInicio],
  );

  const irAMes = (delta) => {
    const d = parseISO(mesInicio);
    d.setMonth(d.getMonth() + delta);
    const nuevo = d.toISOString().slice(0,10);
    setMesInicio(nuevo);
    calendarRef.current?.getApi().gotoDate(nuevo);
  };
  const irAHoy = () => {
    const hoy = new Date();
    const nuevo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2,"0")}-01`;
    setMesInicio(nuevo);
    calendarRef.current?.getApi().today();
  };

  // Eventos del FC
  const events = useMemo(() => {
    const dias = diasDelMes(mesInicio);
    if (tIndividual) {
      return dias.map((fecha) => {
        const j = jornadas.find((x) => x.trabajadorId === tIndividual.id && x.fecha === fecha,
        );
        if (!j) {
          return {
            id: `vacio-${tIndividual.id}-${fecha}`,
            start: fecha,
            allDay: true,
            classNames: ["fc-event-jornada", "fc-event-jornada-vacia"],
            extendedProps: {
                          modo: "vacio",
                          tId: tIndividual.id,
                          fecha,
                        },
            title: "+",
          };
        }
        const classes = [
          "fc-event-jornada",
          `fc-event-jornada-${j.tipo.replace("_","-")}`,
        ];
        if (j.tarifaOverride !== null) classes.push("fc-event-jornada-override");
        if (j.liquidacionId !== null) classes.push("fc-event-jornada-liquidada");
        return {
          id: j.id,
          start: j.fecha,
          allDay: true,
          classNames: classes,
          title: formatCOP(valorJornada(j,tIndividual)),
          extendedProps: {
                      modo: "jornada",
                      j,
                      tId: tIndividual.id,
                      fecha,
                    },
        };
      });
    }
    return dias.map((fecha) => {
      const r = resumenCuadrilla(fecha,jornadas,activos);
      return {
        id: `cuadrilla-${fecha}`,
        start: fecha,
        allDay: true,
        classNames: ["fc-event-jornada", "fc-event-cuadrilla"],
        title: r.total > 0 ? formatCOP(r.total) : "—",
        extendedProps: {
                  modo: "cuadrilla",
                  fecha,
                  total: r.total,
                  completos: r.completos,
                  medios: r.medios,
                  noTrabajados: r.noTrabajados,
                  vacios: r.vacios,
                },
      };
    });
  },[mesInicio, jornadas, tIndividual, activos]);

  const liqConsecutivo = (tId,fecha) => {
    const liq = liquidaciones.find((l) =>
        l.trabajadorId === tId &&
        fecha >= l.periodoInicio &&
        fecha <= l.periodoFin,
    );
    return liq?.consecutivo;
  };

  // Handlers
  const abrirPopoverCelda = (rect,tId,fecha,
  ) => {
    setPopover({
      open: true,
      tId,
      fecha,
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    });
  };

  const handleEventClick = (info) => {
      const data = asExtProps(info.event.extendedProps);
      if (data.modo === "cuadrilla" && data.fecha) {
        setDetalle({ abierto: true, fecha: data.fecha });
        return;
      }
      if (!data.tId || !data.fecha) return;
      const rect = info.el.getBoundingClientRect();
      abrirPopoverCelda(rect,data.tId,data.fecha);
    };

  const handleDateClick = (info) => {
      if (!info.dateStr) return;
      if (tIndividual) {
        abrirPopoverCelda(info.dayEl.getBoundingClientRect(),tIndividual.id,info.dateStr,
        );
      } else {
        setDetalle({ abierto: true, fecha: info.dateStr });
      }
    };

  const renderEventContent = (info) => {
      const data = asExtProps(info.event.extendedProps);
      if (data.modo === "jornada" && data.j) {
      const j = data.j;
      const esLiquidada = j.liquidacionId !== null;
      const cons = liqConsecutivo(j.trabajadorId,j.fecha);
      return (<div className="flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              {j.tipo === "completo"
                ? "Completo"
                : j.tipo === "medio"
                  ? "Medio"
                  : "—"}
            </span>
            {j.tarifaOverride !== null && (<Sparkles className="h-3 w-3 shrink-0" />)}
          </div>
          <span className="block truncate text-xs font-bold num">
            {info.event.title}
          </span>
          {esLiquidada && (<div className="flex items-center gap-0.5 text-[10px]">
              <Lock className="h-2.5 w-2.5" />#{cons}
            </div>)}
        </div>);
    }
    if (data.modo === "cuadrilla") {
      const r = {
        total: data.total ?? 0,
        completos: data.completos ?? 0,
        medios: data.medios ?? 0,
        noTrabajados: data.noTrabajados ?? 0,
        vacios: data.vacios ?? 0,
      };
      return (<div className="flex h-full flex-col justify-between">
          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            {r.completos > 0 && (<span className="rounded bg-success/30 px-1 py-0.5 text-success">
                {r.completos}✓
              </span>)}
            {r.medios > 0 && (<span className="rounded bg-info/30 px-1 py-0.5 text-info">
                {r.medios}½
              </span>)}
            {r.noTrabajados > 0 && (<span className="rounded bg-muted-foreground/30 px-1 py-0.5 text-muted-foreground">
                {r.noTrabajados}−
              </span>)}
            {r.vacios > 0 && (<span className="rounded border border-dashed border-current px-1 py-0.5 text-muted-foreground">
                {r.vacios}?
              </span>)}
          </div>
          <div className="truncate text-right text-xs font-bold num">
            {info.event.title}
          </div>
        </div>);
    }
    return (<div className="flex h-full items-center justify-center text-base font-bold opacity-50">
        +
      </div>);
  };

  return (<div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => irAMes(-1)}
              aria-label="Mes anterior"
              className="min-h-tap min-w-tap"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={irAHoy} className="min-h-tap">
              Hoy
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => irAMes(1)}
              aria-label="Mes siguiente"
              className="min-h-tap min-w-tap"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="ml-2 display text-lg font-semibold capitalize sm:text-xl">
              {titulo}
            </h2>
          </div>
          {!soloLectura && (<Select value={selector} onValueChange={setSelector}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ID_TODOS}>Toda la cuadrilla</SelectItem>
                {activos.map((t) => (<SelectItem key={t.id} value={t.id}>
                    {t.nombre}
                    <span className="ml-1 text-xs text-muted-foreground">· {t.oficio}</span>
                  </SelectItem>))}
              </SelectContent>
            </Select>)}
        </div>
  
        <CalendarioLeyenda />
  
        <div className="rounded-md border bg-card p-2">
          <FullCalendar
            ref={(el) => {
              if (el) {
                calendarRef.current = {
                  getApi: () => el.getApi(),
                };
              }
            }}
            plugins={[dayGridPlugin, interactionPlugin]}
            locale={esLocale}
            firstDay={1}
            height="auto"
            fixedWeekCount={false}
            initialDate={mesInicio}
            headerToolbar={false}
            events={events}
            eventClick={soloLectura ? undefined : handleEventClick}
            dateClick={soloLectura ? undefined : handleDateClick}
            eventContent={renderEventContent}
            dayMaxEventRows={false}
            selectable={!soloLectura}
            editable={false}
          />
        </div>
  
        <CalendarioResumenMes
          mesInicio={mesInicio}
          jornadas={jornadas}
          trabajadores={trabajadores}
          trabajador={tIndividual}
        />
  
        {!soloLectura && popover && tIndividual && (<Popover
            open={popover.open}
            onOpenChange={(o) => {
              if (!o) setPopover(null);
            }}
          >
            <PopoverAnchor>
              <div
                style={{
                  position: "fixed",
                  top: popover.y,
                  left: popover.x,
                  width: 1,
                  height: 1,
                }}
                aria-hidden
              />
            </PopoverAnchor>
            <PopoverContent className="w-80 p-0" align="center" side="bottom">
              <JornadaEditorPopover
                jornada={
                  jornadas.find((j) =>
                      j.trabajadorId === tIndividual.id && j.fecha === popover.fecha,
                  ) ?? null
                }
                trabajador={tIndividual}
                open
                onOpenChange={(o) => setPopover(o ? popover : null)}
                onChange={(input) => onEditCell(tIndividual.id,popover.fecha,input)}
              >
                <span className="hidden" />
              </JornadaEditorPopover>
            </PopoverContent>
          </Popover>)}
  
        {!soloLectura && (<CalendarioDetalleDiaSheet
            abierto={detalle.abierto}
            onClose={() => setDetalle({ abierto: false, fecha: null })}
            fecha={detalle.fecha}
            trabajadores={activos}
            jornadas={jornadas}
            onChange={onEditCell}
          />)}
      </div>);
  }
