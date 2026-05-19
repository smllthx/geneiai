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
const PersonaDetail = lazy(() => import("./pages/PersonaDetail"));
const Arbol = lazy(() => import("./pages/Arbol"));
const Familias = lazy(() => import("./pages/Familias"));
const Documentos = lazy(() => import("./pages/Documentos"));
const Fotos = lazy(() => import("./pages/Fotos"));
const Buscar = lazy(() => import("./pages/Buscar"));
const Investigacion = lazy(() => import("./pages/Investigacion"));
const InvestigacionExterna = lazy(() => import("./pages/InvestigacionExterna"));
const Importar = lazy(() => import("./pages/Importar"));
const Agente = lazy(() => import("./pages/Agente"));
const Asistente = lazy(() => import("./pages/Asistente"));
const Credenciales = lazy(() => import("./pages/Credenciales"));
const Parecidos = lazy(() => import("./pages/Parecidos"));
const ADN = lazy(() => import("./pages/ADN"));
const Coincidencias = lazy(() => import("./pages/Coincidencias"));
const Pistas = lazy(() => import("./pages/Pistas"));
const Hipotesis = lazy(() => import("./pages/Hipotesis"));
const Inferencias = lazy(() => import("./pages/Inferencias"));
const Lugares = lazy(() => import("./pages/Lugares"));
const LineaDeTiempo = lazy(() => import("./pages/LineaDeTiempo"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const AgentesParalelo = lazy(() => import("./pages/AgentesParalelo"));
const ConfigurarApp = lazy(() => import("./pages/ConfigurarApp"));
const Fuentes = lazy(() => import("./pages/Fuentes"));
const FamilySearchCallback = lazy(() => import("./pages/FamilySearchCallback"));
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
                <Route path="/familysearch/callback" element={<ProtectedRoute><FamilySearchCallback /></ProtectedRoute>} />
                <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                  <Route path="/" element={<Navigate to="/inicio" replace />} />
                  <Route path="/inicio" element={<Inicio />} />
                  <Route path="/dashboard" element={<Navigate to="/inicio" replace />} />
                  <Route path="/arbol" element={<Arbol />} />
                  <Route path="/personas" element={<PersonasList />} />
                  <Route path="/personas/:id" element={<PersonaDetail />} />
                  <Route path="/familias" element={<Familias />} />
                  <Route path="/documentos" element={<Documentos />} />
                  <Route path="/documentos/:id" element={<Documentos />} />
                  <Route path="/fotos" element={<Fotos />} />
                  <Route path="/fuentes" element={<Fuentes />} />
                  <Route path="/investigacion" element={<Investigacion />} />
                  <Route path="/investigacion-externa" element={<InvestigacionExterna />} />
                  <Route path="/buscar" element={<Buscar />} />
                  <Route path="/coincidencias" element={<Coincidencias />} />
                  <Route path="/adn" element={<ADN />} />
                  <Route path="/estimacion-etnica" element={<Navigate to="/adn" replace />} />
                  <Route path="/importar" element={<Importar />} />
                  <Route path="/agente" element={<Agente />} />
                  <Route path="/asistente" element={<Asistente />} />
                  <Route path="/credenciales" element={<Credenciales />} />
                  <Route path="/parecidos" element={<Parecidos />} />
                  <Route path="/agentes-paralelo" element={<AgentesParalelo />} />
                  <Route path="/pistas" element={<Pistas />} />
                  <Route path="/hipotesis" element={<Hipotesis />} />
                  <Route path="/inferencias" element={<Inferencias />} />
                  <Route path="/lugares" element={<Lugares />} />
                  <Route path="/linea-de-tiempo" element={<LineaDeTiempo />} />
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
