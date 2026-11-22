import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempDisposableSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { cubeTile, cutAtlas, faceTiles, flagSources } from '../scripts/build-assets.js';
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
const FACE_ATLAS = 'assets-src/faces.webp';
const FACE_DIR = 'assets/faces';
const { app } = loadScripts(['js/components/faces.js']);
const faces = app('FACES'), halos = app('HALOS');
const FACE_TILES = [
    [0, 'auto', { left: 0, top: 0, width: 176, height: 176 }],
    [2, 'auto-epic', { left: 352, top: 0, width: 176, height: 176 }],
    [54, 'demon-extreme-mythic', { left: 704, top: 1760, width: 176, height: 176 }],
    [55, 'unrated', { left: 0, top: 1936, width: 176, height: 176 }]
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

test('cutAtlas names a mismatched atlas and preserves existing output', async t => {
    const { path, remove } = mkdtempDisposableSync(join(tmpdir(), 'ppl-atlas-'));
    t.after(remove);
    const atlas = join(path, 'tiny.webp'), outDir = join(path, 'output');
    await sharp({ create: { width: 1, height: 1, channels: 3, background: 'white' } }).webp().toFile(atlas);
    mkdirSync(outDir);
    const marker = join(outDir, 'keep.txt');
    writeFileSync(marker, 'previous output');

    await assert.rejects(cutAtlas({ atlas, outDir, tiles: [], width: 2, height: 1, webp: {} }),
        error => error.message.includes(atlas) && error.message.includes('expected 2×1'));
    assert.deepEqual(readdirSync(outDir), ['keep.txt']);
    assert.equal(readFileSync(marker, 'utf8'), 'previous output');
});

test('faceTiles lists the atlas tiles in row order', () => {
    const tiles = faceTiles(faces, halos);
    assert.equal(tiles.length, faces.length * (halos.length + 1) + 1);
    for (const [index, name, tile] of FACE_TILES)
        assert.deepEqual(tiles[index], [name, tile], name);
});

test('the face atlas has room for the full catalog and an alpha channel', async () => {
    const { width, height, hasAlpha } = await sharp(FACE_ATLAS).metadata();
    assert.equal(width, (halos.length + 1) * 176);
    assert.equal(height, (faces.length + 1) * 176);
    assert.equal(hasAlpha, true);
});

function webpChunks(data) {
    const chunks = [];
    // RIFF chunks follow the 12-byte WebP header and are padded to even lengths.
    for (let offset = 12; offset + 8 <= data.length;) {
        chunks.push(data.toString('ascii', offset, offset + 4));
        const size = data.readUInt32LE(offset + 4);
        offset += 8 + size + size % 2;
    }
    return chunks;
}

function alphaWeightedPsnr(expected, actual) {
    let squaredError = 0;
    for (let pixel = 0; pixel < expected.length; pixel += 4) {
        const alpha = expected[pixel + 3] / 255;
        for (let channel = 0; channel < 3; channel++) {
            const difference = (expected[pixel + channel] - actual[pixel + channel]) * alpha;
            squaredError += difference ** 2;
        }
        squaredError += (expected[pixel + 3] - actual[pixel + 3]) ** 2;
    }
    const meanSquaredError = squaredError / expected.length;
    return 10 * Math.log10(255 ** 2 / meanSquaredError);
}

test('generated faces are 176×176 lossy WebPs with at least 35 dB PSNR', async () => {
    for (const [, name, tile] of FACE_TILES) {
        const file = join(FACE_DIR, `${name}.webp`);
        const encoded = readFileSync(file);
        const image = sharp(encoded);
        const { format, width, height } = await image.metadata();
        assert.deepEqual({ format, width, height }, { format: 'webp', width: 176, height: 176 }, file);
        const chunks = webpChunks(encoded);
        assert.ok(chunks.includes('VP8 ') && !chunks.includes('VP8L'), `${file} must be lossy WebP`);
        const expected = await sharp(FACE_ATLAS).extract(tile).ensureAlpha().raw().toBuffer();
        const actual = await image.ensureAlpha().raw().toBuffer();
        const psnr = alphaWeightedPsnr(expected, actual);
        assert.ok(psnr >= 35, `${file} has ${psnr.toFixed(2)} dB PSNR`);
    }
});

test('the generated face catalog is at most 512 KB', () => {
    const bytes = readdirSync(FACE_DIR).reduce((total, name) => total + statSync(join(FACE_DIR, name)).size, 0);
    assert.ok(bytes <= 512 * 1024, `Face catalog is ${bytes} bytes`);
});

test('every supported country has a generated 64×48 WebP flag', async () => {
    for (const file of FLAG_FILES) {
        const { format, width, height } = await sharp(file).metadata();
        assert.deepEqual({ format, width, height }, { format: 'webp', width: 64, height: 48 }, file);
    }
});

test('generated flags are lossless and at most 4 KB each', () => {
    for (const file of FLAG_FILES) {
        assert.ok(statSync(file).size <= 4 * 1024, `${file} exceeds 4 KB`);
        assert.ok(readFileSync(file).includes('VP8L'), `${file} is not lossless`);
    }
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
