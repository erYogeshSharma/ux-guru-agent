import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["iife"],
      name: "Tracker",
      fileName: () => "tracker.js",
    },
    outDir: "dist",
    emptyOutDir: true,
    watch: {},
  },
  server: {
    host: true, // important — allows external access
    port: 4500, // change port
    strictPort: true,
    cors: true,
  },
});
