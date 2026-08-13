import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function appGardenStaticWorker() {
  return {
    name: "app-garden-static-worker",
    apply: "build",
    async closeBundle() {
      const outputDirectory = resolve(process.cwd(), "dist");
      const serverDirectory = resolve(outputDirectory, "server");
      const metadataDirectory = resolve(outputDirectory, ".openai");

      await mkdir(serverDirectory, { recursive: true });
      await mkdir(metadataDirectory, { recursive: true });
      await copyFile(resolve(process.cwd(), ".openai", "hosting.json"), resolve(metadataDirectory, "hosting.json"));
      await writeFile(resolve(serverDirectory, "index.js"), `
export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    const url = new URL(request.url);
    const looksLikeFile = /\\.[a-z0-9]+$/i.test(url.pathname);
    if (looksLikeFile || url.pathname.startsWith("/api/")) return response;

    return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
  },
};
`);
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), appGardenStaticWorker()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
