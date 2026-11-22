import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import sharp from 'sharp';

const COLUMNS = 20, TILE_WIDTH = 80, TILE_HEIGHT = 240;
const ATLAS = 'assets-src/cubes.webp', OUT = 'assets/cubes';

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

async function main() {
    const config = readFileSync('js/config.js', 'utf8');
    const count = vm.runInNewContext(config + ';CUBE_COUNT');
    await buildCubeCatalog(count);
    console.log(`Generated ${count} cubes in ${OUT}/`);
}

if (process.argv[1] && import.meta.url == pathToFileURL(process.argv[1]).href) {
    try {
        await main();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
