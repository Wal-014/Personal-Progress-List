import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
// Dot folders other than .github hold git data and local tool output, never published files
const skipped = new Set(['node_modules', '_site', 'design']);

function* files(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (skipped.has(entry.name) || entry.isDirectory() && entry.name.startsWith('.') && entry.name != '.github') continue;
        if (entry.isDirectory()) yield* files(path);
        else if (entry.isFile()) yield path;
    }
}

test('repository files contain no Supabase secret or service-role keys', () => {
    const found = [];
    for (const path of files(root)) {
        const text = readFileSync(path, 'utf8');
        // A real key follows the prefix; the docs name the prefix on its own
        if (/sb_secret_[A-Za-z0-9_-]{20}/.test(text)) found.push(`${relative(root, path)}: secret key`);
        for (const [jwt] of text.matchAll(/\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\b/g)) {
            let payload;
            try {
                payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));
            } catch {
                continue;
            }
            if (payload?.role === 'service_role') found.push(`${relative(root, path)}: service-role key`);
        }
    }
    assert.deepEqual(found, []);
});
