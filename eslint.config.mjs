// @ts-check
import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import angular from "angular-eslint";
import storybook from "eslint-plugin-storybook";

export default [
  {
    // Vendored / generated data files — not source code. The location*.ts
    // bundles are ~1.4M lines of country/state JSON-as-TS literals; linting
    // them produces hundreds of `no-useless-escape` errors on regex-shaped
    // value strings and offers no review value.
    ignores: [
      "src/app/shared/core/constant/location.ts",
      "src/app/shared/core/constant/location-min.ts",
    ],
  },
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
  ...storybook.configs["flat/recommended"],
];
