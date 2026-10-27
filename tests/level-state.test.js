import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const createApp = () => {
    const context = vm.createContext({
        localStorage: {},
        FormData: class extends URLSearchParams {
            constructor(form) {
                super(form.entries);
            }
        }
    });
    for (const file of ['js/config.js', 'js/utils.js', 'js/state.js', 'js/components/levels.js'])
        vm.runInContext(readFileSync(file, 'utf8'), context, { filename: file });
    const app = code => vm.runInContext(code, context);
    const plain = value => JSON.parse(JSON.stringify(value));
    return { app, context, plain };
};

test('activateProfile selects the stored data and normalizes only that profile', () => {
    const { app, plain } = createApp();
    app(`store = { cur: 'first', profs: {
        first: { data: emptyProfile() },
        second: { data: {
            levels: [{ id: 'level', deaths: { 63: 2, 101: 4 } }],
            order: { classic: ['level'], platform: [] },
            wishlists: [{ id: 'wishlist', items: [{ id: 'item', done: true }] }],
            tags: []
        } }
    } }; profile = store.profs.first.data; ui.wl = 'unchanged';
    activateProfile('second')`);
    assert.equal(app('store.cur'), 'second');
    assert.equal(app('profile === store.profs.second.data'), true);
    assert.deepEqual(plain(app('profile.levels[0].deaths')), { 63: 2 });
    assert.equal(app('profile.wishlists[0].items[0].status'), 'done');
    assert.deepEqual(plain(app('store.profs.first.data')), { levels: [], order: { classic: [], platform: [] }, wishlists: [], tags: [] });
    assert.equal(app('ui.wl'), 'unchanged');
});

test('activateProfile saves missing defaults under the newly active profile', () => {
    const { app, context, plain } = createApp();
    app(`store = { cur: 'first', profs: {
        first: { data: emptyProfile() },
        second: { data: { levels: [{ id: 'level', tags: ['Legacy'] }], order: { classic: [], platform: [] } } }
    } }; profile = store.profs.first.data; activateProfile('second')`);
    const saved = JSON.parse(context.localStorage.gdp);
    assert.equal(saved.cur, 'second');
    assert.deepEqual(saved.profs.second.data, plain(app('profile')));
    assert.deepEqual(saved.profs.second.data.wishlists, []);
    assert.deepEqual(saved.profs.second.data.tags, [{ name: 'Legacy', color: '#ff2bd6' }]);
});

test('removeFromOrder removes every occurrence across lists without removing level data', () => {
    const { app, plain } = createApp();
    app(`profile = { levels: [{ id: '2' }], order: {
        classic: ['first', '2', 'last', '2'], platform: [2, 'other'], extra: ['2']
    } }; removeFromOrder('2')`);
    assert.deepEqual(plain(app('profile.order')), { classic: ['first', 'last'], platform: ['other'], extra: [] });
    assert.deepEqual(plain(app('profile.levels')), [{ id: '2' }]);
    app("removeFromOrder('missing')");
    assert.deepEqual(plain(app('profile.order')), { classic: ['first', 'last'], platform: ['other'], extra: [] });
});

const filledEntries = [
    ['name', '  Test level  '], ['kind', 'platform'], ['lid', '123'], ['creator', 'Creator'],
    ['diff', 'Hard'], ['rating', 'epic'], ['attC', '0'], ['attN', '12'], ['date', '2026-10-26'],
    ['link', 'https://example.com/video'], ['enj', '15'], ['lik', '-12'], ['tN', '1h 30m 5s'],
    ['tP', '2m'], ['tPC', '0s'], ['notes', '  Keep spacing  '], ['tg', 'First'], ['tg', 'Second'],
    ['deaths', '63% x4\n63% x2\n100% x1'], ['as', 'r'], ['ap', '0'], ['pos', '2']
];

test('levelFromForm preserves fields, converts units, clamps ratings and keeps all tags', () => {
    const { app, plain } = createApp();
    const input = { entries: structuredClone(filledEntries) };
    assert.deepEqual(plain(app('levelFromForm')(input)), {
        name: 'Test level', kind: 'platform', levelId: '123', creator: 'Creator', diff: 'Hard', rating: 'epic',
        attC: 0, attN: 12, date: '2026-10-26', link: 'https://example.com/video', enj: 10, lik: -10,
        tN: 5405, tP: 120, tPC: 0, notes: '  Keep spacing  ', tags: ['First', 'Second'],
        deaths: { 63: 6, 100: 1 }, ar: { s: 'r', p: 0 }
    });
    assert.deepEqual(input, { entries: filledEntries });
});

test('levelFromForm keeps empty values null and drops positions outside the ranked status', () => {
    const { app, plain } = createApp();
    const entries = filledEntries.filter(([key]) => !['tg', 'pos'].includes(key)).map(([key]) => [key, '']);
    assert.deepEqual(plain(app('levelFromForm')({ entries })), {
        name: '', kind: '', levelId: null, creator: null, diff: null, rating: null,
        attC: null, attN: null, date: null, link: null, enj: null, lik: null,
        tN: null, tP: null, tPC: null, notes: '', tags: [], deaths: {}, ar: { s: '', p: null }
    });
    const pending = filledEntries.map(([key, value]) => [key, key == 'as' ? 'p' : value]);
    assert.deepEqual(plain(app('levelFromForm')({ entries: pending }).ar), { s: 'p', p: null });
});
