import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const refresh = 'Pin @supabase/supabase-js to an exact devDependency, run npm install, then copy node_modules/@supabase/supabase-js/dist/umd/supabase.js to vendor/supabase.js byte for byte.';

test('the vendored Supabase client matches the installed, exactly pinned package', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    assert.match(manifest.devDependencies['@supabase/supabase-js'], /^\d+\.\d+\.\d+$/, refresh);
    assert.ok(readFileSync('vendor/supabase.js').equals(readFileSync('node_modules/@supabase/supabase-js/dist/umd/supabase.js')), refresh);
});
