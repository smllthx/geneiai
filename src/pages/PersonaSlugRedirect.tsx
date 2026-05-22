import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PersonaSlugRedirect() {
  const { slug = "" } = useParams();
  const [target, setTarget] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (UUID_RE.test(slug)) { setTarget(slug); setDone(true); return; }
      const { data } = await supabase.from("personas").select("id, nombres, apellidos").limit(2000);
      const match = (data ?? []).find((p) => slugify(`${p.nombres} ${p.apellidos}`) === slug);
      setTarget(match?.id ?? null);
      setDone(true);
    })();
  }, [slug]);

  if (!done) return <div className="grid min-h-[40vh] place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
  if (!target) return <Navigate to="/personas" replace />;
  return <Navigate to={`/personas/${target}`} replace />;
}
