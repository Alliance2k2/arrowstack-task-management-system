import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
test(
  'browser runner refuses an unrelated healthy API before issuing mutations',
  { timeout: 60000 },
  async () => {
    if (!process.env.TEST_DATABASE_URL)
      throw new Error('Dedicated TEST_DATABASE_URL required');
    let mutations = 0;
    const unrelated = createServer((request, response) => {
      if (request.method !== 'GET') mutations++;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ status: 'ready' }));
    });
    await new Promise((resolve, reject) => {
      unrelated.once('error', reject);
      unrelated.listen(3003, '127.0.0.1', resolve);
    });
    const child = spawn(process.execPath, ['scripts/verify-browser.mjs'], {
      cwd: root,
      env: process.env,
      windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk;
    });
    child.stderr.on('data', (chunk) => {
      output += chunk;
    });
    try {
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', resolve);
      });
      assert.notEqual(code, 0);
      assert.match(output, /failed to start|occupied/);
      assert.equal(mutations, 0);
      assert.doesNotMatch(output, /Running \d+ tests/);
    } finally {
      child.kill();
      await new Promise((resolve) => unrelated.close(resolve));
    }
  },
);
