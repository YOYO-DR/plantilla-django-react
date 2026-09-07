import { createContext, useContext, useEffect, useState } from "react";
import { catalogsService } from "@/api/catalogsService";
import { useAuthStore } from "@/store/authStore";

const CatalogCtx = createContext(null);

export function CatalogProvider({ children }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [workdayTypes, setWorkdayTypes] = useState([]);
  const [paymentStatuses, setPaymentStatuses] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      // Sin sesión: mantener catálogos vacíos, no fetchar nada.
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([
      catalogsService.workdayTypes(),
      catalogsService.paymentStatuses(),
      catalogsService.paymentMethods(),
    ])
      .then(([w, p, m]) => {
        if (!active) return;
        setWorkdayTypes(w);
        setPaymentStatuses(p);
        setPaymentMethods(m);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [accessToken]);

  return (
    <CatalogCtx.Provider
      value={{
        workdayTypes,
        paymentStatuses,
        paymentMethods,
        loading,
        findWorkdayTypeByName: (n) => workdayTypes.find((w) => w.name === n),
        findPaymentStatusByName: (n) => paymentStatuses.find((p) => p.name === n),
      }}
    >
      {children}
    </CatalogCtx.Provider>
  );
}

export function useCatalogs() {
  const ctx = useContext(CatalogCtx);
  if (!ctx) {
    throw new Error("useCatalogs debe usarse dentro de CatalogProvider");
  }
  return ctx;
}
