import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

// state.js and api.js read localStorage when they load, so an empty one is provided
const { context, app } = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/api.js'], { localStorage: {} });

test('an unreadable AREDL cache is dropped instead of breaking every AREDL lookup', () => {
    for (const [stored, expected] of [['{broken', []], ['{"k":"d"}', []], ['[{"k":"d","i":1}]', [{ k: 'd', i: 1 }]]]) {
        const fresh = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/api.js'], { localStorage: { gar: stored } });
        assert.deepEqual(JSON.parse(JSON.stringify(fresh.app('aredlCache'))), expected, stored);
    }
});
const setGlobal = (name, value) => {
    context.__value = value;
    app(`${name} = __value`);
};

test('isValidProfileData accepts an empty profile, a full one and the demo profile', () => {
    const isValid = app('isValidProfileData');
    assert.equal(isValid(app('emptyProfile()')), true);
    assert.equal(isValid({ levels: [{ name: 'A', date: '2025-01-01', tags: ['t'] }, { name: 'B', date: null }], order: { classic: [], platform: [] }, wishlists: [{ items: [{ name: 'C' }] }], tags: [{ name: 't' }] }), true);
    assert.equal(isValid({ levels: [], order: { classic: [], platform: [] } }), true);
    assert.equal(isValid(loadScripts(['data/demo-data.js'], { window: {} }).app('window.DEMO_PROFILE')), true);
});

test('isValidProfileData rejects data the app cannot render', () => {
    const isValid = app('isValidProfileData');
    assert.equal(isValid(null), false);
    assert.equal(isValid([]), false);
    assert.equal(isValid({ levels: {}, order: { classic: [], platform: [] } }), false);
    assert.equal(isValid({ levels: ['x'], order: { classic: [], platform: [] } }), false);
    assert.equal(isValid({ levels: [], order: { classic: [] } }), false);
    assert.equal(isValid({ levels: [], order: { classic: [], platform: [] }, wishlists: [{}] }), false);
    assert.equal(isValid({ levels: [], order: { classic: [], platform: [] }, tags: 'a' }), false);
});

test('isValidProfileData rejects text fields of another type, which the screens would fail to draw', () => {
    const isValid = app('isValidProfileData'), order = { classic: [], platform: [] };
    for (const level of [{}, { name: 5 }, { name: 'A', tags: 'oops' }, { name: 'A', tags: [1] }, { name: 'A', date: 20250101 }])
        assert.equal(isValid({ levels: [level], order }), false, JSON.stringify(level));
    assert.equal(isValid({ levels: [], order, wishlists: [{ items: [{ name: 7 }] }] }), false);
    assert.equal(isValid({ levels: [], order, tags: [{ name: 3, color: '#ffffff' }] }), false);
});

test('findAredlByName matches exact names first, then a single partial match', () => {
    setGlobal('aredlCache', [
        { k: 'd', i: 1, n: 'Bloodbath' },
        { k: 'd', i: 2, n: 'Kenos' },
        { k: 'd', i: 3, n: 'Tidal Wave' },
        { k: 'd', i: 4, n: 'Tidal Wave II' },
        { k: 'd', i: 5, n: '...' },
        { k: 'p', i: 6, n: 'Bloodbath' }
    ]);
    const find = (name, kind = 'd') => app('findAredlByName')(name, kind)?.i ?? null;
    assert.equal(find('blood bath'), 1);
    assert.equal(find('Bloodbath', 'p'), 6);
    assert.equal(find('Tidal Wave'), 3);
    assert.equal(find('bloodb'), 1);
    assert.equal(find('tidal'), null, 'several partial matches are ambiguous');
    assert.equal(find('Kenos Remake'), null, 'typed text containing an official name is a different level');
    assert.equal(find('ken'), null, 'partial matches need at least four characters');
    assert.equal(find('!!!'), null);
});

test('similarAredlNames uses the first four normalized characters and returns three names in cache order', () => {
    setGlobal('aredlCache', [
        { k: 'p', i: 1, n: 'Tidal Platform' },
        { k: 'd', i: 2, n: '...' },
        { k: 'd', i: 3, n: 'Tidal Wave II' },
        { k: 'd', i: 4, n: 'Tidal Wave' },
        { k: 'd', i: 5, n: 'The Tidal Storm' },
        { k: 'd', i: 6, n: 'Tidal Ocean' },
        { k: 'x', i: 7, n: 'Tidal Unknown List' }
    ]);
    const similar = (name, kind = 'd') => Array.from(app('similarAredlNames')(name, kind));
    assert.deepEqual(similar('Tíd-al unrelated'), ['Tidal Wave II', 'Tidal Wave', 'The Tidal Storm']);
    assert.deepEqual(similar('tidal', 'p'), ['Tidal Platform']);
    assert.deepEqual(similar('ti'), ['Tidal Wave II', 'Tidal Wave', 'The Tidal Storm']);
    assert.deepEqual(similar('!!!'), []);
    assert.deepEqual(similar('missing'), []);
});

test('AREDL name lookups use the replacement cache and drop names from the previous array', () => {
    const find = app('findAredlByName');
    const similar = app('similarAredlNames');
    setGlobal('aredlCache', [
        { k: 'd', i: 1, n: 'Bloodbath' },
        { k: 'p', i: 2, n: 'Old Platform' }
    ]);
    assert.equal(find('blood bath', 'd')?.i, 1);
    assert.deepEqual(Array.from(similar('blood', 'd')), ['Bloodbath']);
    assert.equal(find('old platform', 'p')?.i, 2);
    assert.deepEqual(Array.from(similar('old platform', 'p')), ['Old Platform']);
    setGlobal('aredlCache', [
        { k: 'd', i: 3, n: 'Kenos' },
        { k: 'p', i: 4, n: 'New Platform' }
    ]);
    assert.equal(find('kenos', 'd')?.i, 3);
    assert.deepEqual(Array.from(similar('kenos', 'd')), ['Kenos']);
    assert.equal(find('new platform', 'p')?.i, 4);
    assert.deepEqual(Array.from(similar('new platform', 'p')), ['New Platform']);
    assert.equal(find('blood bath', 'd'), null);
    assert.deepEqual(Array.from(similar('blood', 'd')), []);
    assert.equal(find('old platform', 'p'), null);
    assert.deepEqual(Array.from(similar('old platform', 'p')), []);
});

test('AREDL name lookups normalize each cached name once per array on first use', () => {
    const normalized = [];
    const fresh = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/api.js'], {
        localStorage: {}, recordNormalization: name => normalized.push(name)
    });
    fresh.app(`(() => {
        const original = String.prototype.normalize;
        String.prototype.normalize = function (...args) {
            recordNormalization(String(this));
            return original.apply(this, args);
        };
    })()`);
    fresh.app('aredlCache = [{ k: "d", n: "Bloodbath" }, { k: "p", n: "Platform" }, { k: "d", n: "..." }]');
    assert.equal(normalized.length, 0);
    const lookup = () => {
        fresh.app('findAredlByName("blood b", "d")');
        fresh.app('findAredlByName("plat", "p")');
        fresh.app('similarAredlNames("blood b", "d")');
        fresh.app('similarAredlNames("plat", "p")');
    };
    lookup();
    lookup();
    for (const name of ['bloodbath', 'platform', '...'])
        assert.equal(normalized.filter(value => value === name).length, 1, name);
    fresh.app('aredlCache = [...aredlCache]');
    lookup();
    for (const name of ['bloodbath', 'platform', '...'])
        assert.equal(normalized.filter(value => value === name).length, 2, name);
});

test('tagStyle paints a chip in its tag colour and drops anything that is not #rrggbb', () => {
    setGlobal('profile', { tags: [{ name: 'ok', color: '#12ab9F' }, { name: 'bad', color: 'red;background:url(x)' }] });
    const tagStyle = app('tagStyle');
    assert.equal(tagStyle('ok'), 'color:#12ab9F;border-color:#12ab9F');
    assert.equal(tagStyle('bad'), 'color:var(--fg);border-color:var(--fg)');
    assert.equal(tagStyle('missing'), 'color:var(--fg);border-color:var(--fg)');
});

test('ensureProfileDefaults drops imported wishlist statuses and deaths the app cannot render', () => {
    const data = {
        levels: [{ id: 'a', name: 'A', deaths: { 0: 3, 63: 4, 100: 1, 101: 1, 2000000: 1, '5.5': 1, x: 1, 70: '<b>', 80: -1 } }, { id: 'b', name: 'B', deaths: 'oops' }],
        order: { classic: [], platform: [] },
        wishlists: [{ id: 'w', items: [{ id: '1', status: 'prog' }, { id: '2', status: '"><b>x</b>' }, { id: '3', done: true }] }],
        tags: []
    };
    setGlobal('profile', data);
    app('ensureProfileDefaults()');
    assert.deepEqual({ ...data.levels[0].deaths }, { 0: 3, 63: 4, 100: 1 });
    assert.deepEqual({ ...data.levels[1].deaths }, {});
    assert.deepEqual(data.wishlists[0].items.map(i => i.status), ['prog', 'todo', 'done']);
});

test('ensureProfileDefaults appends missing level tags with the next palette colours and saves once', () => {
    let writes = 0;
    const localStorage = {};
    Object.defineProperty(localStorage, 'gdp', { set: value => { localStorage.saved = value; writes++; } });
    const fresh = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js'], { localStorage });
    fresh.app(`store = { cur: 'p', profs: { p: { data: {
        levels: [{ id: 'n1', tags: ['Existing', 'Missing', 'Shared'] }, { id: 'n2', tags: ['Shared', 'Last'] }],
        order: { classic: [], platform: [] }, wishlists: [],
        tags: [{ name: 'Existing', color: '#123456' }, { name: 'Unused', color: '#abcdef' },
            { name: 'Third', color: '#112233' }, { name: 'Fourth', color: '#445566' }, { name: 'Fifth', color: '#778899' }]
    } } } }; profile = store.profs.p.data; ensureProfileDefaults()`);
    assert.equal(writes, 1);
    assert.deepEqual(JSON.parse(localStorage.saved).profs.p.data.tags, [
        { name: 'Existing', color: '#123456' }, { name: 'Unused', color: '#abcdef' },
        { name: 'Third', color: '#112233' }, { name: 'Fourth', color: '#445566' }, { name: 'Fifth', color: '#778899' },
        { name: 'Missing', color: '#9d7bff' }, { name: 'Shared', color: '#ff2bd6' }, { name: 'Last', color: '#00e5ff' }
    ]);
    assert.equal(writes, 1);
    fresh.app('ensureProfileDefaults()');
    assert.equal(writes, 1);
});

test('ensureProfileDefaults removes repeated level tags in first-occurrence order and saves the result', () => {
    let writes = 0;
    const localStorage = {};
    Object.defineProperty(localStorage, 'gdp', { set: value => { localStorage.saved = value; writes++; } });
    const fresh = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js'], { localStorage });
    fresh.app(`store = { cur: 'p', profs: { p: { data: {
        levels: [{ id: 'n', tags: ['B', 'A', 'B', 'A', 'B'] }],
        order: { classic: [], platform: [] }, wishlists: [],
        tags: [{ name: 'A', color: '#123456' }, { name: 'B', color: '#abcdef' }]
    } } } }; profile = store.profs.p.data; ensureProfileDefaults()`);
    assert.deepEqual([...fresh.app('profile.levels[0].tags')], ['B', 'A']);
    assert.deepEqual(JSON.parse(localStorage.saved).profs.p.data.levels[0].tags, ['B', 'A']);
    assert.equal(writes, 1);
    fresh.app('ensureProfileDefaults()');
    assert.equal(writes, 1);
});

test('ensureProfileDefaults leaves consistent tags unchanged without saving', () => {
    let writes = 0;
    const localStorage = {};
    Object.defineProperty(localStorage, 'gdp', { set: () => { writes++; } });
    const fresh = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js'], { localStorage });
    fresh.app(`profile = {
        levels: [{ id: 'n1', tags: ['B', 'A'], deaths: {} }, { id: 'n2', tags: [], deaths: {} }],
        order: { classic: [], platform: [] }, wishlists: [],
        tags: [{ name: 'A', color: '#123456' }, { name: 'B', color: '#abcdef' }]
    }`);
    const before = fresh.app('JSON.stringify(profile)'), levelTags = fresh.app('profile.levels[0].tags'), tags = fresh.app('profile.tags');
    fresh.app('ensureProfileDefaults()');
    assert.equal(fresh.app('JSON.stringify(profile)'), before);
    assert.equal(fresh.app('profile.levels[0].tags'), levelTags);
    assert.equal(fresh.app('profile.tags'), tags);
    assert.equal(writes, 0);
});
