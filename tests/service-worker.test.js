import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { appScripts } from '../eslint.config.js';
import { loadScripts } from './load-scripts.js';

const shell = [...loadScripts(['sw.js'], { self: { addEventListener() {} } }).app('SHELL')];

test('the service worker caches every script the page loads, so the app also starts offline', () => {
    assert.deepEqual(appScripts.filter(file => !shell.includes(file)), []);
});

test('the ranking coordinator loads after the API and before startup and is cached offline', () => {
    const coordinator = 'js/ranking-sync.js';
    assert.equal(appScripts[appScripts.indexOf('js/api.js') + 1], coordinator);
    assert.ok(appScripts.indexOf(coordinator) < appScripts.indexOf('js/main.js'));
    assert.ok(shell.includes(coordinator));
});

test('every file the service worker caches exists', () => {
    assert.deepEqual(shell.filter(file => file != './' && !existsSync(file)), []);
});

function dispatchFetch(path, { workerPath = '/Personal-Progress-List/sw.js', cached, network } = {}) {
    const location = new URL(workerPath, 'https://example.test');
    const request = new Request(new URL(path, location));
    const cache = { match: mock.fn(async () => cached), put: mock.fn(async () => {}) };
    const caches = { open: mock.fn(async () => cache), match: mock.fn(async () => cached) };
    const fetch = mock.fn(network ?? (async () => { throw new Error('offline'); }));
    const listeners = new Map();
    loadScripts(['sw.js'], {
        self: { addEventListener: (event, listener) => listeners.set(event, listener) },
        caches, fetch, location, URL
    });
    let response;
    listeners.get('fetch')({ request, respondWith: value => { response = value; } });
    return { response, request, cache, caches, fetch };
}

test('an asset in the cache is served without fetching', async () => {
    const cached = new Response('cached cube');
    const { response, fetch } = dispatchFetch('assets/cubes/2.webp', {
        cached, network: async () => new Response('network cube')
    });
    assert.equal(await response, cached);
    assert.equal(fetch.mock.callCount(), 0);
});

test('an uncached asset is revalidated once and stored in the current cache', async () => {
    const image = new Response('new face');
    const { response, request, fetch, caches, cache } = dispatchFetch('assets/faces/hard.webp', {
        workerPath: '/sw.js', network: async () => image
    });
    assert.equal(await response, image);
    assert.equal(caches.open.mock.calls[0].arguments[0], loadScripts(['sw.js'], { self: { addEventListener() {} } }).app('CACHE'));
    assert.equal(caches.match.mock.callCount(), 0);
    assert.equal(fetch.mock.callCount(), 1);
    const [fetched, options] = fetch.mock.calls[0].arguments;
    assert.equal(fetched, request);
    assert.equal(options.cache, 'no-cache');
    assert.equal(cache.put.mock.callCount(), 1);
    const [key, copy] = cache.put.mock.calls[0].arguments;
    assert.equal(key, request);
    assert.notEqual(copy, image);
    assert.equal(await copy.text(), 'new face');
});

test('an asset error is returned without being stored', async () => {
    const error = new Response('missing', { status: 404 });
    const { response, cache } = dispatchFetch('assets/missing.webp', { network: async () => error });
    assert.equal(await response, error);
    assert.equal(cache.put.mock.callCount(), 0);
});

test('paths outside the local assets folder still try the network before falling back to the cache', async () => {
    for (const path of ['index.html', '/assets/cubes/2.webp', 'assets-backup/cubes/2.webp']) {
        const cached = new Response('offline copy');
        const { response, request, fetch } = dispatchFetch(path, { cached });
        assert.equal(await response, cached, path);
        assert.equal(fetch.mock.callCount(), 1, path);
        const [fetched, options] = fetch.mock.calls[0].arguments;
        assert.equal(fetched, request, path);
        assert.equal(options.cache, 'no-cache', path);
    }
});
