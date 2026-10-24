import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // eslint-plugin-react-hooks 7 (with Next 16) flags every setState inside an effect. Ours are the
      // deliberate "read browser-only state after hydration" kind (theme, saved view options, the guide
      // filter's pre-hydration text, inspector fields following the selection), which must not run
      // during the static render. Kept visible as warnings; refactor one at a time, each with its own
      // test (Next.js 16 move, 2026-10-23).
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores(["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
