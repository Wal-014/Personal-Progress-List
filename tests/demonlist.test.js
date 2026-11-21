import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyDurationFields, loadScripts } from './load-scripts.js';

const response = (levels = [{ id: 999, ingame_id: 42, placement: 387, name: 'Collision' }]) => ({ ok: true, json: async () => ({ message: 'success', data: { levels } }) });
const fixture = (extra = {}) => loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/demonlist.js', 'js/api.js'], { localStorage: {}, ui: { lang: 'en' }, ...extra });

test('downloads compact ID pairs once, reuses cache and forces refresh', async () => {
    let calls = 0;
    const storage = {}, f = fixture({ localStorage: storage, fetch: async url => {
        assert.equal(url, 'https://api.demonlist.org/level/classic/list');
        calls++;
        return response();
    } });
    await f.app('loadDemonlist()');
    assert.equal(storage.ggdl, '[[42,387]]');
    await f.app('loadDemonlist()');
    assert.equal(calls, 1);
    await f.app('loadDemonlist(true)');
    assert.equal(calls, 2);
});

test('cache tolerates invalid JSON, wrong shapes and invalid pairs', () => {
    for (const ggdl of ['{', '{}', 'null', '[[42,0]]', '[[42,1.5]]', '[["42",1]]', '[null]', '[[42,100001]]'])
        assert.equal(fixture({ localStorage: { ggdl } }).app('demonlistCache'), null);
});

test('lookup uses game ID only, preserves unknown IDs and excludes platformers', () => {
    const f = fixture({ localStorage: { ggdl: '[[42,387]]' } });
    const levels = [{ levelId: '42' }, { name: 'Collision', levelId: '999', gdl: 2 }, { name: 'Collision' }, { gdl: 4 }, { kind: 'platform', levelId: '42', gdl: 5 }];
    f.app('matchWithDemonlist')(levels);
    assert.deepEqual(levels.map(l => l.gdl), [387, null, undefined, 4, null]);
});

test('empty successful list clears positions, missing cache preserves positions', async () => {
    const levels = [{ levelId: '42', gdl: 3 }], f = fixture({ fetch: async () => response([]) });
    f.app('matchWithDemonlist')(levels);
    assert.equal(levels[0].gdl, 3);
    await f.app('loadDemonlist()');
    f.app('matchWithDemonlist')(levels);
    assert.equal(levels[0].gdl, null);
});

for (const result of [{ ok: false }, { ok: true, json: async () => ({ data: { levels: [] } }) }, response([{ ingame_id: 42, placement: '2' }])])
    test('invalid downloads preserve the previous cache', async () => {
        const storage = { ggdl: '[[42,7]]' }, f = fixture({ localStorage: storage, fetch: async () => result });
        await assert.rejects(f.app('loadDemonlist(true)'));
        assert.equal(storage.ggdl, '[[42,7]]');
        assert.equal(f.app('demonlistCache[0][1]'), 7);
    });

function formFixture() {
    const nodes = Object.fromEntries(['#lf-face', '#lf-diffT', '#gdq', 'label[for=fm-ap]', '#fm-gdl-field', '#fm-gdl', '#fm-pos-hint'].map(key => [key, { value: '#7', setCustomValidity() {} }]));
    const f = fixture({ localStorage: { ggdl: '[[42,387]]' }, document: { querySelector: key => nodes[key], body: {}, addEventListener() {} }, window: { addEventListener() {} }, clearTimeout,
        FormData: class extends URLSearchParams { constructor(form) { super(form.entries); } },
        render() {}, save() {}, closeModal() {}, scrollSel() {}, renderTagSuggestions() {}, fetch: async () => { throw Error('offline'); } });
    f.load(['js/state.js', 'js/components/faces.js', 'js/components/deaths-input.js', 'js/components/duration-input.js', 'js/components/levels.js', 'js/components/search.js', 'js/events.js']);
    f.app('profile = emptyProfile(); ui.lang = "en"');
    return { ...f, nodes };
}

test('form and detail show classic GDL values, hide platformer GDL and escape values', () => {
    const f = formFixture();
    for (const lang of ['en', 'es']) {
        f.app(`ui.lang = '${lang}'`);
        for (const kind of ['classic', 'platform']) {
            const level = { id: 'n', name: 'Level', kind, gdl: 387 };
            const html = f.app('levelForm')(level);
            assert.ok(html.includes(`<div id=fm-gdl-field${kind == 'platform' ? ' hidden' : ''}>`));
            assert.ok(html.includes(lang == 'en' ? 'Top in Global Demonlist' : 'Top en Global Demonlist'));
            assert.ok(html.includes(`<output id=fm-gdl name=gdl>${kind == 'platform' ? '—' : '#387'}</output>`));
            assert.equal(f.app('detail')(level).includes('<dt>GDL</dt><dd>#387</dd>'), kind == 'classic');
        }
    }
    assert.ok(f.app('detail')({ name: 'Empty', kind: 'classic' }).includes('<dt>GDL</dt><dd>\u2014</dd>'));
    assert.ok(f.app('levelForm')({ name: 'Empty', kind: 'classic' }).includes('<output id=fm-gdl name=gdl>\u2014</output>'));
    assert.ok(f.app('detail')({ name: 'Unsafe', gdl: '<img>' }).includes('<dt>GDL</dt><dd>#&lt;img&gt;</dd>'));
});

test('picked results toggle GDL visibility and update from cached IDs', async () => {
    const f = formFixture(), form = { id: 'fm', isConnected: true, dataset: {}, elements: Object.fromEntries(['name', 'lid', 'creator', 'diff', 'rating', 'kind', 'kindT', 'ap', 'pos'].map(key => [key, { value: '' }])) };
    for (const kind of ['classic', 'platform', 'classic']) {
        f.app('pickLevel')(form, { name: 'Level', levelId: '42', kind });
        await new Promise(resolve => setTimeout(resolve));
        assert.equal(f.nodes['#fm-gdl-field'].hidden, kind == 'platform');
        assert.equal(f.nodes['#fm-gdl'].value, kind == 'platform' ? '\u2014' : '#387');
    }
    f.app('demonlistCache = null');
    f.app('pickLevel')(form, { name: 'Missing', levelId: '99', kind: 'classic' });
    await new Promise(resolve => setTimeout(resolve));
    assert.equal(f.nodes['#fm-gdl'].value, '#387');
});

test('saveLevel derives GDL from cache and never accepts a submitted position', () => {
    const f = formFixture();
    for (const kind of ['classic', 'platform']) {
        f.app('saveLevel')({ dataset: {}, elements: { ...emptyDurationFields(), pos: { value: '' } }, entries: [['name', 'Level'], ['kind', kind], ['lid', '42'], ['deaths', ''], ['gdl', '999']] });
        assert.equal(f.app('profile.levels.at(-1).gdl'), kind == 'classic' ? 387 : null);
    }
});

test('CSP permits the Global Demonlist API', () => {
    const csp = readFileSync('index.html', 'utf8').match(/connect-src ([^;"]*)/)[1].split(' ');
    assert.ok(csp.includes('https://api.demonlist.org'));
});
