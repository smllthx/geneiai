import { supabase } from "@/integrations/supabase/client";

type PosterPerson = {
  id: string; nombres?: string; apellidos?: string; foto_url?: string | null;
  nac_fecha?: string | null; nac_fecha_aprox?: string | null; defuncion_fecha?: string | null;
  nac_lugar?: string | null; nacionalidad?: string | null; ocupacion?: string | null;
};

async function imageCanvas(url: string, maxSize?: number) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const scale = Math.min(1, (maxSize ?? Infinity) / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la imagen.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function generatePersonPoster(person: PosterPerson, portraitUrl = person.foto_url) {
  // SVGs rendered inside an img cannot load an external portrait. Embed a small copy.
  let photo: string | null = null;
  if (portraitUrl) {
    try { photo = (await imageCanvas(portraitUrl, 480)).toDataURL("image/png"); }
    catch { /* An unavailable portrait leaves the person's initials on the poster. */ }
  }
  const { id, nombres, apellidos, nac_fecha, nac_fecha_aprox, defuncion_fecha, nac_lugar, nacionalidad, ocupacion } = person;
  const { data, error } = await supabase.functions.invoke("generar-cuadro-persona", {
    body: { persona_id: id, persona: { nombres, apellidos, nac_fecha, nac_fecha_aprox, defuncion_fecha, nac_lugar, nacionalidad, ocupacion, foto_url: photo } },
  });
  if (error) throw error;
  if (typeof data?.imageUrl !== "string" || !data.imageUrl.startsWith("data:image/")) throw new Error("El generador no devolvió una imagen.");
  return data.imageUrl as string;
}

export async function downloadPersonPoster(url: string, id: string, format: "png" | "pdf") {
  const canvas = await imageCanvas(url);
  const png = canvas.toDataURL("image/png");
  if (format === "pdf") {
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const scale = Math.min(190 / canvas.width, 277 / canvas.height);
    const width = canvas.width * scale, height = canvas.height * scale;
    pdf.addImage(png, "PNG", (210 - width) / 2, (297 - height) / 2, width, height);
    pdf.save(`cuadro-${id}.pdf`);
    return;
  }
  const link = document.createElement("a");
  link.href = png;
  link.download = `cuadro-${id}.png`;
  document.body.append(link);
  link.click();
  link.remove();
}
