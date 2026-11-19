// Share the backend's supported ESLint/TypeScript parser instead of installing incompatible duplicates.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const requireBackend = createRequire(
  new URL('../backend/package.json', import.meta.url),
);
const { ESLint } = requireBackend('eslint');
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: fileURLToPath(
    new URL('../backend/eslint.config.js', import.meta.url),
  ),
});
const results = await eslint.lintFiles([
  'frontend/src/**/*.{ts,tsx}',
  'frontend/tests/**/*.ts',
  'frontend/vite.config.ts',
  'frontend/playwright.config.ts',
]);
const formatter = await eslint.loadFormatter('stylish');
const output = formatter.format(results);
if (output) console.log(output);
if (results.some((result) => result.errorCount || result.warningCount))
  process.exitCode = 1;
