import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const createApp = () => {
    const { app, context } = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/components/deaths-input.js', 'js/components/levels.js'], {
        localStorage: {},
        FormData: class extends URLSearchParams {
            constructor(form) {
                super(form.entries);
            }
        }
    });
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
    ['dth', '63:6'], ['dth', '100:1'], ['dth', '0:0'], ['as', 'r'], ['ap', '0'], ['pos', '2']
];

test('levelFromForm preserves fields, converts units, clamps ratings and keeps all tags', () => {
    const { app, plain } = createApp();
    const input = { entries: structuredClone(filledEntries) };
    assert.deepEqual(plain(app('levelFromForm')(input)), {
        name: 'Test level', kind: 'platform', levelId: '123', creator: 'Creator', diff: 'Hard', rating: 'epic',
        attC: 0, attN: 12, date: '2026-10-26', link: 'https://example.com/video', enj: 10, lik: -10,
        tN: 5405, tP: 120, tPC: 0, notes: '  Keep spacing  ', tags: ['First', 'Second'],
        deaths: { 0: 0, 63: 6, 100: 1 }
    });
    assert.deepEqual(input, { entries: filledEntries });
});

test('levelFromForm keeps empty values null and ignores legacy status fields', () => {
    const { app, plain } = createApp();
    const entries = filledEntries.filter(([key]) => !['tg', 'dth', 'pos'].includes(key)).map(([key]) => [key, '']);
    assert.deepEqual(plain(app('levelFromForm')({ entries })), {
        name: '', kind: '', levelId: null, creator: null, diff: null, rating: null,
        attC: null, attN: null, date: null, link: null, enj: null, lik: null,
        tN: null, tP: null, tPC: null, notes: '', tags: [], deaths: {}
    });
    const pending = filledEntries.map(([key, value]) => [key, key == 'as' ? 'p' : value]);
    assert.equal('ar' in app('levelFromForm')({ entries: pending }), false);
});

test('chip data feeds the existing histogram with zero counts preserved', () => {
    const { app, plain } = createApp();
    const entries = filledEntries.filter(([key]) => key != 'dth').concat([['dth', '24:270'], ['dth', '40:82'], ['dth', '0:0']]);
    const level = app('levelFromForm')({ entries });
    assert.deepEqual(plain(level.deaths), { 0: 0, 24: 270, 40: 82 });
    const histogram = app('deathHistogram')(level.deaths);
    assert.match(histogram, /data-hp="24" data-hn="270"/);
    assert.match(histogram, /data-hp="40" data-hn="82"/);
    assert.match(histogram, /data-hp="0" data-hn="0"/);
});
