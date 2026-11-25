import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const NOW = Date.UTC(2026, 0, 1);
const classic = { kind: 'classic', levelId: '42', name: 'Classic', creator: 'Creator', diff: 'Extreme Demon', rating: 'rated', ar: { s: 'r', p: 250 }, gdl: 320 };
const platform = { ...classic, kind: 'platform', levelId: '43', name: 'Platform', ar: { s: 'r', p: 12 }, gdl: null };
const entry = (level_id, name, position) => ({ level_id, name, position });
const json = (body, ok = true) => ({ ok, json: async () => body });
const responses = {
    d: json([entry(42, 'Classic', 267), entry(95, 'Removed', 999), entry(96, 'Awaiting Placement', 100)]),
    p: json({ data: [entry(43, 'Platform', 15)] }),
    gdl: json({ message: 'success', data: { levels: [{ ingame_id: 42, placement: 338 }] } })
};
const plain = value => JSON.parse(JSON.stringify(value));

function fixture(extra = {}) {
    let now = NOW, saves = 0, renders = 0;
    const requests = [], changes = {}, nodes = {}, docEvents = [], winEvents = [], intervals = [];
    const f = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/sheet.js', 'js/demonlist.js', 'js/api.js'], {
        localStorage: {}, profile: { levels: structuredClone([classic, platform]), wishlists: [] }, store: { cur: 'p1' },
        cloudUser: null, cloudSession: null, ui: { lang: 'en', theme: 'nebula', background: 'grid' },
        save() { saves++; }, render() { renders++; }, fillRatings: async () => {}, navigator: { onLine: true },
        Date: class extends Date { static now() { return now; } },
        document: { body: {}, visibilityState: 'visible', querySelector: selector => nodes[selector], addEventListener: (...args) => docEvents.push(args) },
        window: { addEventListener: (...args) => winEvents.push(args) }, setInterval: (...args) => intervals.push(args),
        fetch: async url => {
            const key = url.includes('demonlist.org') ? 'gdl' : url.endsWith('arepl/levels') ? 'p' : 'd';
            requests.push(key);
            if (changes[key] instanceof Error) throw changes[key];
            return changes[key] ?? responses[key];
        }, ...extra
    });
    return { ...f, setup() { f.load(['js/ranking-sync.js', 'js/components/shell.js']); }, requests, changes, nodes, docEvents, winEvents, intervals,
        advance(ms) { now += ms; }, now: () => now, saves: () => saves, renders: () => renders,
        timestamps: () => JSON.parse(f.context.localStorage.granks || '{}') };
}

test('refresh updates both classic ranks and the platform rank and clears delisted IDs', async () => {
    const f = fixture();
    f.setup();
    const levels = f.context.profile.levels;
    levels.push({ ...classic, levelId: '44', name: 'Removed', rating: 'unrated' }, { ...classic, levelId: '45', name: 'Awaiting' });
    await f.app('syncRankings()');
    assert.deepEqual(plain(levels.map(l => [l.ar, l.gdl])), [[{ s: 'r', p: 267 }, 338], [{ s: 'r', p: 15 }, null], [{ s: 'n', p: null }, null], [{ s: 'p', p: null }, null]]);
    assert.deepEqual(f.timestamps(), { 'local:p1': { aredl: NOW, gdl: NOW } });
    assert.equal(f.saves(), 1);
    await f.app('syncRankings({ force: true })');
    assert.equal(f.saves(), 1);
});

test('a cached list for the other kind cannot clear an existing position', () => {
    const f = fixture({ localStorage: { gar: JSON.stringify([{ k: 'd', i: 42, n: 'Classic', p: 267 }]) } });
    const levels = f.context.profile.levels;
    f.app('matchWithAredl')(levels);
    assert.equal(levels[0].ar.p, 267);
    assert.deepEqual(levels[1].ar, platform.ar);
});

for (const [kind, failed, index] of [['p', 'AREPL', 1], ['d', 'AREDL', 0]]) {
    test(`partial refresh preserves the saved position and cache when ${failed} fails`, async () => {
        const oldEntry = { k: kind, i: index ? 43 : 42, n: 'Old cache', p: 7, u: null };
        const oldStamp = NOW - 1;
        const f = fixture({ localStorage: { gar: JSON.stringify([oldEntry]), granks: JSON.stringify({ 'local:p1': { aredl: oldStamp } }) } });
        f.setup();
        f.changes[kind] = Error('offline');
        await f.app('syncRankings({ force: true })');
        const levels = f.context.profile.levels;
        assert.equal(levels[index].ar.p, index ? 12 : 250);
        assert.equal(levels[1 - index].ar.p, index ? 267 : 15);
        assert.deepEqual(JSON.parse(f.context.localStorage.gar).find(l => l.k === kind), oldEntry);
        assert.equal(f.app('rankingSync.aredl.status'), 'partial');
        assert.equal(f.app('rankingSync.aredl.failed'), failed);
        assert.deepEqual(f.timestamps(), { 'local:p1': { aredl: oldStamp, gdl: NOW } });
    });
}

for (const [label, result] of [
    ['error object', json({ error: 'unavailable' })], ['empty array', json([])], ['numeric ID string', json([entry('42', 'Classic', 1)])],
    ['missing ID', json([entry(undefined, 'Classic', 1)])], ['zero ID', json([entry(0, 'Classic', 1)])],
    ['unsafe ID', json([entry(2 ** 53, 'Classic', 1)])], ['non-string name', json([entry(42, null, 1)])],
    ['fractional position', json([entry(42, 'Classic', 1.5)])], ['zero position', json([entry(42, 'Classic', 0)])],
    ['position over the limit', json([entry(42, 'Classic', 100001)])], ['mixed valid and invalid entries', json([entry(42, 'Classic', 1), null])],
    ['HTTP 500 with valid body', json([entry(42, 'Classic', 1)], false)]
]) test(`keeps cached classic entries after receiving ${label}`, async () => {
    const cached = [{ k: 'd', i: 42, n: 'Classic', p: 250 }];
    const f = fixture({ localStorage: { gar: JSON.stringify(cached) } });
    f.changes.d = result;
    await f.app('loadAredlList()');
    assert.deepEqual(f.requests, []);
    assert.deepEqual(plain(await f.app('loadAredlList(true)')), { d: false, p: true });
    assert.deepEqual(plain(f.app("aredlCache.filter(l => l.k === 'd')")), cached);
    assert.deepEqual(JSON.parse(f.context.localStorage.gar).filter(l => l.k === 'd'), cached);
});

for (const failed of ['aredl', 'gdl']) test(`${failed} retries independently and force bypasses the retry delay`, async () => {
    const f = fixture();
    f.setup();
    const keys = failed === 'aredl' ? ['d', 'p'] : ['gdl'];
    const successful = failed === 'aredl' ? 'gdl' : 'aredl';
    keys.forEach(key => { f.changes[key] = Error('offline'); });
    await f.app('autoSyncRankings()');
    assert.deepEqual(f.timestamps(), { 'local:p1': { [successful]: NOW } });
    assert.equal(f.app(`rankingSync.${failed}.status`), 'error');
    const level = f.context.profile.levels[0];
    assert.deepEqual([level.ar.p, level.gdl], failed === 'aredl' ? [250, 338] : [267, 320]);
    f.advance(f.app('RANKING_RETRY_DELAY') - 1);
    f.requests.length = 0;
    await f.app('autoSyncRankings()');
    assert.deepEqual(f.requests, []);
    await f.app('syncRankings({ force: true })');
    assert.deepEqual([...f.requests].sort(), ['d', 'gdl', 'p']);
    f.requests.length = 0;
    f.advance(f.app('RANKING_RETRY_DELAY') - 1);
    await f.app('autoSyncRankings()');
    assert.deepEqual(f.requests, []);
    keys.forEach(key => { delete f.changes[key]; });
    f.advance(1);
    await f.app('autoSyncRankings()');
    assert.deepEqual(f.requests, keys);
    assert.equal(f.timestamps()['local:p1'][failed], f.now());
    assert.equal(f.app(`rankingSync.${failed}.status`), 'ok');
});

test('a partial result backs off and a forced recovery clears the cooldown', async () => {
    const f = fixture();
    f.setup();
    f.changes.p = Error('offline');
    await f.app('autoSyncRankings()');
    f.requests.length = 0;
    await f.app('autoSyncRankings()');
    assert.deepEqual(f.requests, []);
    delete f.changes.p;
    await f.app('syncRankings({ force: true })');
    f.requests.length = 0;
    f.context.store.cur = 'other';
    await f.app('autoSyncRankings()');
    assert.deepEqual([...f.requests].sort(), ['d', 'gdl', 'p']);
});

test('failed downloads leave levels untouched and tolerate corrupt ranking timestamps', async () => {
    const localStorage = { granks: '{', gas: String(NOW), gar: '[{"k":"d","i":42,"n":"Classic","p":7}]', ggdl: '[[42,9]]' };
    const f = fixture({ localStorage });
    f.setup();
    for (const kind of ['d', 'p', 'gdl']) f.changes[kind] = Error('offline');
    await f.app('autoSyncRankings()');
    assert.deepEqual([...f.requests].sort(), ['d', 'gdl', 'p']);
    assert.deepEqual(f.context.profile.levels, [classic, platform]);
    assert.equal(localStorage.granks, '{');
    assert.equal(localStorage.gas, String(NOW));
    assert.equal(f.saves(), 0);
});

test('only the active owner’s expired or missing providers are due', async () => {
    const local = { aredl: NOW, gdl: NOW };
    const f = fixture({ localStorage: { granks: JSON.stringify({ 'local:p1': local, 'cloud:owner': { aredl: 'invalid', gdl: NOW } }) } });
    f.setup();
    f.advance(f.app('RANKING_MAX_AGE'));
    await f.app('autoSyncRankings()');
    assert.deepEqual(f.requests, []);
    f.app("cloudUser = 'owner'; cloudSession = { revision: 0 }");
    await f.app('autoSyncRankings()');
    assert.deepEqual(f.requests, ['d', 'p']);
    assert.deepEqual(f.timestamps(), { 'local:p1': local, 'cloud:owner': { aredl: f.now(), gdl: NOW } });
    f.app("cloudUser = null; cloudSession = null");
    f.advance(1);
    f.requests.length = 0;
    await f.app('autoSyncRankings()');
    assert.deepEqual([...f.requests].sort(), ['d', 'gdl', 'p']);
});

test('read-only and uninitialized accounts skip all refreshes and offline skips automatic refreshes', async () => {
    const f = fixture();
    f.setup();
    f.context.canEdit = () => false;
    await f.app('syncRankings({ force: true })');
    f.context.canEdit = () => true;
    f.app("cloudUser = 'owner'; cloudSession = { revision: null }");
    await f.app('syncRankings({ force: true })');
    f.app('cloudSession.revision = 0; navigator.onLine = false');
    await f.app('autoSyncRankings()');
    assert.deepEqual(f.requests, []);
    await f.app('syncRankings({ force: true })');
    assert.deepEqual([...f.requests].sort(), ['d', 'gdl', 'p']);
});

test('concurrent calls share a promise and the completed refresh applies to the newly active profile', async () => {
    const f = fixture();
    f.setup();
    let finish;
    f.changes.d = new Promise(resolve => { finish = resolve; });
    const original = f.context.profile, sync = f.app('syncRankings()');
    assert.equal(f.app('syncRankings({ force: true })'), sync);
    await Promise.resolve();
    assert.deepEqual([...f.requests].sort(), ['d', 'gdl', 'p']);
    f.context.profile = structuredClone(original);
    f.context.store.cur = 'p2';
    finish(responses.d);
    await sync;
    assert.equal(original.levels[0].ar.p, 250);
    assert.equal(f.context.profile.levels[0].ar.p, 267);
    assert.deepEqual(f.timestamps(), { 'local:p2': { aredl: NOW, gdl: NOW } });
});

test('an owner switch checks for a stale provider omitted from the in-flight refresh', async () => {
    const f = fixture();
    f.setup();
    const stale = NOW - f.app('RANKING_MAX_AGE') - 1;
    f.context.localStorage.granks = JSON.stringify({ 'local:p1': { gdl: NOW }, 'local:p2': { gdl: stale } });
    let finish;
    f.changes.d = new Promise(resolve => { finish = resolve; });
    const first = f.app('autoSyncRankings()');
    await Promise.resolve();
    assert.deepEqual(f.requests, ['d', 'p']);
    f.context.profile = structuredClone(f.context.profile);
    f.context.store.cur = 'p2';
    finish(responses.d);
    await first;
    await f.app('rankingPromise');
    assert.deepEqual(f.requests, ['d', 'p', 'gdl']);
    assert.equal(f.context.profile.levels[0].gdl, 338);
    assert.deepEqual(f.timestamps(), { 'local:p1': { gdl: NOW }, 'local:p2': { aredl: NOW, gdl: NOW } });
});

test('a local refresh finishing during first sign-in cannot record success for the placeholder', async () => {
    const f = fixture();
    f.setup();
    let finish;
    f.changes.d = new Promise(resolve => { finish = resolve; });
    const sync = f.app('syncRankings()');
    f.app("cloudUser = 'owner'; cloudSession = { revision: null }");
    finish(responses.d);
    await sync;
    assert.deepEqual(f.context.profile.levels, [classic, platform]);
    assert.deepEqual(f.timestamps(), {});
    assert.equal(f.saves(), 0);
});

test('an enrichment error still applies and records both successful providers', async () => {
    const f = fixture({ fillRatings: async () => { throw Error('unavailable'); } });
    f.setup();
    await f.app('syncRankings()');
    assert.deepEqual(plain(f.context.profile.levels.map(l => [l.ar.p, l.gdl])), [[267, 338], [15, null]]);
    assert.deepEqual(f.timestamps(), { 'local:p1': { aredl: NOW, gdl: NOW } });
    assert.equal(f.app('rankingSync.aredl.status'), 'ok');
    assert.equal(f.saves(), 1);
});

test('wishlist enrichment alone saves once when all positions are unchanged', async () => {
    const item = { kind: 'classic', name: 'Wish', levelId: '84', creator: 'Creator', diff: 'Extreme Demon', rating: 'rated' };
    const f = fixture({
        profile: { levels: [{ ...classic, ar: { s: 'r', p: 267 }, gdl: 338 }], wishlists: [{ items: [item] }] },
        fillRatings: async levels => { levels.find(level => level.levelId === '84').rating = 'epic'; }
    });
    f.setup();
    await f.app('syncRankings()');
    assert.equal(item.rating, 'epic');
    assert.equal(f.saves(), 1);
    await f.app('syncRankings({ force: true })');
    assert.equal(f.saves(), 1);
});

test('startup checks immediately and only registers one visible, online and interval check', () => {
    let checks = 0;
    const f = fixture();
    f.setup();
    f.context.autoSyncRankings = () => { checks++; };
    f.app('startRankingSync(); startRankingSync()');
    assert.equal(checks, 1);
    assert.equal(f.docEvents.length, 1);
    assert.equal(f.docEvents[0][0], 'visibilitychange');
    assert.equal(f.winEvents.length, 1);
    assert.equal(f.winEvents[0][0], 'online');
    assert.equal(f.intervals.length, 1);
    assert.equal(f.intervals[0][1], f.app('RANKING_CHECK_INTERVAL'));
    f.context.document.visibilityState = 'hidden';
    f.docEvents[0][1]();
    assert.equal(checks, 1);
    f.context.document.visibilityState = 'visible';
    f.docEvents[0][1]();
    assert.equal(checks, 2);
    f.winEvents[0][1]();
    assert.equal(checks, 3);
    f.intervals[0][0]();
    assert.equal(checks, 4);
});

test('a GDL-only refresh keeps the AREDL timestamp visible while GDL is updating', async () => {
    const f = fixture();
    f.setup();
    const stale = NOW - f.app('RANKING_MAX_AGE') - 1;
    f.context.localStorage.granks = JSON.stringify({ 'local:p1': { aredl: NOW, gdl: stale } });
    let finish;
    f.changes.gdl = new Promise(resolve => { finish = resolve; });
    const sync = f.app('autoSyncRankings()');
    await Promise.resolve();
    assert.deepEqual(f.requests, ['gdl']);
    const rows = f.app('rankingStatusRows()');
    const formatted = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(NOW);
    assert.ok(rows.includes(`<strong>AREDL / AREPL</strong><span>Updated: ${formatted}</span>`));
    assert.match(rows, /<strong>Global Demonlist<\/strong><span>Updating…<\/span>/);
    finish(responses.gdl);
    await sync;
    assert.doesNotMatch(f.app('rankingStatusRows()'), /Updating…/);
});

for (const [lang, title, refresh, updating, never, updated, partial, error] of [
    ['en', 'External rankings', 'Update positions now', 'Updating…', 'Not updated yet', 'Updated: ', 'AREPL is not responding; the rest was updated.', 'Not responding; the last positions are kept. It will retry on its own.'],
    ['es', 'Posiciones externas', 'Actualizar posiciones ahora', 'Actualizando…', 'Aún sin actualizar', 'Actualizado: ', 'AREPL no responde; el resto se actualizó.', 'No responde; se mantienen las últimas posiciones. Se reintentará solo.']
]) test(`settings display ranking states and keep the refresh button focusable in ${lang}`, async () => {
    const f = fixture();
    f.setup();
    f.load(['js/components/help-tip.js', 'js/events.js']);
    f.context.ui.lang = lang;
    const settings = () => f.app('pauseUI()');
    const warning = f.app('ICONS.warning');
    assert.ok(settings().includes(`<h3 id=ranking-sync>${title}</h3>`));
    assert.equal(settings().split(never).length - 1, 2);
    assert.ok(settings().includes(`<span>${refresh}</span>`));
    assert.match(settings(), /role=status aria-live=polite/);
    assert.match(settings(), /data-act=rankrefresh aria-describedby=ranking-status/);
    f.context.canEdit = () => false;
    assert.doesNotMatch(settings(), /data-ranking-status|rankrefresh/);
    f.context.canEdit = () => true;

    const label = {}, labelAttributes = {}, statusAttributes = {};
    const status = { setAttribute: (key, value) => { statusAttributes[key] = value; } };
    f.nodes['[data-ranking-status]'] = status;
    f.nodes['[data-act=rankrefresh]'] = { querySelector: () => label, setAttribute: (key, value) => { labelAttributes[key] = value; } };
    f.nodes['form, dialog[open], .ms[open], .sortable-chosen'] = {};
    f.context.localStorage.granks = JSON.stringify({ 'local:p1': { aredl: NOW, gdl: NOW } });
    assert.ok(settings().includes(updated + new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(NOW)));
    f.changes.p = Error('offline');
    f.changes.gdl = Error('offline');
    f.app('ACTIONS.rankrefresh()');
    assert.equal(label.textContent, updating);
    assert.equal(statusAttributes['aria-busy'], 'true');
    assert.equal(labelAttributes['aria-disabled'], 'true');
    assert.doesNotMatch(settings(), /[\s]disabled(?:[\s=>])/);
    assert.equal(settings().split(updating).length - 1, 3);
    const sync = f.app('syncRankings()');
    assert.equal(f.app('ACTIONS.rankrefresh()'), undefined);
    await sync;
    assert.deepEqual([...f.requests].sort(), ['d', 'gdl', 'p']);
    assert.equal(label.textContent, refresh);
    assert.equal(statusAttributes['aria-busy'], 'false');
    assert.equal(labelAttributes['aria-disabled'], 'false');
    assert.ok(status.innerHTML.includes(warning + partial));
    assert.ok(status.innerHTML.includes(warning + error));
    assert.equal(f.renders(), 0);
});
