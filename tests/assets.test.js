import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { cubeTile, faceTiles } from '../scripts/build-assets.js';
import { SITE_FILES } from '../scripts/build-site.js';
import { loadScripts } from './load-scripts.js';

const ATLAS = 'assets-src/cubes.webp';
const CUBE_TILES = [
    [1, { left: 0, top: 0, width: 80, height: 240 }],
    [20, { left: 1520, top: 0, width: 80, height: 240 }],
    [21, { left: 0, top: 240, width: 80, height: 240 }],
    [485, { left: 320, top: 5760, width: 80, height: 240 }]
];
const FACE_ATLAS = 'assets-src/faces.webp';
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

test('generated faces preserve the atlas tiles exactly', async () => {
    for (const [, name, tile] of FACE_TILES) {
        const expected = await sharp(FACE_ATLAS).extract(tile).ensureAlpha().raw().toBuffer();
        const actual = await sharp(`assets/faces/${name}.webp`).ensureAlpha().raw().toBuffer();
        assert.ok(actual.equals(expected), `Face ${name} differs from its atlas tile`);
    }
});

test('source atlases stay out of the published site', () => {
    assert.ok(SITE_FILES.every(entry => entry != 'assets-src' && !entry.startsWith('assets-src/')));
});
