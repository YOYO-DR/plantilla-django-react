// Hook para gestionar el título de la página.

import { useEffect } from "react";

const DEFAULT_TITLE = "JornalPro · El cuaderno de obra, ahora en tu bolsillo";

export function usePageTitle(segmento) {
  useEffect(() => {
    const prev = typeof document !== "undefined" ? document.title : DEFAULT_TITLE;
    const next = segmento ? `${segmento} · JornalPro` : DEFAULT_TITLE;
    document.title = next;
    return () => {
      if (typeof document !== "undefined") document.title = prev;
    };
  }, [segmento]);
}
