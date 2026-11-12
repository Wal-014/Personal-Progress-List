import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadScripts } from './load-scripts.js';

function cloud(url = 'https://example.com/app/', storage = {}) {
    const scripts = [], replacements = [], clients = [];
    const location = new URL(url);
    const localStorage = Object.assign({ removeItem(key) { delete this[key]; } }, storage);
    const instance = {};
    const loaded = loadScripts(['js/config.js', 'js/cloud.js'], {
        URL, URLSearchParams, location, localStorage,
        history: { state: { keep: true }, replaceState(...args) { replacements.push(args); } },
        document: { createElement: () => ({ remove() {} }), head: { appendChild(script) { scripts.push(script); } } },
        supabase: { createClient(...args) { clients.push(args); return instance; } }
    });
    return { ...loaded, scripts, replacements, clients, instance, localStorage };
}

test('the beta switch persists opt-in and removes only its query parameter', () => {
    const page = cloud('https://example.com/app/?other=one&beta=cloud#keep');
    assert.equal(page.app('cloudBeta()'), true);
    assert.equal(page.localStorage.gbeta, 'cloud');
    assert.deepEqual(page.replacements, [[{ keep: true }, '', '/app/?other=one#keep']]);
    delete page.localStorage.gbeta;
    assert.equal(page.app('cloudBeta()'), true);
    assert.equal(page.replacements.length, 1);
});

test('the beta switch reads saved opt-in, defaults off and persists opt-out', () => {
    assert.equal(cloud().app('cloudBeta()'), false);
    assert.equal(cloud(undefined, { gbeta: 'cloud' }).app('cloudBeta()'), true);
    const page = cloud('https://example.com/app/?beta=off&other=one#keep', { gbeta: 'cloud' });
    assert.equal(page.app('cloudBeta()'), false);
    assert.equal(page.localStorage.gbeta, undefined);
    assert.equal(page.replacements[0][2], '/app/?other=one#keep');
    page.localStorage.gbeta = 'cloud';
    assert.equal(page.app('cloudBeta()'), false);
});

test('blocked storage disables beta and session detection without keeping the beta parameter', () => {
    for (const beta of ['cloud', 'off']) {
        const page = cloud('https://example.com/app/?beta=' + beta);
        Object.defineProperty(page.context, 'localStorage', { get() { throw Error('Blocked'); } });
        assert.equal(page.app('cloudBeta()'), false);
        assert.equal(page.app('hasCloudSession()'), false);
        assert.equal(page.replacements[0][2], '/app/');
    }
});

test('cloud loading shares a script and a client configured for persistent PKCE', async () => {
    const page = cloud();
    const first = page.app('loadCloud()'), second = page.app('loadCloud()');
    assert.equal(first, second);
    assert.equal(page.scripts.length, 1);
    assert.equal(page.scripts[0].src, 'vendor/supabase.js');
    page.scripts[0].onload();
    assert.equal(await first, page.instance);
    assert.equal(await page.app('loadCloud()'), page.instance);
    assert.equal(page.clients.length, 1);
    const [url, key, options] = page.clients[0];
    assert.equal(url, 'https://mjgklvdnuhbnyucytaji.supabase.co');
    assert.ok(key.startsWith('sb_publishable_'));
    assert.deepEqual(JSON.parse(JSON.stringify(options)), {
        auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
});

test('a failed script is removed and the next call retries with a fresh element', async () => {
    const page = cloud();
    let removed = false;
    const first = page.app('loadCloud()');
    page.scripts[0].remove = () => { removed = true; };
    page.scripts[0].onerror();
    await assert.rejects(first);
    assert.equal(removed, true);
    const retry = page.app('loadCloud()');
    assert.equal(page.scripts.length, 2);
    assert.notEqual(page.scripts[0], page.scripts[1]);
    page.scripts[1].onload();
    assert.equal(await retry, page.instance);
});

test('session detection derives the project reference from the configured host', () => {
    const page = cloud(undefined, { 'sb-mjgklvdnuhbnyucytaji-auth-token': 'session' });
    assert.equal(page.app('hasCloudSession()'), true);
    delete page.localStorage['sb-mjgklvdnuhbnyucytaji-auth-token'];
    page.localStorage['sb-other-auth-token'] = 'session';
    assert.equal(page.app('hasCloudSession()'), false);
});

test('the CSP allows the Supabase origin and the page does not load its vendor script eagerly', () => {
    const html = readFileSync('index.html', 'utf8');
    const csp = html.match(/connect-src ([^;"]*)/)[1].split(' ');
    assert.ok(csp.includes(new URL(cloud().app('SUPABASE_URL')).origin));
    assert.equal(/<script[^>]*src="vendor\/supabase.js"/.test(html), false);
});

test('installing the service worker leaves the cloud vendor for the first account use', async () => {
    const handlers = {}, requested = [];
    let installed;
    const worker = loadScripts(['sw.js'], {
        Request: class { constructor(url) { this.url = url; } },
        self: { skipWaiting() {}, addEventListener(event, handler) { handlers[event] = handler; } },
        caches: { open: async () => ({ addAll: async requests => requested.push(...requests.map(r => r.url)) }) }
    });
    assert.equal(worker.app("SHELL.includes('vendor/supabase.js')"), false);
    handlers.install({ waitUntil(promise) { installed = promise; } });
    await installed;
    assert.ok(requested.includes('js/cloud.js'));
    assert.ok(requested.includes('js/account.js'));
    assert.equal(requested.includes('vendor/supabase.js'), false);
});

test('the service worker caches the cloud vendor on demand and serves it offline', async () => {
    const handlers = {}, stored = new Map();
    const response = { ok: true, clone: () => response };
    const page = loadScripts(['sw.js'], {
        URL, location: { origin: 'https://example.com' },
        self: { addEventListener(event, handler) { handlers[event] = handler; } },
        fetch: async () => response,
        caches: {
            open: async () => ({ put: async (request, copy) => stored.set(request.url, copy) }),
            match: async request => stored.get(request.url)
        }
    });
    const request = { method: 'GET', url: 'https://example.com/app/vendor/supabase.js' };
    let result;
    const event = { request, respondWith(promise) { result = promise; } };
    handlers.fetch(event);
    assert.equal(await result, response);
    assert.equal(stored.get(request.url), response);
    page.context.fetch = async () => { throw TypeError('Failed to fetch'); };
    handlers.fetch(event);
    assert.equal(await result, response);
});

test('startup initializes accounts after the first render only when beta is on', () => {
    for (const beta of [false, true]) {
        const calls = [];
        loadScripts(['js/main.js'], {
            store: {}, storeWasUnreadable: false,
            ensureProfileColors() {}, ensureProfileDefaults() {}, autoSyncIfStale() {},
            render() { calls.push('render'); }, cloudBeta: () => beta,
            initAccount() { calls.push('init'); }, document: { addEventListener() {} }, navigator: {}
        });
        assert.deepEqual(calls, beta ? ['render', 'init'] : ['render']);
    }
});
