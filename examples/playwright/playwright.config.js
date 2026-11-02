const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.js",
  reporter: [["list"], ["junit", { outputFile: "report/junit.xml" }]],
});
