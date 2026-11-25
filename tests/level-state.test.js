import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDurationFields, loadScripts } from './load-scripts.js';

const createApp = () => {
    const { app, context } = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/components/deaths-input.js', 'js/components/duration-input.js', 'js/components/levels.js'], {
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
    assert.deepEqual(plain(app('store.profs.first.data')), { ratingScale: 10, firstStepsRetired: true, levels: [], order: { classic: [], platform: [] }, wishlists: [], tags: [] });
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

const durationForm = entries => ({ entries, elements: Object.fromEntries(entries.map(([name, value]) => [name, { value, setCustomValidity() {} }])) });

const filledEntries = [
    ['name', '  Test level  '], ['kind', 'platform'], ['lid', '123'], ['creator', 'Creator'],
    ['diff', 'Hard'], ['rating', 'epic'], ['attC', '0'], ['attN', '12'], ['date', '2026-10-26'],
    ['link', 'https://example.com/video'], ['enj', '15'], ['lik', '-12'], ['tN_h', '1'], ['tN_m', '30'], ['tN_s', '5'],
    ['tP_h', ''], ['tP_m', '2'], ['tP_s', ''], ['tPC_h', ''], ['tPC_m', ''], ['tPC_s', '0'], ['notes', '  Keep spacing  '], ['tg', 'First'], ['tg', 'Second'],
    ['dth', '63:6'], ['dth', '100:1'], ['dth', '0:0'], ['as', 'r'], ['ap', '0'], ['pos', '2']
];

test('levelFromForm preserves fields, converts units, clamps ratings and keeps all tags', () => {
    const { app, plain } = createApp();
    const input = durationForm(structuredClone(filledEntries));
    assert.deepEqual(plain(app('levelFromForm')(input)), {
        name: 'Test level', kind: 'platform', levelId: '123', creator: 'Creator', diff: 'Hard', rating: 'epic',
        attC: 0, attN: 12, date: '2026-10-26', link: 'https://example.com/video', enj: 10, lik: 0,
        tN: 5405, tP: 120, tPC: 0, notes: '  Keep spacing  ', tags: ['First', 'Second'],
        deaths: { 0: 0, 63: 6, 100: 1 }
    });
    assert.deepEqual(input.entries, filledEntries);
});

test('levelFromForm keeps empty values null and ignores legacy status fields', () => {
    const { app, plain } = createApp();
    const entries = filledEntries.filter(([key]) => !['tg', 'dth', 'pos'].includes(key)).map(([key]) => [key, '']);
    assert.deepEqual(plain(app('levelFromForm')(durationForm(entries))), {
        name: '', kind: '', levelId: null, creator: null, diff: null, rating: null,
        attC: null, attN: null, date: null, link: null, enj: null, lik: null,
        tN: null, tP: null, tPC: null, notes: '', tags: [], deaths: {}
    });
    const pending = filledEntries.map(([key, value]) => [key, key == 'as' ? 'p' : value]);
    assert.equal('ar' in app('levelFromForm')(durationForm(pending)), false);
});

test('chip data feeds the existing histogram with zero counts preserved', () => {
    const { app, plain } = createApp();
    const entries = filledEntries.filter(([key]) => key != 'dth').concat([['dth', '24:270'], ['dth', '40:82'], ['dth', '0:0']]);
    const level = app('levelFromForm')(durationForm(entries));
    assert.deepEqual(plain(level.deaths), { 0: 0, 24: 270, 40: 82 });
    const histogram = app('deathHistogram')(level.deaths);
    assert.match(histogram, /data-hp="24" data-hn="270"/);
    assert.match(histogram, /data-hp="40" data-hn="82"/);
    assert.match(histogram, /data-hp="0" data-hn="0"/);
});


test('legacy ratings convert once and persist the scale marker', () => {
    const { app, context, plain } = createApp();
    app(`store = { cur: 'old', profs: { old: { data: { levels: [-10, -3, 0, 10, null].map((v, i) => ({ id: 'n' + i, enj: v, lik: v })), order: { classic: [], platform: [] }, tags: [], wishlists: [] } } } }; activateProfile('old')`);
    assert.deepEqual(plain(app('profile.levels.map(l => l.enj)')), [0, 3.5, 5, 10, null]);
    assert.deepEqual(plain(app('profile.levels.map(l => l.lik)')), [0, 3.5, 5, 10, null]);
    assert.equal(JSON.parse(context.localStorage.gdp).profs.old.data.ratingScale, 10);
    app("activateProfile('old')");
    assert.deepEqual(plain(app('profile.levels.map(l => l.enj)')), [0, 3.5, 5, 10, null]);
});

test('rating formatting uses the interface locale and at most one decimal', () => {
    const { app } = createApp();
    for (const lang of ['es', 'en']) {
        app(`ui.lang = '${lang}'`);
        assert.deepEqual([0, 1, 2.5, 9.9, 10].map(app('formatRating')), lang === 'es' ? ['0', '1', '2,5', '9,9', '10'] : ['0', '1', '2.5', '9.9', '10']);
        assert.equal(app('formatRating(7.33333)'), lang === 'es' ? '7,3' : '7.3');
    }
});

test('levelFromForm rounds rating decimals without converting the new scale', () => {
    const { app } = createApp();
    const result = app('levelFromForm')({ entries: [['name', 'Level'], ['enj', '7.34'], ['lik', '2.56']], elements: emptyDurationFields() });
    assert.equal(result.enj, 7.3);
    assert.equal(result.lik, 2.6);
});

test('a legacy profile drops the retired Pre-Extremes tag once and its levels become unplaced with their data intact', () => {
    const { app, context, plain } = createApp();
    app(`store = { cur: 'old', profs: { old: { data: {
        levels: [
            { id: 'ranked-pre', kind: 'classic', name: 'A', att: 120, notes: 'kept', deaths: { 40: 3 }, tags: ['Pre-Extremes', 'Fluked'] },
            { id: 'pre', kind: 'platform', name: 'B', tags: ['Pre-Extremes'] },
            { id: 'plain', kind: 'classic', name: 'C', tags: ['Fluked'] }
        ],
        order: { classic: ['plain', 'ranked-pre'], platform: [] },
        tags: [{ name: 'Fluked', color: '#00e5ff' }, { name: 'Pre-Extremes', color: '#ff2bd6' }]
    } } } }; activateProfile('old')`);
    assert.deepEqual(plain(app('profile.order')), { classic: ['plain'], platform: [] });
    assert.deepEqual(plain(app('profile.tags')), [{ name: 'Fluked', color: '#00e5ff' }]);
    assert.deepEqual(plain(app('profile.levels[0]')), { id: 'ranked-pre', kind: 'classic', name: 'A', att: 120, notes: 'kept', deaths: { 40: 3 }, tags: ['Fluked'] });
    assert.deepEqual(plain(app('profile.levels[1].tags')), []);
    assert.equal(JSON.parse(context.localStorage.gdp).profs.old.data.firstStepsRetired, true);
});

test('a Pre-Extremes tag created after the retirement is an ordinary tag', () => {
    const { app, context, plain } = createApp();
    app(`store = { cur: 'new', profs: { new: { data: emptyProfile() } } }; profile = store.profs.new.data;
        profile.levels.push({ id: 'l', kind: 'classic', name: 'L', tags: ['Pre-Extremes'] });
        profile.tags.push({ name: 'Pre-Extremes', color: '#123456' }); profile.order.classic.push('l');
        activateProfile('new')`);
    assert.equal(context.localStorage.gdp, undefined);
    assert.deepEqual(plain(app('profile.levels[0].tags')), ['Pre-Extremes']);
    assert.deepEqual(plain(app('profile.order.classic')), ['l']);
    assert.deepEqual(plain(app('profile.tags')), [{ name: 'Pre-Extremes', color: '#123456' }]);
});
