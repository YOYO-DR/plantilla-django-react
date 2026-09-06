// Grilla semanal para móvil (<md). Acordeón de trabajadores; cada uno
// expande a 7 filas-día con botones grandes y popover reutilizable.

import { useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";

import { AvatarIniciales } from "@/components/shared/AvatarIniciales";
import { SemanaDots } from "@/components/shared/SemanaDots";
import { FilaDiaMovil } from "./FilaDiaMovil";

import { formatCOP } from "@/lib/format";
import { valorJornada } from "@/lib/calculo";

export function GrillaMovil({
  dias,
  trabajadores,
  jornadas,
  onEditCell,
  onDeleteCell,
}) {
  const [abiertos, setAbiertos] = useState([]);

  if (trabajadores.length === 0) {
    return (
      <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground md:hidden">
        No tienes trabajadores activos. Crea el primero desde "Trabajadores".
      </div>
    );
  }

  return (
    <div className="space-y-2 md:hidden">
      <Accordion type="multiple" value={abiertos} onValueChange={setAbiertos} className="rounded-md border bg-card">
        {trabajadores.map((t) => {
          const jsT = jornadas.filter(
            (j) =>
              j.trabajadorId === t.id &&
              j.fecha >= dias[0] &&
              j.fecha <= dias[dias.length - 1],
          );
          const totalSemana = jsT.reduce((acc, j) => acc + valorJornada(j, t), 0);

          return (
            <AccordionItem key={t.id} value={t.id} className="border-b last:border-b-0">
              <AccordionTrigger className="px-3 py-3">
                <div className="flex w-full items-center gap-3">
                  <AvatarIniciales nombre={t.nombre} size="sm" />
                  <div className="min-w-0 flex-1 text-left">
                    <p className="truncate font-medium">{t.nombre}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <SemanaDots
                        dias={dias}
                        jornadas={jsT}
                        trabajador={t}
                        size="sm"
                      />
                    </div>
                  </div>
                  <span className="ml-2 text-sm font-bold num">{formatCOP(totalSemana)}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 px-3 pb-3">
                  <Separator />
                  {dias.map((fecha) => {
                    const j = jsT.find((x) => x.fecha === fecha) ?? null;
                    return (
                      <FilaDiaMovil
                        key={fecha}
                        fecha={fecha}
                        jornada={j}
                        trabajador={t}
                        onChange={(input) => onEditCell(t.id, fecha, input)}
                        onDelete={j ? () => onDeleteCell(j.id) : undefined}
                      />
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
