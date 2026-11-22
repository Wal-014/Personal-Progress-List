import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import sharp from 'sharp';

const COLUMNS = 20, TILE_WIDTH = 80, TILE_HEIGHT = 240;
const ATLAS = 'assets-src/cubes.webp', OUT = 'assets/cubes';
const FACE_SIZE = 176;
const FACE_ATLAS = 'assets-src/faces.webp', FACE_OUT = 'assets/faces';

export function cubeTile(id) {
    return {
        left: ((id - 1) % COLUMNS) * TILE_WIDTH,
        top: Math.floor((id - 1) / COLUMNS) * TILE_HEIGHT,
        width: TILE_WIDTH,
        height: TILE_HEIGHT
    };
}

async function buildCubeCatalog(count) {
    const atlas = sharp(ATLAS);
    const { width, height } = await atlas.metadata();
    const expectedWidth = COLUMNS * TILE_WIDTH, expectedHeight = Math.ceil(count / COLUMNS) * TILE_HEIGHT;
    if (width != expectedWidth || height != expectedHeight)
        throw new Error(`${ATLAS} is ${width}×${height}; expected ${expectedWidth}×${expectedHeight} for ${count} cubes`);

    const { data, info } = await atlas.raw().toBuffer({ resolveWithObject: true });
    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(OUT, { recursive: true });
    for (let id = 1; id <= count; id++) {
        await sharp(data, { raw: info }).extract(cubeTile(id))
            .webp({ lossless: true, exact: true }).toFile(`${OUT}/${id}.webp`);
    }
}

function faceTile(column, row) {
    return { left: column * FACE_SIZE, top: row * FACE_SIZE, width: FACE_SIZE, height: FACE_SIZE };
}

export function faceTiles(faces, halos) {
    const tiles = [];
    for (const [row, face] of faces.entries()) {
        tiles.push([face, faceTile(0, row)]);
        for (const [column, halo] of halos.entries())
            tiles.push([`${face}-${halo}`, faceTile(column + 1, row)]);
    }
    tiles.push(['unrated', faceTile(0, faces.length)]);
    return tiles;
}

async function buildFaceCatalog(faces, halos) {
    const atlas = sharp(FACE_ATLAS);
    const { width, height } = await atlas.metadata();
    const expectedWidth = (halos.length + 1) * FACE_SIZE, expectedHeight = (faces.length + 1) * FACE_SIZE;
    const tiles = faceTiles(faces, halos);
    if (width != expectedWidth || height != expectedHeight)
        throw new Error(`${FACE_ATLAS} is ${width}×${height}; expected ${expectedWidth}×${expectedHeight} for ${tiles.length} faces`);

    const { data, info } = await atlas.raw().toBuffer({ resolveWithObject: true });
    rmSync(FACE_OUT, { recursive: true, force: true });
    mkdirSync(FACE_OUT, { recursive: true });
    for (const [name, tile] of tiles)
        await sharp(data, { raw: info }).extract(tile)
            .webp({ lossless: true, exact: true }).toFile(`${FACE_OUT}/${name}.webp`);
    console.log(`Generated ${tiles.length} faces in ${FACE_OUT}/`);
}

async function main() {
    const config = readFileSync('js/config.js', 'utf8');
    const count = vm.runInNewContext(config + ';CUBE_COUNT');
    await buildCubeCatalog(count);
    console.log(`Generated ${count} cubes in ${OUT}/`);

    const faceConfig = readFileSync('js/components/faces.js', 'utf8');
    const [faces, halos] = vm.runInNewContext(faceConfig + ';[FACES, HALOS]');
    await buildFaceCatalog(faces, halos);
}

if (process.argv[1] && import.meta.url == pathToFileURL(process.argv[1]).href) {
    try {
        await main();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
