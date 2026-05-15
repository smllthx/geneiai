import { useNavigate } from "react-router-dom";
import { SectionHeader, GlassCard } from "@/components/glass";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Bot, Globe, Compass, Lightbulb, Brain, Layers } from "lucide-react";

export default function Investigacion() {
  const navigate = useNavigate();
  const cards = [
    { to: "/agente", icon: Bot, title: "Agente IA", desc: "Conversa con la IA para investigar a una persona o un evento." },
    { to: "/agentes-paralelo", icon: Layers, title: "Agentes en paralelo", desc: "Lanza múltiples consultas en simultáneo a Lovable AI, OpenAI y Anthropic." },
    { to: "/investigacion-externa", icon: Globe, title: "Búsquedas externas", desc: "Genera URLs de búsqueda para FamilySearch, Geneanet, archivos y más." },
    { to: "/pistas", icon: Compass, title: "Pistas", desc: "Tareas de investigación generadas automáticamente." },
    { to: "/hipotesis", icon: Lightbulb, title: "Hipótesis", desc: "Conjeturas con probabilidad, argumentos a favor y en contra." },
    { to: "/inferencias", icon: Brain, title: "Inferencias automáticas", desc: "Reglas que deducen datos a partir de los registros existentes." },
  ];

  return (
    <div>
      <SectionHeader
        eyebrow="Centro de investigación"
        title="Investigación automática"
        subtitle="Toda la inteligencia investigativa en un solo lugar: agente IA, búsquedas externas, pistas, hipótesis e inferencias."
      />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <button key={c.to} onClick={() => navigate(c.to)} className="text-left">
            <GlassCard interactive>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><c.icon className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-base font-semibold">{c.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{c.desc}</p>
                </div>
              </div>
            </GlassCard>
          </button>
        ))}
      </div>
    </div>
  );
}
