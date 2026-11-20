import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const lists = [
    { k: 'd', i: 42, n: 'Bloodbath', p: 125, u: 'Publisher' },
    { k: 'd', i: 43, n: 'Sonic Wave', p: 80 },
    { k: 'd', i: 44, n: 'Sonic Wave Infinity', p: 30 },
    { k: 'p', i: 45, n: 'Platform Trial', p: 12 }
];

function formFixture(lang = 'en') {
    const nodes = Object.fromEntries(['#wn', '#lf-face', '#lf-diffT', '#gdq', 'label[for=fm-ap]'].map(key => [key, { textContent: '', setCustomValidity() {} }]));
    const f = fixture({
        document: { querySelector: key => nodes[key], body: {}, addEventListener() {} },
        window: { addEventListener() {} }, clearTimeout,
        FormData: class extends URLSearchParams { constructor(form) { super(form.entries); } },
        render() {}, closeModal() {}, scrollSel() {}, renderTagSuggestions() {}
    });
    f.load(['js/state.js', 'js/components/faces.js', 'js/components/deaths-input.js', 'js/components/levels.js', 'js/components/search.js', 'js/events.js']);
    f.app('profile = emptyProfile()');
    f.app('ui.lang = ' + JSON.stringify(lang));
    return { ...f, nodes };
}

for (const [lang, pending, top] of [['en', 'Awaiting placement', 'Top in'], ['es', 'Pendiente de ubicación', 'Top en']])
    for (const [kind, list] of [['classic', 'AREDL'], ['platform', 'AREPL']])
        test(`the ${lang} ${kind} form shows a read-only top without a status selector`, () => {
            const f = formFixture(lang);
            for (const [ar, value] of [[{ s: 'r', p: 125 }, '#125'], [{ s: 'p' }, pending], [{ s: 'r' }, '—'], [{ s: 'n' }, '—']]) {
                const level = { id: 'edit', name: 'Level', kind, ar };
                const html = f.app('levelForm')(level);
                assert.doesNotMatch(html, /\bname=as\b/);
                assert.ok(html.includes(`<label for=fm-ap>${top} ${list}</label>`));
                assert.match(html, /id=fm-ap name=ap type=text readonly tabindex=-1/);
                assert.ok(html.includes(`value="${value}" class=ro`));
            }
        });

test('picking results updates the top, list label and found note from current form fields', async () => {
    const f = formFixture();
    const form = { id: 'fm', elements: Object.fromEntries(['name', 'lid', 'creator', 'diff', 'rating', 'kind', 'kindT', 'ap'].map(key => [key, { value: '' }])) };
    for (const [level, value, label, note] of [
        [{ name: 'Bloodbath', levelId: '42', kind: 'classic' }, '#125', 'Top in AREDL', '✓ Found in the list · #125'],
        [{ name: 'Platform Trial', levelId: '45', kind: 'platform' }, '#12', 'Top in AREPL', '✓ Found in the list · #12'],
        [{ name: 'New', levelId: '99', kind: 'platform', diff: 'Extreme Demon', rating: 'rated' }, 'Awaiting placement', 'Top in AREPL', ''],
        [{ name: 'Blóod Bath', kind: 'classic' }, '#125', 'Top in AREDL', '✓ Found in the list · #125'],
        [{ name: 'Unknown', kind: 'classic' }, '—', 'Top in AREDL', '']
    ]) {
        f.app('pickLevel')(form, level);
        await Promise.resolve();
        assert.equal(form.elements.ap.value, value);
        assert.equal(f.nodes['label[for=fm-ap]'].textContent, label);
        assert.equal(f.nodes['#wn'].textContent, note);
    }
});

test('picking a result without downloadable lists keeps the shown top', async () => {
    const f = formFixture();
    f.app('aredlCache = []');
    const form = { id: 'fm', elements: Object.fromEntries(['name', 'lid', 'creator', 'diff', 'rating', 'kind', 'kindT', 'ap'].map(key => [key, { value: '' }])) };
    form.elements.ap.value = '#7';
    f.app('pickLevel')(form, { name: 'New', levelId: '99', kind: 'platform', diff: 'Extreme Demon', rating: 'rated' });
    await new Promise(resolve => setTimeout(resolve));
    assert.equal(form.elements.ap.value, '#7');
    assert.equal(f.nodes['label[for=fm-ap]'].textContent, 'Top in AREPL');
});

test('saving an existing level preserves its status without cached lists', () => {
    const f = formFixture(), ar = { s: 'r', p: 7 };
    f.app('aredlCache = []');
    f.app('profile').levels.push({ id: 'edit', name: 'Old', kind: 'classic', ar });
    const form = { dataset: { id: 'edit' }, elements: { pos: { value: '' } }, entries: [
        ['name', 'Edited'], ['kind', 'classic'], ['deaths', ''], ['as', 'p'], ['ap', '999']
    ] };
    f.app('saveLevel')(form);
    assert.equal(f.app('profile.levels[0].name'), 'Edited');
    assert.equal(f.app('profile.levels[0].ar'), ar);
});

test('cards show ranking metadata only for a position or pending placement', () => {
    const f = formFixture();
    for (const [ar, shown] of [[{ s: 'r', p: 125 }, true], [{ s: 'p' }, true], [{ s: 'r' }, false], [{ s: 'n' }, false], [undefined, false]]) {
        const level = { id: 'card', name: 'Level', kind: 'classic', ar };
        assert.equal(f.app('card')(level).includes('AREDL'), shown);
        assert.equal(f.app('detail')(level).includes('AREDL'), true);
    }
});

function fixture(extra = {}) {
    return loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/sheet.js', 'js/gd.js', 'js/api.js'], {
        localStorage: { gar: JSON.stringify(lists) }, ui: { lang: 'en' }, ...extra
    });
}

for (const [name, level, expected] of [
    ['ID before name', { levelId: '42', name: 'Sonic Wave' }, { s: 'r', p: 125 }],
    ['case insensitive name', { name: 'BLOODBATH' }, { s: 'r', p: 125 }],
    ['normalized name', { name: 'Blóod Bath' }, { s: 'r', p: 125 }],
    ['unique partial name', { name: 'Blood' }, { s: 'r', p: 125 }],
    ['exact name before partial', { name: 'Sonic Wave' }, { s: 'r', p: 80 }],
    ['ambiguous partial name', { name: 'Sonic' }, { s: 'n', p: null }],
    ['short partial name', { name: 'Blo' }, { s: 'n', p: null }],
    ['reverse partial name', { name: 'Bloodbath Remake' }, { s: 'n', p: null }],
    ['platform list', { kind: 'platform', levelId: '45', name: 'Other' }, { s: 'r', p: 12 }],
    ['platform ignores classic ID and name', { kind: 'platform', levelId: '42', name: 'Bloodbath' }, { s: 'n', p: null }],
    ['classic ignores platform ID and name', { kind: 'classic', levelId: '45', name: 'Platform Trial' }, { s: 'n', p: null }],
    ['rated non Extreme', { name: 'Other', diff: 'Insane Demon', rating: 'epic' }, { s: 'n', p: null }],
    ['unrated Extreme', { name: 'Other', diff: 'Extreme Demon', rating: 'unrated' }, { s: 'n', p: null }],
    ['unknown rating', { name: 'Other', diff: 'Extreme Demon', rating: null }, { s: 'n', p: null }],
    ['invalid rating', { name: 'Other', diff: 'Extreme Demon', rating: 'unknown' }, { s: 'n', p: null }]
])
    test(`aredlStatus handles ${name} without mutating the level`, () => {
        const f = fixture(), before = structuredClone(level);
        assert.deepEqual({ ...f.app('aredlStatus')(level) }, expected);
        assert.deepEqual(level, before);
    });

for (const rating of ['rated', 'featured', 'epic', 'legendary', 'mythic'])
    for (const kind of ['classic', 'platform'])
        test(`an unlisted ${kind} Extreme Demon with tier ${rating} awaits placement`, () => {
            assert.deepEqual({ ...fixture().app('aredlStatus')({ name: 'New Extreme', kind, diff: 'Extreme Demon', rating }) }, { s: 'p', p: null });
        });

test('matchWithAredl preserves stored statuses with an empty cache', () => {
    const f = fixture({ localStorage: {} }), ar = { s: 'r', p: 5 }, levels = [{ name: 'Bloodbath', ar }];
    assert.deepEqual([...f.app('matchWithAredl')(levels)], []);
    assert.equal(levels[0].ar, ar);
});

test('matching replaces stale statuses while keeping existing metadata', () => {
    const f = fixture(), levels = [
        { name: 'Bloodbath', ar: { s: 'p' } },
        { name: 'Other', ar: { s: 'r' } },
        { name: 'Unknown', diff: 'Extreme Demon', rating: 'rated', ar: { s: 'n' } },
        { name: 'Bloodbath', levelId: '42', creator: 'Kept' }
    ];
    assert.deepEqual([...f.app('matchWithAredl')(levels)], [levels[0], levels[3]]);
    assert.equal(levels[0].levelId, '42');
    assert.equal(levels[0].creator, 'Publisher');
    assert.equal(levels[3].creator, 'Kept');
    assert.deepEqual(levels.map(l => ({ ...l.ar })), [{ s: 'r', p: 125 }, { s: 'n', p: null }, { s: 'p', p: null }, { s: 'r', p: 125 }]);
});

for (const failed of [false, true])
    test(`sync ${failed ? 'preserves statuses on download failure' : 'recomputes stale statuses after sheet and relay ratings'}`, async () => {
        const levels = [
            { name: 'Old pending', levelId: '100', ar: { s: 'p' } },
            { name: 'Old ranked', levelId: '101', ar: { s: 'r' } },
            { name: 'Sheet Extreme', levelId: '102' },
            { name: 'Relay Extreme', levelId: '103' },
            { name: 'Blood', ar: { s: 'r' } }
        ];
        const f = fixture({
            profile: { levels, wishlists: [] },
            document: { querySelector: () => ({}) }, renderSyncStatus() {}, save() {},
            fetch: async url => {
                if (url == 'data/levels.json')
                    return { ok: true, json: async () => [[100, 'Old pending', '', 9, 0, 0], [102, 'Sheet Extreme', '', 10, 0, 0]] };
                if (failed) throw Error('offline');
                return { json: async () => url.includes('arepl/') ? [] : [{ level_id: 42, name: 'Bloodbath', position: 125 }] };
            },
            fetchRelayLevelsById: async ids => ids.map(levelId => ({ levelId, diff: 'Extreme Demon', rating: 'rated' }))
        });
        const before = structuredClone(levels);
        await f.app('syncWithAredl()');
        if (failed) assert.deepEqual(levels, before);
        else {
            assert.deepEqual(levels.map(l => ({ ...l.ar })), [{ s: 'n', p: null }, { s: 'p', p: null }, { s: 'p', p: null }, { s: 'p', p: null }, { s: 'r', p: 125 }]);
            assert.equal(levels[4].rating, 'rated', 'the AREDL ID is available for rating enrichment');
        }
        assert.equal(f.app('ui.sync'), 0);
    });
