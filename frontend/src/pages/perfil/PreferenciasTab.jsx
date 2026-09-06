// Pestaña "Preferencias" — versión Fase 6 integrada al backend.
// Sin localStorage: tema + tamaño de texto + día inicio van al
// ThemeContext (zustand) o son decorativos hasta que el backend
// exponga endpoints de preferencias.

import { useEffect, useState } from "react";
import { Bell, Sun, Moon, MonitorSmartphone, Type, Calendar } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

const SIZE_LABELS = { normal: "Normal", grande: "Grande" };
const DIA_LABELS = { lunes: "Lunes", domingo: "Domingo" };

export function PreferenciasTab() {
  const { usuario } = useAuth();
  const { preference, setPreference, resolved } = useTheme();
  const [tamano, setTamano] = useState("normal");
  const [primerDia, setPrimerDia] = useState("lunes");

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.textSize =
      tamano === "grande" ? "large" : "normal";
  }, [tamano]);

  if (!usuario) return null;

  const onTamano = (v) => setTamano(v);
  const onPrimerDia = (v) => setPrimerDia(v);

  return (
    <div className="space-y-4">
      {/* Tema */}
      <Card>
        <CardHeader>
          <CardTitle className="display text-base flex items-center gap-2">
            <Sun className="h-4 w-4" /> Tema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <BtnTema
              activo={preference === "light"}
              icon={Sun}
              label="Claro"
              onClick={() => setPreference("light")}
            />
            <BtnTema
              activo={preference === "dark"}
              icon={Moon}
              label="Oscuro"
              onClick={() => setPreference("dark")}
            />
            <BtnTema
              activo={preference === "system"}
              icon={MonitorSmartphone}
              label="Sistema"
              onClick={() => setPreference("system")}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Tema aplicado: <span className="font-medium capitalize">{resolved}</span>
            {preference === "system" && " (siguiendo el sistema operativo)"}
          </p>
        </CardContent>
      </Card>

      {/* Tamaño de texto */}
      <Card>
        <CardHeader>
          <CardTitle className="display text-base flex items-center gap-2">
            <Type className="h-4 w-4" /> Tamaño de texto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(SIZE_LABELS).map((k) => (
              <Button
                key={k}
                variant={tamano === k ? "default" : "outline"}
                onClick={() => onTamano(k)}
                className="min-h-tap"
              >
                {SIZE_LABELS[k]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Útil cuando se usa bajo el sol. Se aplica a toda la app y persiste entre sesiones.
          </p>
        </CardContent>
      </Card>

      {/* Día de inicio de semana */}
      <Card>
        <CardHeader>
          <CardTitle className="display text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Día de inicio de semana
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {Object.keys(DIA_LABELS).map((k) => (
              <Button
                key={k}
                variant={primerDia === k ? "default" : "outline"}
                onClick={() => onPrimerDia(k)}
                className="min-h-tap"
              >
                {DIA_LABELS[k]}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notificaciones (decorativas) */}
      <Card>
        <CardHeader>
          <CardTitle className="display text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notificaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NotifRow label="Resumen diario" />
          <NotifRow label="Aviso de cierre semanal" />
          <NotifRow label="Préstamos nuevos del maestro" />
          <p className="text-xs text-muted-foreground">
            Próximamente — estas preferencias sólo son decorativas en el prototipo.
          </p>
        </CardContent>
      </Card>

      {/* Zona de datos — eliminada en Fase 6: ya no hay localStorage */}
    </div>
  );
}

function BtnTema({
  activo,
  onClick,
  icon: Icon,
  label,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-tap flex-col items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm transition-colors ${
        activo
          ? "border-primary bg-primary/10 text-primary"
          : "border-border hover:border-primary/40"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function NotifRow({ label }) {
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center justify-between">
      <Label className="cursor-pointer">{label}</Label>
      <Switch checked={on} onCheckedChange={setOn} aria-label={label} />
    </div>
  );
}