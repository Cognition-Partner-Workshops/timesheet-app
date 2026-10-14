import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/", "coverage/"],
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
  {
    files: ["src/__tests__/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];
