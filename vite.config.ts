import fs from "node:fs";
import { resolve } from "node:path";
import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";

const manifest = JSON.parse(fs.readFileSync("./manifest.json", "utf-8"));

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: resolve(__dirname, "index.html"),
    },
    sourcemap: true,
  },
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
