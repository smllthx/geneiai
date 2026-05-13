import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Upload, AlertTriangle, CheckCircle2, FileDown, Link2 } from "lucide-react";
import { parseGedcom } from "@/lib/import/gedcom";
import { readCSV, readXLSX, readJSON, parseTabular } from "@/lib/import/tabular";
import { persistImport, type ImportSummary } from "@/lib/import/persist";

const CSV_TEMPLATE = `id,nombres,apellidos,sexo,nac_fecha,nac_lugar,defuncion_fecha,defuncion_lugar,padre_id,madre_id,conyuge_id,ocupacion,notas
P1,Giovanni Battista,Sanguineti,M,1850-03-12,Chiavari (Italia),1920-08-01,Buenos Aires,,,P2,,Migrante 1875
P2,Maria Rosa,Queirolo,F,1855-06-20,Chiavari (Italia),1925-01-15,Buenos Aires,,,P1,,
P3,Pedro,Sanguineti,M,1880-04-05,Buenos Aires,,,P1,P2,,Comerciante,
`;

export default function Importar() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "plantilla-genealogia.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) return toast.error("Seleccioná un archivo primero.");
    setBusy(true); setSummary(null);
    try {
      const name = file.name.toLowerCase();
      let data: { personas: any[]; familias: any[] };
      let source = "Importación";

      if (name.endsWith(".ged") || name.endsWith(".gedcom")) {
        data = parseGedcom(await file.text()); source = "GEDCOM";
      } else if (name.endsWith(".csv")) {
        data = parseTabular(await readCSV(file)); source = "CSV";
      } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        data = parseTabular(await readXLSX(file)); source = "Excel";
      } else if (name.endsWith(".json")) {
        data = await readJSON(file); source = "JSON";
      } else {
        throw new Error("Formato no soportado. Usá .ged, .csv, .xlsx o .json.");
      }

      if (!data.personas.length) throw new Error("No se encontraron personas en el archivo.");

      const result = await persistImport(data, source);
      setSummary(result);
      if (result.errores.length === 0) toast.success(`Importación completa: ${result.personasCreadas} personas, ${result.relacionesCreadas} relaciones.`);
      else toast.warning(`Importación parcial. Revisá los errores.`);
    } catch (e: any) {
      toast.error(e.message ?? "Error al importar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Importar árbol genealógico" subtitle="GEDCOM (.ged), CSV, Excel o JSON. Las personas se marcan como certeza «probable» hasta que las verifiques con fuentes." />

      <Alert className="mb-6 border-accent/30 bg-accent/5">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Importante</AlertTitle>
        <AlertDescription>
          Lo importado entra como <strong>probable</strong>, no como hecho comprobado. Revisá cada persona y asociá fuentes documentales antes de darlo por verificado.
        </AlertDescription>
      </Alert>

      <Card className="archivo-card mb-6">
        <CardHeader><CardTitle className="font-serif text-xl">Subir archivo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Archivo (.ged, .gedcom, .csv, .xlsx, .json)</Label>
            <Input type="file" accept=".ged,.gedcom,.csv,.xlsx,.xls,.json,application/json,text/csv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setSummary(null); }} />
            {file && <p className="mt-1 text-xs text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleImport} disabled={!file || busy}>
              <Upload className="h-4 w-4" /> {busy ? "Importando…" : "Importar"}
            </Button>
            <Button variant="outline" onClick={downloadTemplate}>
              <FileDown className="h-4 w-4" /> Descargar plantilla CSV
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Para importar desde FamilySearch, MyHeritage, Ancestry o Geneanet: exportá tu árbol como GEDCOM desde esa plataforma y subilo aquí.
          </p>
        </CardContent>
      </Card>

      {summary && (
        <Card className="archivo-card mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <CheckCircle2 className="h-5 w-5 text-primary" /> Resultado de la importación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><strong>{summary.personasCreadas}</strong> personas creadas.</p>
            <p><strong>{summary.relacionesCreadas}</strong> relaciones (padre / madre / cónyuge / hijo) creadas.</p>
            {summary.errores.length > 0 && (
              <div>
                <p className="font-medium text-destructive">Errores:</p>
                <ul className="list-disc pl-5 text-xs text-muted-foreground">
                  {summary.errores.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="archivo-card">
        <CardHeader><CardTitle className="flex items-center gap-2 font-serif text-xl"><Link2 className="h-5 w-5" /> Sincronización directa con FamilySearch / MyHeritage</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>La sincronización en vivo (sin exportar archivos) requiere credenciales de desarrollador de cada plataforma:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>FamilySearch</strong>: registrar la app en <em>familysearch.org/developers</em> (gratis, aprobación manual). Necesitamos <code>client_id</code> y dominio de redirección.</li>
            <li><strong>MyHeritage</strong>: API privada para partners (<em>myheritage.com/api</em>). Acceso restringido y de pago.</li>
            <li><strong>Ancestry</strong>: no expone API pública. Solo GEDCOM.</li>
          </ul>
          <p>Cuando tengas las credenciales, las cargás en Configuración y activamos el flujo OAuth + sincronización periódica. Mientras tanto, el camino confiable es <strong>exportar GEDCOM</strong> desde esas plataformas e importarlo aquí.</p>
        </CardContent>
      </Card>
    </div>
  );
}
