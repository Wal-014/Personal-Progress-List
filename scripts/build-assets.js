import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import sharp from 'sharp';

const COLUMNS = 20, TILE_WIDTH = 80, TILE_HEIGHT = 240;
const ATLAS = 'assets-src/cubes.webp', CUBES = 'assets/cubes', FLAGS = 'assets/flags';

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
    rmSync(CUBES, { recursive: true, force: true });
    mkdirSync(CUBES, { recursive: true });
    for (let id = 1; id <= count; id++) {
        await sharp(data, { raw: info }).extract(cubeTile(id))
            .webp({ lossless: true, exact: true }).toFile(`${CUBES}/${id}.webp`);
    }
}

async function buildFlagCatalog(codes) {
    const packageDir = dirname(createRequire(import.meta.url).resolve('flag-icons/package.json'));
    const sourceDir = join(packageDir, 'flags', '4x3');
    const flags = codes.map(code => {
        const name = code.toLowerCase();
        const source = join(sourceDir, `${name}.svg`);
        if (!existsSync(source))
            throw new Error(`Missing flag SVG for ${code}: ${source}`);
        return { name, source };
    });

    rmSync(FLAGS, { recursive: true, force: true });
    mkdirSync(FLAGS, { recursive: true });
    for (const { name, source } of flags) {
        await sharp(source).resize(64, 48, { fit: 'fill' })
            .webp({ quality: 90, effort: 6 }).toFile(`${FLAGS}/${name}.webp`);
    }
    copyFileSync(join(packageDir, 'LICENSE'), `${FLAGS}/LICENSE`);
}

async function main() {
    const config = readFileSync('js/config.js', 'utf8');
    const { CUBE_COUNT, COUNTRY_CODES } = vm.runInNewContext(config + ';({ CUBE_COUNT, COUNTRY_CODES })');
    await buildCubeCatalog(CUBE_COUNT);
    console.log(`Generated ${CUBE_COUNT} cubes in ${CUBES}/`);
    await buildFlagCatalog(COUNTRY_CODES);
    console.log(`Generated ${COUNTRY_CODES.length} flags in ${FLAGS}/`);
}

if (process.argv[1] && import.meta.url == pathToFileURL(process.argv[1]).href) {
    try {
        await main();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
