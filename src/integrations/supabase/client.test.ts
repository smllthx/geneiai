import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Session = { user: { id: string } } | null;
const harness = vi.hoisted(() => ({
  invoke: vi.fn(),
  authListeners: new Set<(event: string, session: Session) => void>(),
  recordAiUsage: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (listener: (event: string, session: Session) => void) => {
        harness.authListeners.add(listener);
        return { data: { subscription: { unsubscribe: () => harness.authListeners.delete(listener) } } };
      },
    },
    functions: { invoke: harness.invoke },
  }),
}));
vi.mock("../../../shared/backendIdentity", () => ({
  resolvePublicBackendConfig: () => ({
    projectRef: "camdtylwddleifaegzaf",
    supabaseUrl: "https://camdtylwddleifaegzaf.supabase.co",
    authOrigin: "https://camdtylwddleifaegzaf.supabase.co/auth/v1",
    publishableKey: "sb_publishable_test_fixture_not_a_real_key",
  }),
}));
vi.mock("../../lib/aiUsage", () => ({ recordAiUsage: harness.recordAiUsage }));
vi.mock("../../lib/aiErrors", () => ({ friendlyAiErrorMessage: (message: string) => message }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function changeUser(id: string) {
  for (const listener of harness.authListeners) listener("SIGNED_IN", { user: { id } });
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  harness.authListeners.clear();
  harness.invoke.mockReset();
  harness.recordAiUsage.mockReset();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Edge Function responses stay with the account that requested them", () => {
  it("discards both deduplicated responses from A and starts a fresh identical request for B", async () => {
    const pendingA = deferred<{ data: { owner: string; detail: string }; error: null }>();
    const pendingB = deferred<{ data: { owner: string }; error: null }>();
    harness.invoke.mockReturnValueOnce(pendingA.promise).mockReturnValueOnce(pendingB.promise);
    const { supabase } = await import("./client");
    const options = { body: { personId: "shared-request-fixture" } };

    changeUser("account-A");
    const firstA = supabase.functions.invoke("ai-biography", options);
    const duplicateA = supabase.functions.invoke("ai-biography", options);
    expect(harness.invoke).toHaveBeenCalledTimes(1);

    changeUser("account-B");
    const requestB = supabase.functions.invoke("ai-biography", options);
    expect(harness.invoke).toHaveBeenCalledTimes(2);

    pendingA.resolve({ data: { owner: "account-A", detail: "private A fixture" }, error: null });
    for (const result of await Promise.all([firstA, duplicateA])) {
      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain("La sesión cambió");
    }
    expect(harness.recordAiUsage).not.toHaveBeenCalled();

    pendingB.resolve({ data: { owner: "account-B" }, error: null });
    await expect(requestB).resolves.toEqual({ data: { owner: "account-B" }, error: null });
    expect(harness.recordAiUsage).toHaveBeenCalledTimes(1);
  });

  it("does not publish A's delayed error details after the active account becomes B", async () => {
    const body = deferred<string>();
    const readingBody = deferred<void>();
    const error = Object.assign(new Error("request A failed"), {
      context: { clone: () => ({ text: () => { readingBody.resolve(); return body.promise; } }) },
    });
    harness.invoke.mockResolvedValue({ data: null, error });
    const dispatch = vi.spyOn(window, "dispatchEvent");
    const { supabase } = await import("./client");

    changeUser("account-A");
    const requestA = supabase.functions.invoke("ai-biography", { body: { personId: "person-A" } });
    await readingBody.promise;
    changeUser("account-B");
    body.resolve(JSON.stringify({ error: "private A error fixture" }));

    const result = await requestA;
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain("La sesión cambió");
    expect(dispatch.mock.calls.filter(([event]) => event.type === "genaia:ia-error")).toHaveLength(0);
  });
});
