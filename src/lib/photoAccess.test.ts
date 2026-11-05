import { afterEach, expect, it, vi } from "vitest";
import config from "../../config/geneai-backend.json";
import { createPhotoAccess, photoStoragePath } from "./photoAccess";

afterEach(() => vi.useRealTimers());
it("recognizes canonical private, signed and old public references, preserves external photos", () => {
  for (const mode of ["public", "authenticated", "sign"]) {
    expect(photoStoragePath(`${config.supabaseUrl}/storage/v1/object/${mode}/fotos/u/arch%20ivo.jpg?token=old`)).toBe("u/arch ivo.jpg");
  }
  expect(photoStoragePath("storage://fotos/u/tree/image.jpg")).toBe("u/tree/image.jpg");
  expect(photoStoragePath("https://another.example/storage/v1/object/public/fotos/u/arch.jpg")).toBeNull();
});
it("batches paths, reuses signatures until expiry, and refuses other owners or traversals", async () => {
  vi.useFakeTimers();
  const sign = vi.fn(async (paths: string[]) => ({ data: paths.map(path => ({ path, error: null, signedUrl: `/signed/${path}` })), error: null }));
  const access = createPhotoAccess("u", sign);
  const one = access("u/one.jpg");
  const duplicate = access("u/one.jpg");
  const two = access("u/two.jpg");
  await vi.advanceTimersByTimeAsync(1);
  expect(await one).toEqual(await duplicate);
  expect((await two)?.url).toBe("/signed/u/two.jpg");
  expect(sign).toHaveBeenCalledTimes(1);
  expect(sign).toHaveBeenCalledWith(["u/one.jpg", "u/two.jpg"], 3600);
  expect((await access("u/one.jpg"))?.url).toBe("/signed/u/one.jpg");
  expect(await access("v/one.jpg")).toBeNull();
  expect(await access("u/../v/one.jpg")).toBeNull();
  await vi.advanceTimersByTimeAsync(3600_000);
  const fresh = access("u/one.jpg");
  await vi.advanceTimersByTimeAsync(1);
  expect((await fresh)?.url).toBe("/signed/u/one.jpg");
  expect(sign).toHaveBeenCalledTimes(2);
});
