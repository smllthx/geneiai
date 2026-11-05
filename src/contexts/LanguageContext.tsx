import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isLanguage, localeFor, translate, type Language } from "@/lib/language";

const read = (key: string): Language => { try { const v = localStorage.getItem(key); return isLanguage(v) ? v : "es"; } catch { return "es"; } };
const write = (key: string, value: Language) => { try { localStorage.setItem(key, value); } catch { /* Preference still works in memory. */ } };
type Context = { language: Language; locale: string; t: (text: string) => string; saveLanguage: (language: Language) => Promise<void> };
const LanguageContext = createContext<Context>({ language: "es", locale: "es-CL", t: text => text, saveLanguage: async () => {} });

function ScopedLanguageProvider({ userId, children }: { userId?: string; children: ReactNode }) {
  const key = `geneai:language:${userId || "preview"}`;
  const [language, setLanguage] = useState<Language>(() => read(key));
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    const startedAt = revision.current;
    if (userId) void supabase.from("app_config").select("idioma").eq("user_id", userId).maybeSingle().then(({ data, error }) => {
      if (active && revision.current === startedAt && !error && isLanguage(data?.idioma)) { setLanguage(data.idioma); write(key, data.idioma); }
    });
    const storage = (event: StorageEvent) => { if (event.key === key && isLanguage(event.newValue)) { revision.current++; setLanguage(event.newValue); } };
    window.addEventListener("storage", storage);
    return () => { active = false; revision.current++; window.removeEventListener("storage", storage); };
  }, [key, userId]);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const saveLanguage = async (next: Language) => {
    const stamp = ++revision.current;
    if (userId) {
      const { error } = await supabase.from("app_config").upsert({ user_id: userId, idioma: next }, { onConflict: "user_id" });
      if (error) throw error;
    }
    if (stamp !== revision.current) return;
    write(key, next); setLanguage(next);
  };
  return <LanguageContext.Provider value={{ language, locale: localeFor(language), t: text => translate(text, language), saveLanguage }}>{children}</LanguageContext.Provider>;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <ScopedLanguageProvider key={user?.id || "preview"} userId={user?.id}>{children}</ScopedLanguageProvider>;
}
export const useLanguage = () => useContext(LanguageContext);
