import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), {
    name: "geneai-worker-revision",
    apply: "build",
    async writeBundle(options, bundle) {
      const hash = createHash("sha256").update(Object.keys(bundle).sort().join("\n"));
      for (const asset of ["sw.js", "release.json", "geneai-runtime.json", "offline.html", "manifest.webmanifest", "favicon.png", "logo-sidebar.png", "apple-touch-icon.png", "app-icon-192.png", "app-icon-512.png"]) {
        hash.update(await readFile(path.resolve("public", asset)));
      }
      const revision = hash.digest("hex").slice(0, 12);
      const workerPath = path.resolve(options.dir ?? "dist", "sw.js");
      const worker = await readFile(workerPath, "utf8");
      const host = process.env.VERCEL_URL ?? "";
      const assetOrigin = process.env.VERCEL_ENV === "production" && /^geneiai-[a-z0-9]+-geneaia\.vercel\.app$/.test(host)
        ? `https://${host}` : "";
      await writeFile(workerPath, worker.replaceAll("__GENEAI_BUILD_ID__", revision)
        .replace('"__GENEAI_DEPLOYMENT_ORIGIN__"', JSON.stringify(assetOrigin)));
    },
  }],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
