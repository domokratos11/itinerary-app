import { defineConfig } from "vitest/config";

// The security rules, tested on the local Firestore emulator. Run with
// `npm run test:rules`; it never touches the real database.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
  },
});
