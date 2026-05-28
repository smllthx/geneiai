export type AiUsageEvent = {
  ts: number;
  functionName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  credits: number;
  ok: boolean;
};

export type AiUsagePeriod = {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  credits: number;
  failed: number;
};

const STORAGE_KEY = "genaia:ai-usage-events";
const THIRTY_ONE_DAYS = 31 * 24 * 60 * 60 * 1000;

const AI_FUNCTIONS = new Set([
  "ai-genealogy",
  "ai-router",
  "analizar-foto",
  "analyze-photo",
  "busqueda-ia",
  "document-insights",
  "familysearch-context",
  "historical-context",
  "investigar-auto",
  "leer-documento-ia",
  "pdf-insights",
  "research-agent",
  "run-agent",
  "smart-insights",
  "web-search",
]);

const OUTPUT_ESTIMATE: Record<string, number> = {
  "ai-genealogy": 700,
  "ai-router": 500,
  "analizar-foto": 900,
  "analyze-photo": 900,
  "busqueda-ia": 900,
  "document-insights": 1100,
  "historical-context": 900,
  "investigar-auto": 900,
  "leer-documento-ia": 1400,
  "pdf-insights": 1200,
  "research-agent": 900,
  "run-agent": 800,
  "smart-insights": 700,
  "web-search": 700,
};

const emptyPeriod = (): AiUsagePeriod => ({
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  credits: 0,
  failed: 0,
});

export const estimateAiTokens = (value: unknown) => {
  try {
    return Math.max(1, Math.ceil(JSON.stringify(value ?? {}).length / 4));
  } catch {
    return 1;
  }
};

export const isAiFunction = (functionName: string) => AI_FUNCTIONS.has(functionName);

export const readAiUsageEvents = (): AiUsageEvent[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const recordAiUsage = (functionName: string, body: unknown, ok: boolean) => {
  if (typeof window === "undefined" || !isAiFunction(functionName)) return;
  const now = Date.now();
  const inputTokens = estimateAiTokens(body);
  const outputTokens = OUTPUT_ESTIMATE[functionName] ?? 800;
  const totalTokens = inputTokens + outputTokens;
  const credits = Math.max(1, Math.ceil(totalTokens / 1000));
  const event: AiUsageEvent = { ts: now, functionName, inputTokens, outputTokens, totalTokens, credits, ok };
  const events = readAiUsageEvents()
    .filter((item) => now - item.ts <= THIRTY_ONE_DAYS)
    .concat(event)
    .slice(-800);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  window.dispatchEvent(new CustomEvent("genaia:ai-usage-updated"));
};

const addEvent = (period: AiUsagePeriod, event: AiUsageEvent) => {
  period.calls += 1;
  period.inputTokens += event.inputTokens;
  period.outputTokens += event.outputTokens;
  period.totalTokens += event.totalTokens;
  period.credits += event.credits;
  if (!event.ok) period.failed += 1;
};

export const summarizeAiUsage = (now = Date.now()) => {
  const day = emptyPeriod();
  const week = emptyPeriod();
  const month = emptyPeriod();
  for (const event of readAiUsageEvents()) {
    const age = now - event.ts;
    if (age <= 24 * 60 * 60 * 1000) addEvent(day, event);
    if (age <= 7 * 24 * 60 * 60 * 1000) addEvent(week, event);
    if (age <= 30 * 24 * 60 * 60 * 1000) addEvent(month, event);
  }
  return { day, week, month };
};

