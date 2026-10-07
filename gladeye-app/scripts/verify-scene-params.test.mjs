import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const APP_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const REPO_ROOT = path.resolve(APP_ROOT, '..');
const GUARD_NAME = 'G.no `any` in experience scope';

// Execute the real verifier against copies of its existing inputs. Mutations
// never touch the application's source, assets, settings, or expected evidence.
function withFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gladeye-scene-verifier-'));
  const app = path.join(root, 'gladeye-app');
  try {
    for (const relative of [
      'gladeye-app/scripts/verify-scene-params.mjs',
      'gladeye-app/src/experience',
      'gladeye-app/public/valley',
      'docs/research/gladeye/EVIDENCE.md',
      'evidence/source-assets/js/app/page-4c279de0997d388f.js',
    ]) {
      const destination = path.join(root, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.cpSync(path.join(REPO_ROOT, relative), destination, { recursive: true });
    }
    return run(app);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function execute(app) {
  const result = spawnSync(process.execPath, ['scripts/verify-scene-params.mjs'], {
    cwd: app,
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.doesNotMatch(result.stderr, /ReferenceError/);
  const summary = /scene-params: (\d+)\/(\d+) checks passed, (\d+) failed/.exec(result.stdout);
  assert.ok(summary, `Verifier must finish with a summary. stderr:\n${result.stderr}`);
  const rows = result.stdout.split('\n').filter((line) => /^(PASS|FAIL)  /.test(line));
  const failed = rows.filter((line) => line.startsWith('FAIL')).length;
  assert.equal(Number(summary[1]), rows.length - failed);
  assert.equal(Number(summary[2]), rows.length);
  assert.equal(Number(summary[3]), failed);
  assert.equal(result.status, failed === 0 ? 0 : 1);
  return rows;
}

function guardResult(rows) {
  const guard = rows.filter((row) => row.includes(GUARD_NAME));
  assert.equal(guard.length, 1);
  return guard[0].startsWith('PASS');
}

test('real verifier reaches its summary and reports accurate totals', () => {
  withFixture((app) => {
    assert.equal(guardResult(execute(app)), true);
  });
});

for (const [extension, source] of [
  ['ts', 'export const regressionValue: any = null;\n'],
  ['tsx', 'export const regressionValue = null as any;\n'],
]) {
  test(`experience-scope guard rejects any in deeply nested .${extension} sources`, () => {
    withFixture((app) => {
      const nested = path.join(app, 'src/experience/regression/deeply/nested');
      fs.mkdirSync(nested, { recursive: true });
      fs.writeFileSync(path.join(nested, `guard.${extension}`), source);
      assert.equal(guardResult(execute(app)), false);
    });
  });
}

test('experience-scope guard ignores non-source files and outside sources', () => {
  withFixture((app) => {
    fs.writeFileSync(path.join(app, 'src/experience/regression.txt'), 'value: any');
    fs.writeFileSync(path.join(app, 'src/outside-experience.ts'), 'export const value: any = null;');
    assert.equal(guardResult(execute(app)), true);
  });
});
