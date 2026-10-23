import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "contracts/**"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      // money and security boundaries must be typed explicitly
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
);
