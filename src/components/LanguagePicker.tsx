import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GeneIcon } from "./GeneIcon";
import { useLanguage } from "@/contexts/LanguageContext";
import { languages, translate, type Language } from "@/lib/language";

export default function LanguagePicker() {
  const { language, saveLanguage, t } = useLanguage();
  const [draft, setDraft] = useState<Language>(language);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const save = async () => {
    setSaving(true); setError(false);
    try { await saveLanguage(draft); setOpen(false); } catch { setError(true); } finally { setSaving(false); }
  };
  return <Dialog open={open} onOpenChange={value => { if (saving) return; setOpen(value); setDraft(language); setError(false); }}>
    <DialogTrigger asChild><button type="button" className="language-trigger flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-foreground/5"><GeneIcon name="language" size={22} />{t("Idioma")}<span className="ml-auto text-xs text-muted-foreground">{languages.find(l => l.code === language)?.name}</span></button></DialogTrigger>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader><DialogTitle>{t("Idioma de la interfaz")}</DialogTitle><DialogDescription>{t("Los nombres propios y los documentos conservan su idioma original.")}</DialogDescription></DialogHeader>
      <fieldset className="space-y-2" disabled={saving}><legend className="sr-only">{t("Idioma")}</legend>{languages.map(item => <label key={item.code} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border p-4 ${draft === item.code ? "border-primary bg-primary/5" : "border-border"}`}>
        <input type="radio" name="interface-language" value={item.code} checked={draft === item.code} onChange={() => setDraft(item.code)} className="accent-primary" />
        <span lang={item.code}>{item.name}</span><span className="ml-auto text-xs text-muted-foreground">{item.code.toUpperCase()}</span>
      </label>)}</fieldset>
      <div className="rounded-xl border bg-muted/30 p-4" aria-live="polite"><p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">{t("Vista previa")}</p><div lang={draft} className="flex flex-wrap gap-4">{["Inicio", "Archivo familiar", "Investigación", "Fotos"].map(text => <span key={text}>{translate(text, draft)}</span>)}</div></div>
      {error && <p role="alert" className="text-sm text-destructive">{t("No se pudo guardar el idioma. Inténtalo otra vez.")}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>{t("Cancelar")}</Button><Button disabled={saving} onClick={save}>{t(saving ? "Guardando…" : "Guardar")}</Button></div>
    </DialogContent>
  </Dialog>;
}
