import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appScripts } from '../eslint.config.js';
import { loadScripts } from './load-scripts.js';

const plain = value => JSON.parse(JSON.stringify(value));

function fixture(localStorage = { gl: 'en' }) {
    const known = { id: 'i1', name: 'Known <level>', levelId: '12', kind: 'classic', status: 'done' };
    const unknown = { id: 'i1', name: 'Unknown', status: 'done' };
    const wishlists = [
        { id: 'w1', name: 'Goals & <more>', items: [known, { id: 'i2', name: 'Unplaced', kind: 'classic', status: 'done' }] },
        { id: 'w2', name: 'Later', items: [unknown, { id: 'i2', name: 'Working on it', status: 'prog' }] }
    ];
    const levels = [
        { id: 'n1', name: 'Unplaced', kind: 'classic', levelId: '10', tags: [] },
        { id: 'n2', name: 'ID missing', kind: 'platform', tags: [] }
    ];
    let html = '', dialog = null;
    const host = {
        get innerHTML() { return html; },
        set innerHTML(value) {
            html = value;
            dialog = value ? { querySelector: () => null, addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; } } : null;
        }
    };
    const scripts = appScripts.filter(file => !file.startsWith('vendor/') && file != 'js/main.js');
    const env = loadScripts(scripts, {
        localStorage, document: {
            body: {},
            documentElement: { querySelectorAll: () => [] },
            querySelector: selector => ({ '#md': host, '#md dialog': dialog }[selector] || null),
            querySelectorAll: () => [], addEventListener() {}
        },
        window: { addEventListener() {} },
        MutationObserver: class { observe() {} },
        location: new URL('https://example.test/'), URL, URLSearchParams,
        fetch: async () => ({ ok: true, json: async () => [] }), queueMicrotask
    });
    env.context.data = { levels, wishlists, order: { classic: [], platform: ['n2'] }, tags: [] };
    env.app('profile = data; store = { cur: "p1", profs: { p1: { name: "Local", data } } }; ui.wl = "w1"');
    env.context.render = () => {};
    const click = dataset => env.app('ACTIONS.notifwish')({ dataset });
    const signIn = () => env.app('cloudUser = "owner"; cloudSession = { pulled: true }; account.status = "signed-in"');
    return { ...env, known, unknown, wishlists, levels, host, click, signIn, localStorage, dialog: () => dialog };
}

test('unplaced levels and levels without IDs produce an empty panel and no badge', () => {
    const f = fixture();
    f.known.status = f.unknown.status = 'todo';
    assert.match(f.app('bellUI()'), /All good ✓/);
    assert.doesNotMatch(f.app('bellUI()'), /<section\b|Unplaced|ID missing/);
    const shell = f.app('sharedShell("")');
    assert.match(shell, /data-act=bell[^>]*aria-label="Notifications"/);
    assert.doesNotMatch(shell, /class=bdg\b/);
    assert.deepEqual(plain(f.app('notifications()')), []);
});

test('the header and panel bells and notification rows use unfilled outline icons', () => {
    const f = fixture();
    f.signIn();
    const panel = f.app('bellUI()'), shell = f.app('sharedShell("")');
    const bell = shell.match(/data-act=bell[^>]*>(<svg.*?<\/svg>)/)?.[1];
    assert.ok(bell && panel.includes(bell));
    const rowIcons = [...panel.matchAll(/class=notification-icon aria-hidden=true>(<svg.*?<\/svg>)/g)].map(match => match[1]);
    assert.equal(rowIcons.length, 3);
    assert.notEqual(rowIcons[0], rowIcons[1]);
    for (const icon of [bell, ...rowIcons]) {
        assert.match(icon, /viewBox="0 0 24 24" fill=none stroke=currentColor/);
        assert.doesNotMatch(icon, /(?:fill|stroke)="#/);
    }
    f.known.status = f.unknown.status = 'todo';
    f.app('cloudUser = null');
    assert.ok(f.app('notificationBody()').includes(bell));
});

test('pending reminders use stable wishlist-scoped IDs and localized transfer actions', () => {
    const f = fixture();
    const entries = plain(f.app('notifications()'));
    assert.deepEqual(entries.map(({ id, section, title, text, action }) => ({ id, section, title, text, action })), [
        { id: 'wish:w1:i1', section: 'pending', title: 'Known <level>', text: 'Completed in Goals & <more>, not yet in your Classic list',
            action: { act: 'notifwish', label: 'Add to Classic', data: { w: 'w1', id: 'i1', v: 'classic' } } },
        { id: 'wish:w2:i1', section: 'pending', title: 'Unknown', text: 'Completed in Later, not yet in a list',
            action: { act: 'notifwish', label: 'Add to a list', data: { w: 'w2', id: 'i1' } } }
    ]);
    assert.ok(entries.every(entry => entry.type && entry.icon));
    f.app('ui.lang = "es"');
    f.wishlists.reverse();
    assert.deepEqual(plain(f.app('notifications().map(entry => entry.id)')), ['wish:w2:i1', 'wish:w1:i1']);
    assert.match(f.app('bellUI()'), /<h3>Pendiente<\/h3>/);
});

test('pending panel escapes level and wishlist names and the badge counts its rows', () => {
    const f = fixture(), html = f.app('bellUI()');
    assert.match(html, /<h2>.*Notifications<\/h2>/);
    assert.equal((html.match(/<section\b/g) || []).length, 1);
    assert.match(html, /<h3>Pending<\/h3>/);
    assert.match(html, /<strong>Known &lt;level&gt;<\/strong>/);
    assert.match(html, /Completed in Goals &amp; &lt;more&gt;/);
    assert.doesNotMatch(html, /<level>|<more>|All good/);
    assert.match(html, /data-act="notifwish" data-w="w1" data-id="i1" data-v="classic"/);
    assert.match(html, /data-act="notifwish" data-w="w2" data-id="i1">/);
    const shell = f.app('sharedShell("")');
    assert.match(shell, /aria-label="Notifications \(2\)"/);
    assert.equal(Number(shell.match(/class=bdg aria-hidden=true>(\d+)/)[1]), f.app('notifications().length'));
});

test('a local data notice renders above Pending, with localized counts and an accessible Hide button', () => {
    const f = fixture();
    f.signIn();
    const html = f.app('bellUI()');
    assert.match(html, /<h3>Notices<\/h3>.*<h3>Pending<\/h3>/s);
    assert.match(html, /You have 1 profile on this device not yet in your account\./);
    assert.match(html, /data-act="notiflocal"[^>]*>Review local data<\/button>/);
    assert.match(html, /aria-label="Hide · Local data available" data-act="notifdismiss" data-id="local-data">Hide<\/button>/);
    assert.equal((html.match(/data-act="notifdismiss"/g) || []).length, 1);
    assert.match(f.app('sharedShell("")'), /class=bdg aria-hidden=true>3</);
    f.app('store.profs.p2 = store.profs.p1');
    assert.match(f.app('bellUI()'), /You have 2 profiles on this device not yet in your account\./);
    f.known.status = f.unknown.status = 'todo';
    f.app('ui.lang = "es"');
    assert.match(f.app('bellUI()'), /Datos locales disponibles.*Tienes 2 perfiles/s);
    assert.doesNotMatch(f.app('bellUI()'), /<h3>Pendiente<\/h3>/);
});

for (const [reason, setup] of [
    ['signed out', 'cloudUser = null'],
    ['before the first pull', 'cloudSession.pulled = false'],
    ['during recovery', 'account.recovering = true'],
    ['in a read-only view', 'viewing = {}'],
    ['without local progress', 'store.profs.p1.data = emptyProfile()'],
    ['after all offered profiles have been brought over', 'localStorage.gmigrated = \'{"owner":["p1"]}\'']
]) {
    test(`the local data notice is absent ${reason}`, () => {
        const f = fixture();
        f.signIn();
        f.app(setup);
        assert.doesNotMatch(f.app('bellUI()'), /Local data available/);
    });
}

test('Review opens the migration dialog and Not now leaves the notice available', () => {
    const f = fixture();
    f.signIn();
    f.app('ACTIONS.bell(); ACTIONS.notiflocal()');
    assert.match(f.host.innerHTML, /id=migration/);
    assert.match(f.host.innerHTML, /value="p1" checked/);
    assert.match(f.host.innerHTML, /data-act=close>Not now<\/button>/);
    f.app('ACTIONS.close()');
    assert.match(f.app('bellUI()'), /Local data available/);
});

test('Hide refreshes the open panel and persists only for the current account and offered IDs', () => {
    const f = fixture({ gl: 'en', gmigrated: '{"owner":["previous"]}', gnotices: '{"other":{"local-data":"old"}}' });
    f.signIn();
    f.app('ACTIONS.bell()');
    const dialog = f.dialog(), profiles = f.app('JSON.stringify(store.profs)');
    let body, focused = false;
    const sections = { set outerHTML(value) { body = value; } };
    const panel = { querySelector: selector => selector == '.notification-sections' ? sections : { focus() { focused = true; } } };
    f.app('ACTIONS.notifdismiss')({ dataset: { id: 'local-data' }, closest: () => panel });
    assert.equal(f.dialog(), dialog);
    assert.equal(dialog.open, true);
    assert.equal(focused, true);
    assert.match(body, /<h3>Pending<\/h3>/);
    assert.doesNotMatch(body, /Local data available/);
    assert.match(f.app('sharedShell("")'), /class=bdg aria-hidden=true>2</);
    assert.equal(f.app('JSON.stringify(store.profs)'), profiles);
    assert.equal(f.localStorage.gmigrated, '{"owner":["previous"]}');
    assert.deepEqual(JSON.parse(f.localStorage.gnotices), {
        owner: { 'local-data': 'p1' }, other: { 'local-data': 'old' }
    });

    const fresh = fixture({ ...f.localStorage });
    fresh.signIn();
    assert.doesNotMatch(fresh.app('bellUI()'), /Local data available/);
    fresh.app('cloudUser = "other"');
    assert.match(fresh.app('bellUI()'), /Local data available/);
    fresh.app('cloudUser = "owner"; store.profs = { p2: store.profs.p1, ...store.profs }');
    assert.match(fresh.app('bellUI()'), /You have 2 profiles/);
    fresh.app('ACTIONS.bell()');
    fresh.app('ACTIONS.notifdismiss')({ dataset: { id: 'local-data' }, closest: () => panel });
    assert.equal(JSON.parse(fresh.localStorage.gnotices).owner['local-data'], 'p1,p2');
    fresh.app('store.profs = { p1: store.profs.p1, p2: store.profs.p2 }');
    assert.doesNotMatch(fresh.app('bellUI()'), /Local data available/);
});

test('a known-kind action transfers from the owning wishlist and opens the level editor', () => {
    const f = fixture();
    f.app('ui.wl = "w2"; ACTIONS.bell()');
    f.click({ w: 'w1', id: 'i1', v: 'classic' });
    assert.equal(f.app('ui.wl'), 'w1');
    assert.equal(f.levels.length, 3);
    assert.equal(f.levels[2].levelId, '12');
    assert.equal(f.app('ui.tab'), 'classic');
    assert.equal(f.app('ui.sel'), f.levels[2].id);
    assert.equal(f.app('ui.edit'), 1);
    assert.equal(f.host.innerHTML, '');
    assert.deepEqual(plain(f.app('notifications().map(entry => entry.id)')), ['wish:w2:i1']);
});

test('an unknown-kind action opens the chooser for its wishlist without transferring', async () => {
    const f = fixture();
    f.app('ACTIONS.bell()');
    await f.click({ w: 'w2', id: 'i1' });
    assert.equal(f.app('ui.wl'), 'w2');
    assert.equal(f.levels.length, 2);
    assert.match(f.host.innerHTML, /<h2>Add to a list<\/h2>/);
    assert.match(f.host.innerHTML, /data-act=wto data-id="i1" data-v=classic/);
    assert.match(f.host.innerHTML, /data-act=wto data-id="i1" data-v=platform/);
    f.app('ACTIONS.wto({ dataset: { v: "platform" } }, "i1")');
    assert.equal(f.levels[2].name, 'Unknown');
    assert.equal(f.levels[2].kind, 'platform');
    assert.deepEqual(plain(f.app('notifications().map(entry => entry.id)')), ['wish:w1:i1']);
});

for (const [reason, change] of [
    ['wishlist was removed', f => f.wishlists.pop()],
    ['item was removed', f => f.wishlists[1].items.shift()],
    ['status changed', f => { f.unknown.status = 'prog'; }],
    ['item was already transferred', f => f.levels.push({ name: 'Unknown', kind: 'platform' })]
]) {
    test(`a stale notification is ignored when the ${reason}`, () => {
        const f = fixture();
        f.app('ACTIONS.bell()');
        change(f);
        const levelCount = f.levels.length;
        f.click({ w: 'w2', id: 'i1' });
        assert.equal(f.app('ui.wl'), 'w1');
        assert.equal(f.levels.length, levelCount);
        assert.equal(f.host.innerHTML, '');
    });
}
