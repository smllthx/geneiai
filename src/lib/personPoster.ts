import { supabase } from "@/integrations/supabase/client";

async function imageCanvas(url: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la imagen.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function generatePersonPoster(personId: string) {
  const { data, error } = await supabase.functions.invoke("generar-cuadro-persona", {
    body: { persona_id: personId },
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
