import { expect, it, vi } from "vitest";
import { getInstallationSnapshot, getInstallationPlatform, promptAppInstallation, startAppInstallation } from "./appInstallation";

it("retains an early install prompt, consumes it once, and waits for actual installation", async () => {
  startAppInstallation();
  const first = new Event("beforeinstallprompt", { cancelable: true });
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(first, { prompt, userChoice: Promise.resolve({ outcome: "dismissed" }) });
  window.dispatchEvent(first);
  expect(first.defaultPrevented).toBe(true);
  expect(getInstallationSnapshot().canPrompt).toBe(true);
  expect(await promptAppInstallation()).toBe("dismissed");
  expect(await promptAppInstallation()).toBe("unavailable");
  expect(prompt).toHaveBeenCalledTimes(1);
  const second = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(second, { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) });
  window.dispatchEvent(second);
  expect(await promptAppInstallation()).toBe("accepted");
  expect(getInstallationSnapshot().installed).toBe(false);
  window.dispatchEvent(new Event("appinstalled"));
  expect(getInstallationSnapshot()).toEqual({ installed: true, canPrompt: false });
});

it("recognizes iPad desktop mode separately from a Mac for installation guidance", () => {
  const ua = vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15");
  const original = Object.getOwnPropertyDescriptor(navigator, "maxTouchPoints");
  Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 5 });
  expect(getInstallationPlatform()).toBe("ios");
  Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: 0 });
  expect(getInstallationPlatform()).toBe("macos");
  ua.mockRestore();
  if (original) Object.defineProperty(navigator, "maxTouchPoints", original);
  else Reflect.deleteProperty(navigator, "maxTouchPoints");
});
