import { routeLoaders } from "@/lib/routeLoaders";
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import ExternalLinkBrowser from "@/components/ExternalLinkBrowser";
import AppUpdateNotifier from "@/components/AppUpdateNotifier";
import Login from "./pages/Login";
const Inicio = lazy(routeLoaders.Inicio);
import SelfHealer, { AppErrorBoundary } from "@/components/SelfHealer";

// Lazy-load all non-critical pages for faster initial paint
const PersonasList = lazy(routeLoaders.PersonasList);
const Apellidos = lazy(routeLoaders.Apellidos);
const PersonaDetail = lazy(routeLoaders.PersonaDetail);
const GenealogyProfilePage = lazy(routeLoaders.GenealogyProfilePage);
const NuevaPersona = lazy(routeLoaders.NuevaPersona);
const Arbol = lazy(routeLoaders.Arbol);
const ArbolModerno = lazy(routeLoaders.ArbolModerno);
const Familias = lazy(routeLoaders.Familias);
const Documentos = lazy(routeLoaders.Documentos);
const Fotos = lazy(routeLoaders.Fotos);
const Buscar = lazy(routeLoaders.Buscar);
const Investigacion = lazy(routeLoaders.Investigacion);
const InvestigacionExterna = lazy(routeLoaders.InvestigacionExterna);
const PersonasImportadasPendientes = lazy(routeLoaders.PersonasImportadasPendientes);
const Importar = lazy(routeLoaders.Importar);
const Agente = lazy(routeLoaders.Agente);
const Asistente = lazy(routeLoaders.Asistente);
const Credenciales = lazy(routeLoaders.Credenciales);
const Parecidos = lazy(routeLoaders.Parecidos);
const ADN = lazy(routeLoaders.ADN);
const CuadrosIA = lazy(routeLoaders.CuadrosIA);
const Coincidencias = lazy(routeLoaders.Coincidencias);
const Pistas = lazy(routeLoaders.Pistas);
const Hipotesis = lazy(routeLoaders.Hipotesis);
const Inferencias = lazy(routeLoaders.Inferencias);
const Lugares = lazy(routeLoaders.Lugares);
const LineaDeTiempo = lazy(routeLoaders.LineaDeTiempo);
const Configuracion = lazy(routeLoaders.Configuracion);
const ConfigurarApp = lazy(routeLoaders.ConfigurarApp);
const Fuentes = lazy(routeLoaders.Fuentes);
const FamilySearchCallback = lazy(routeLoaders.FamilySearchCallback);
const Fusionar = lazy(routeLoaders.Fusionar);
const Sugerencias = lazy(routeLoaders.Sugerencias);
const TareasIA = lazy(routeLoaders.TareasIA);
const PersonaPublica = lazy(routeLoaders.PersonaPublica);
const PersonaSlugRedirect = lazy(routeLoaders.PersonaSlugRedirect);
const Calendario = lazy(routeLoaders.Calendario);
const OAuthConsent = lazy(routeLoaders.OAuthConsent);
const NotFound = lazy(routeLoaders.NotFound);

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
        <AppUpdateNotifier />
        <ExternalLinkBrowser />
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
