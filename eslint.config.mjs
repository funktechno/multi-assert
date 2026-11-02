import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "archive/**", "examples/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      semi: ["error", "always"],
      quotes: ["error", "double"],
      "no-multiple-empty-lines": "error",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
