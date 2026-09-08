import { createClient } from '@supabase/supabase-js';
import { resolvePublicBackendConfig } from '../../../shared/backendIdentity';
import type { Database } from './types';
import { recordAiUsage } from '../../lib/aiUsage';
import { friendlyAiErrorMessage } from '../../lib/aiErrors';

let configurationError: Error | null = null;
export const backendConfig = (() => {
  try {
    return resolvePublicBackendConfig(import.meta.env);
  } catch (error) {
    configurationError = error instanceof Error ? error : new Error('Configuración de GENEAI inválida');
    // Keep the client inert so AuthProvider can render a connection error.
    return resolvePublicBackendConfig({});
  }
})();
export const backendConfigurationError = configurationError;
export const SUPABASE_URL = backendConfig.supabaseUrl;
const SUPABASE_PUBLISHABLE_KEY = backendConfig.publishableKey;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: !backendConfigurationError,
    autoRefreshToken: !backendConfigurationError,
    detectSessionInUrl: !backendConfigurationError,
  }
});

const originalInvoke = supabase.functions.invoke.bind(supabase.functions);
const inFlightInvokes = new Map<string, Promise<any>>();
let sessionGeneration = 0;
let invokingUser: string | null | undefined;
supabase.auth.onAuthStateChange((_event, session) => {
  const nextUser = session?.user.id ?? null;
  if (invokingUser === nextUser) return;
  invokingUser = nextUser;
  sessionGeneration += 1;
  inFlightInvokes.clear();
});

const invokeKey = (functionName: string, options?: any) => {
  try {
    return `${sessionGeneration}:${functionName}:${JSON.stringify(options ?? {})}`;
  } catch {
    return `${functionName}:uncached`;
  }
};

supabase.functions.invoke = (async (functionName: string, options?: any) => {
  if (backendConfigurationError) return { data: null, error: backendConfigurationError };
  const generation = sessionGeneration;
  const key = invokeKey(functionName, options);
  if (key !== `${functionName}:uncached` && inFlightInvokes.has(key)) {
    const result = await inFlightInvokes.get(key);
    return generation === sessionGeneration ? result : {
      data: null, error: new Error('La sesión cambió durante la consulta. Vuelve a intentarlo.'),
    };
  }

  const pending = originalInvoke(functionName as any, options);
  if (key !== `${functionName}:uncached`) {
    inFlightInvokes.set(key, pending);
    const forget = () => window.setTimeout(() => {
      if (inFlightInvokes.get(key) === pending) inFlightInvokes.delete(key);
    }, 2500);
    void pending.then(forget, forget);
  }

  const result = await pending;
  if (generation !== sessionGeneration) {
    return { data: null, error: new Error('La sesión cambió durante la consulta. Vuelve a intentarlo.') };
  }
  try {
    recordAiUsage(functionName, options?.body, !result.error);
  } catch {}

  if (!result.error) {
    const dataError = (result.data as any)?.error;
    if (dataError) {
      (result.data as any).details = (result.data as any).details ?? dataError;
      (result.data as any).error = friendlyAiErrorMessage(dataError, functionName);
    }
    return result;
  }

  let detail = "";
  const context = (result.error as any).context;
  try {
    if (context?.clone) {
      const raw = await context.clone().text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          detail = parsed.error || parsed.message || raw;
        } catch {
          detail = raw;
        }
      }
    }
  } catch {
    detail = "";
  }

  if (generation !== sessionGeneration) {
    return { data: null, error: new Error('La sesión cambió durante la consulta. Vuelve a intentarlo.') };
  }

  const rawMessage = detail || result.error.message || "Error de IA";
  const friendly = friendlyAiErrorMessage(rawMessage, functionName);

  (result.error as any).message = friendly;
  (result.error as any).details = rawMessage;

  try {
    window.dispatchEvent(new CustomEvent("genaia:ia-error", {
      detail: { functionName, message: friendly, raw: rawMessage },
    }));
  } catch {}

  return result;
}) as typeof supabase.functions.invoke;
