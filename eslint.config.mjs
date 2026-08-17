import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // 🔴 FIX: skrip dev/utility di root (bukan sumber aplikasi) memakai API
    // Node (`require`, `process`, `__dirname`). Pada fase `next build`, lint
    // mensyokurkan melint semua *.js/*.mjs termasuk skrip ini → aturan
    // `@typescript-eslint/no-require-imports` & `no-undef` jadi ERROR
    // (3 error di Vercel). Di-ignore agar build lint phase & `next lint`
    // CLI konsisten dan bebas error.
    ignores: [
      "checkstatus.js",
      "create_write_script.js",
      "write_tampilanpc.js",
      "verify_vault_live.mjs",
      "scripts/**",
      "_*.*",
      // Output & generated: bukan source aplikasi, tak perlu dilint.
      ".next/**",
      "next-env.d.ts",
      "node_modules/**",
      // Test & skrip smoke di repo (Playwright, smoke_tests): dev-only.
      "tests/**",
      "smoke_tests.js",
      "coverage/**",
      "playwright-report/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
