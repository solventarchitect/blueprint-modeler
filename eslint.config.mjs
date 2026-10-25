import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // eslint-plugin-react-hooks 7 (with Next 16) flags every setState inside an effect. The seven
      // found at the Next.js 16 move were refactored (M62, 2026-10-25): browser-only state is read
      // with useSyncExternalStore, a field following its prop is adjusted while rendering, and the
      // guide's counts are worked out from its markup. New ones fail the build.
      "react-hooks/set-state-in-effect": "error",
    },
  },
  globalIgnores(["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
