import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "./pages/Login";
import Inicio from "./pages/Inicio";
import SelfHealer, { AppErrorBoundary } from "@/components/SelfHealer";

// Lazy-load all non-critical pages for faster initial paint
const PersonasList = lazy(() => import("./pages/PersonasList"));
const Apellidos = lazy(() => import("./pages/Apellidos"));
const PersonaDetail = lazy(() => import("./pages/PersonaDetail"));
const GenealogyProfilePage = lazy(() => import("./pages/GenealogyProfilePage"));
const NuevaPersona = lazy(() => import("./pages/NuevaPersona"));
const Arbol = lazy(() => import("./pages/Arbol"));
const ArbolModerno = lazy(() => import("./pages/ArbolModerno"));
const Familias = lazy(() => import("./pages/Familias"));
const Documentos = lazy(() => import("./pages/Documentos"));
const Fotos = lazy(() => import("./pages/Fotos"));
const Buscar = lazy(() => import("./pages/Buscar"));
const Investigacion = lazy(() => import("./pages/Investigacion"));
const InvestigacionExterna = lazy(() => import("./pages/InvestigacionExterna"));
const PersonasImportadasPendientes = lazy(() => import("./pages/PersonasImportadasPendientes"));
const Importar = lazy(() => import("./pages/Importar"));
const Agente = lazy(() => import("./pages/Agente"));
const Asistente = lazy(() => import("./pages/Asistente"));
const Credenciales = lazy(() => import("./pages/Credenciales"));
const Parecidos = lazy(() => import("./pages/Parecidos"));
const ADN = lazy(() => import("./pages/ADN"));
const CuadrosIA = lazy(() => import("./pages/CuadrosIA"));
const Coincidencias = lazy(() => import("./pages/Coincidencias"));
const Pistas = lazy(() => import("./pages/Pistas"));
const Hipotesis = lazy(() => import("./pages/Hipotesis"));
const Inferencias = lazy(() => import("./pages/Inferencias"));
const Lugares = lazy(() => import("./pages/Lugares"));
const LineaDeTiempo = lazy(() => import("./pages/LineaDeTiempo"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const ConfigurarApp = lazy(() => import("./pages/ConfigurarApp"));
const Fuentes = lazy(() => import("./pages/Fuentes"));
const FamilySearchCallback = lazy(() => import("./pages/FamilySearchCallback"));
const Fusionar = lazy(() => import("./pages/Fusionar"));
const Sugerencias = lazy(() => import("./pages/Sugerencias"));
const TareasIA = lazy(() => import("./pages/TareasIA"));
const PersonaPublica = lazy(() => import("./pages/PersonaPublica"));
const PersonaSlugRedirect = lazy(() => import("./pages/PersonaSlugRedirect"));
const Calendario = lazy(() => import("./pages/Calendario"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const PageFallback = () => (
  <div className="grid min-h-[40vh] place-items-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SelfHealer />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/oauth/consent" element={<OAuthConsent />} />
                <Route path="/familysearch/callback" element={<ProtectedRoute><FamilySearchCallback /></ProtectedRoute>} />
                <Route path="/p/:id" element={<PersonaPublica />} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/" element={<Navigate to="/inicio" replace />} />
                  <Route path="/index" element={<Navigate to="/inicio" replace />} />
                  <Route path="/inicio" element={<Inicio />} />
                  <Route path="/dashboard" element={<Navigate to="/inicio" replace />} />
                  <Route path="/arbol" element={<Arbol />} />
                  <Route path="/arbol-moderno" element={<ArbolModerno />} />
                  <Route path="/arbol-clasico" element={<Navigate to="/arbol" replace />} />
                  <Route path="/personas" element={<PersonasList />} />
                  <Route path="/apellidos" element={<Apellidos />} />
                  <Route path="/personas/nueva" element={<NuevaPersona />} />
                  <Route path="/personas/:id/ficha" element={<GenealogyProfilePage />} />
                  <Route path="/personas/:id" element={<PersonaDetail />} />
                  <Route path="/familias" element={<Familias />} />
                  <Route path="/documentos" element={<Documentos />} />
                  <Route path="/documentos/:id" element={<Documentos />} />
                  <Route path="/fotos" element={<Fotos />} />
                  <Route path="/fuentes" element={<Fuentes />} />
                  <Route path="/investigacion" element={<Investigacion />} />
                  <Route path="/importadas-pendientes" element={<PersonasImportadasPendientes />} />
                  <Route path="/investigacion-externa" element={<InvestigacionExterna />} />
                  <Route path="/buscar" element={<Buscar />} />
                  <Route path="/coincidencias" element={<Coincidencias />} />
                  <Route path="/adn" element={<ADN />} />
                  <Route path="/origen-ancestral" element={<Navigate to="/adn" replace />} />
                  <Route path="/cuadros-ia" element={<CuadrosIA />} />
                  <Route path="/estimacion-etnica" element={<Navigate to="/adn" replace />} />
                  <Route path="/importar" element={<Importar />} />
                  <Route path="/agente" element={<Agente />} />
                  <Route path="/asistente" element={<Asistente />} />
                  <Route path="/credenciales" element={<Credenciales />} />
                  <Route path="/parecidos" element={<Parecidos />} />
                  <Route path="/agentes-paralelo" element={<Navigate to="/investigacion?tab=paralelo" replace />} />
                  <Route path="/pistas" element={<Pistas />} />
                  <Route path="/hipotesis" element={<Hipotesis />} />
                  <Route path="/inferencias" element={<Inferencias />} />
                  <Route path="/insights" element={<Navigate to="/investigacion?tab=insights" replace />} />
                  <Route path="/busqueda-ia" element={<Navigate to="/investigacion?tab=busqueda" replace />} />
                  <Route path="/fusionar" element={<Fusionar />} />
                  <Route path="/sugerencias" element={<Sugerencias />} />
                  <Route path="/tareas-ia" element={<TareasIA />} />
                  <Route path="/persona/:slug" element={<PersonaSlugRedirect />} />
                  <Route path="/lugares" element={<Lugares />} />
                  <Route path="/linea-de-tiempo" element={<LineaDeTiempo />} />
                  <Route path="/calendario" element={<Calendario />} />
                  <Route path="/configuracion" element={<Configuracion />} />
                  <Route path="/configurar-app" element={<ConfigurarApp />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
