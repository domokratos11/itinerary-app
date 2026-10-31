import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // All text comes from src/messages, so no words typed into the markup.
  {
    files: ["src/components/**/*.tsx", "src/app/**/*.tsx"],
    ignores: ["src/components/ui/**", "**/*.test.tsx"],
    rules: {
      "react/jsx-no-literals": [
        "error",
        {
          allowedStrings: [
            "→",
            "·",
            "—",
            "…",
            "–",
            "¥",
            "/",
            ".",
            ",",
            ":",
            "Google Maps",
            "Ctrl K",
            "(",
            ")",
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
