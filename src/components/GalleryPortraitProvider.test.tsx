import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import GalleryPortraitProvider from "./GalleryPortraitProvider";
import PersonPortrait from "./PersonPortrait";

const calls = vi.hoisted(() => ({ account: vi.fn(), queries: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "/stored/alba.jpg" } }) }) },
  from: (table: string) => {
    calls.queries(table);
    const query = {
      select: () => query, eq: (...args: unknown[]) => { calls.account(...args); return query; },
      not: () => query, order: () => query, range: () => query, abortSignal: async () => ({
        data: [
          { personas_ids: ["alba", "juan"], url: "/group.jpg" },
          { personas_ids: ["alba"], url: "/album/alba.jpg", storage_path: "alba.jpg" },
        ],
      }),
    };
    return query;
  },
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("consults the account gallery once across surfaces, skips group pictures and recovers from broken URLs", async () => {
  render(<GalleryPortraitProvider userId="account">
    <PersonPortrait personId="alba" src="/primary.jpg" name="Alba Rojas" />
    <PersonPortrait personId="alba" name="Alba" />
    <PersonPortrait personId="juan" name="Juan Vidal" />
  </GalleryPortraitProvider>);
  expect(screen.getByRole("img", { name: "Retrato de Alba Rojas" })).toHaveAttribute("src", "/primary.jpg");
  await waitFor(() => expect(screen.getByRole("img", { name: "Retrato de Alba" })).toHaveAttribute("src", "/stored/alba.jpg"));
  expect(calls.account).toHaveBeenCalledWith("user_id", "account");
  expect(calls.queries).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("img", { name: "Retrato de Juan Vidal" })).toHaveTextContent("JV");
  fireEvent.error(screen.getByRole("img", { name: "Retrato de Alba Rojas" }));
  expect(screen.getByRole("img", { name: "Retrato de Alba Rojas" })).toHaveAttribute("src", "/stored/alba.jpg");
  fireEvent.error(screen.getByRole("img", { name: "Retrato de Alba Rojas" }));
  expect(screen.getByRole("img", { name: "Retrato de Alba Rojas" })).toHaveAttribute("src", "/album/alba.jpg");
});

it("renders saved portraits without a gallery request", () => {
  render(<GalleryPortraitProvider userId="account"><PersonPortrait personId="alba" src="/primary.jpg" name="Alba" /></GalleryPortraitProvider>);
  expect(calls.queries).not.toHaveBeenCalled();
});
