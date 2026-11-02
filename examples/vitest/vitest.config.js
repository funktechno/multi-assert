import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.spec.js"],
    reporters: ["default", "junit"],
    outputFile: { junit: "report/junit.xml" },
  },
});
