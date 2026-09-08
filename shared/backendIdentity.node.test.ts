// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { expect, it } from 'vitest';

it('loads the emitted backend module in native Node ESM as Vercel does', () => {
  const root = mkdtempSync(join(tmpdir(), 'geneai-node-'));
  try {
    mkdirSync(join(root, 'shared'));
    mkdirSync(join(root, 'config'));
    writeFileSync(join(root, 'package.json'), '{"type":"module"}');
    writeFileSync(join(root, 'config/geneai-backend.json'), readFileSync(new URL('../config/geneai-backend.json', import.meta.url)));
    const source = readFileSync(new URL('./backendIdentity.ts', import.meta.url), 'utf8');
    const emitted = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    writeFileSync(join(root, 'shared/backendIdentity.js'), emitted);
    const moduleURL = pathToFileURL(join(root, 'shared/backendIdentity.js')).href;
    const script = `import { getCanonicalBackendIdentity } from ${JSON.stringify(moduleURL)}; process.stdout.write(JSON.stringify(getCanonicalBackendIdentity()));`;
    const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '--eval', script], { encoding: 'utf8', timeout: 10000 }));
    const config = JSON.parse(readFileSync(join(root, 'config/geneai-backend.json'), 'utf8'));
    expect(result.projectRef).toBe(config.projectRef);
    expect(result.supabaseUrl).toBe(config.supabaseUrl);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
