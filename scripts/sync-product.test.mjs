import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { validateProduct, synchronize } from './sync-product.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const readJSON = p => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
const product = readJSON('config/geneai-product.json');
const backend = readJSON('config/geneai-backend.json');
test('accepts original product and dedicated backend', () => assert.equal(validateProduct(product, backend), product));
for (const [name, patch] of [
  ['wrong repository', { repository: 'someone/other-app' }],
  ['legacy URL', { publicOrigin: 'https://geneai-exclusivo.vercel.app' }],
  ['shared database', { backendProjectRef: 'fbqovchaouhisdyxhdhy' }],
  ['changed Apple bundle', { appleBundleIdentifier: 'com.geneai.geneai' }],
  ['invalid version', { version: 'latest' }],
  ['invalid build', { build: 1.2 }],
  ['invalid channel', { channel: 'unknown' }],
  ['empty changelog', { changes: [] }],
]) test(`rejects ${name}`, () => assert.throws(() => validateProduct({ ...product, ...patch }, backend)));
test('refuses secret keys in generated client configuration', () => assert.throws(() => validateProduct(product, { ...backend, publishableKey: 'sb_secret_never-in-clients' })));
test('refuses mismatched database URL', () => assert.throws(() => validateProduct(product, { ...backend, supabaseUrl: 'https://example.com' })));
test('tracked generated files are synchronized', () => assert.deepEqual(synchronize(root), []));
test('detects drift without writing and synchronizes idempotently', () => {
  const tmp = mkdtempSync(resolve(tmpdir(), 'geneai-contract-test-'));
  try {
    for (const path of ['config/geneai-product.json', 'config/geneai-backend.json', 'package.json', 'package-lock.json', 'vercel.json', 'public/release.json', 'public/geneai-runtime.json', 'apple/GENEAI/project.yml', 'apple/GENEAI/GENAIAApple/Info.plist', 'apple/GENEAI/GENAIAApple/Support/ProductContract.swift']) {
      const target = resolve(tmp, path); mkdirSync(dirname(target), { recursive: true }); copyFileSync(resolve(root, path), target);
    }
    const releasePath = resolve(tmp, 'public/release.json');
    writeFileSync(releasePath, '{}\n');
    assert.deepEqual(synchronize(tmp), ['public/release.json']);
    assert.equal(readFileSync(releasePath, 'utf8'), '{}\n');
    assert.deepEqual(synchronize(tmp, { write: true }), ['public/release.json']);
    assert.deepEqual(synchronize(tmp), []);
    const runtime = JSON.parse(readFileSync(resolve(tmp, 'public/geneai-runtime.json'), 'utf8'));
    assert.equal(runtime.nativeDistributionReady, false);
    assert.equal('publishableKey' in runtime, false);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
