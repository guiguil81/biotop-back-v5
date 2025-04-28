import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginPrettier from "eslint-plugin-prettier";
import configPrettier from "eslint-config-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    plugins: {
      js,
      prettier: pluginPrettier,
    },
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...js.configs.recommended.rules,
      "prettier/prettier": "error",
      semi: ["error", "always"],
      "no-multi-spaces": "error",
    },
  },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  configPrettier, // désactive les règles ESLint qui entrent en conflit avec Prettier
]);
