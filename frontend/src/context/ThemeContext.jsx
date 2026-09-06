// Contexto de tema claro / oscuro / sistema.
// Fase 6: persistencia vía localStorage directo (tema es UI, no dato de negocio).

import { createContext, useContext, useEffect, useState } from "react";

const TEMA_KEY = "jornalpro:tema";

function leerTemaPreferido() {
  if (typeof window === "undefined") return "system";
  return window.localStorage.getItem(TEMA_KEY) || "system";
}

function escribirTemaPreferido(pref) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TEMA_KEY, pref);
}

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolve(pref) {
  return pref === "system" ? getSystemTheme() : pref;
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => leerTemaPreferido());
  const [resolved, setResolved] = useState(() => resolve(preference));

  useEffect(() => {
    if (typeof document === "undefined") return;
    const r = resolve(preference);
    document.documentElement.classList.toggle("dark", r === "dark");
    document.documentElement.dataset.theme = preference;
    setResolved(r);
    escribirTemaPreferido(preference);
  }, [preference]);

  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const r = resolve("system");
      document.documentElement.classList.toggle("dark", r === "dark");
      setResolved(r);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [preference]);

  const toggle = () => {
    setPreference((p) => (p === "light" ? "dark" : "light"));
  };

  const cycle = () => {
    setPreference((p) => {
      if (p === "light") return "dark";
      if (p === "dark") return "system";
      return "light";
    });
  };

  return (
    <ThemeContext.Provider
      value={{ preference, resolved, setPreference, toggle, cycle }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
