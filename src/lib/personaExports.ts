import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { personaCode } from "./personaCode";
import { padresDe, hijosDe, conyugesDe, hermanosDe } from "./kinship";

const yearOf = (d?: string | null) => (d ? new Date(d).getUTCFullYear() : null);
const fullName = (p: any) => `${p?.nombres ?? ""} ${p?.apellidos ?? ""}`.trim() || "(sin nombre)";
const lifespan = (p: any) => {
  const yN = yearOf(p?.nac_fecha) ?? p?.nac_rango_ini ?? null;
  const yD = yearOf(p?.defuncion_fecha) ?? null;
  if (!yN && !yD) return "";
  return ` (${yN ?? "?"}–${yD ?? (p?.viva === "si" ? "Vive" : "?")})`;
};

async function loadContext(personaId: string) {
  const [{ data: personas }, { data: rels }, { data: eventos }, { data: docs }] = await Promise.all([
    supabase.from("personas").select("*"),
    supabase.from("relaciones").select("id,persona_id,pariente_id,tipo"),
    supabase.from("eventos").select("*").eq("persona_id", personaId).order("fecha"),
    supabase.from("documentos").select("*"),
  ]);
  const byId = new Map((personas ?? []).map((p: any) => [p.id, p]));
  return { personas: personas ?? [], rels: rels ?? [], byId, eventos: eventos ?? [], docs: docs ?? [], persona: byId.get(personaId) };
}

function header(doc: jsPDF, title: string, persona: any) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text(title, 40, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(110);
  doc.text(`${fullName(persona)}${lifespan(persona)} · ${personaCode(persona.id)}`, 40, 68);
  doc.setDrawColor(220);
  doc.line(40, 78, doc.internal.pageSize.getWidth() - 40, 78);
  doc.setTextColor(20);
}

function footer(doc: jsPDF) {
  const pages = (doc as any).getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`GeneaAgents · ${new Date().toLocaleDateString("es")}`, 40, doc.internal.pageSize.getHeight() - 20);
    doc.text(`${i} / ${pages}`, doc.internal.pageSize.getWidth() - 60, doc.internal.pageSize.getHeight() - 20);
  }
}

function drawAncestorBox(doc: jsPDF, x: number, y: number, w: number, h: number, p: any | null) {
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, w, h, 4, 4, "S");
  if (!p) {
    doc.setFontSize(8);
    doc.setTextColor(160);
    doc.text("?", x + w / 2, y + h / 2, { align: "center", baseline: "middle" });
    doc.setTextColor(20);
    return;
  }
  const isF = p.sexo === "femenino";
  const bar = isF ? [244, 114, 182] : p.sexo === "masculino" ? [56, 189, 248] : [148, 163, 184];
  doc.setFillColor(bar[0], bar[1], bar[2]);
  doc.rect(x, y, w, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const name = fullName(p);
  const lines = doc.splitTextToSize(name, w - 6);
  doc.text(lines.slice(0, 2), x + 3, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(110);
  doc.text(lifespan(p).trim() || "", x + 3, y + h - 6);
  doc.setTextColor(20);
}

// === 1. Cuadro genealógico (ascendientes en cascada) ===
export async function exportCuadroGenealogico(personaId: string) {
  const { personas, rels, byId, persona } = await loadContext(personaId);
  if (!persona) throw new Error("Persona no encontrada");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  header(doc, "Cuadro genealógico", persona);

  const pageW = doc.internal.pageSize.getWidth();
  const startX = 40, startY = 110;
  const generations = 5;
  const colW = (pageW - 80) / generations;
  const boxH = 38, boxW = colW - 12;

  // Pedigree positions: gen g has 2^g slots
  function ancestor(pid: string, g: number, idx: number): any | null {
    if (g === 0) return byId.get(pid);
    const ppObj = padresDe(pid, rels as any, byId); const pp = ppObj.all;
    if (!pp.length) return null;
    const padre = pp.find((x: any) => x.sexo === "masculino") ?? pp[0];
    const madre = pp.find((x: any) => x.sexo === "femenino") ?? pp[1];
    const targetSlot = idx >> (g - 1);
    const next = targetSlot % 2 === 0 ? padre : madre;
    if (!next) return null;
    return ancestor(next.id, g - 1, idx & ((1 << (g - 1)) - 1));
  }

  const totalH = doc.internal.pageSize.getHeight() - startY - 40;
  for (let g = 0; g < generations; g++) {
    const slots = 1 << g;
    const slotH = totalH / slots;
    for (let i = 0; i < slots; i++) {
      const y = startY + i * slotH + slotH / 2 - boxH / 2;
      const x = startX + g * colW;
      const p = ancestor(personaId, g, i);
      drawAncestorBox(doc, x, y, boxW, boxH, p);
      if (g > 0) {
        const parentSlotH = totalH / (1 << (g - 1));
        const parentY = startY + Math.floor(i / 2) * parentSlotH + parentSlotH / 2;
        doc.setDrawColor(180);
        doc.line(x, y + boxH / 2, x - 6, y + boxH / 2);
        doc.line(x - 6, y + boxH / 2, x - 6, parentY);
        doc.line(x - 6, parentY, x - colW + boxW, parentY);
      }
    }
  }

  footer(doc);
  doc.save(`cuadro-${personaCode(persona.id)}.pdf`);
}

// === 2. Familia en PDF (informe) ===
export async function exportFamiliaPDF(personaId: string, conFuentes = false) {
  const { rels, byId, eventos, docs, persona } = await loadContext(personaId);
  if (!persona) throw new Error("Persona no encontrada");
  const padres = padresDe(personaId, rels as any, byId).all;
  const conyuges = conyugesDe(personaId, rels as any, byId);
  const hijos = hijosDe(personaId, rels as any, byId);
  const hermanos = hermanosDe(personaId, rels as any, byId);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  header(doc, conFuentes ? "Familia con fuentes" : "Informe familiar", persona);

  let y = 100;
  const pageW = doc.internal.pageSize.getWidth();
  const writeLine = (label: string, value: string) => {
    if (y > 780) { doc.addPage(); y = 60; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(label, 40, y);
    doc.setFont("helvetica", "normal"); doc.text(value, 140, y, { maxWidth: pageW - 180 });
    y += 16;
  };
  const section = (title: string) => {
    if (y > 760) { doc.addPage(); y = 60; }
    y += 8;
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.setTextColor(40); doc.text(title, 40, y);
    doc.setDrawColor(230); doc.line(40, y + 4, pageW - 40, y + 4);
    y += 18; doc.setTextColor(20);
  };
  const listPersonas = (arr: any[]) => arr.length ? arr.map((p) => `${fullName(p)}${lifespan(p)} [${personaCode(p.id)}]`).join("\n") : "—";

  section("Datos personales");
  writeLine("Nombre", fullName(persona));
  writeLine("Sexo", persona.sexo ?? "—");
  writeLine("Nacimiento", `${persona.nac_fecha ?? persona.nac_fecha_aprox ?? "?"}`);
  writeLine("Defunción", `${persona.defuncion_fecha ?? "—"}`);
  writeLine("Ocupación", persona.ocupacion ?? "—");
  writeLine("Nacionalidad", persona.nacionalidad ?? "—");

  section("Familia directa");
  const block = (label: string, arr: any[]) => {
    if (y > 760) { doc.addPage(); y = 60; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(label, 40, y); y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const txt = listPersonas(arr);
    const lines = doc.splitTextToSize(txt, pageW - 80);
    doc.text(lines, 56, y); y += lines.length * 13 + 6;
  };
  block("Padres", padres);
  block("Cónyuges", conyuges);
  block("Hijos/as", hijos);
  block("Hermanos/as", hermanos);

  section("Eventos");
  if (!eventos.length) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(10); doc.setTextColor(120);
    doc.text("Sin eventos registrados.", 40, y); y += 14; doc.setTextColor(20);
  } else {
    for (const e of eventos) {
      if (y > 780) { doc.addPage(); y = 60; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(`${e.tipo} · ${e.fecha ?? e.fecha_aprox ?? "s/f"}`, 40, y); y += 13;
      doc.setFont("helvetica", "normal");
      if (e.descripcion) {
        const lines = doc.splitTextToSize(e.descripcion, pageW - 80);
        doc.text(lines, 56, y); y += lines.length * 12;
      }
      if (conFuentes && e.fuente_id) {
        const d = docs.find((x: any) => x.id === e.fuente_id);
        if (d) {
          doc.setTextColor(90); doc.setFontSize(9);
          const cite = `Fuente: ${d.titulo}${d.cita ? " · " + d.cita : ""}${d.repositorio ? " · " + d.repositorio : ""}`;
          const lines = doc.splitTextToSize(cite, pageW - 80);
          doc.text(lines, 56, y); y += lines.length * 11; doc.setTextColor(20);
        }
      }
      y += 4;
    }
  }

  if (conFuentes && docs.length) {
    section("Fuentes consultadas");
    for (const d of docs.slice(0, 50)) {
      if (y > 780) { doc.addPage(); y = 60; }
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text(`• ${d.titulo}`, 40, y); y += 13;
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(100);
      const meta = [d.tipo, d.fecha, d.repositorio, d.cita].filter(Boolean).join(" · ");
      if (meta) { doc.text(meta, 56, y); y += 12; }
      doc.setTextColor(20); y += 4;
    }
  }

  footer(doc);
  doc.save(`familia-${conFuentes ? "fuentes-" : ""}${personaCode(persona.id)}.pdf`);
}

// === 3. Abanico ===
export async function exportAbanicoPDF(personaId: string) {
  const { rels, byId, persona } = await loadContext(personaId);
  if (!persona) throw new Error("Persona no encontrada");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  header(doc, "Cuadro estilo abanico", persona);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const cx = pageW / 2, cy = pageH - 60;
  const generations = 5;
  const maxR = Math.min(pageW / 2 - 40, pageH - 140);
  const rPerGen = maxR / generations;

  function ancestor(pid: string, g: number, idx: number): any | null {
    if (g === 0) return byId.get(pid);
    const ppObj = padresDe(pid, rels as any, byId); const pp = ppObj.all;
    if (!pp.length) return null;
    const padre = pp.find((x: any) => x.sexo === "masculino") ?? pp[0];
    const madre = pp.find((x: any) => x.sexo === "femenino") ?? pp[1];
    const targetSlot = idx >> (g - 1);
    const next = targetSlot % 2 === 0 ? padre : madre;
    if (!next) return null;
    return ancestor(next.id, g - 1, idx & ((1 << (g - 1)) - 1));
  }

  // Center person
  doc.setFillColor(241, 245, 249);
  doc.circle(cx, cy, rPerGen, "F");
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  const lines = doc.splitTextToSize(fullName(persona), rPerGen * 2 - 6);
  doc.text(lines.slice(0, 2), cx, cy - 2, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(110);
  doc.text(lifespan(persona).trim(), cx, cy + 8, { align: "center" });
  doc.setTextColor(20);

  for (let g = 1; g < generations; g++) {
    const slots = 1 << g;
    const arcAngle = Math.PI / slots;
    for (let i = 0; i < slots; i++) {
      const aStart = -Math.PI + i * arcAngle;
      const aEnd = aStart + arcAngle;
      const aMid = (aStart + aEnd) / 2;
      const rIn = g * rPerGen;
      const rOut = (g + 1) * rPerGen;
      const p = ancestor(personaId, g, i);
      // Determine line side (paternal/maternal) — top half of slots paternal
      const paternal = i < slots / 2;
      const fill = paternal ? [224, 242, 254] : [252, 231, 243];
      doc.setFillColor(fill[0], fill[1], fill[2]);
      // Draw filled annular sector via polygon approximation
      const steps = 12;
      const pts: [number, number][] = [];
      for (let s = 0; s <= steps; s++) {
        const a = aStart + (aEnd - aStart) * (s / steps);
        pts.push([cx + Math.cos(a) * rIn, cy + Math.sin(a) * rIn]);
      }
      for (let s = steps; s >= 0; s--) {
        const a = aStart + (aEnd - aStart) * (s / steps);
        pts.push([cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut]);
      }
      (doc as any).lines(
        pts.slice(1).map((pt, idx2) => [pt[0] - pts[idx2][0], pt[1] - pts[idx2][1]]),
        pts[0][0], pts[0][1], [1, 1], "F", true
      );
      doc.setDrawColor(200);
      doc.setLineWidth(0.3);
      (doc as any).lines(
        pts.slice(1).map((pt, idx2) => [pt[0] - pts[idx2][0], pt[1] - pts[idx2][1]]),
        pts[0][0], pts[0][1], [1, 1], "S", true
      );

      if (p) {
        const rText = (rIn + rOut) / 2;
        const tx = cx + Math.cos(aMid) * rText;
        const ty = cy + Math.sin(aMid) * rText;
        doc.setFontSize(g >= 4 ? 5 : g >= 3 ? 6 : 7);
        doc.setFont("helvetica", "bold");
        const name = fullName(p);
        const short = name.length > 18 ? name.slice(0, 17) + "…" : name;
        const angleDeg = (aMid * 180 / Math.PI) + 90;
        doc.text(short, tx, ty, { align: "center", angle: -angleDeg });
      }
    }
  }

  footer(doc);
  doc.save(`abanico-${personaCode(persona.id)}.pdf`);
}

// === 4. Cuadro estilo retrato (vertical, formal) ===
export async function exportRetratoPDF(personaId: string) {
  const { rels, byId, persona } = await loadContext(personaId);
  if (!persona) throw new Error("Persona no encontrada");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Title block
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 110, "F");
  doc.setTextColor(255);
  doc.setFont("times", "bold"); doc.setFontSize(22);
  doc.text("Cuadro Genealógico", pageW / 2, 50, { align: "center" });
  doc.setFont("times", "italic"); doc.setFontSize(13);
  doc.text(fullName(persona), pageW / 2, 75, { align: "center" });
  doc.setFontSize(10);
  doc.text(`${lifespan(persona).trim()} · ${personaCode(persona.id)}`, pageW / 2, 95, { align: "center" });
  doc.setTextColor(20);

  // Recursive vertical tree
  let y = 140;
  function render(pid: string | null, depth: number) {
    if (!pid || depth > 4) return;
    const p = byId.get(pid);
    if (!p) return;
    if (y > 780) { doc.addPage(); y = 60; }
    const indent = 40 + depth * 24;
    const isF = p.sexo === "femenino";
    const bar = isF ? [244, 114, 182] : p.sexo === "masculino" ? [56, 189, 248] : [148, 163, 184];
    doc.setFillColor(bar[0], bar[1], bar[2]);
    doc.rect(indent - 6, y - 9, 3, 14, "F");
    doc.setFont("times", "bold"); doc.setFontSize(11);
    doc.text(fullName(p), indent, y);
    doc.setFont("times", "italic"); doc.setFontSize(9); doc.setTextColor(110);
    doc.text(`${lifespan(p).trim()}${p.ocupacion ? " · " + p.ocupacion : ""}`, indent, y + 12);
    doc.setTextColor(20);
    y += 28;
    for (const par of padresDe(pid, rels as any, byId).all) render(par.id, depth + 1);
  }
  render(personaId, 0);

  footer(doc);
  doc.save(`retrato-${personaCode(persona.id)}.pdf`);
}

export type ExportKind = "cuadro" | "familia" | "familia-fuentes" | "abanico" | "retrato";

export async function runExport(kind: ExportKind, personaId: string) {
  switch (kind) {
    case "cuadro": return exportCuadroGenealogico(personaId);
    case "familia": return exportFamiliaPDF(personaId, false);
    case "familia-fuentes": return exportFamiliaPDF(personaId, true);
    case "abanico": return exportAbanicoPDF(personaId);
    case "retrato": return exportRetratoPDF(personaId);
  }
}
