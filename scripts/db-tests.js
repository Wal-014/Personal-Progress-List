/**
 * Runs tests/db against the local Supabase stack with its URL and keys. Run it with `npm run test:db`.
 * CI puts the CLI on the PATH and names it in SUPABASE_CLI; elsewhere the pinned version runs through npx.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

// npx is a .cmd file on Windows, which cannot be spawned without a shell, so its script runs with this Node instead
const cli = process.env.SUPABASE_CLI
    ? [process.env.SUPABASE_CLI]
    : [process.execPath, join(dirname(process.env.npm_execpath || ''), 'npx-cli.js'), '--yes', 'supabase@2.122.0'];
const status = spawnSync(cli[0], [...cli.slice(1), 'status', '-o', 'json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']
});
if (status.error || status.status !== 0) {
    console.error('Could not read the local Supabase status. Start the local stack first, and run this script with npm run test:db.');
    process.exit(status.status || 1);
}

let local;
try {
    local = JSON.parse(status.stdout);
} catch {
    console.error('Supabase status did not return valid JSON.');
    process.exit(1);
}

const env = {
    ...process.env,
    SUPABASE_TEST_URL: local.API_URL,
    SUPABASE_TEST_ANON_KEY: local.ANON_KEY,
    SUPABASE_TEST_SERVICE_KEY: local.SERVICE_ROLE_KEY
};
if (![env.SUPABASE_TEST_URL, env.SUPABASE_TEST_ANON_KEY, env.SUPABASE_TEST_SERVICE_KEY].every(value => typeof value === 'string' && value.length > 0)) {
    console.error('Supabase status is missing API_URL, ANON_KEY or SERVICE_ROLE_KEY.');
    process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', 'tests/db/*.test.js'], { stdio: 'inherit', env });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
