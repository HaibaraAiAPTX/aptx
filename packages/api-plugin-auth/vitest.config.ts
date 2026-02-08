import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@aptx/api-core": path.resolve(__dirname, "../api-core/src/index.ts"),
      "@aptx/token-store": path.resolve(__dirname, "../token-store/src/index.ts"),
    },
  },
});
