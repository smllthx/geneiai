export function toDisplayText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(toDisplayText).filter(Boolean).join(" · ");
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred =
      record.motivo ??
      record.razon ??
      record.reason ??
      record.descripcion ??
      record.description ??
      record.texto ??
      record.title ??
      record.titulo ??
      record.label ??
      record.via ??
      record.tipo;
    const text = preferred !== undefined ? toDisplayText(preferred) : "";
    if (text && record.ia === true) return `IA: ${text}`;
    if (text) return text;
    try {
      return JSON.stringify(record);
    } catch {
      return String(record);
    }
  }
  return String(value);
}

export function toDisplayTextList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const text = toDisplayText(value);
    return text ? [text] : [];
  }
  return value.map(toDisplayText).filter(Boolean);
}
