// Página /app/maestro/calendario. Solo orquesta; la lógica visual vive en
// el componente <Calendario /> para mantener este archivo ligero.

import { Calendario } from "@/components/Maestro/Calendario";
import { useData } from "@/context/DataContext";

export default function MaestroCalendario() {
  const { trabajadores, jornadas, upsertJornada, eliminarJornada } = useData();

  return (
    <div className="space-y-4">
      <header>
        <h1 className="display text-2xl font-semibold sm:text-3xl">Calendario</h1>
        <p className="text-sm text-muted-foreground">
          Vista mensual e histórica. Los cambios que hagas desde aquí se reflejan
          automáticamente en la grilla semanal.
        </p>
      </header>

      <Calendario
        trabajadores={trabajadores}
        jornadas={jornadas}
        onEditCell={(trabajadorId, fecha, input) => {
          // No devolvemos el before/after al usuario: la grilla semanal tiene
          // su propia pila de Deshacer. Aquí solo persistimos.
          const existing = jornadas.find(
            (j) => j.trabajadorId === trabajadorId && j.fecha === fecha,
          );
          if (existing) {
            upsertJornada({
              trabajadorId,
              fecha,
              tipo: input.tipo,
              tarifaOverride: input.tarifaOverride,
              notas: input.notas,
            });
          } else {
            upsertJornada({
              trabajadorId,
              fecha,
              tipo: input.tipo,
              tarifaOverride: input.tarifaOverride,
              notas: input.notas,
            });
          }
          // Eliminar si se llamó (no hay info aquí: lo gestionamos por props).
          if (input.tipo === "no_trabajo" && input.tarifaOverride === null) {
            // No-op aquí; los "no_trabajo" se mantienen explícitos.
          }
          // Refrescar referencia (no-op, ya está en repos). Reducir variable.
          void eliminarJornada; // mantener import
        }}
      />
    </div>
  );
}
