import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appScripts } from '../eslint.config.js';
import { loadScripts } from './load-scripts.js';

const plain = value => JSON.parse(JSON.stringify(value));
const fixture = () => ({
    profile: { username: 'player', display_name: 'Player', color: '#123456', secondary_color: '#abcdef', bio: 'Hello\nWorld', country: 'CR' },
    levels: ['classic', 'platform'].map((kind, index) => ({ id: 'n' + index, kind, name: 'Level ' + kind, creator: 'Maker', level_id: 42, attempts_normal: 10, completed_on: '2026-01-01', enjoyment: 5, deaths: { 50: 2 } })),
    level_tags: [{ level_id: 'n0', tag_name: 'Tag', position: 0 }],
    list_orders: ['classic', 'platform'].map((kind, index) => ({ kind, level_ids: ['n' + index] })),
    wishlists: [{ id: 'w1', name: 'Goals', position: 0, item_ids: ['i1', 'i2', 'i3'] }],
    wishlist_items: ['todo', 'prog', 'done'].map((status, index) => ({ id: 'i' + (index + 1), wishlist_id: 'w1', name: 'Wish ' + status, status, progress: 55, kind: 'classic' })),
    tags: [{ name: 'Tag', color: '#abcdef', position: 0 }]
});

function page(query = '?user=player', response = { data: fixture() }, beta = false, saved = {}) {
    const calls = [], writes = [], listeners = {};
    const storage = new Proxy({ gl: 'en', ...saved }, { set(target, key, value) { writes.push(key); target[key] = value; return true; } });
    const appNode = { innerHTML: '', contains: () => false };
    const document = { body: {}, activeElement: null, documentElement: { dataset: {} }, visibilityState: 'visible',
        querySelector: selector => selector == '#app' ? appNode : null, querySelectorAll: () => [],
        addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn); } };
    const env = loadScripts(appScripts.filter(file => !file.startsWith('vendor/') && file != 'js/main.js'), {
        localStorage: storage, document, window: { addEventListener: (name, fn) => { listeners[name] = [fn]; } },
        location: new URL('https://example.test/app/' + query), URL, URLSearchParams,
        navigator: { onLine: true }, history: { replaceState() {} }, setTimeout, clearTimeout, queueMicrotask
    });
    env.context.cloudBeta = () => beta;
    env.context.loadCloud = async () => ({ rpc: async (name, args) => { calls.push([name, plain(args)]); if (response instanceof Error) throw response; return response; } });
    env.context.autoSyncIfStale = () => calls.push('auto-sync');
    env.context.initAccount = () => calls.push('account');
    env.context.restoreCloudSync = () => calls.push('restore');
    return { ...env, calls, writes, listeners, html: () => appNode.innerHTML };
}

for (const username of ['', 'ab', 'UPPER', 'a-b', 'a'.repeat(21), '<img src=x onerror=alert(1)>', 'Bad<User>', 'abc\n']) {
    test('invalid public username never calls the server: ' + JSON.stringify(username), async () => {
        const p = page('?user=' + encodeURIComponent(username));
        await p.app('initPublicView()');
        assert.deepEqual(p.calls, []);
        assert.match(p.html(), /This profile does not exist or is private\./);
        assert.match(p.html(), /Go to my progress/);
        assert.match(p.html(), /<h1>Personal Ranked Progress<\/h1>/);
        assert.doesNotMatch(p.html(), /<h1>@/);
    });
}

for (const label of ['missing', 'private']) test(label + ' profiles have the same friendly screen', async () => {
    const p = page('?user=player', { data: null });
    await p.app('initPublicView()');
    assert.match(p.html(), /This profile does not exist or is private\./);
    assert.match(p.html(), /<h1>@player<\/h1>/);
});

test('offline and RPC failures show the connection screen', async () => {
    for (const result of [new TypeError('Failed to fetch'), { error: { message: 'offline' } }]) {
        const p = page('?user=player', result);
        await p.app('initPublicView()');
        assert.match(p.html(), /Could not load this profile. Check your connection./);
    }
});

test('startup uses public rows independently of beta, never syncs or writes storage', async () => {
    for (const beta of [false, true]) {
        const p = page('?user=player', { data: fixture() }, beta);
        p.load(['js/main.js']);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(p.app('profile.levels.length'), 2);
        assert.equal(p.app('profile.levels[0].notes'), '');
        assert.deepEqual(plain(p.app('profile.order.classic')), ['n0']);
        assert.equal(p.app('profile.wishlists[0].items.length'), 3);
        assert.equal(p.app('viewing.identity.display_name'), 'Player');
        assert.deepEqual(p.calls.filter(call => call != 'account'), [['public_profile', { target_username: 'player' }]]);
        p.app('save(); cloudUser = "owner"; save(); startCloudSync({ id: "owner" }, {})');
        assert.equal(p.app('cloudSession'), null);
        assert.deepEqual(p.writes, []);
        assert.match(p.html(), /Costa Rica/);
        assert.match(p.html(), /Hello\nWorld/);
    }
});

const forbidden = /data-act\s*=\s*["']?(?:add|edit|del|wadd|wedit|wdel|wstatus|wren|wdelL|tags|wnew|wto|wask|exp|imp|localdata|bell|sync)(?=[\s"'>])|class\s*=\s*["']?grip\b|data-wp=/;
const screens = ['home', 'classic', 'platform', 'wish', 'stats'];
function draw(p, tab) {
    p.app(`ui.tab = '${tab}'; ui.sel = '${tab == 'platform' ? 'n1' : 'n0'}'; ui.wl = 'w1'; render()`);
    return p.html();
}

test('all public screens omit editing controls while the editable screens retain them', async () => {
    const p = page();
    await p.app('initPublicView()');
    for (const tab of screens) {
        assert.doesNotMatch(draw(p, tab), forbidden, tab);
        assert.match(p.html(), /@player/);
    }
    assert.doesNotMatch(p.app('pauseUI()'), forbidden);
    assert.equal(p.app('alerts().length'), 0);
    p.app('viewing = null; store = { cur: "p1", profs: { p1: { name: "Local", data: profile } } }; cloudUser = null');
    for (const tab of screens) assert.match(draw(p, tab), forbidden, tab);
});

test('empty public lists and wishlists have no action and a plain empty message', async () => {
    const data = fixture();
    data.levels = []; data.wishlist_items = [];
    const p = page('?user=player', { data });
    await p.app('initPublicView()');
    for (const tab of ['classic', 'platform', 'wish']) {
        assert.doesNotMatch(draw(p, tab), forbidden);
        assert.match(p.html(), /No levels yet/);
    }
});

test('hostile public values remain text and never become markup, URLs or CSS', async () => {
    const data = fixture(), payload = `<img src=x onerror=alert(1)>"'`, color = 'red;background:url(x)';
    Object.assign(data.profile, { display_name: payload, bio: payload, country: payload, color, secondary_color: color });
    for (const row of [...data.levels, ...data.wishlist_items]) Object.assign(row, { name: payload, creator: payload, level_id: payload, video_url: 'javascript:alert(1)' });
    data.tags[0] = { name: payload, color };
    data.level_tags[0].tag_name = payload;
    data.wishlists[0].name = payload;
    const p = page('?user=player', { data });
    await p.app('initPublicView()');
    p.app('ui.comparison.open = true; ui.comparison.slots = ["n0", "n1"]');
    for (const tab of screens) {
        const html = draw(p, tab);
        assert.doesNotMatch(html, /<img src=x|href=["']?javascript:|red;background:url\(x\)/);
        assert.doesNotMatch(html.replace(/&lt;[^<>]*?&gt;/g, ''), /onerror=/);
        assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), tab);
    }
});

test('restored sessions, including the owner, retain the public view without starting sync', async () => {
    for (const username of ['visitor', 'player']) {
        const p = page();
        await p.app('initPublicView()');
        const before = JSON.stringify(plain(p.app('profile'))), calls = [];
        p.context.startCloudSync = () => calls.push('sync');
        p.context.client = { from: table => ({ select: () => ({ eq: (key, id) => ({ maybeSingle: async () => {
            calls.push([table, key, id]);
            return { data: { id, username, display_name: 'Visitor', color: '#123456', secondary_color: '#abcdef' } };
        } }) }) }) };
        p.app('accountClientPromise = Promise.resolve(client)');
        for (const event of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED'])
            await p.app(`applyAccountSession('${event}', { user: { id: 'owner' } })`);
        assert.equal(p.app('account.status'), 'signed-in');
        assert.match(p.html(), /popovertarget=amenu/);
        assert.doesNotMatch(p.html(), /id=cloudst/);
        assert.equal(p.app('cloudUser'), null);
        assert.equal(calls.includes('sync'), false);
        await p.app('applyAccountSession("SIGNED_OUT", null)');
        assert.equal(JSON.stringify(plain(p.app('profile'))), before);
        assert.deepEqual(p.writes, []);
    }
});

test('opening wishlists and external storage events never enrich or replace public data', async () => {
    const p = page();
    await p.app('initPublicView()');
    const before = JSON.stringify(plain(p.app('profile')));
    p.context.enrichWishlist = () => assert.fail('public wishlist must not be enriched');
    p.app('ACTIONS.wopen(null, "w1")');
    for (const handler of p.listeners.storage) handler({ key: 'gdp', newValue: '{"profs":{}}' });
    assert.equal(JSON.stringify(plain(p.app('profile'))), before);
    p.app('ui.edit = true; ui.tab = "classic"; ui.sel = "n0"; render()');
    assert.doesNotMatch(p.html(), forbidden);
    assert.deepEqual(p.writes, []);
});

test('returning to own progress navigates without the public user parameter', () => {
    const p = page('?user=player&keep=yes#part');
    let target;
    p.context.location.assign = value => target = value;
    p.app('ACTIONS.myprogress()');
    assert.equal(target, '/app/?keep=yes#part');
});

test('public wishlist progress uses labels and percentages without editing instructions', async () => {
    const p = page();
    await p.app('initPublicView()');
    const html = draw(p, 'wish');
    assert.doesNotMatch(html, /Set it to In progress/);
    for (const text of ['0%', '55%', '100%', 'Not started', 'In progress', 'Completed'])
        assert.ok(html.includes(text), text);
});

for (const username of ['a_1', 'a'.repeat(20)]) test('valid public username is passed unchanged: ' + username, async () => {
    const p = page('?user=' + username);
    await p.app('initPublicView()');
    assert.deepEqual(p.calls, [['public_profile', { target_username: username }]]);
    assert.equal(p.app('viewing.username'), username);
});

test('client loading failures also show the connection screen without touching local data', async () => {
    const p = page();
    p.context.loadCloud = async () => { throw new TypeError('Failed to load client'); };
    await p.app('initPublicView()');
    assert.match(p.html(), /Could not load this profile. Check your connection./);
    assert.deepEqual(p.writes, []);
});


for (const [language, publicHeading, ownHeading] of [['en', 'Lists', 'My lists'], ['es', 'Listas', 'Mis listas']]) {
    test('Home uses a neutral list heading only in public viewing mode: ' + language, async () => {
        const p = page();
        await p.app('initPublicView()');
        p.app(`ui.lang = '${language}'; render()`);
        assert.ok(p.html().includes(`<h2 class=sec>${publicHeading}</h2>`));
        assert.ok(!p.html().includes(`<h2 class=sec>${ownHeading}</h2>`));
        p.app('viewing = null; store = { cur: "p1", profs: { p1: { name: "Local", data: profile } } }; render()');
        assert.ok(p.html().includes(`<h2 class=sec>${ownHeading}</h2>`));
    });
}
