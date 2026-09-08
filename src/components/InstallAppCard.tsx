import { useState, useSyncExternalStore } from "react";
import { Download, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getInstallationPlatform, getInstallationServerSnapshot, getInstallationSnapshot,
  promptAppInstallation, subscribeInstallation,
} from "@/lib/appInstallation";

const instructions = {
  ios: ["Abre esta misma dirección en Safari.", "Toca Compartir y selecciona Añadir a pantalla de inicio.", "Si aparece Abrir como app web, actívalo. Deja el nombre GENEAI y toca Añadir."],
  android: ["Abre esta misma dirección en Chrome.", "Abre el menú ⋮ y elige Instalar aplicación o Añadir a pantalla de inicio.", "Confirma el nombre GENEAI y abre su icono desde el inicio."],
  macos: ["Abre esta misma dirección en Safari.", "En macOS Sonoma o posterior, elige Archivo → Añadir al Dock.", "Deja el nombre GENEAI y pulsa Añadir. Si ya la tienes en el Dock, abre esa misma app."],
  desktop: ["Abre esta misma dirección en Chrome o Edge.", "Busca Instalar GENEAI en la barra de direcciones o en el menú del navegador.", "Confirma la instalación y abre GENEAI desde su icono."],
};

export default function InstallAppCard() {
  const { installed, canPrompt } = useSyncExternalStore(subscribeInstallation, getInstallationSnapshot, getInstallationServerSnapshot);
  const [platform] = useState(getInstallationPlatform);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const install = async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await promptAppInstallation();
      setMessage(result === "accepted"
        ? "Solicitud aceptada. Cuando termine la instalación, abre el icono GENEAI."
        : "Puedes añadir GENEAI desde el menú de tu navegador cuando quieras.");
    } catch {
      setMessage("No se pudo abrir la instalación. Sigue los pasos del navegador que aparecen abajo.");
    } finally { setBusy(false); }
  };

  return (
    <Card className="archivo-card mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-serif text-xl">
          <Smartphone className="h-5 w-5 shrink-0" /> GENEAI en este dispositivo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-base">{installed ? "Estás usando GENEAI como app." : "Abre GENEAI desde su icono en la pantalla de inicio o en el Dock."}</p>
        <p className="text-sm text-muted-foreground">
          Entra con tu misma cuenta y selecciona el mismo árbol en el teléfono y en el Mac para ver tus datos compartidos. Los cambios guardados se consultan con conexión a internet.
        </p>
        <p className="text-sm text-muted-foreground">
          El ajuste automático adapta los menús a esta pantalla y a sus giros. Puedes modificarlo en Ajustar vista; el tamaño elegido se guarda en este dispositivo.
        </p>
        {!installed && <>
          {canPrompt && <Button onClick={install} disabled={busy} className="min-h-11 w-full sm:w-auto">
            <Download className="h-4 w-4" /> {busy ? "Abriendo instalación…" : "Instalar GENEAI"}
          </Button>}
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {instructions[platform].map((step) => <li key={step}>{step}</li>)}
          </ol>
        </>}
        {message && <p role="status" className="text-sm">{message}</p>}
      </CardContent>
    </Card>
  );
}
