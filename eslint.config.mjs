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
            "$",
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
      // The same for text jsx-no-literals can't see. URLs and the Google Maps
      // name aren't translated.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name=/^(aria-label|placeholder|title|alt)$/] > Literal[value=/^(?!https?:|Google Maps$).*[A-Za-z]/]",
          message: 'Use t("key"): all text comes from src/messages.',
        },
        {
          selector:
            "CallExpression[callee.name='toast'] > :matches(Literal, TemplateLiteral)",
          message: 'Use t("key"): all text comes from src/messages.',
        },
        {
          selector:
            "CallExpression[callee.object.name='toast'] > :matches(Literal, TemplateLiteral)",
          message: 'Use t("key"): all text comes from src/messages.',
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
    // Claude Code worktrees: full copies of the repo with their own build
    // output, which made lint take many minutes.
    ".claude/**",
  ]),
]);

export default eslintConfig;
