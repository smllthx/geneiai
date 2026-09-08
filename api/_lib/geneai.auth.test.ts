import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { getActiveTreeId, getBearer, getUserOrThrow } from "./geneai";

function fakeAuth(result: unknown) {
  const getUser = vi.fn().mockResolvedValue(result);
  const from = vi.fn();
  return { getUser, from, client: { auth: { getUser }, from } as unknown as SupabaseClient };
}

describe("server-side identity and account failures", () => {
  it("uses only the user returned by Auth even if token claims name another account", async () => {
    const forgedClaims = Buffer.from(JSON.stringify({ sub: "different-user", role: "authenticated" })).toString("base64url");
    const token = `header.${forgedClaims}.invalid_signature`;
    const auth = fakeAuth({ data: { user: { id: "verified-user" } }, error: null });
    const user = await getUserOrThrow(auth.client, token);
    expect(auth.getUser).toHaveBeenCalledWith(token);
    expect(user.id).toBe("verified-user");
  });

  it("does not allow forged or expired token claims when Auth rejects the token", async () => {
    const auth = fakeAuth({ data: { user: null }, error: { status: 401, message: "JWT rejected" } });
    await expect(getUserOrThrow(auth.client, "header.payload.signature")).rejects.toMatchObject({ status: 401, code: "AUTH_INVALID" });
    expect(auth.from).not.toHaveBeenCalled();
  });

  it("treats a missing session and an unavailable Auth server differently", async () => {
    const auth = fakeAuth({ data: { user: null }, error: { status: 503, message: "unavailable" } });
    await expect(getUserOrThrow(auth.client, "")).rejects.toMatchObject({ status: 401, code: "AUTH_REQUIRED" });
    expect(auth.getUser).not.toHaveBeenCalled();
    await expect(getUserOrThrow(auth.client, "token")).rejects.toMatchObject({ status: 503, code: "AUTH_UNAVAILABLE" });
    auth.getUser.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(getUserOrThrow(auth.client, "token")).rejects.toMatchObject({ status: 503, code: "AUTH_UNAVAILABLE" });
  });

  it("does not blame the user's password when a project API key is rejected", async () => {
    const auth = fakeAuth({ data: { user: null }, error: { status: 401, message: "Invalid API key" } });
    await expect(getUserOrThrow(auth.client, "token")).rejects.toMatchObject({ status: 503, code: "BACKEND_PUBLIC_KEY_REJECTED" });
  });

  it("rejects ambiguous authorization headers rather than accepting the first account", () => {
    for (const authorization of [["Bearer first", "Bearer second"], "Bearer first, Bearer second", "Bearer ", "Bearer first\r\nOther: second"]) {
      expect(getBearer({ headers: { authorization } })).toBe("");
    }
    expect(getBearer({ headers: { authorization: "bearer valid-token" } })).toBe("Bearer valid-token");
  });

  it("does not turn a profile lookup failure into an unscoped tree request", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "connection refused" } });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const client = { from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) }) } as unknown as SupabaseClient;
    await expect(getActiveTreeId(client, "verified-user")).rejects.toMatchObject({ status: 503, code: "PROFILE_UNAVAILABLE" });
    expect(eq).toHaveBeenCalledWith("id", "verified-user");
    maybeSingle.mockResolvedValueOnce({ data: { active_arbol_id: null }, error: null });
    await expect(getActiveTreeId(client, "verified-user")).resolves.toBeNull();
  });
});
