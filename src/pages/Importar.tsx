import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SectionHeader, GlassCard } from "@/components/glass";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, AlertTriangle, CheckCircle2, FileDown, Link2, RefreshCw, Download, FileText, Sparkles, Brain, Loader2 } from "lucide-react";
import { parseGedcom } from "@/lib/import/gedcom";
import { readCSV, readXLSX, readJSON, parseTabular } from "@/lib/import/tabular";
import { persistImport, type ImportSummary } from "@/lib/import/persist";
import { notify } from "@/lib/notifications";

const CSV_TEMPLATE = `id,nombres,apellidos,sexo,nac_fecha,nac_lugar,defuncion_fecha,defuncion_lugar,padre_id,madre_id,conyuge_id,ocupacion,notas
P1,Giovanni Battista,Sanguineti,M,1850-03-12,Chiavari (Italia),1920-08-01,Buenos Aires,,,P2,,Migrante 1875
P2,Maria Rosa,Queirolo,F,1855-06-20,Chiavari (Italia),1925-01-15,Buenos Aires,,,P1,,
`;

export default function Importar() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [fsAccount, setFsAccount] = useState<any>(null);
  const [genAsc, setGenAsc] = useState(4);
  const [genDesc, setGenDesc] = useState(2);
  const [iaFile, setIaFile] = useState<File | null>(null);
  const [iaBusy, setIaBusy] = useState(false);
  const [iaResult, setIaResult] = useState<any>(null);
  const [mhFile, setMhFile] = useState<File | null>(null);
  const [mhBusy, setMhBusy] = useState(false);
  const [mhSummary, setMhSummary] = useState<ImportSummary | null>(null);


  const fileToBase64 = (f: File) => new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      resolve(s.split(",")[1] ?? "");
    };
    r.onerror = reject;
    r.readAsDataURL(f);
  });

  const handleIaLeer = async () => {
    if (!iaFile) return toast.error("Selecciona un archivo");
    setIaBusy(true); setIaResult(null);
    const sizeMB = iaFile.size / (1024 * 1024);
    const t = toast.loading(`Subiendo "${iaFile.name}" (${sizeMB.toFixed(1)} MB)…`);
    try {
      const mime = iaFile.type || "application/octet-stream";
      const isText = mime.startsWith("text/") || /\.(txt|csv|json|md|ged|gedcom)$/i.test(iaFile.name);
      const isVisual = mime.startsWith("image/") || mime === "application/pdf";
      let payload: any = { filename: iaFile.name, mime_type: mime, background: true };
      if (isVisual) payload.file_base64 = await fileToBase64(iaFile);
      else if (isText) payload.text_content = await iaFile.text();
      else {
        try { payload.text_content = await iaFile.text(); }
        catch { payload.file_base64 = await fileToBase64(iaFile); }
      }
      const { data, error } = await supabase.functions.invoke("leer-documento-ia", { body: payload });
      toast.dismiss(t);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setIaResult(data);
      toast.success("📄 Procesando en segundo plano. Podés cambiar de sección — los resultados aparecerán en Inicio.", { duration: 8000 });
      notify("Documento en proceso", {
        body: `IA leyendo "${iaFile.name}". Te avisaremos cuando termine.`,
        url: "/inicio",
        tag: "leer-doc",
      });
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "Error de IA");
    } finally { setIaBusy(false); }
  };

  const loadAccount = async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    const { data } = await supabase.from("external_accounts")
      .select("*").eq("user_id", user.id).eq("provider", "familysearch").maybeSingle();
    setFsAccount(data);
  };
  useEffect(() => { loadAccount(); }, []);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "plantilla-genealogia.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) return toast.error("Selecciona un archivo primero.");
    setBusy(true); setSummary(null);
    try {
      const name = file.name.toLowerCase();
      let data: { personas: any[]; familias: any[] }; let source = "Import";
      if (name.endsWith(".ged") || name.endsWith(".gedcom")) { data = parseGedcom(await file.text()); source = "GEDCOM"; }
      else if (name.endsWith(".csv")) { data = parseTabular(await readCSV(file)); source = "CSV"; }
      else if (name.endsWith(".xlsx") || name.endsWith(".xls")) { data = parseTabular(await readXLSX(file)); source = "Excel"; }
      else if (name.endsWith(".json")) { data = await readJSON(file); source = "JSON"; }
      else throw new Error("Formato no soportado.");
      if (!data.personas.length) throw new Error("No se encontraron personas en el archivo.");
      const result = await persistImport(data, source);
      setSummary(result);
      result.errores.length === 0
        ? toast.success(`${result.personasCreadas} personas, ${result.relacionesCreadas} relaciones`)
        : toast.warning("Importación parcial. Revisa los errores.");
    } catch (e: any) { toast.error(e.message ?? "Error al importar"); }
    finally { setBusy(false); }
  };

  const handleImportMH = async () => {
    if (!mhFile) return toast.error("Selecciona el GEDCOM exportado de MyHeritage.");
    const name = mhFile.name.toLowerCase();
    if (!name.endsWith(".ged") && !name.endsWith(".gedcom")) {
      return toast.error("MyHeritage exporta en formato GEDCOM (.ged).");
    }
    setMhBusy(true); setMhSummary(null);
    const t = toast.loading("Procesando GEDCOM de MyHeritage…");
    try {
      const data = parseGedcom(await mhFile.text());
      if (!data.personas.length) throw new Error("No se encontraron personas en el archivo.");
      const result = await persistImport(data, "MyHeritage");
      setMhSummary(result);
      toast.dismiss(t);
      result.errores.length === 0
        ? toast.success(`${result.personasCreadas} nuevas · ${result.personasFusionadas} fusionadas · ${result.relacionesCreadas} relaciones`)
        : toast.warning("Importación parcial. Revisa los errores.");
      notify("MyHeritage importado", {
        body: `+${result.personasCreadas} nuevas · ${result.personasFusionadas} fusionadas`,
        url: "/personas",
        tag: "mh-import",
      });
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e.message ?? "Error al importar de MyHeritage");
    } finally { setMhBusy(false); }
  };


  const conectarFS = async () => {
    try {
      const redirectUri = `${window.location.origin}/familysearch/callback`;
      const { data, error } = await supabase.functions.invoke("familysearch-auth", {
        body: { action: "start", redirect_uri: redirectUri },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      window.location.href = data.url;
    } catch (e: any) { toast.error(e.message); }
  };

  const desconectarFS = async () => {
    if (!confirm("¿Desconectar FamilySearch?")) return;
    const user = (await supabase.auth.getUser()).data.user!;
    await supabase.from("external_accounts").delete().eq("user_id", user.id).eq("provider", "familysearch");
    setFsAccount(null); toast.success("Desconectado");
  };

  const sincronizarFS = async () => {
    const t = toast.loading("Sincronizando con FamilySearch…");
    try {
      const { data, error } = await supabase.functions.invoke("familysearch-sync", {
        body: { generaciones_asc: genAsc, generaciones_desc: genDesc },
      });
      toast.dismiss(t);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.creadas} personas creadas, ${data.relsCreadas} relaciones`);
    } catch (e: any) { toast.dismiss(t); toast.error(e.message); }
  };

  const exportarGEDCOM = async () => {
    const t = toast.loading("Generando GEDCOM…");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/familysearch-export`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      toast.dismiss(t);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "arbol-familiar.ged"; a.click();
      toast.success("Descargado");
    } catch (e: any) { toast.dismiss(t); toast.error(e.message); }
  };

  return (
    <div>
      <SectionHeader
        eyebrow="Importar / Exportar"
        title="Conectar con otras plataformas"
        subtitle="Sincroniza con FamilySearch, importa GEDCOM/CSV/JSON y exporta tu árbol completo."
      />

      <Alert className="mb-6 border-accent/30 bg-accent/5">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Importación marcada como «probable»</AlertTitle>
        <AlertDescription>Los datos importados quedan como certeza «probable» hasta que los verifiques con fuentes documentales.</AlertDescription>
      </Alert>

      <Tabs defaultValue="ia" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="ia"><Sparkles className="h-3.5 w-3.5" /> IA: Leer documento</TabsTrigger>
          <TabsTrigger value="familysearch">FamilySearch</TabsTrigger>
          <TabsTrigger value="myheritage">MyHeritage</TabsTrigger>
          <TabsTrigger value="gedcom">GEDCOM / CSV / JSON</TabsTrigger>
          <TabsTrigger value="exportar">Exportar</TabsTrigger>
          <TabsTrigger value="otros">Otras plataformas</TabsTrigger>
        </TabsList>


        <TabsContent value="ia">
          <GlassCard>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Brain className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-semibold">IA experta lee tu documento genealógico</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Subí cualquier archivo (PDF, foto de acta, escaneo, DOCX, TXT, CSV…). La IA extrae personas, fechas,
                  lugares, eventos y relaciones, y los agrega automáticamente a tu árbol (con certeza "probable" para
                  que los revises). Los duplicados por nombre+apellido se reusan.
                </p>
                <div className="mt-3 space-y-3">
                  <Input
                    type="file"
                    accept="image/*,application/pdf,.pdf,.txt,.csv,.json,.md,.ged,.gedcom,.docx,.doc"
                    onChange={(e) => { setIaFile(e.target.files?.[0] ?? null); setIaResult(null); }}
                  />
                  {iaFile && <p className="text-xs text-muted-foreground">{iaFile.name} · {(iaFile.size / 1024).toFixed(1)} KB</p>}
                  <Button onClick={handleIaLeer} disabled={!iaFile || iaBusy} className="w-full sm:w-auto">
                    {iaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {iaBusy ? "Analizando…" : "Leer con IA y agregar al árbol"}
                  </Button>
                </div>
                {iaResult && (
                  <div className="mt-4 space-y-2 rounded-2xl bg-foreground/5 p-4 text-sm">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <strong>+{iaResult.personasCreadas}</strong> personas nuevas
                      {iaResult.personasReusadas > 0 && <span className="text-muted-foreground">(· {iaResult.personasReusadas} reusadas)</span>}
                      , <strong>+{iaResult.eventosCreados}</strong> eventos, <strong>+{iaResult.relacionesCreadas}</strong> relaciones.
                    </p>
                    {iaResult.tipo_documento && <p className="text-xs text-muted-foreground">Tipo: {iaResult.tipo_documento}</p>}
                    {iaResult.resumen && <p className="text-xs">{iaResult.resumen}</p>}
                    {iaResult.transcripcion && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground">Transcripción</summary>
                        <pre className="mt-2 whitespace-pre-wrap">{iaResult.transcripcion}</pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </TabsContent>


        <TabsContent value="familysearch">
          <GlassCard>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Link2 className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-semibold">FamilySearch · Sincronización en vivo</h3>
                {!fsAccount ? (
                  <>
                    <p className="mt-1 text-sm text-muted-foreground">Conecta tu cuenta de FamilySearch para descargar y sincronizar tu árbol automáticamente vía OAuth.</p>
                    <Button className="mt-3" onClick={conectarFS}>Conectar cuenta de FamilySearch</Button>
                  </>
                ) : (
                  <>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="glass-pill text-primary">✓ Conectado</span>
                      {fsAccount.expires_at && <span className="text-xs text-muted-foreground">Expira: {new Date(fsAccount.expires_at).toLocaleString("es")}</span>}
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label>Generaciones de ancestros</Label>
                        <Select value={String(genAsc)} onValueChange={(v) => setGenAsc(parseInt(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{[1,2,3,4,5,6,7,8].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Generaciones de descendientes</Label>
                        <Select value={String(genDesc)} onValueChange={(v) => setGenDesc(parseInt(v))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{[0,1,2].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button onClick={sincronizarFS}><RefreshCw className="h-4 w-4" /> Sincronizar ahora</Button>
                      <Button variant="outline" onClick={desconectarFS}>Desconectar</Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="myheritage">
          <GlassCard>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Link2 className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-semibold">MyHeritage · Importar árbol</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  MyHeritage no expone una API pública para sincronización en vivo, pero sí permite exportar tu árbol completo como GEDCOM. Esta pestaña lo procesa con auto‑fusión de duplicados (alta confianza).
                </p>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>En MyHeritage entra a tu árbol → <strong>Gestionar árbol</strong> → <strong>Exportar a GEDCOM</strong>.</li>
                  <li>Espera el correo con el enlace de descarga y guarda el archivo <code>.ged</code>.</li>
                  <li>Súbelo aquí abajo. Las personas que ya tienes (mismo nombre+apellido y año de nacimiento ±2) se fusionan; las nuevas entran como certeza «probable».</li>
                </ol>
                <div className="mt-3 space-y-3">
                  <Input
                    type="file"
                    accept=".ged,.gedcom"
                    onChange={(e) => { setMhFile(e.target.files?.[0] ?? null); setMhSummary(null); }}
                  />
                  {mhFile && <p className="text-xs text-muted-foreground">{mhFile.name} · {(mhFile.size / 1024).toFixed(1)} KB</p>}
                  <Button onClick={handleImportMH} disabled={!mhFile || mhBusy}>
                    {mhBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {mhBusy ? "Importando…" : "Importar GEDCOM de MyHeritage"}
                  </Button>
                </div>
                {mhSummary && (
                  <div className="mt-4 rounded-2xl bg-foreground/5 p-4 text-sm">
                    <p className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <strong>{mhSummary.personasCreadas}</strong> nuevas · <strong>{mhSummary.personasFusionadas}</strong> fusionadas · <strong>{mhSummary.relacionesCreadas}</strong> relaciones
                    </p>
                    {mhSummary.errores.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-xs text-destructive">
                        {mhSummary.errores.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </TabsContent>

        <TabsContent value="gedcom">
          <GlassCard>
            <h3 className="font-display text-lg font-semibold">Subir archivo</h3>
            <p className="mt-1 text-sm text-muted-foreground">.ged, .gedcom, .csv, .xlsx, .json — con auto‑fusión de duplicados</p>
            <div className="mt-3 space-y-3">
              <Input type="file" accept=".ged,.gedcom,.csv,.xlsx,.xls,.json,application/json,text/csv"
                onChange={(e) => { setFile(e.target.files?.[0] ?? null); setSummary(null); }} />
              {file && <p className="text-xs text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleImport} disabled={!file || busy}><Upload className="h-4 w-4" /> {busy ? "Importando…" : "Importar"}</Button>
                <Button variant="outline" onClick={downloadTemplate}><FileDown className="h-4 w-4" /> Plantilla CSV</Button>
              </div>
            </div>
            {summary && (
              <div className="mt-4 rounded-2xl bg-foreground/5 p-4 text-sm">
                <p className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <strong>{summary.personasCreadas}</strong> nuevas · <strong>{summary.personasFusionadas}</strong> fusionadas · <strong>{summary.relacionesCreadas}</strong> relaciones
                </p>
                {summary.errores.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-xs text-destructive">
                    {summary.errores.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                )}
              </div>
            )}
          </GlassCard>
        </TabsContent>

        <TabsContent value="exportar">
          <GlassCard>
            <h3 className="font-display text-lg font-semibold">Exportar árbol</h3>
            <p className="mt-1 text-sm text-muted-foreground">Genera un archivo GEDCOM 5.5.1 con todas tus personas y relaciones.</p>
            <Button className="mt-3" onClick={exportarGEDCOM}><Download className="h-4 w-4" /> Descargar GEDCOM</Button>
          </GlassCard>
        </TabsContent>

        <TabsContent value="otros">
          <GlassCard>
            <h3 className="font-display text-lg font-semibold">Ancestry · Geneanet · Otros</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Estas plataformas tampoco exponen API pública. El flujo es el mismo que MyHeritage:
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              <li>Exporta tu árbol como GEDCOM desde la plataforma origen.</li>
              <li>Sube el archivo en la pestaña <strong>GEDCOM / CSV / JSON</strong>.</li>
              <li>Los duplicados se fusionan automáticamente.</li>
            </ol>
          </GlassCard>
        </TabsContent>

      </Tabs>
    </div>
  );
}
