// @ts-check
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import angular from "angular-eslint";

export default [
  ...defineConfig([
    {
      files: ["**/*.ts"],
      extends: [
        eslint.configs.recommended,
        tseslint.configs.recommended,
        tseslint.configs.stylistic,
        angular.configs.tsRecommended,
      ],
      processor: angular.processInlineTemplates,
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
        "@typescript-eslint/no-empty-object-type": "off",
        "@typescript-eslint/no-non-null-asserted-optional-chain": "off",
        "@angular-eslint/no-output-native": "off",
        "@angular-eslint/template/click-events-have-key-events": [
          "off"
        ],
        "@angular-eslint/prefer-inject": "off",
        "@angular-eslint/directive-selector": [
          "error",
          {
            type: "attribute",
            prefix: "app",
            style: "camelCase",
          },
        ],
        "@angular-eslint/component-selector": [
          "error",
          {
            type: "element",
            prefix: "app",
            style: "kebab-case",
          },
        ],
      },
    },
    {
      files: ["**/*.html"],
      extends: [
        angular.configs.templateRecommended,
        angular.configs.templateAccessibility,
      ],
      rules: {},
    },
  ]),
];
