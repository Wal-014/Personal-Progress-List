import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { appScripts } from '../eslint.config.js';
import { SITE_FILES } from '../scripts/build-site.js';
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
