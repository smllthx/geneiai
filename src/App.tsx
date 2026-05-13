import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PersonasList from "./pages/PersonasList";
import PersonaDetail from "./pages/PersonaDetail";
import Arbol from "./pages/Arbol";
import Documentos from "./pages/Documentos";
import Buscar from "./pages/Buscar";
import InvestigacionExterna from "./pages/InvestigacionExterna";
import Importar from "./pages/Importar";
import Agente from "./pages/Agente";
import EstimacionEtnica from "./pages/EstimacionEtnica";
import Coincidencias from "./pages/Coincidencias";
import Pistas from "./pages/Pistas";
import Hipotesis from "./pages/Hipotesis";
import Inferencias from "./pages/Inferencias";
import Lugares from "./pages/Lugares";
import LineaDeTiempo from "./pages/LineaDeTiempo";
import Configuracion from "./pages/Configuracion";
import AgentesParalelo from "./pages/AgentesParalelo";
import ConfigurarApp from "./pages/ConfigurarApp";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/personas" element={<PersonasList />} />
              <Route path="/personas/:id" element={<PersonaDetail />} />
              <Route path="/arbol" element={<Arbol />} />
              <Route path="/documentos" element={<Documentos />} />
              <Route path="/documentos/:id" element={<Documentos />} />
              <Route path="/buscar" element={<Buscar />} />
              <Route path="/investigacion-externa" element={<InvestigacionExterna />} />
              <Route path="/importar" element={<Importar />} />
              <Route path="/agente" element={<Agente />} />
              <Route path="/estimacion-etnica" element={<EstimacionEtnica />} />
              <Route path="/coincidencias" element={<Coincidencias />} />
              <Route path="/pistas" element={<Pistas />} />
              <Route path="/hipotesis" element={<Hipotesis />} />
              <Route path="/inferencias" element={<Inferencias />} />
              <Route path="/lugares" element={<Lugares />} />
              <Route path="/linea-de-tiempo" element={<LineaDeTiempo />} />
              <Route path="/configuracion" element={<Configuracion />} />
              <Route path="/agentes-paralelo" element={<AgentesParalelo />} />
              <Route path="/configurar-app" element={<ConfigurarApp />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
