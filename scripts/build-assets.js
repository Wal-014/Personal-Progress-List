import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import sharp from 'sharp';

const CUBE_COLUMNS = 20, CUBE_WIDTH = 80, CUBE_HEIGHT = 240;
const CUBE_ATLAS = 'assets-src/cubes.webp', CUBE_DIR = 'assets/cubes';
const FACE_SIZE = 176;
const FACE_ATLAS = 'assets-src/faces.webp', FACE_DIR = 'assets/faces';
const FLAG_DIR = 'assets/flags';

export async function cutAtlas({ atlas, outDir, tiles, width, height, webp }) {
    // A buffer lets Sharp reuse the input without caching an open file handle.
    const image = sharp(readFileSync(atlas));
    const { width: atlasWidth, height: atlasHeight } = await image.metadata();
    if (atlasWidth != width || atlasHeight != height)
        throw new Error(`${atlas} is ${atlasWidth}×${atlasHeight}; expected ${width}×${height}`);

    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    for (const [name, tile] of tiles)
        await sharp(data, { raw: info }).extract(tile).webp(webp).toFile(join(outDir, `${name}.webp`));
}

export function cubeTile(id) {
    return {
        left: ((id - 1) % CUBE_COLUMNS) * CUBE_WIDTH,
        top: Math.floor((id - 1) / CUBE_COLUMNS) * CUBE_HEIGHT,
        width: CUBE_WIDTH,
        height: CUBE_HEIGHT
    };
}

function buildCubeCatalog(count) {
    const tiles = Array.from({ length: count }, (_, index) => [index + 1, cubeTile(index + 1)]);
    return cutAtlas({
        atlas: CUBE_ATLAS, outDir: CUBE_DIR, tiles,
        width: CUBE_COLUMNS * CUBE_WIDTH, height: Math.ceil(count / CUBE_COLUMNS) * CUBE_HEIGHT,
        webp: { lossless: true, exact: true }
    });
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
    const tiles = faceTiles(faces, halos);
    await cutAtlas({
        atlas: FACE_ATLAS, outDir: FACE_DIR, tiles,
        width: (halos.length + 1) * FACE_SIZE, height: (faces.length + 1) * FACE_SIZE,
        webp: { quality: 90, alphaQuality: 100, effort: 6 }
    });
    return tiles.length;
}

/** Checks every source before the catalog is emptied, so a package without a flag cannot leave it half built. */
export function flagSources(codes, sourceDir) {
    return codes.map(code => {
        const name = code.toLowerCase();
        const source = join(sourceDir, `${name}.svg`);
        if (!existsSync(source))
            throw new Error(`Missing flag SVG for ${code}: ${source}`);
        return { name, source };
    });
}

async function buildFlagCatalog(codes) {
    const packageDir = dirname(createRequire(import.meta.url).resolve('flag-icons/package.json'));
    const flags = flagSources(codes, join(packageDir, 'flags', '4x3'));

    rmSync(FLAG_DIR, { recursive: true, force: true });
    mkdirSync(FLAG_DIR, { recursive: true });
    for (const { name, source } of flags) {
        // Flat flag colours compress smaller lossless than lossy, with no artefacts
        await sharp(source).resize(64, 48, { fit: 'fill' })
            .webp({ lossless: true, effort: 6 }).toFile(`${FLAG_DIR}/${name}.webp`);
    }
    copyFileSync(join(packageDir, 'LICENSE'), `${FLAG_DIR}/LICENSE`);
}

async function main() {
    const config = readFileSync('js/config.js', 'utf8');
    const { CUBE_COUNT, COUNTRY_CODES } = vm.runInNewContext(config + ';({ CUBE_COUNT, COUNTRY_CODES })');
    const faceConfig = readFileSync('js/components/faces.js', 'utf8');
    const [faces, halos] = vm.runInNewContext(faceConfig + ';[FACES, HALOS]');

    await buildCubeCatalog(CUBE_COUNT);
    console.log(`Generated ${CUBE_COUNT} cubes in ${CUBE_DIR}/`);
    const faceCount = await buildFaceCatalog(faces, halos);
    console.log(`Generated ${faceCount} faces in ${FACE_DIR}/`);
    await buildFlagCatalog(COUNTRY_CODES);
    console.log(`Generated ${COUNTRY_CODES.length} flags in ${FLAG_DIR}/`);
}

if (process.argv[1] && import.meta.url == pathToFileURL(process.argv[1]).href) {
    try {
        await main();
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
