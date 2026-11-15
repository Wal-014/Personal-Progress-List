import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const DEV_ORIGIN = 'https://ppl-dev.waquermaster.workers.dev';
const PRODUCTION_ORIGIN = 'https://wal-014.github.io';

// Only whole-line comments are dropped: the URLs inside the values contain `//`
const readJsonc = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, ''));

test('the dev site Worker serves the built site at the dev URL', () => {
    const config = readJsonc('dev-site/wrangler.jsonc');
    assert.equal(config.name, 'ppl-dev');
    assert.equal(new URL(DEV_ORIGIN).host, `${config.name}.waquermaster.workers.dev`);
    assert.equal(resolve(dirname('dev-site/wrangler.jsonc'), config.assets.directory), resolve('_site'));
    assert.equal(config.main, undefined, 'an assets-only Worker runs no code');
    assert.equal(config.workers_dev, true);
});

test('the relay allows the production and dev sites', () => {
    const { vars } = readJsonc('relay/wrangler.jsonc');
    assert.deepEqual(vars.ALLOWED_ORIGINS.split(','), [PRODUCTION_ORIGIN, DEV_ORIGIN]);
});
