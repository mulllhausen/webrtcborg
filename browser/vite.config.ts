import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "js",
    rollupOptions: {
      input: "src/main.ts",
    },
  },
});
