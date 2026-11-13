import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts, syncScripts } from './load-scripts.js';
import { FakeSyncServer } from './fake-sync-server.js';

const plain = value => JSON.parse(JSON.stringify(value));
const local = { cur: 'p1', profs: { p1: { name: 'Local', data: { levels: [{ id: 'local', name: 'Local' }], order: { classic: [], platform: [] }, wishlists: [], tags: [] } } } };
const level = (id = 'n1') => ({ id, name: 'Level ' + id, kind: 'classic', attN: 10 });

function device(server = new FakeSyncServer(), storage = {}) {
    const timers = new Map(), listeners = { window: {}, document: {} }, toasts = [], nodes = {}, errors = [];
    let timerId = 0, draws = 0, blocked = false, now = 0;
    const migrationPrompts = [];
    storage.gdp ||= JSON.stringify(local);
    storage.gl ||= 'en';
    storage.removeItem ||= function(key) { delete this[key]; };
    const document = { visibilityState: 'visible', body: {}, querySelector: selector => nodes[selector] || (blocked ? {} : null),
        addEventListener(name, handler) { (listeners.document[name] ||= new Set()).add(handler); },
        removeEventListener(name, handler) { listeners.document[name]?.delete(handler); } };
    const window = {
        addEventListener(name, handler) { (listeners.window[name] ||= new Set()).add(handler); },
        removeEventListener(name, handler) { listeners.window[name]?.delete(handler); }
    };
    const env = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/account.js', 'js/cloud-model.js'], {
        document, window, localStorage: storage, navigator: { onLine: true }, URL, TypeError, Date: class extends Date { static now() { return now; } },
        setTimeout(work, delay) { timers.set(++timerId, { work, at: now + delay, delay }); return timerId; },
        clearTimeout(id) { timers.delete(id); },
        console: { error(error) { errors.push(error); } },
        render() { draws++; }, showToast(text) { toasts.push(text); }, showAlert(text) { toasts.push(text); },
        loadCloud: async () => server, queueMicrotask,
        migrationDialog: () => 'Migration preview', openModal: html => migrationPrompts.push(html)
    });
    return { ...env, server, storage, timers, listeners, toasts, document, nodes, errors, migrationPrompts,
        load(files = syncScripts) { env.load(files); },
        start: () => env.app(`startCloudSync({ id: 'owner' }, ${JSON.stringify(server.profile)})`),
        data: () => plain(env.app('profile')),
        status: () => plain(env.app('cloudSync')),
        get draws() { return draws; }, set blocked(value) { blocked = value; },
        async tick(ms) {
            now += ms;
            const due = [...timers].filter(([, task]) => task.at <= now);
            for (const [id, task] of due) { timers.delete(id); await task.work(); }
        },
        async emit(target, name, event = {}) { for (const handler of listeners[target][name] || []) await handler(event); }
    };
}

test('first sign-in uses empty cloud data and leaves the local profile untouched', async () => {
    const page = device();
    page.load();
    await page.start();
    assert.deepEqual(page.data().levels, []);
    assert.equal(page.app('cloudUser'), 'owner');
    assert.equal(page.storage.gdp, JSON.stringify(local));
    assert.equal(page.status().status, 'saved');
    assert.ok(page.storage['gcloud:owner']);
});

async function ready(server, storage) {
    const page = device(server, storage);
    page.load();
    await page.start();
    return page;
}

test('adds, edits, reorders and deletes rows with server versions and composite keys', async () => {
    const page = await ready();
    page.app(`profile.levels.push(${JSON.stringify(level())}, ${JSON.stringify(level('n2'))});
        profile.tags.push({ name: 'Focus/Next', color: '#123456' });
        profile.levels[0].tags = ['Focus/Next']; profile.levels[0].notes = 'Note';
        profile.wishlists.push({ id: 'w1', name: 'Wishlist', items: [{ id: 'i1', name: 'Item', status: 'todo' }, { id: 'i2', name: 'Second', status: 'todo' }] }); save();`);
    await page.app('pushCloud()');
    assert.equal(page.server.rows('levels')[0].version, 1);
    assert.equal(page.server.rows('level_tags')[0].tag_name, 'Focus/Next');
    assert.ok(page.server.rows('levels')[0].created_at);
    page.app(`profile.levels[0].attN = 20; profile.order.classic = ['n2', 'n1']; profile.wishlists[0].items.reverse(); profile.wishlists[0].items[0].name = 'Changed'; profile.tags[0].color = '#abcdef'; save();`);
    await page.app('pushCloud()');
    assert.equal(page.server.rows('levels')[0].attempts_normal, 20);
    assert.equal(page.server.rows('levels')[0].version, 2);
    assert.deepEqual(page.server.rows('list_orders').find(row => row.kind === 'classic').level_ids, ['n2', 'n1']);
    assert.deepEqual(page.server.rows('wishlists')[0].item_ids, ['i2', 'i1']);
    assert.equal(page.server.rows('wishlist_items').find(row => row.id === 'i2').name, 'Changed');
    page.app(`profile.levels = []; profile.order.classic = []; profile.tags = []; profile.wishlists = []; save();`);
    await page.app('pushCloud()');
    for (const table of ['levels', 'level_notes', 'level_tags', 'tags', 'wishlists', 'wishlist_items']) assert.equal(page.server.rows(table).length, 0, table);
    const deletes = page.server.calls.filter(call => call.name === 'sync_push').flatMap(call => call.changes).filter(change => change.row === null);
    assert.ok(deletes.some(change => change.table === 'level_tags' && change.key.tag_name === 'Focus/Next' && change.key.level_id === 'n1'));
    assert.ok(deletes.every(change => Number.isInteger(change.version)));
    const cache = JSON.parse(page.storage['gcloud:owner']);
    for (const entry of Object.values(cache.snapshot)) for (const column of ['user_id', 'version', 'created_at', 'updated_at']) assert.ok(!(column in entry.row));
});

async function pair() {
    const a = await ready();
    a.app(`profile.levels.push(${JSON.stringify(level())}); save();`);
    await a.app('pushCloud()');
    const b = await ready(a.server);
    return [a, b];
}

test('two devices preserve different field edits and report same-field conflicts', async () => {
    const [a, b] = await pair();
    a.app(`profile.levels[0].attN = 20; save();`);
    b.app(`profile.levels[0].tN = 30; save();`);
    await a.app('pushCloud()'); await b.app('pushCloud()'); await a.app('pullCloud()');
    assert.equal(a.data().levels[0].attN, 20);
    assert.equal(a.data().levels[0].tN, 30);
    a.app(`profile.levels[0].name = 'Winner'; save();`);
    b.app(`profile.levels[0].name = 'Loser'; save();`);
    await a.app('pushCloud()'); await b.app('pushCloud()');
    assert.equal(b.data().levels[0].name, 'Winner');
    assert.ok(b.toasts.some(text => text.includes('Winner')));
});

for (const deletionFirst of [true, false]) test(`deletion versus edit reconciles when deletion goes ${deletionFirst ? 'first' : 'last'}`, async () => {
    const [a, b] = await pair();
    a.app('profile.levels = []; save();'); b.app('profile.levels[0].attN = 99; save();');
    await (deletionFirst ? a : b).app('pushCloud()');
    await (deletionFirst ? b : a).app('pushCloud()');
    await a.app('pullCloud()'); await b.app('pullCloud()');
    assert.equal(a.data().levels.length, deletionFirst ? 0 : 1);
    assert.equal(b.data().levels.length, deletionFirst ? 0 : 1);
    assert.ok((deletionFirst ? b : a).toasts.some(text => text.includes('Level n1')));
});

test('pull preserves local changes, merges remote edits and handles remote deletion', async () => {
    const [a, b] = await pair();
    b.app(`profile.levels[0].tN = 50; save();`);
    a.app(`profile.levels[0].attN = 40; save();`); await a.app('pushCloud()');
    await b.app('pullCloud()');
    assert.equal(b.data().levels[0].attN, 40); assert.equal(b.data().levels[0].tN, 50);
    await a.app('pullCloud()');
    b.app(`profile.levels[0].attN = 100; save();`);
    a.app(`profile.levels = []; save();`); await a.app('pushCloud()');
    await b.app('pullCloud()'); assert.equal(b.data().levels.length, 0);
    assert.ok(b.toasts.some(text => text.includes('Level n1')));
});

test('offline changes survive reload and reconnect with increasing retry delays', async () => {
    const a = await ready(); a.server.failure = 'offline';
    a.app(`profile.levels.push(${JSON.stringify(level())}); save();`); await a.app('pushCloud()');
    assert.equal(a.status().status, 'offline');
    for (const delay of [5000, 15000, 60000, 300000]) {
        assert.ok([...a.timers.values()].some(task => task.delay === delay)); await a.tick(delay);
    }
    const b = await ready(a.server, a.storage);
    assert.equal(b.data().levels[0].id, 'n1'); assert.equal(b.status().status, 'offline');
    b.server.failure = null; await b.emit('window', 'online');
    assert.equal(b.server.rows('levels')[0].id, 'n1'); assert.equal(b.status().status, 'saved');
});

test('a rejected row stays local and is retried only after it changes', async () => {
    const page = await ready(); page.server.reject = change => change.table === 'levels' ? 'row_limit_exceeded' : null;
    page.app(`profile.levels.push(${JSON.stringify(level())}); save();`); await page.app('pushCloud()');
    assert.equal(page.status().status, 'error'); assert.equal(page.data().levels.length, 1);
    const count = page.server.calls.filter(call => call.name === 'sync_push').length;
    await page.app('pushCloud()'); assert.equal(page.server.calls.filter(call => call.name === 'sync_push').length, count);
    page.server.reject = () => null;
    page.app(`profile.levels[0].name = 'Valid'; save();`); await page.app('pushCloud()');
    assert.equal(page.server.rows('levels')[0].name, 'Valid'); assert.equal(page.status().status, 'saved');
});

test('429 holds writes for sixty seconds even if another save occurs', async () => {
    const page = await ready(); page.server.failure = { status: 429, code: 'PT429' };
    page.app(`profile.levels.push(${JSON.stringify(level())}); save();`); await page.app('pushCloud()');
    const count = page.server.calls.length; page.server.failure = null;
    page.app('profile.levels[0].attN = 11; save();'); await page.tick(1000);
    assert.equal(page.server.calls.length, count);
    await page.tick(59000); assert.equal(page.server.rows('levels')[0].attempts_normal, 11);
});

test('batches contain at most 500 ordered changes', async () => {
    const page = await ready(); page.app(`for (let i = 0; i < 510; i++) profile.levels.push({ id: 'n' + i, name: 'Level', kind: 'classic', notes: 'Note' }); save();`);
    await page.app('pushCloud()');
    const batches = page.server.calls.filter(call => call.name === 'sync_push' && call.changes.some(change => change.table === 'levels'));
    assert.equal(batches[0].changes.length, 500); assert.equal(page.server.rows('levels').length, 510);
    assert.ok(page.server.calls.filter(call => call.name === 'sync_push').every(call => call.changes.length <= 500));
    assert.equal(page.server.rows('level_notes').length, 510);
});

test('revision polling skips unchanged data and runs only while visible', async () => {
    const [a, b] = await pair();
    const count = b.server.calls.filter(call => call.name === 'sync_pull').length;
    await b.app('checkCloudRevision()'); assert.equal(b.server.calls.filter(call => call.name === 'sync_pull').length, count);
    a.app('profile.levels[0].attN = 30; save();'); await a.app('pushCloud()');
    await b.app('checkCloudRevision()'); assert.equal(b.data().levels[0].attN, 30);
    b.document.visibilityState = 'hidden'; const before = b.server.calls.length; await b.tick(60000);
    assert.equal(b.server.calls.length, before);
    b.document.visibilityState = 'visible'; await b.emit('document', 'visibilitychange');
    assert.ok(b.server.calls.length > before);
});

test('sign-out clears cache and listeners; another account removes old account caches', async () => {
    const page = await ready(); page.app('stopCloudSync(true)');
    assert.equal(page.storage['gcloud:owner'], undefined); assert.equal(page.app('cloudUser'), null);
    assert.equal(page.data().levels[0].id, 'local'); assert.equal(page.timers.size, 0);
    page.storage['gcloud:old'] = '{}'; await page.app(`startCloudSync({ id: 'other' }, {})`);
    assert.equal(page.storage['gcloud:old'], undefined);
    page.app('stopCloudSync(true)'); for (const handlers of Object.values(page.listeners.window)) assert.equal(handlers.size, 0);
});

test('settings sync both ways and cached settings restore on an offline start', async () => {
    const [a, b] = await pair(); a.app(`ui.lang = 'es'; ui.theme = 'night'; save();`); await a.app('pushCloud()');
    await b.app('pullCloud()'); assert.deepEqual(plain(b.app('currentSettings()')), { lang: 'es', theme: 'night' });
    assert.equal(b.storage.gl, 'es'); assert.equal(b.storage.gt, 'night');
    b.server.failure = 'offline'; const reload = await ready(b.server, b.storage);
    assert.equal(reload.app('ui.theme'), 'night'); assert.equal(reload.app('ui.lang'), 'es');
});

test('pull defers full rendering while a form, dialog or dropdown is open', async () => {
    const [a, b] = await pair(); a.app(`profile.levels[0].attN = 50; save();`); await a.app('pushCloud()');
    b.blocked = true; const before = b.draws; await b.app('pullCloud()');
    assert.equal(b.draws, before); assert.equal(b.data().levels[0].attN, 50);
    b.blocked = false; b.app('render()'); assert.equal(b.draws, before + 1);
});

test('status sentences announce pending counts, errors and retry accessibly', async () => {
    const page = await ready();
    assert.match(page.app('cloudStatus()'), /role=status aria-atomic=true/); assert.match(page.app('cloudStatus()'), /Saved/);
    assert.ok(page.app('cloudStatus().includes(ICONS.check)'));
    page.app(`cloudSync.status = 'saving'`); assert.match(page.app('cloudStatus()'), /Saving…/);
    assert.ok(page.app('cloudStatus().includes(ICONS.sync)'));
    page.app(`cloudSync.status = 'offline'; cloudSync.pending = 1`);
    assert.match(page.app('cloudStatus()'), /Offline · 1 change waiting/); assert.match(page.app('cloudStatus()'), /data-act=csync[^>]*aria-label="Offline · 1 change waiting · Retry"/);
    assert.match(page.app('cloudStatus()'), /class=cloudtxt/);
    assert.doesNotMatch(page.app('cloudStatus()'), /style=/);
    assert.ok(page.app('cloudStatus().includes(ICONS.warning)'));
    page.app('cloudSync.pending = 3'); assert.match(page.app('cloudStatus()'), /3 changes waiting/);
    page.app(`cloudSync.status = 'error'; cloudSync.error = '<reason>'`); assert.match(page.app('cloudStatus()'), /Not saved: &lt;reason&gt;/);
    assert.ok(page.app('cloudStatus().includes(ICONS.warning)'));
});

test('saves during an active push are sent afterwards and sign-out ignores stale responses', async () => {
    const page = await ready(); let release;
    page.server.before = name => name === 'sync_push' ? new Promise(resolve => { release = resolve; }) : null;
    page.app(`profile.levels.push(${JSON.stringify(level())}); save();`); const pushing = page.app('pushCloud()');
    await new Promise(resolve => setImmediate(resolve));
    page.app('profile.levels[0].attN = 70; save();'); page.server.before = null; release(); await pushing;
    assert.equal(page.server.rows('levels')[0].attempts_normal, 70);
    page.server.before = name => name === 'sync_pull' ? new Promise(resolve => { release = resolve; }) : null;
    const pulling = page.app('pullCloud()'); await new Promise(resolve => setImmediate(resolve));
    page.app('stopCloudSync(true)'); release(); await pulling;
    assert.equal(page.data().levels[0].id, 'local'); assert.equal(page.storage['gcloud:owner'], undefined);
});

test('network profile failure restores a signed-in account from its cache', async () => {
    const page = await ready(); page.app('stopCloudSync(false)'); page.server.failure = 'offline';
    page.app(`ensureOwnProfile = async () => { throw { message: 'TypeError: Failed to fetch' }; }`);
    await page.app(`applyAccountSession('SIGNED_IN', { user: { id: 'owner' } })`);
    assert.equal(page.app('account.status'), 'signed-in'); assert.equal(page.status().status, 'offline');
    page.server.failure = null; await page.emit('window', 'online');
    assert.equal(page.app('account.profile.display_name'), 'Player');
});

test('confirmed inserts keep server creation order across a pull and later local inserts', async () => {
    const page = await ready();
    page.app(`profile.levels.push(${JSON.stringify(level('z'))}); save();`); await page.app('pushCloud()');
    const cache = JSON.parse(page.storage['gcloud:owner']);
    assert.equal(cache.snapshot['levels:z'].createdAt, null);
    await page.app('pullCloud()');
    assert.equal(JSON.parse(page.storage['gcloud:owner']).snapshot['levels:z'].createdAt, page.server.rows('levels')[0].created_at);
    page.app(`profile.levels.push(${JSON.stringify(level('a'))}); save();`);
    page.server.failure = 'offline'; await page.app('pullCloud()'); page.server.failure = null;
    await page.app('pullCloud()');
    assert.deepEqual(page.data().levels.map(entry => entry.id), ['z', 'a']);
});

test('a successful push also observes changes to other rows included in its returned revision', async () => {
    const [a, b] = await pair();
    a.app(`profile.tags.push({ name: 'Remote tag', color: '#abcdef' }); save();`); await a.app('pushCloud()');
    const pulls = a.server.calls.filter(call => call.name === 'sync_pull').length;
    b.app(`profile.levels[0].attN = 80; save();`); await b.app('pushCloud()');
    assert.equal(a.server.calls.filter(call => call.name === 'sync_pull').length, pulls + 1);
    await b.app('checkCloudRevision()');
    assert.deepEqual(b.data().tags, [{ name: 'Remote tag', color: '#abcdef' }]);
});

test('blocked cache storage does not interrupt account sync', async () => {
    const page = device(); page.load();
    page.context.localStorage = new Proxy({}, { get() { throw Error('Storage blocked'); }, set() { throw Error('Storage blocked'); }, ownKeys() { throw Error('Storage blocked'); } });
    await page.start();
    page.app(`profile.levels.push(${JSON.stringify(level())}); save();`); await page.app('pushCloud()');
    assert.equal(page.server.rows('levels')[0].id, 'n1'); page.app('stopCloudSync(true)');
});

test('storage events ignore legacy data and reload the active account cache only outside forms', async () => {
    const [a, b] = await pair(); a.load(['js/events.js']);
    b.app(`profile.levels[0].attN = 90; save();`); await b.app('pushCloud()');
    a.storage['gcloud:owner'] = b.storage['gcloud:owner'];
    await a.emit('window', 'storage', { key: 'gdp', newValue: JSON.stringify(local) });
    assert.equal(a.data().levels[0].attN, 10);
    a.blocked = true; await a.emit('window', 'storage', { key: 'gcloud:owner', newValue: a.storage['gcloud:owner'] });
    assert.equal(a.data().levels[0].attN, 10);
    a.blocked = false; await a.emit('window', 'storage', { key: 'gcloud:owner', newValue: a.storage['gcloud:owner'] });
    assert.equal(a.data().levels[0].attN, 90);
});

test('language and theme actions save account preferences and Retry pulls remote changes', async () => {
    const page = await ready(); page.load(['js/events.js']);
    page.context.openModal = () => {};
    page.app(`reopenPause = () => {}; ACTIONS.lang({ dataset: { v: 'es' }, closest: () => null }); ACTIONS.theme({ dataset: { v: 'night' } });`);
    await page.app('pushCloud()');
    assert.equal(page.server.rows('user_settings')[0].lang, 'es'); assert.equal(page.server.rows('user_settings')[0].theme, 'night');
    page.server.profile.display_name = 'Updated'; page.server.revision++;
    await page.app('ACTIONS.csync()'); assert.equal(page.app('account.profile.display_name'), 'Updated');
    const pulls = page.server.calls.filter(call => call.name === 'sync_pull').length;
    await page.app('ACTIONS.csync()');
    assert.ok(page.server.calls.filter(call => call.name === 'sync_pull').length > pulls);
});

test('a pull during a write-budget cooldown does not bypass the wait', async () => {
    const page = await ready(); page.server.failure = { code: 'PT429', status: 429 };
    page.app(`profile.levels.push(${JSON.stringify(level())}); save();`); await page.app('pushCloud()');
    page.server.failure = null;
    await page.app('pullCloud()'); assert.equal(page.server.rows('levels').length, 0);
    await page.tick(60000); assert.equal(page.server.rows('levels').length, 1);
});

test('account switching stops the previous sync before waiting for the next profile', async () => {
    const page = await ready(); page.app(`account.user = { id: 'owner' }; account.status = 'signed-in'`);
    let release;
    page.context.profileRequest = new Promise(resolve => { release = resolve; });
    page.app('ensureOwnProfile = () => profileRequest');
    const pending = page.app(`applyAccountSession('SIGNED_IN', { user: { id: 'other' } })`);
    assert.equal(page.app('cloudUser'), null); assert.equal(page.storage['gcloud:owner'], undefined);
    release({ ...page.server.profile, id: 'other' }); await pending;
    assert.equal(page.app('cloudUser'), 'other');
});

test('write-only network failures keep increasing the retry delay after successful pulls', async () => {
    const page = await ready();
    page.server.before = name => { if (name === 'sync_push') throw new TypeError('Failed to fetch'); };
    page.app(`profile.levels.push(${JSON.stringify(level())}); save();`); await page.app('pushCloud()');
    for (const delay of [5000, 15000, 60000, 300000]) {
        assert.ok([...page.timers.values()].some(task => task.delay === delay), `retry after ${delay}`);
        await page.tick(delay);
    }
});

test('account Home and shell hide local file actions and show the account colours and status', async () => {
    const page = await ready(); page.load(['js/components/home.js', 'js/components/shell.js']);
    page.app(`account.status = 'signed-in'`);
    let html = page.app('profileSwitcher()');
    assert.match(html, /obj pbtn/); assert.match(html, /Player/); assert.match(html, /#123456/); assert.match(html, /Saved/);
    assert.doesNotMatch(html, /data-act=(?:imp|exp|psel)|popovertarget=pmenu|Choose a username/);
    assert.doesNotMatch(page.app('paletteButtons()'), /data-act=exp/);
    assert.doesNotMatch(page.app('pauseUI()'), /data-act=imp/);
    page.context.alerts = () => []; page.context.accountButton = () => '';
    html = page.app('topBar()'); assert.equal((html.match(/id=cloudst/g) || []).length, 1);
    page.app(`account.profile.username = 'player'`); assert.match(page.app('profileSwitcher()'), /@player/);
    page.app(`cloudSync.status = 'offline'; cloudSync.pending = 1`);
    html = page.app('profileSwitcher()');
    assert.match(html, /Offline · 1 change waiting/); assert.match(html, /data-act=csync/);
    assert.doesNotMatch(html, /<button[^>]*data-act=aprofile[^>]*>(?:(?!<\/button>)[\s\S])*<button/);
    page.app(`account.status = 'signed-out'; stopCloudSync(true)`);
    page.context.localProfileSummary = () => 'Local';
    assert.match(page.app('profileSwitcher()'), /data-act=localdata/);
    assert.doesNotMatch(page.app('profileSwitcher()'), /data-act=imp/); assert.doesNotMatch(page.app('paletteButtons()'), /data-act=exp/);
});

test('conflict notices name at most three entries and keep valid selections', async () => {
    const a = await ready();
    a.app(`for (let i = 0; i < 5; i++) profile.levels.push({ id: 'n' + i, name: 'Level ' + i, kind: 'classic' });
        profile.wishlists.push({ id: 'w1', name: 'Wishlist', items: [] }); save();`); await a.app('pushCloud()');
    const b = await ready(a.server);
    a.app(`profile.levels.forEach(entry => entry.attN = 10); save();`); await a.app('pushCloud()');
    b.app(`profile.levels.forEach(entry => entry.attN = 20); ui.sel = 'n1'; ui.wl = 'w1'; save();`); await b.app('pushCloud()');
    assert.match(b.toasts.at(-1), /Level 0, Level 1, Level 2 and 2 more/);
    assert.equal(b.app('ui.sel'), 'n1'); assert.equal(b.app('ui.wl'), 'w1');
    a.app(`profile.levels = []; profile.wishlists = []; save();`); await a.app('pushCloud()'); await b.app('pullCloud()');
    assert.equal(b.app('ui.sel'), null); assert.equal(b.app('ui.wl'), null);
});

test('saves debounce for one second and update status without a full render', async () => {
    const page = await ready();
    page.nodes['#cloudst'] = { outerHTML: '' }; page.nodes['[data-cloud-status]'] = { textContent: '' };
    const before = page.draws, pushes = page.server.calls.filter(call => call.name === 'sync_push').length;
    page.app(`profile.levels.push(${JSON.stringify(level())}); save();`); await page.tick(500);
    page.app(`profile.levels[0].attN = 99; save();`); await page.tick(999);
    assert.equal(page.server.calls.filter(call => call.name === 'sync_push').length, pushes);
    assert.equal(page.draws, before); assert.match(page.nodes['#cloudst'].outerHTML, /Saving…/);
    assert.equal(page.nodes['[data-cloud-status]'].textContent, 'Saving…');
    await page.tick(1); assert.equal(page.server.rows('levels')[0].attempts_normal, 99);
    assert.match(page.nodes['#cloudst'].outerHTML, /Saved/);
});

test('parent deletion cascades and a second device can confirm missing child deletes', async () => {
    const a = await ready();
    a.app(`profile.levels.push({ id: 'n1', name: 'Level', kind: 'classic', notes: 'Note', tags: ['Tag'] });
        profile.tags.push({ name: 'Tag', color: '#123456' }); save();`); await a.app('pushCloud()');
    const b = await ready(a.server);
    const current = a.server.rows('levels')[0];
    await a.server.rpc('sync_push', { changes: [{ table: 'levels', key: { id: 'n1' }, version: current.version, row: null }] });
    b.app('profile.levels = []; save();'); await b.app('pushCloud()');
    for (const table of ['levels', 'level_notes', 'level_tags']) assert.equal(a.server.rows(table).length, 0);
    assert.equal(b.status().status, 'saved');
});

test('unsolicited signed-out auth events retain caches even before sync has started', async () => {
    const page = device(); page.load(); page.storage['gcloud:previous'] = '{}';
    await page.app(`applyAccountSession('SIGNED_OUT', null)`);
    assert.equal(page.storage['gcloud:previous'], '{}');
});

test('offline session restoration preserves cached edits before the first profile request', async () => {
    const a = await ready(); a.server.failure = 'offline';
    a.app(`profile.levels.push(${JSON.stringify(level())}); save();`);
    const b = device(a.server, a.storage); b.load();
    b.app(`ensureOwnProfile = async () => { throw new TypeError('Failed to fetch'); }`);
    await b.app(`applyAccountSession('INITIAL_SESSION', { user: { id: 'owner' } })`);
    assert.equal(b.app('account.status'), 'signed-in'); assert.equal(b.data().levels[0].id, 'n1');
});

test('account preference actions tolerate blocked storage', async () => {
    const page = await ready(); page.load(['js/events.js']);
    page.context.localStorage = new Proxy({}, { get() { throw Error('Storage blocked'); }, set() { throw Error('Storage blocked'); } });
    page.app(`reopenPause = () => {}; ACTIONS.lang({ dataset: { v: 'es' }, closest: () => null }); ACTIONS.theme({ dataset: { v: 'night' } });`);
    assert.equal(page.app('ui.lang'), 'es'); assert.equal(page.app('ui.theme'), 'night');
});

test('saving only local changes adopts the revision without downloading the account', async () => {
    const page = await ready(), pulls = page.server.calls.filter(call => call.name === 'sync_pull').length;
    page.app(`profile.levels.push(${JSON.stringify(level())}); save();`);
    const before = JSON.parse(page.storage['gcloud:owner']).revision;
    await page.app('pushCloud()');
    assert.equal(page.server.calls.filter(call => call.name === 'sync_pull').length, pulls);
    assert.notEqual(JSON.parse(page.storage['gcloud:owner']).revision, before);
    assert.equal(JSON.parse(page.storage['gcloud:owner']).revision, String(page.server.revision));
    await page.app('checkCloudRevision()');
    assert.equal(page.server.calls.filter(call => call.name === 'sync_pull').length, pulls);
});

function boot(page, user = { id: 'owner' }) {
    page.storage[page.app(`'sb-' + new URL(SUPABASE_URL).hostname.split('.')[0] + '-auth-token'`)] = JSON.stringify({ user });
    page.context.initAccount = () => {};
    page.context.autoSyncIfStale = () => {};
    const frames = [];
    page.context.render = () => frames.push({ profile: page.data(), account: plain(page.app('account')), status: page.status() });
    page.load(['js/main.js']);
    return frames;
}

for (const online of [false, true]) test(`cached startup precedes the first render, with online=${online}`, async () => {
    const a = await ready();
    a.app(`profile.levels.push(${JSON.stringify(level())}); ui.lang = 'es'; ui.theme = 'night'; save();`);
    const page = device(a.server, a.storage); page.load(); page.context.navigator.onLine = online;
    const calls = a.server.calls.length, frames = boot(page);
    assert.equal(frames.length, 1);
    assert.equal(frames[0].profile.levels[0].id, 'n1');
    assert.equal(frames[0].account.status, 'signed-in');
    assert.equal(frames[0].account.profile.display_name, 'Player');
    assert.equal(frames[0].status.status, online ? 'saving' : 'offline');
    assert.equal(page.app('ui.theme'), 'night'); assert.equal(page.app('ui.lang'), 'es');
    assert.equal(a.server.calls.length, calls);
    page.app(`profile.levels[0].attN = 70; save();`);
    await page.tick(1000);
    assert.equal(a.server.calls.length, calls);
    page.app(`ensureOwnProfile = () => { throw Error('Cached startup must not wait for a profile request'); }`);
    let release;
    a.server.before = name => name === 'sync_pull' ? new Promise(resolve => { release = resolve; }) : null;
    const confirmed = page.app(`applyAccountSession('INITIAL_SESSION', { user: { id: 'owner', email: 'player@example.com' } })`);
    await new Promise(setImmediate);
    assert.equal(frames.length, 1);
    assert.equal(page.data().levels[0].attN, 70);
    a.server.before = null; release(); await confirmed;
    assert.equal(a.server.rows('levels')[0].attempts_normal, 70);
    assert.equal(page.status().status, 'saved');
    assert.equal(a.server.calls[calls].name, 'sync_pull');
});

test('cached startup parses stored sessions defensively and always restores accounts', async () => {
    const a = await ready();
    for (const value of ['{', 'null', '{}', '{"user":null}', '{"user":{"id":7}}']) {
        const page = device(a.server, { ...a.storage }); page.load();
        const key = page.app(`'sb-' + new URL(SUPABASE_URL).hostname.split('.')[0] + '-auth-token'`);
        page.storage[key] = value;
        assert.doesNotThrow(() => page.app('restoreCloudSync()'));
        assert.equal(page.app('cloudUser'), null);
    }
    const page = device(a.server, a.storage); page.load();
    const frames = boot(page);
    assert.deepEqual(frames[0].profile.levels, []);
    assert.equal(page.app('cloudUser'), 'owner');
    page.context.localStorage = new Proxy({}, { get() { throw Error('Blocked'); } });
    assert.doesNotThrow(() => page.app('restoreCloudSync()'));
});

test('unsolicited sign-out retains pending edits for the next same-user sign-in', async () => {
    const a = await ready();
    a.app(`profile.levels.push(${JSON.stringify(level())}); save();`);
    const page = device(a.server, a.storage); page.load(); boot(page);
    await page.app(`applyAccountSession('SIGNED_OUT', null)`);
    assert.equal(page.app('cloudUser'), null); assert.equal(page.data().levels[0].id, 'local');
    assert.ok(page.storage['gcloud:owner']);
    page.context.ensureOwnProfile = async () => a.server.profile;
    await page.app(`applyAccountSession('SIGNED_IN', { user: { id: 'owner' } })`);
    assert.equal(a.server.rows('levels')[0].id, 'n1');
});

test('a missing session stops cached mode without removing pending edits', async () => {
    const a = await ready(), page = device(a.server, a.storage); page.load(); boot(page);
    delete page.storage[page.app(`'sb-' + new URL(SUPABASE_URL).hostname.split('.')[0] + '-auth-token'`)];
    await page.app(`applyAccountSession('INITIAL_SESSION', null)`);
    assert.equal(page.app('cloudUser'), null); assert.equal(page.data().levels[0].id, 'local');
    assert.ok(page.storage['gcloud:owner']);
});

test('an explicit sign-out clears cached mode even if its auth event arrives first', async () => {
    const a = await ready(), page = device(a.server, a.storage); page.load(); boot(page);
    page.context.startAccount = async () => ({ auth: { signOut: async () => {
        await page.app(`applyAccountSession('SIGNED_OUT', null)`);
        return { error: null };
    } } });
    await page.app('signOutAccount()');
    assert.equal(page.storage['gcloud:owner'], undefined);
});

test('a remote revision gap in an earlier batch still triggers one pull at the end', async () => {
    const [a, b] = await pair();
    a.app(`profile.tags.push({ name: 'Remote tag', color: '#abcdef' }); save();`); await a.app('pushCloud()');
    b.app(`for (let i = 0; i < 501; i++) profile.levels.push({ id: 'extra' + i, name: 'Extra ' + i, kind: 'classic' }); save();`);
    const calls = a.server.calls.length;
    await b.app('pushCloud()');
    const changes = a.server.calls.slice(calls);
    assert.equal(changes.filter(call => call.name === 'sync_push').length, 2);
    assert.equal(changes.filter(call => call.name === 'sync_pull').length, 1);
    assert.deepEqual(b.data().tags, [{ name: 'Remote tag', color: '#abcdef' }]);
});

test('an offline expired session keeps cached edits until auth refresh confirms the user', async () => {
    const a = await ready();
    a.app(`profile.levels.push(${JSON.stringify(level())}); save();`);
    const page = device(a.server, a.storage); page.load(); boot(page);
    const calls = a.server.calls.length, draws = page.draws;
    await page.app(`applyAccountSession('INITIAL_SESSION', null)`);
    assert.equal(page.app('cloudUser'), 'owner'); assert.equal(page.app('account.status'), 'signed-in');
    assert.equal(page.status().status, 'offline'); assert.ok(page.status().pending > 0);
    assert.equal(page.data().levels[0].id, 'n1'); assert.equal(page.draws, draws);
    assert.equal(a.server.calls.length, calls); assert.equal(page.app('cloudSession.started'), false);
    await page.app(`applyAccountSession('TOKEN_REFRESHED', { user: { id: 'owner' } })`);
    assert.equal(page.app('cloudSession.started'), true); assert.equal(page.status().status, 'saved');
    assert.equal(a.server.rows('levels')[0].id, 'n1');
});

test('a null initial session leaves cached mode when its stored session belongs to someone else', async () => {
    const a = await ready(), page = device(a.server, a.storage); page.load(); boot(page);
    page.storage[page.app(`'sb-' + new URL(SUPABASE_URL).hostname.split('.')[0] + '-auth-token'`)] = JSON.stringify({ user: { id: 'other' } });
    await page.app(`applyAccountSession('INITIAL_SESSION', null)`);
    assert.equal(page.app('cloudUser'), null); assert.equal(page.app('account.status'), 'signed-out');
    assert.equal(page.data().levels[0].id, 'local'); assert.ok(page.storage['gcloud:owner']);
});

test('Retry refreshes an unconfirmed session, keeps offline edits on failure and starts sync on success', async () => {
    const a = await ready(); a.app(`profile.levels.push(${JSON.stringify(level())}); save();`);
    const page = device(a.server, a.storage); page.load(); boot(page); page.load(['js/events.js']);
    let attempts = 0;
    a.server.auth = { refreshSession: async () => {
        attempts++;
        if (attempts === 1) return { data: null, error: { message: 'TypeError: Failed to fetch' } };
        return { data: { session: { user: { id: 'owner' } } }, error: null };
    } };
    await page.app('ACTIONS.csync()');
    assert.equal(attempts, 1); assert.equal(page.app('cloudUser'), 'owner');
    assert.equal(page.status().status, 'offline'); assert.equal(page.app('cloudSession.started'), false);
    assert.equal(page.data().levels[0].id, 'n1');
    await page.app('ACTIONS.csync()');
    assert.equal(attempts, 2); assert.equal(page.app('cloudSession.started'), true);
    assert.equal(page.status().status, 'saved'); assert.equal(a.server.rows('levels')[0].id, 'n1');
});

test('an offline save updates the pending count without showing Saving, including during a retry', async () => {
    const page = await ready(); page.server.failure = 'offline';
    page.app(`profile.levels.push(${JSON.stringify(level())}); save();`); await page.app('pushCloud()');
    const pending = page.status().pending;
    page.app(`profile.levels.push(${JSON.stringify(level('n2'))}); save();`);
    assert.equal(page.status().status, 'offline'); assert.ok(page.status().pending > pending);
    assert.match(page.app('cloudStatusSentence()'), /Offline · \d+ changes waiting/);
    page.server.failure = null;
    let release;
    page.server.before = name => name === 'sync_push' ? new Promise(resolve => { release = resolve; }) : null;
    const retry = page.tick(5000); await new Promise(setImmediate);
    assert.equal(page.status().status, 'offline');
    page.server.before = null; release(); await retry;
    assert.equal(page.status().status, 'saved');
});

for (const message of ['Cannot read properties of undefined', 'Failed to fetch']) test(`sync failures classify TypeError: ${message}`, async () => {
    const page = await ready(), failure = new TypeError(message), network = message === 'Failed to fetch';
    page.server.before = name => { if (name === 'sync_push') throw failure; };
    page.app(`profile.levels.push(${JSON.stringify(level())}); save();`); await page.app('pushCloud()');
    assert.equal(page.status().status, network ? 'offline' : 'error');
    assert.equal([...page.timers.values()].some(task => task.work === page.app('retryCloudSync')), network);
    assert.deepEqual(page.errors, network ? [] : [failure]);
    if (!network) assert.match(page.app('cloudStatusSentence()'), /Not saved:/);
});

test('a programming error cancels an earlier network retry', async () => {
    const page = await ready(); page.server.failure = 'offline';
    page.app(`profile.levels.push(${JSON.stringify(level())}); save();`); await page.app('pushCloud()');
    page.app(`cloudFailed(new TypeError('Cannot read properties of undefined'), cloudSession)`);
    assert.equal(page.status().status, 'error');
    assert.equal([...page.timers.values()].some(task => task.work === page.app('retryCloudSync')), false);
    assert.equal(page.errors.length, 1);
});


test('migration waits for the first successful pull and resumes after a blocked form closes', async () => {
    const page = device(); page.load(); page.server.failure = 'offline';
    await page.start(); assert.equal(page.migrationPrompts.length, 0); assert.equal(page.app('cloudSession.pulled'), false);
    page.server.failure = null; page.blocked = true;
    await page.app('pullCloud()'); assert.equal(page.migrationPrompts.length, 0); assert.equal(page.app('cloudSession.pulled'), true);
    page.blocked = false; page.app('maybeOfferMigration()'); assert.equal(page.migrationPrompts.length, 1);
});

test('bringing queues durably before a failed push and a reload retries without modifying local backups', async () => {
    const page = await ready();
    page.context.closeModal = () => {};
    const backup = page.storage.gdp;
    await page.app("bringLocalProfile('p1', false)");
    assert.equal(JSON.parse(page.storage['gcloud:owner']).profile.levels[0].id, 'local');
    page.server.failure = 'offline'; await page.app('pushCloud()');
    assert.equal(page.status().status, 'offline'); assert.equal(page.storage.gdp, backup);
    const restored = await ready(page.server, page.storage);
    restored.context.closeModal = () => {};
    restored.server.failure = null; await restored.app('pullCloud()');
    await restored.app("bringLocalProfile('p1', false)"); await restored.app('pushCloud()');
    assert.equal(restored.server.rows('levels').length, 1); assert.equal(restored.server.rows('levels')[0].id, 'local');
    assert.equal(restored.storage.gdp, backup); assert.equal(restored.status().status, 'saved');
});


test('first sign-in pulls populated lists silently and later pull conflicts still notify', async () => {
    const a = await ready();
    a.app(`profile.levels.push(${JSON.stringify(level('classic'))}, ${JSON.stringify(level('platform'))});
        profile.levels[1].kind = 'platform';
        profile.order = { classic: ['classic'], platform: ['platform'] }; save();`);
    await a.app('pushCloud()');
    const b = await ready(a.server);
    assert.deepEqual(b.toasts, []);
    assert.deepEqual(b.data().order, { classic: ['classic'], platform: ['platform'] });
    assert.deepEqual(b.data().levels.map(entry => entry.id), ['classic', 'platform']);
    a.app('profile.levels[0].attN = 20; save()');
    b.app('profile.levels[0].attN = 30; save()');
    await a.app('pushCloud()');
    await b.app('pullCloud()');
    assert.equal(b.data().levels[0].attN, 20);
    assert.deepEqual(b.toasts, ['Changed on another device: Level classic']);
});

test('the first pull after a cached restart still reports conflicts when a revision exists', async () => {
    const [a, b] = await pair();
    b.app('profile.levels[0].attN = 30; save()');
    a.app('profile.levels[0].attN = 20; save()');
    await a.app('pushCloud()');
    const restored = await ready(a.server, b.storage);
    assert.equal(restored.data().levels[0].attN, 20);
    assert.deepEqual(restored.toasts, ['Changed on another device: Level n1']);
});
