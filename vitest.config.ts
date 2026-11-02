import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.ts"],
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: { junit: "junit.xml" },
    coverage: { provider: "v8", include: ["src/**/*.ts"] },
  },
});
