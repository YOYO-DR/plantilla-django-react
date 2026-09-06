import { createContext, useContext, useEffect, useState } from "react";
import { organizationsService } from "@/api/organizationsService";
import { useAuthStore } from "@/store/authStore";

const OrgCtx = createContext(null);

export function OrganizationProvider({ children }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setOrganization(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const org = await organizationsService.me();
        if (active) setOrganization(org);
      } catch (_e) {
        if (active) setOrganization(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken]);

  return (
    <OrgCtx.Provider value={{ organization, loading }}>
      {children}
    </OrgCtx.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrgCtx);
  if (!ctx) {
    throw new Error("useOrganization dentro de <OrganizationProvider>");
  }
  return ctx;
}
