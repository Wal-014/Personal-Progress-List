import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempDisposableSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { appScripts } from '../eslint.config.js';
import { BETA_BASE, DEV_HEADERS, RELEASE_LINE, SITE_FILES, siteHash, countReleaseCommits, devConfig, devPage, releaseVersion, siteConfig, stampCache, stampVersion } from '../scripts/build-site.js';
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

test('releaseVersion appends the count to a prerelease line', () => {
    assert.equal(releaseVersion('0.1.0-beta', 1), '0.1.0-beta.1');
    assert.equal(releaseVersion('0.1.0-beta', 12), '0.1.0-beta.12');
});

test('releaseVersion leaves the stable line unchanged without a count', () => {
    assert.equal(releaseVersion('1.0.0'), '1.0.0');
    assert.equal(releaseVersion('1.0.0', 12), '1.0.0');
});

test('releaseVersion requires a positive integer count for a prerelease', () => {
    for (const count of [0, -1, 1.5, '1', NaN, Infinity, undefined])
        assert.throws(() => releaseVersion('0.1.0-beta', count), /positive integer/);
});

test('stampVersion rewrites only the APP_VERSION declaration', () => {
    const config = ["// const APP_VERSION = '0.1.0-dev';", "const APP_VERSION = '0.1.0-dev';", "const OTHER = '0.1.0-dev';", ''];
    const expected = [config[0], "const APP_VERSION = '0.1.0-beta.4';", ...config.slice(2)];
    assert.equal(stampVersion(config.join('\r\n'), '0.1.0-beta.4'), expected.join('\r\n'));
});

test('stampVersion fails when the version declaration is missing', () => {
    assert.throws(() => stampVersion("// const APP_VERSION = '0.1.0-dev';", '0.1.0-beta.4'), /APP_VERSION/);
});

test('release count follows first parents and is stable on the same commit', t => {
    const { path, remove } = mkdtempDisposableSync(join(tmpdir(), 'ppl-release-'));
    t.after(remove);
    const identity = { NAME: 'Release Test', EMAIL: 'release-test@example.invalid' };
    const env = { ...process.env, ...Object.fromEntries(['AUTHOR', 'COMMITTER'].flatMap(role => Object.entries(identity).map(([key, value]) => [`GIT_${role}_${key}`, value]))) };
    const git = (...args) => execFileSync('git', args, { cwd: path, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '--initial-branch=main');
    // Plumbing builds the history directly, so the machine's commit hooks and identity settings do not apply.
    const tree = git('mktree');
    const commit = (message, ...parents) => git('commit-tree', tree, ...parents.flatMap(parent => ['-p', parent]), '-m', message);
    const moveMain = sha => git('update-ref', 'HEAD', sha);
    const base = commit('Last release');
    moveMain(base);
    const initial = countReleaseCommits(base, path);
    assert.equal(initial, 0);
    assert.throws(() => releaseVersion(RELEASE_LINE, initial), /positive integer/);

    const side = ['First', 'Second', 'Third'].reduce((parent, name) => commit(name + ' side change', parent), base);
    const mainChange = commit('Main change', base);
    moveMain(mainChange);
    assert.equal(countReleaseCommits(base, path), 1);
    moveMain(commit('Merge side', mainChange, side));
    assert.equal(countReleaseCommits(base, path), 2);
    assert.equal(countReleaseCommits(base, path), 2);
});

test('release count errors explain the full-history requirement', t => {
    const { path, remove } = mkdtempDisposableSync(join(tmpdir(), 'ppl-release-'));
    t.after(remove);
    assert.throws(() => countReleaseCommits(BETA_BASE, path), /full Git history/);
});

test('a flagged production build stamps the release into config', () => {
    const config = readFileSync('js/config.js', 'utf8');
    const production = siteConfig(config, 'production', 'true', () => 4);
    assert.equal(vm.runInNewContext(production + ';APP_VERSION'), '0.1.0-beta.4');
});

test('local and development builds keep the dev version without counting releases', () => {
    const config = readFileSync('js/config.js', 'utf8');
    const unexpectedCount = () => assert.fail('only an explicit production release counts commits');
    for (const flag of [undefined, 'false', 'TRUE'])
        assert.equal(siteConfig(config, 'production', flag, unexpectedCount), config);
    const dev = siteConfig(config, 'development', 'true', unexpectedCount);
    assert.equal(vm.runInNewContext(dev + ';APP_VERSION'), '0.1.0-dev');
    assert.equal(vm.runInNewContext(dev + ';ACCOUNTS'), false);
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

test('siteHash is stable and hashes files in relative path order regardless of write order', t => {
    const files = [['z.webp', 'Z'], ['cubes/2.webp', 'C']];
    const first = assetTree(t, files);
    const second = assetTree(t, files.toReversed());
    const expected = createHash('sha256').update('["cubes/2.webp",1]C["z.webp",1]Z').digest('hex').slice(0, 12);
    assert.equal(siteHash(first), expected);
    assert.equal(siteHash(second), expected);
});

test('siteHash changes when one file byte changes', t => {
    const dir = assetTree(t, [['cubes/2.webp', Buffer.from([0, 255])], ['flag.svg', 'flag']]);
    const before = siteHash(dir);
    writeFileSync(join(dir, 'cubes/2.webp'), Buffer.from([0, 254]));
    assert.notEqual(siteHash(dir), before);
});

test('siteHash changes when a file is renamed', t => {
    const dir = assetTree(t, [['cubes/2.webp', 'cube']]);
    const before = siteHash(dir);
    renameSync(join(dir, 'cubes/2.webp'), join(dir, 'cubes/3.webp'));
    assert.notEqual(siteHash(dir), before);
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

test('siteHash leaves out the skipped worker and data folder but sees code, styles and pages', t => {
    const dir = assetTree(t, [['sw.js', 'worker'], ['data/levels.json', '[]'], ['js/app.js', 'a'], ['css/styles.css', 'b'], ['index.html', 'c'], ['database.txt', 'd']]);
    const skip = ['sw.js', 'data'];
    const before = siteHash(dir, skip);
    writeFileSync(join(dir, 'sw.js'), 'stamped worker');
    writeFileSync(join(dir, 'data/levels.json'), '[1]');
    assert.equal(siteHash(dir, skip), before);
    for (const file of ['js/app.js', 'css/styles.css', 'index.html', 'database.txt']) {
        const previous = siteHash(dir, skip);
        writeFileSync(join(dir, file), 'changed ' + file);
        assert.notEqual(siteHash(dir, skip), previous, file);
    }
});
