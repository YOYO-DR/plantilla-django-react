import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouterProvider, createBrowserRouter } from "react-router-dom";

import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { DataProvider } from "@/context/DataContext";
import { OrganizationProvider } from "@/context/OrganizationContext";
import { CatalogProvider } from "@/context/CatalogContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Landing = lazy(() => import("@/pages/public/Landing"));
const Login = lazy(() => import("@/pages/public/Login"));
// const Diagnostico = lazy(() => import("@/pages/Diagnostico")); // Fase 12: ya no se sirve vía router
const NotFound = lazy(() => import("@/pages/NotFound"));
const Perfil = lazy(() => import("@/pages/perfil/Perfil"));

const MaestroDashboard = lazy(() => import("@/pages/maestro/Dashboard"));
const ListaTrabajadores = lazy(() => import("@/pages/maestro/trabajadores/Lista"));
const DetalleTrabajador = lazy(() => import("@/pages/maestro/trabajadores/Detalle"));
const MaestroJornadas = lazy(() => import("@/pages/maestro/jornadas"));
const MaestroCalendario = lazy(() => import("@/pages/maestro/calendario"));
const MaestroDeudas = lazy(() => import("@/pages/maestro/deudas"));
const MaestroPagos = lazy(() => import("@/pages/maestro/pagos"));
const PagoComprobante = lazy(() => import("@/pages/maestro/pagos/Comprobante"));

const TrabajadorInicio = lazy(() => import("@/pages/trabajador/Inicio"));
const TrabajadorDias = lazy(() => import("@/pages/trabajador/Dias"));
const TrabajadorDeuda = lazy(() => import("@/pages/trabajador/Deuda"));
const TrabajadorPagos = lazy(() => import("@/pages/trabajador/Pagos"));
const TrabajadorComprobante = lazy(() => import("@/pages/trabajador/Comprobante"));

const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminTenants = lazy(() => import("@/pages/admin/Tenants"));
const AdminTenantDetalle = lazy(() => import("@/pages/admin/TenantDetalle"));
const AdminUsuarios = lazy(() => import("@/pages/admin/Usuarios"));
const AdminSistema = lazy(() => import("@/pages/admin/Sistema"));

import { AppShell } from "@/components/layout/AppShell";
import { RutaProtegida } from "@/components/RutaProtegida";
import { RedireccionPorRol } from "@/components/RedireccionPorRol";

const router = createBrowserRouter([
  // --- Públicas -------------------------------------------------------------
  {
    path: "/",
    element: (<Suspense fallback={null}>
        <Landing />
      </Suspense>),
  },
  {
    path: "/login",
    element: (<Suspense fallback={null}>
              <Login />
            </Suspense>),
        },

        // --- Protegidas (cualquier rol) ------------------------------------------
  {
    element: <RutaProtegida rolesPermitidos={["AdminPlataforma", "Maestro", "Trabajador"]} />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/app", element: <RedireccionPorRol /> },
          {
            path: "/app/perfil",
            element: (<Suspense fallback={null}>
                <Perfil />
              </Suspense>),
          },
        ],
      },
    ],
  },

  // --- Maestro -------------------------------------------------------------
  {
    element: <RutaProtegida rolesPermitidos={["Maestro"]} />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: "/app/maestro",
            element: (<Suspense fallback={null}>
                <MaestroDashboard />
              </Suspense>),
          },
          {
            path: "/app/maestro/trabajadores",
            element: (<Suspense fallback={null}>
                <ListaTrabajadores />
              </Suspense>),
          },
          {
            path: "/app/maestro/trabajadores/:id",
            element: (<Suspense fallback={null}>
                <DetalleTrabajador />
              </Suspense>),
          },
          {
            path: "/app/maestro/jornadas",
            element: (<Suspense fallback={null}>
                <MaestroJornadas />
              </Suspense>),
          },
          {
            path: "/app/maestro/calendario",
            element: (<Suspense fallback={null}>
                <MaestroCalendario />
              </Suspense>),
          },
          {
            path: "/app/maestro/deudas",
            element: (<Suspense fallback={null}>
                <MaestroDeudas />
              </Suspense>),
          },
          {
            path: "/app/maestro/pagos",
            element: (<Suspense fallback={null}>
                <MaestroPagos />
              </Suspense>),
          },
          {
            path: "/app/maestro/pagos/:id",
            element: (<Suspense fallback={null}>
                <PagoComprobante />
              </Suspense>),
          },
        ],
      },
    ],
  },

  // --- Trabajador (Fase 8 — sólo R8 lectura) -------------------------------
  {
    element: <RutaProtegida rolesPermitidos={["Trabajador"]} />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: "/app/trabajador",
            element: (<Suspense fallback={null}>
                <TrabajadorInicio />
              </Suspense>),
          },
          {
            path: "/app/trabajador/dias",
            element: (<Suspense fallback={null}>
                <TrabajadorDias />
              </Suspense>),
          },
          {
            path: "/app/trabajador/deuda",
            element: (<Suspense fallback={null}>
                <TrabajadorDeuda />
              </Suspense>),
          },
          {
            path: "/app/trabajador/pagos",
            element: (<Suspense fallback={null}>
                <TrabajadorPagos />
              </Suspense>),
          },
          {
            path: "/app/trabajador/pagos/:id",
            element: (<Suspense fallback={null}>
                <TrabajadorComprobante />
              </Suspense>),
          },
        ],
      },
    ],
  },

  // --- Admin (Fase 10) -----------------------------------------------------
  {
    element: <RutaProtegida rolesPermitidos={["AdminPlataforma"]} />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: "/app/admin",
            element: (<Suspense fallback={null}>
                <AdminDashboard />
              </Suspense>),
          },
          {
            path: "/app/admin/tenants",
            element: (<Suspense fallback={null}>
                <AdminTenants />
              </Suspense>),
          },
          {
            path: "/app/admin/tenants/:id",
            element: (<Suspense fallback={null}>
                <AdminTenantDetalle />
              </Suspense>),
          },
          {
            path: "/app/admin/usuarios",
            element: (<Suspense fallback={null}>
                <AdminUsuarios />
              </Suspense>),
          },
          {
            path: "/app/admin/sistema",
            element: (<Suspense fallback={null}>
                <AdminSistema />
              </Suspense>),
          },
        ],
      },
    ],
  },

  {
    path: "*",
    element: (<Suspense fallback={null}>
        <NotFound />
      </Suspense>),
  },
  // Silencia el warning de React Router sobre v7_startTransition.
  // Cuando subamos a v7, podemos quitar esta flag.
],
{ future: { v7_startTransition: true } },
);

const App = () => (<ErrorBoundary>
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <OrganizationProvider>
            <CatalogProvider>
              <TooltipProvider>
                <Sonner />
                <RouterProvider router={router} />
              </TooltipProvider>
            </CatalogProvider>
          </OrganizationProvider>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  </ErrorBoundary>);

export default App;
