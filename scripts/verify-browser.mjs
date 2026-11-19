// Reproducible browser -> API -> dedicated test PostgreSQL verification.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('TEST_DATABASE_URL required');
const target = new URL(url);
if (
  !['127.0.0.1', 'localhost'].includes(target.hostname) ||
  !target.pathname.endsWith('_test')
)
  throw new Error(
    'Browser verification requires a dedicated local _test database',
  );
const frontend = join(root, 'frontend');
const requireFrontend = createRequire(join(frontend, 'package.json'));
const { createServer } = await import(
  pathToFileURL(requireFrontend.resolve('vite')).href
);
const { default: react } = await import(
  pathToFileURL(requireFrontend.resolve('@vitejs/plugin-react')).href
);
const config = join(tmpdir(), `arrowstack-tasks-browser-${process.pid}.mjs`);
const env = {
  ...process.env,
  DATABASE_URL: url,
  TEST_DATABASE_URL: url,
  MIGRATION_DATABASE_URL: url,
  NODE_ENV: 'test',
  PORT: '3003',
  HOST: '127.0.0.1',
  WEB_ORIGIN: 'http://127.0.0.1:5176',
  JWT_SECRET: randomBytes(64).toString('hex'),
};
const api = spawn(process.execPath, ['dist/server.js'], {
  cwd: join(root, 'backend'),
  env,
  stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  windowsHide: true,
});
let frontendServer;
try {
  // Only this child's IPC message proves that this run owns the API listener.
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => finish(new Error('Review API readiness timeout')),
      15000,
    );
    const message = (value) => {
      if (value?.type === 'ready' && value.port === 3003) finish();
    };
    const exited = () =>
      finish(
        new Error(
          'Review API failed to start; port 3003 may already be occupied',
        ),
      );
    const finish = (error) => {
      clearTimeout(timer);
      api.off('message', message);
      api.off('exit', exited);
      api.off('error', finish);
      if (error) reject(error);
      else resolve();
    };
    api.on('message', message);
    api.once('exit', exited);
    api.once('error', finish);
  });
  const readiness = await fetch('http://127.0.0.1:3003/api/v1/ready');
  if (!readiness.ok) throw new Error('Review database is not ready');
  frontendServer = await createServer({
    root: frontend,
    configFile: false,
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5176,
      strictPort: true,
      proxy: {
        '/api': { target: 'http://127.0.0.1:3003', changeOrigin: false },
      },
    },
  });
  await frontendServer.listen();
  await writeFile(
    config,
    'export default ' +
      JSON.stringify({
        testDir: join(frontend, 'tests'),
        outputDir: join(frontend, 'test-results'),
        workers: 1,
        timeout: 30000,
        use: {
          baseURL: 'http://127.0.0.1:5176',
          headless: true,
          channel: process.env.PLAYWRIGHT_CHANNEL,
          trace: 'retain-on-failure',
        },
      }),
  );
  const runner = spawn(
    process.execPath,
    [
      join(frontend, 'node_modules/@playwright/test/cli.js'),
      'test',
      '--config',
      config,
    ],
    { cwd: frontend, env, stdio: 'inherit', windowsHide: true },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    runner.on('error', reject);
    runner.on('exit', (code) => resolve(code ?? 1));
  });
} finally {
  await frontendServer?.close();
  api.kill();
  await rm(config, { force: true });
}
