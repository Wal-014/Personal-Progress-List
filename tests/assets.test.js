import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempDisposableSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { cubeTile, flagSources } from '../scripts/build-assets.js';
import { SITE_FILES } from '../scripts/build-site.js';
import { loadScripts } from './load-scripts.js';

const ATLAS = 'assets-src/cubes.webp';
const FLAGS = 'assets/flags';
const FLAG_FILES = loadScripts(['js/config.js']).app('COUNTRY_CODES')
    .map(code => `${FLAGS}/${code.toLowerCase()}.webp`);
const CUBE_TILES = [
    [1, { left: 0, top: 0, width: 80, height: 240 }],
    [20, { left: 1520, top: 0, width: 80, height: 240 }],
    [21, { left: 0, top: 240, width: 80, height: 240 }],
    [485, { left: 320, top: 5760, width: 80, height: 240 }]
];

test('cubeTile maps cube IDs to their atlas coordinates', () => {
    for (const [id, tile] of CUBE_TILES)
        assert.deepEqual(cubeTile(id), tile, `Cube ${id}`);
});

test('the cube atlas has room for the full catalog and an alpha channel', async () => {
    const count = loadScripts(['js/config.js']).app('CUBE_COUNT');
    const { width, height, hasAlpha } = await sharp(ATLAS).metadata();
    assert.equal(width, 1600);
    assert.equal(height, Math.ceil(count / 20) * 240);
    assert.equal(hasAlpha, true);
});

test('generated cubes preserve the atlas tiles exactly', async () => {
    for (const [id, tile] of CUBE_TILES) {
        const expected = await sharp(ATLAS).extract(tile).raw().toBuffer();
        const actual = await sharp(`assets/cubes/${id}.webp`).raw().toBuffer();
        assert.ok(actual.equals(expected), `Cube ${id} differs from its atlas tile`);
    }
});

test('every supported country has a generated 64×48 WebP flag', async () => {
    for (const file of FLAG_FILES) {
        const { format, width, height } = await sharp(file).metadata();
        assert.deepEqual({ format, width, height }, { format: 'webp', width: 64, height: 48 }, file);
    }
});

test('generated flags are at most 4 KB each', () => {
    for (const file of FLAG_FILES)
        assert.ok(statSync(file).size <= 4 * 1024, `${file} exceeds 4 KB`);
});

test('flagSources maps codes to lowercase SVG files and names a missing one', t => {
    const { path, remove } = mkdtempDisposableSync(join(tmpdir(), 'ppl-flags-'));
    t.after(remove);
    writeFileSync(join(path, 'cr.svg'), '<svg/>');
    assert.deepEqual(flagSources(['CR'], path), [{ name: 'cr', source: join(path, 'cr.svg') }]);
    assert.throws(() => flagSources(['CR', 'ES'], path), /Missing flag SVG for ES/);
});

test('the generated flag catalog includes the flag-icons license', () => {
    const packageDir = dirname(createRequire(import.meta.url).resolve('flag-icons/package.json'));
    assert.deepEqual(readFileSync(`${FLAGS}/LICENSE`), readFileSync(join(packageDir, 'LICENSE')));
});

test('source atlases stay out of the published site', () => {
    assert.ok(SITE_FILES.every(entry => entry != 'assets-src' && !entry.startsWith('assets-src/')));
});
