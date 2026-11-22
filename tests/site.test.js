import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempDisposableSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { appScripts } from '../eslint.config.js';
import { DEV_HEADERS, SITE_FILES, assetsHash, devConfig, devPage, stampCache } from '../scripts/build-site.js';
import { loadScripts } from './load-scripts.js';

const isPublished = file => SITE_FILES.some(entry => file == entry || file.startsWith(`${entry}/`));

test('every file the service worker caches is published', () => {
    const shell = loadScripts(['sw.js'], { self: { addEventListener() {} } }).app('SHELL');
    assert.deepEqual([...shell].filter(file => file != './' && !isPublished(file)), []);
});

test('the social preview image is published', () => {
    const image = readFileSync('index.html', 'utf8').match(/<meta property="og:image" content="https:\/\/wal-014\.github\.io\/Personal-Progress-List\/([^"]+)"/)[1];
    assert.ok(isPublished(image), image);
});

test('every local path the scripts load at runtime is published', () => {
    const code = appScripts.map(file => readFileSync(file, 'utf8')).join('\n');
    // Quoted relative paths such as 'data/levels.json' or `assets/faces/${face}.webp`; API routes like 'search/' have no matching folder
    const paths = [...code.matchAll(/(?<=['"`])(?:[\w.-]+\/)+[\w.-]*(?=[$'"`])/g)].map(([path]) => path)
        .filter(path => existsSync(path.split('/')[0]));
    assert.ok(paths.includes('data/levels.json'), 'the level index lookup must be found');
    assert.deepEqual(paths.filter(path => !isPublished(path)), []);
});

test('stampCache appends the asset hash to the cache name', () => {
    const sw = "// Cache version\nconst CACHE = 'prp-1.13.14';\nself.skipWaiting();\n";
    assert.equal(stampCache(sw, '0123456789ab'), sw.replace('prp-1.13.14', 'prp-1.13.14-0123456789ab'));
});

test('stampCache fails when the cache declaration is missing', () => {
    assert.throws(() => stampCache("// const CACHE = 'example';\nconst OTHER = 'example';"), /CACHE/);
});

function assetTree(t, files) {
    const { path, remove } = mkdtempDisposableSync(join(tmpdir(), 'ppl-assets-'));
    t.after(remove);
    for (const [name, content] of files) {
        const file = join(path, name);
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, content);
    }
    return path;
}

test('assetsHash is stable and hashes files in relative path order regardless of write order', t => {
    const files = [['z.webp', 'Z'], ['cubes/2.webp', 'C']];
    const first = assetTree(t, files);
    const second = assetTree(t, files.toReversed());
    const expected = createHash('sha256').update('["cubes/2.webp",1]C["z.webp",1]Z').digest('hex').slice(0, 12);
    assert.equal(assetsHash(first), expected);
    assert.equal(assetsHash(second), expected);
});

test('assetsHash changes when one file byte changes', t => {
    const dir = assetTree(t, [['cubes/2.webp', Buffer.from([0, 255])], ['flag.svg', 'flag']]);
    const before = assetsHash(dir);
    writeFileSync(join(dir, 'cubes/2.webp'), Buffer.from([0, 254]));
    assert.notEqual(assetsHash(dir), before);
});

test('assetsHash changes when a file is renamed', t => {
    const dir = assetTree(t, [['cubes/2.webp', 'cube']]);
    const before = assetsHash(dir);
    renameSync(join(dir, 'cubes/2.webp'), join(dir, 'cubes/3.webp'));
    assert.notEqual(assetsHash(dir), before);
});

const SUPABASE_ORIGIN = 'https://mjgklvdnuhbnyucytaji.supabase.co';
const connectSrc = html => html.match(/connect-src ([^;"]*)/)[1].split(' ');

test('devConfig turns accounts off', () => {
    const config = readFileSync('js/config.js', 'utf8');
    assert.ok(loadScripts(['js/config.js']).app('ACCOUNTS'));
    const dev = devConfig(config);
    assert.equal(vm.runInNewContext(dev + ';ACCOUNTS'), false);
    assert.equal(dev.length, config.length + 1);
});

test('devConfig fails when the accounts switch is missing', () => {
    assert.throws(() => devConfig('const OTHER = true;'), /ACCOUNTS/);
});

test('devPage removes only Supabase from connect-src', () => {
    const html = readFileSync('index.html', 'utf8');
    const before = connectSrc(html);
    assert.ok(before.includes(SUPABASE_ORIGIN));
    assert.deepEqual(connectSrc(devPage(html, SUPABASE_ORIGIN)), before.filter(source => source != SUPABASE_ORIGIN));
});

test('devPage fails when Supabase is not in connect-src', () => {
    assert.throws(() => devPage(`<meta content="connect-src 'self'">`, SUPABASE_ORIGIN), /connect-src/);
});

test('dev headers keep every page out of search results, frames and plain HTTP', () => {
    const [path, ...headers] = DEV_HEADERS.trim().split('\n');
    assert.equal(path, '/*');
    assert.deepEqual(headers.map(line => line.trim()), [
        'X-Robots-Tag: noindex', 'X-Content-Type-Options: nosniff', 'Referrer-Policy: strict-origin-when-cross-origin',
        "Content-Security-Policy: frame-ancestors 'none'", 'Strict-Transport-Security: max-age=31536000'
    ]);
});
