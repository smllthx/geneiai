import { createContext, Fragment, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import { backendConfigurationError, supabase } from '@/integrations/supabase/client';
import { clearDeviceUnlock } from '@/lib/devicePasskey';
import { verifyServerBackend } from '@/lib/backendConnection';

type Ctx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<Ctx>({ user: null, session: null, loading: true, signOut: async () => {} });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const previousUser = useRef<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    let revision = 0;
    let unsubscribe: (() => void) | undefined;
    setLoading(true);
    setConnectionError(null);

    const acceptSession = (next: Session | null) => {
      if (!active) return;
      const id = next?.user.id ?? null;
      if (previousUser.current !== id) {
        queryClient.clear();
        clearDeviceUnlock();
        previousUser.current = id;
      }
      setSession(next);
    };

    const initialize = async () => {
      try {
        if (backendConfigurationError) throw backendConfigurationError;
        // Vite development serves only the frontend; published builds verify the API.
        if (import.meta.env.PROD) await verifyServerBackend();
        if (!active) return;
        const { data } = supabase.auth.onAuthStateChange((_event, next) => {
          revision += 1;
          acceptSession(next);
        });
        unsubscribe = () => data.subscription.unsubscribe();
        const startedAt = revision;
        const result = await supabase.auth.getSession();
        if (!active) return;
        if (result.error) throw result.error;
        if (revision === startedAt) acceptSession(result.data.session);
      } catch (error) {
        if (active) setConnectionError(error instanceof Error ? error.message : 'No se pudo abrir la sesión de GENEAI.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void initialize();
    return () => { active = false; unsubscribe?.(); };
  }, [attempt, queryClient]);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    clearDeviceUnlock();
    queryClient.clear();
    previousUser.current = null;
    setSession(null);
  };

  if (connectionError) return (
    <main className="grid min-h-[100dvh] place-items-center p-6">
      <section role="alert" className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6">
        <h1 className="text-xl font-semibold">GENEAI necesita restablecer la conexión</h1>
        <p className="text-sm text-muted-foreground">{connectionError}</p>
        <button className="min-h-11 rounded-lg bg-primary px-5 text-primary-foreground" onClick={() => setAttempt(n => n + 1)}>Volver a intentar</button>
      </section>
    </main>
  );
  if (loading) return <div role="status" className="grid min-h-[100dvh] place-items-center text-muted-foreground">Conectando con GENEAI…</div>;

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>
      <Fragment key={session?.user.id ?? 'signed-out'}>{children}</Fragment>
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
