import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const shared = JSON.parse(readFileSync(new URL('../config/geneai-backend.json', import.meta.url), 'utf8'));
const deployment = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
for (const [name, expected] of Object.entries({
  SUPABASE_URL: shared.supabaseUrl,
  SUPABASE_PUBLISHABLE_KEY: shared.publishableKey,
  VITE_SUPABASE_URL: shared.supabaseUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: shared.publishableKey,
  VITE_SUPABASE_PROJECT_ID: shared.projectRef,
})) {
  if (deployment.env?.[name] !== expected) throw new Error(`Deployment and shared backend differ: ${name}`);
}
const env = {
  ...process.env,
  VITE_SUPABASE_PROJECT_ID: shared.projectRef,
  VITE_SUPABASE_URL: shared.supabaseUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: shared.publishableKey,
};
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
