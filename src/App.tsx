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
import PersonasList from "./pages/PersonasList";
import PersonaDetail from "./pages/PersonaDetail";
import Arbol from "./pages/Arbol";
import Familias from "./pages/Familias";
import Documentos from "./pages/Documentos";
import Fotos from "./pages/Fotos";
import Buscar from "./pages/Buscar";
import Investigacion from "./pages/Investigacion";
import InvestigacionExterna from "./pages/InvestigacionExterna";
import Importar from "./pages/Importar";
import Agente from "./pages/Agente";
import Asistente from "./pages/Asistente";
import EstimacionEtnica from "./pages/EstimacionEtnica";
import ADN from "./pages/ADN";
import Coincidencias from "./pages/Coincidencias";
import Pistas from "./pages/Pistas";
import Hipotesis from "./pages/Hipotesis";
import Inferencias from "./pages/Inferencias";
import Lugares from "./pages/Lugares";
import LineaDeTiempo from "./pages/LineaDeTiempo";
import Configuracion from "./pages/Configuracion";
import AgentesParalelo from "./pages/AgentesParalelo";
import ConfigurarApp from "./pages/ConfigurarApp";
import Fuentes from "./pages/Fuentes";
import FamilySearchCallback from "./pages/FamilySearchCallback";
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
