import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const createApp = () => loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/cloud-model.js'], { localStorage: {} });
const plain = value => {
    if (Array.isArray(value))
        return [...value].map(plain);
    if (value && typeof value == 'object')
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, plain(entry)]));
    return value;
};
const empty = () => ({ levels: [], order: { classic: [], platform: [] }, wishlists: [], tags: [] });
const level = (fields = {}) => ({
    id: 'n1', name: 'Étoile 星 🎮', kind: 'classic', levelId: '123456', creator: 'Creator',
    diff: 'Extreme Demon', rating: 'mythic', attN: 0, attC: 123, tN: 456, tP: 789, tPC: 10,
    date: '2026-11-11', link: 'https://example.com/video', enj: -10, lik: 0,
    notes: '  Private notes\n第二行  ', tags: ['Focus', '星'], deaths: { 0: 0, 43: 7, 100: 1 },
    ar: { s: 'r', p: 42 }, ...fields
});
const item = (fields = {}) => ({
    id: 'i1', name: 'Wishlist 星', levelId: '789', creator: 'Maker', diff: 'Hard', rating: 'featured',
    kind: 'platform', status: 'prog', pct: 0, chk: 1, ...fields
});

test('the cloud model exposes the five pure data functions', () => {
    const { app } = createApp();
    for (const name of ['profileRows', 'rowsProfile', 'canonicalJson', 'rowChanges', 'mergeRow'])
        assert.equal(app(`typeof ${name}`), 'function', name);
});

test('profileRows maps every level field and keeps private notes in their own row', () => {
    const { app } = createApp(), convert = app('profileRows');
    const input = { ...empty(), levels: [{ ...level(), legacy: 'discard', user_id: 'discard', version: 99 }] };
    const before = structuredClone(input), rows = convert(input);
    assert.deepEqual([...rows.keys()], ['levels:n1', 'level_notes:n1', 'level_tags:n1/Focus', 'level_tags:n1/星', 'list_orders:classic', 'list_orders:platform']);
    assert.deepEqual(plain(rows.get('levels:n1')), {
        table: 'levels', row: {
            id: 'n1', name: 'Étoile 星 🎮', kind: 'classic', level_id: 123456, creator: 'Creator',
            difficulty: 'Extreme Demon', rating: 'mythic', attempts_normal: 0, attempts_copy: 123,
            time_normal: 456, time_practice: 789, time_practice_copy: 10, completed_on: '2026-11-11',
            video_url: 'https://example.com/video', enjoyment: -10, liking: 0,
            deaths: { 0: 0, 43: 7, 100: 1 }, aredl_status: 'r', aredl_position: 42
        }
    });
    assert.deepEqual(plain(rows.get('level_notes:n1')), { table: 'level_notes', row: { level_id: 'n1', notes: '  Private notes\n第二行  ' } });
    assert.deepEqual(input, before);
});

test('profileRows normalizes missing and empty level values without losing zeroes', () => {
    const convert = createApp().app('profileRows');
    for (const value of [undefined, null, '']) {
        const source = Object.fromEntries(Object.keys(level()).map(key => [key, value]));
        source.id = 'empty';
        const rows = convert({ ...empty(), levels: [source] });
        assert.deepEqual(plain(rows.get('levels:empty').row), {
            id: 'empty', name: null, kind: null, level_id: null, creator: null, difficulty: null,
            rating: null, attempts_normal: null, attempts_copy: null, time_normal: null,
            time_practice: null, time_practice_copy: null, completed_on: null, video_url: null,
            enjoyment: null, liking: null, deaths: {}, aredl_status: null, aredl_position: null
        });
        assert.equal(rows.has('level_notes:empty'), false);
    }
    for (const notes of [undefined, null, '', ' \t\r\n ', '\u2003'])
        assert.equal(convert({ ...empty(), levels: [level({ notes })] }).has('level_notes:n1'), false);
    const row = convert({ ...empty(), levels: [level({ ar: { s: '', p: '' } })] }).get('levels:n1').row;
    assert.equal(row.aredl_status, null);
    assert.equal(row.aredl_position, null);
});

test('profileRows maps orders, wishlist positions and items, tag positions and optional settings', () => {
    const convert = createApp().app('profileRows');
    const source = {
        ...empty(), order: { classic: ['n2', 'n1'], platform: ['n3'] },
        wishlists: [
            { id: 'w2', name: 'Later', items: [item({ legacy: true }), item({ id: 'i2', status: 'done', pct: 100, chk: 0 })] },
            { id: 'w1', name: 'Now', items: [] }
        ],
        tags: [{ name: '星', color: '#abcdef', legacy: true }, { name: 'Focus', color: '#123456' }]
    };
    const rows = convert(source, { lang: 'en', theme: 'night', legacy: true });
    assert.deepEqual([...rows.keys()], [
        'list_orders:classic', 'list_orders:platform', 'wishlists:w2', 'wishlist_items:i1',
        'wishlist_items:i2', 'wishlists:w1', 'tags:星', 'tags:Focus', 'user_settings:me'
    ]);
    assert.deepEqual(plain(rows.get('list_orders:classic')), { table: 'list_orders', row: { kind: 'classic', level_ids: ['n2', 'n1'] } });
    assert.deepEqual(plain(rows.get('list_orders:platform').row), { kind: 'platform', level_ids: ['n3'] });
    assert.deepEqual(plain(rows.get('wishlists:w2').row), { id: 'w2', name: 'Later', position: 0, item_ids: ['i1', 'i2'] });
    assert.deepEqual(plain(rows.get('wishlists:w1').row), { id: 'w1', name: 'Now', position: 1, item_ids: [] });
    assert.deepEqual(plain(rows.get('wishlist_items:i1')), {
        table: 'wishlist_items', row: {
            id: 'i1', wishlist_id: 'w2', name: 'Wishlist 星', level_id: 789, creator: 'Maker',
            difficulty: 'Hard', rating: 'featured', kind: 'platform', status: 'prog', progress: 0, enrich_checked: true
        }
    });
    assert.equal(rows.get('wishlist_items:i2').row.enrich_checked, false);
    assert.equal(rows.get('wishlist_items:i2').row.progress, 100);
    assert.deepEqual(plain(rows.get('tags:星')), { table: 'tags', row: { name: '星', color: '#abcdef', position: 0 } });
    assert.deepEqual(plain(rows.get('tags:Focus').row), { name: 'Focus', color: '#123456', position: 1 });
    assert.deepEqual(plain(rows.get('user_settings:me')), { table: 'user_settings', row: { lang: 'en', theme: 'night' } });
    assert.equal(convert(empty()).has('user_settings:me'), false);
});

test('profileRows defaults optional wishlist fields to null and enrichment to a boolean', () => {
    const convert = createApp().app('profileRows');
    for (const value of [undefined, null, '']) {
        const source = { id: 'i', name: 'Sparse', status: 'todo', levelId: value, creator: value, diff: value, rating: value, kind: value };
        const rows = convert({ ...empty(), wishlists: [{ id: 'w', name: 'List', items: [source] }] });
        assert.deepEqual(plain(rows.get('wishlist_items:i').row), {
            id: 'i', wishlist_id: 'w', name: 'Sparse', level_id: null, creator: null, difficulty: null,
            rating: null, kind: null, status: 'todo', progress: null, enrich_checked: false
        });
    }
});

test('profileRows emits unique level_tags at their first positions, including names containing slashes', () => {
    const convert = createApp().app('profileRows');
    const source = { ...empty(), levels: [level({ tags: ['Z', 'Z', 'Focus/Next', 'A', 'Z'] }), level({ id: 'n2', tags: ['Z'] })] };
    const before = structuredClone(source), rows = convert(source);
    assert.deepEqual(plain([...rows].filter(([, entry]) => entry.table == 'level_tags')), [
        ['level_tags:n1/Z', { table: 'level_tags', row: { level_id: 'n1', tag_name: 'Z', position: 0 } }],
        ['level_tags:n1/Focus/Next', { table: 'level_tags', row: { level_id: 'n1', tag_name: 'Focus/Next', position: 2 } }],
        ['level_tags:n1/A', { table: 'level_tags', row: { level_id: 'n1', tag_name: 'A', position: 3 } }],
        ['level_tags:n2/Z', { table: 'level_tags', row: { level_id: 'n2', tag_name: 'Z', position: 0 } }]
    ]);
    assert.equal(Object.hasOwn(rows.get('levels:n1').row, 'tags'), false);
    assert.deepEqual(source, before);
});

test('level IDs become numeric rows only for all-digit values, then return as app strings', () => {
    const { app } = createApp(), encode = app('profileRows'), decode = app('rowsProfile');
    const cases = [
        ['123', 123], ['00042', 42], [42, 42], ['999999999999', 999999999999], ['0', 0],
        [null, null], [undefined, null], ['', null], [' ', null], ['12.3', null], ['-1', null],
        ['+1', null], ['0x10', null], ['1e3', null], ['123x', null], ['123\n', null], ['１２', null]
    ];
    for (const [levelId, expected] of cases) {
        const source = { ...empty(), levels: [level({ levelId })], wishlists: [{ id: 'w', name: 'List', items: [item({ levelId })] }] };
        const rows = encode(source);
        assert.equal(rows.get('levels:n1').row.level_id, expected, String(levelId));
        assert.equal(rows.get('wishlist_items:i1').row.level_id, expected, String(levelId));
        const rebuilt = decode(rows).profile, restored = expected === null ? null : String(expected);
        assert.equal(rebuilt.levels[0].levelId, restored);
        assert.equal(rebuilt.wishlists[0].items[0].levelId, restored);
    }
});

test('rowsProfile rebuilds every field and ignores server and legacy columns in all tables', () => {
    const { app } = createApp(), source = {
        ...empty(), levels: [level()], order: { classic: ['n1'], platform: [] },
        wishlists: [{ id: 'w', name: 'List', items: [item(), item({ id: 'i2', status: 'todo', chk: 0 })] }],
        tags: [{ name: 'Focus', color: '#123456' }]
    };
    delete source.wishlists[0].items[1].kind;
    delete source.wishlists[0].items[1].pct;
    const settings = { lang: 'es', theme: 'synth' };
    const rows = [...app('profileRows')(source, settings).values()].map(({ table, row }) => ({
        table, row: { ...row, user_id: 'owner', version: 17, created_at: '2026-11-11T00:00:00Z', updated_at: '2026-11-12T00:00:00Z', legacy: 'discard' }
    }));
    rows.push({ table: 'profiles', row: { id: 'owner', display_name: 'Not profile data' } });
    const before = structuredClone(rows);
    assert.deepEqual(plain(app('rowsProfile')(rows.values())), { profile: source, settings });
    assert.deepEqual(rows, before);
});

test('rowsProfile supplies the exact level field set, empty notes and missing collection defaults', () => {
    const convert = createApp().app('rowsProfile');
    assert.deepEqual(plain(convert([])), { profile: empty(), settings: null });
    const result = convert([
        { table: 'levels', row: { id: 'n', kind: 'platform', name: 'Sparse', legacy: true } },
        { table: 'level_notes', row: { level_id: 'unknown', notes: 'Orphan notes' } },
        { table: 'wishlist_items', row: { id: 'orphan', wishlist_id: 'missing' } }
    ]);
    assert.deepEqual(plain(result), {
        profile: {
            ...empty(), levels: [{
                id: 'n', kind: 'platform', name: 'Sparse', levelId: null, creator: null, diff: null,
                rating: null, attN: null, attC: null, tN: null, tP: null, tPC: null, date: null,
                link: null, enj: null, lik: null, notes: '', tags: [], deaths: {}, ar: { s: null, p: null }
            }]
        }, settings: null
    });
});

test('rowsProfile orders levels by creation time with id ties, or by id without timestamps', () => {
    const convert = createApp().app('rowsProfile');
    const rows = [
        { id: 'z', created_at: '2026-11-11T03:00:00+02:00' },
        { id: 'b', created_at: '2026-11-11T00:00:00Z' },
        { id: 'a', created_at: '2026-11-11T00:00:00Z' },
        { id: 'c', created_at: '2026-11-11T00:30:00Z' }
    ].map(row => ({ table: 'levels', row }));
    assert.deepEqual([...convert(rows).profile.levels].map(entry => entry.id), ['a', 'b', 'c', 'z']);
    assert.deepEqual([...convert(rows.map(({ table, row: { id } }) => ({ table, row: { id } }))).profile.levels].map(entry => entry.id), ['a', 'b', 'c', 'z']);
});

test('rowsProfile rebuilds tags by position then name and drops assignments for unknown levels', () => {
    const convert = createApp().app('rowsProfile');
    const rows = [
        { table: 'level_tags', row: { level_id: 'n1', tag_name: 'Z', position: 2 } },
        { table: 'level_tags', row: { level_id: 'unknown', tag_name: 'Orphan', position: 0 } },
        { table: 'levels', row: { id: 'n2', tags: ['Ignored legacy column'] } },
        { table: 'level_tags', row: { level_id: 'n1', tag_name: 'Focus/Next', position: 0 } },
        { table: 'levels', row: { id: 'n1' } },
        { table: 'level_tags', row: { level_id: 'n1', tag_name: 'A', position: 2 } }
    ];
    const before = structuredClone(rows), result = convert(rows).profile;
    assert.deepEqual([...result.levels].map(entry => ({ id: entry.id, tags: [...entry.tags] })), [
        { id: 'n1', tags: ['Focus/Next', 'A', 'Z'] }, { id: 'n2', tags: [] }
    ]);
    assert.deepEqual(rows, before);
});

test('rowsProfile orders wishlists and tags by position and identity, and items by item_ids then stray ids', () => {
    const convert = createApp().app('rowsProfile');
    const rows = [
        { table: 'wishlist_items', row: { id: 'stray-z', wishlist_id: 'a', status: 'done' } },
        { table: 'wishlists', row: { id: 'z', name: 'Last', position: 2, item_ids: [] } },
        { table: 'tags', row: { name: 'Z', color: '#123456', position: 0 } },
        { table: 'wishlists', row: { id: 'b', name: 'Second', position: 0, item_ids: [] } },
        { table: 'wishlist_items', row: { id: 'second', wishlist_id: 'a', status: 'prog' } },
        { table: 'wishlist_items', row: { id: 'orphan', wishlist_id: 'missing', status: 'todo' } },
        { table: 'tags', row: { name: 'First', color: '#123456', position: 0 } },
        { table: 'wishlist_items', row: { id: 'stray-a', wishlist_id: 'a', status: 'todo' } },
        { table: 'wishlists', row: { id: 'a', name: 'First', position: 0, item_ids: ['first', 'missing', 'second', 'orphan'] } },
        { table: 'wishlist_items', row: { id: 'first', wishlist_id: 'a', status: 'todo' } },
        { table: 'tags', row: { name: 'A', color: '#123456', position: 2 } }
    ];
    const result = convert(rows).profile;
    assert.deepEqual([...result.wishlists].map(entry => entry.id), ['a', 'b', 'z']);
    assert.deepEqual([...result.wishlists[0].items].map(entry => entry.id), ['first', 'second', 'stray-a', 'stray-z']);
    assert.deepEqual([...result.wishlists[1].items], []);
    assert.deepEqual([...result.tags].map(entry => entry.name), ['First', 'Z', 'A']);
});

function seededRandom(seed) {
    return () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}

test('250 seeded profiles round-trip after defaults and normalize randomly missing optional fields', () => {
    const { app, context } = createApp(), random = seededRandom(0xc10d), choose = values => values[Math.floor(random() * values.length)];
    for (let sample = 0; sample < 250; sample++) {
        const source = empty(), settings = { lang: choose(['es', 'en']), theme: choose(['blue', 'night', 'synth']) };
        const tagNames = ['Focus', '星 🎮', 'Éxito', 'Next/Goal'];
        source.tags = tagNames.slice(0, Math.floor(random() * 5)).map(name => ({ name, color: choose(['#123456', '#abcdef', '#00ff00']) }));
        source.levels = Array.from({ length: Math.floor(random() * 8) }, (_, index) => level({
            id: `n${index}`, name: choose(['星 🎮', 'Étoile', 'Level', 'ñ']), kind: choose(['classic', 'platform']),
            levelId: choose([null, String(1 + Math.floor(random() * 999999999999))]), creator: choose([null, 'Creator 星']),
            diff: choose([null, 'Auto', 'Extreme Demon']), rating: choose([null, 'unrated', 'mythic']),
            attN: choose([null, 0, 1000000000]), attC: choose([null, 0, 17]),
            tN: choose([null, 0, 12345]), tP: choose([null, 0, 42]), tPC: choose([null, 0, 60]),
            date: choose([null, '2026-11-11']), link: choose([null, 'https://example.com/🎮']),
            enj: choose([null, -10, 0, 10]), lik: choose([null, -10, 0, 10]), notes: choose(['', '星\n  Notes  ']),
            tags: Array.from({ length: Math.floor(random() * 7) }, () => choose(tagNames)),
            deaths: random() < 0.5 ? {} : { 0: 0, [Math.floor(random() * 100) + 1]: Math.floor(random() * 100) },
            ar: choose([{ s: null, p: null }, { s: 'n', p: null }, { s: 'p', p: null }, { s: 'r', p: 1 }])
        }));
        for (const kind of ['classic', 'platform'])
            source.order[kind] = source.levels.filter(entry => entry.kind == kind).map(entry => entry.id).reverse();
        source.wishlists = Array.from({ length: 2 + Math.floor(random() * 3) }, (_, listIndex) => ({
            id: `w${listIndex}`, name: choose(['星 🎮', 'Wishlist', 'Éxito']),
            items: ['todo', 'prog', 'done'].map((status, index) => {
                const entry = item({
                    id: `i${listIndex}_${index}`, status, name: choose(['星 🎮', 'Soon', 'é']),
                    levelId: choose([null, String(1 + Math.floor(random() * 999999999999))]), creator: choose([null, 'Maker']), diff: choose([null, 'Hard']),
                    rating: choose([null, 'epic']), chk: choose([0, 1])
                });
                if (random() < 0.5) delete entry.kind;
                if (random() < 0.5) delete entry.pct;
                else entry.pct = choose([0, 42, 100]);
                return entry;
            }).reverse()
        }));
        context.sampleProfile = source;
        app('profile = sampleProfile; ensureProfileDefaults()');
        const before = structuredClone(source);
        assert.deepEqual(plain(app('rowsProfile')(app('profileRows')(source, settings))), { profile: before, settings }, `sample ${sample}`);
        assert.deepEqual(plain(source), before, `sample ${sample} was mutated`);
        const sparse = structuredClone(source);
        for (const entry of sparse.levels) {
            for (const field of ['levelId', 'creator', 'diff', 'rating', 'attN', 'attC', 'tN', 'tP', 'tPC', 'date', 'link', 'enj', 'lik']) {
                if (entry[field] === null && random() < 0.5)
                    delete entry[field];
            }
            if (!entry.notes && random() < 0.5) delete entry.notes;
            if (!entry.tags.length && random() < 0.5) delete entry.tags;
            if (!Object.keys(entry.deaths).length && random() < 0.5) delete entry.deaths;
            if (entry.ar.s === null && random() < 0.5) delete entry.ar;
        }
        context.sampleProfile = sparse;
        app('profile = sampleProfile; ensureProfileDefaults()');
        assert.deepEqual(plain(app('rowsProfile')(app('profileRows')(sparse, settings))), { profile: before, settings }, `sparse sample ${sample}`);
    }
});

test('canonicalJson sorts object keys at every depth and preserves array order and JSON values', () => {
    const canonical = createApp().app('canonicalJson');
    const left = { z: [{ b: 2, a: 1 }, null, false], a: { z: {}, a: [3, 2, 1] } };
    const right = { a: { a: [3, 2, 1], z: {} }, z: [{ a: 1, b: 2 }, null, false] };
    assert.equal(canonical(left), '{"a":{"a":[3,2,1],"z":{}},"z":[{"a":1,"b":2},null,false]}');
    assert.equal(canonical(left), canonical(right));
    assert.notEqual(canonical([1, 2]), canonical([2, 1]));
    assert.equal(canonical(undefined), undefined);
    assert.equal(canonical(null), 'null');
    assert.equal(canonical('é'), '"é"');
    assert.equal(canonical({ missing: undefined, value: 0 }), '{"value":0}');
});

test('rowChanges emits added, changed and deleted rows with snapshot versions and ignores reordered keys', () => {
    const changes = createApp().app('rowChanges');
    const current = new Map([
        ['levels:add', { table: 'levels', row: { id: 'add', name: 'New' } }],
        ['levels:change', { table: 'levels', row: { id: 'change', deaths: { 5: 2 } } }],
        ['levels:same', { table: 'levels', row: { deaths: { b: 2, a: 1 }, id: 'same' } }]
    ]);
    const snapshot = new Map([
        ['levels:change', { version: 4, row: { id: 'change', deaths: { 5: 1 } } }],
        ['levels:same', { version: 7, row: { id: 'same', deaths: { a: 1, b: 2 } } }],
        ['tags:removed', { version: 2, row: { name: 'removed', color: '#123456' } }]
    ]);
    const before = structuredClone({ current, snapshot });
    assert.deepEqual(plain(changes(current, snapshot)), [
        { key: 'levels:add', table: 'levels', version: null, row: { id: 'add', name: 'New' } },
        { key: 'levels:change', table: 'levels', version: 4, row: { id: 'change', deaths: { 5: 2 } } },
        { key: 'tags:removed', table: 'tags', version: 2, row: null }
    ]);
    assert.deepEqual({ current, snapshot }, before);
    assert.deepEqual([...changes(new Map(), new Map())], []);
});

test('rowChanges upserts parents before children, then deletes children before parents', () => {
    const changes = createApp().app('rowChanges');
    const current = new Map([
        ['level_tags:n/new', { table: 'level_tags', row: { level_id: 'n', tag_name: 'new', position: 0 } }],
        ['wishlist_items:i', { table: 'wishlist_items', row: { id: 'i', wishlist_id: 'w' } }],
        ['level_notes:n', { table: 'level_notes', row: { level_id: 'n', notes: 'New' } }],
        ['tags:new', { table: 'tags', row: { name: 'new', color: '#123456' } }],
        ['wishlists:w', { table: 'wishlists', row: { id: 'w', name: 'Changed' } }],
        ['levels:n', { table: 'levels', row: { id: 'n', name: 'New' } }],
        ['user_settings:me', { table: 'user_settings', row: { lang: 'en', theme: 'night' } }]
    ]);
    const snapshot = new Map([
        ['wishlists:removed', { version: 1, row: { id: 'removed' } }],
        ['wishlists:w', { version: 3, row: { id: 'w', name: 'Before' } }],
        ['levels:removed', { version: 8, row: { id: 'removed' } }],
        ['tags:removed', { version: 4, row: { name: 'removed' } }],
        ['level_tags:removed/removed', { version: 6, row: { level_id: 'removed', tag_name: 'removed', position: 0 } }],
        ['level_notes:removed', { version: 7, row: { level_id: 'removed', notes: 'Old' } }],
        ['wishlist_items:removed', { version: 5, row: { id: 'removed' } }]
    ]);
    const result = [...changes(current, snapshot)], keys = result.map(entry => entry.key);
    assert.ok(keys.indexOf('wishlists:w') < keys.indexOf('wishlist_items:i'));
    assert.ok(keys.indexOf('levels:n') < keys.indexOf('level_notes:n'));
    assert.ok(keys.indexOf('tags:new') < keys.indexOf('level_notes:n'));
    assert.ok(keys.indexOf('levels:n') < keys.indexOf('level_tags:n/new'));
    assert.ok(keys.indexOf('tags:new') < keys.indexOf('level_tags:n/new'));
    assert.equal(result.length, 13);
    assert.ok(result.slice(0, 7).every(entry => entry.row !== null));
    assert.ok(result.slice(7).every(entry => entry.row === null));
    for (const child of ['level_tags:removed/removed', 'level_notes:removed', 'wishlist_items:removed']) {
        for (const parent of ['levels:removed', 'tags:removed', 'wishlists:removed'])
            assert.ok(keys.indexOf(child) < keys.indexOf(parent), `${child} before ${parent}`);
    }
    assert.equal(result.find(entry => entry.key == 'wishlists:w').version, 3);
    assert.equal(result.find(entry => entry.key == 'wishlist_items:removed').version, 5);
});

test('rowChanges compares tag assignments by position and keeps composite keys intact on deletion', () => {
    const changes = createApp().app('rowChanges');
    assert.deepEqual(plain(changes(new Map([
        ['level_tags:n/Focus/Next', { table: 'level_tags', row: { level_id: 'n', tag_name: 'Focus/Next', position: 2 } }]
    ]), new Map([
        ['level_tags:n/Focus/Next', { version: 4, row: { level_id: 'n', tag_name: 'Focus/Next', position: 0 } }],
        ['level_tags:n/Old/Tag', { version: 5, row: { level_id: 'n', tag_name: 'Old/Tag', position: 1 } }]
    ]))), [
        { key: 'level_tags:n/Focus/Next', table: 'level_tags', version: 4, row: { level_id: 'n', tag_name: 'Focus/Next', position: 2 } },
        { key: 'level_tags:n/Old/Tag', table: 'level_tags', version: 5, row: null }
    ]);
});

test('rowChanges treats array reorders as changes and handles the fixed settings key on deletion', () => {
    const changes = createApp().app('rowChanges');
    assert.deepEqual(plain(changes(new Map([
        ['list_orders:classic', { table: 'list_orders', row: { kind: 'classic', level_ids: ['b', 'a'] } }]
    ]), new Map([
        ['list_orders:classic', { version: 2, row: { level_ids: ['a', 'b'], kind: 'classic' } }],
        ['user_settings:me', { version: 3, row: { lang: 'es', theme: 'blue' } }]
    ]))), [
        { key: 'list_orders:classic', table: 'list_orders', version: 2, row: { kind: 'classic', level_ids: ['b', 'a'] } },
        { key: 'user_settings:me', table: 'user_settings', version: 3, row: null }
    ]);
});

test('mergeRow takes remote-only edits, local-only edits and identical simultaneous edits without conflicts', () => {
    const merge = createApp().app('mergeRow');
    assert.deepEqual(plain(merge(
        { same: 1, remoteOnly: 1, localOnly: 1, both: 1, nullable: null },
        { same: 1, remoteOnly: 1, localOnly: 2, both: 2, nullable: null },
        { same: 1, remoteOnly: 2, localOnly: 1, both: 2, nullable: 0 }
    )), { row: { same: 1, remoteOnly: 2, localOnly: 2, both: 2, nullable: 0 }, conflicts: [] });
});

test('mergeRow compares nested fields canonically and reports every conflict with remote winning', () => {
    const merge = createApp().app('mergeRow');
    const base = { name: 'Base', deaths: { 5: 1 }, tags: ['A'], meta: { a: 1, b: 2 }, local: 1 };
    const local = { name: 'Local', deaths: { 5: 2 }, tags: ['A', 'B'], meta: { b: 2, a: 1 }, local: 2 };
    const remote = { name: 'Remote', deaths: { 6: 3 }, tags: ['B', 'A'], meta: { a: 3, b: 2 }, local: 1 };
    const before = structuredClone({ base, local, remote }), result = merge(base, local, remote);
    assert.deepEqual(plain(result.row), { name: 'Remote', deaths: { 6: 3 }, tags: ['B', 'A'], meta: { a: 3, b: 2 }, local: 2 });
    assert.deepEqual([...result.conflicts].sort(), ['deaths', 'name', 'tags']);
    assert.deepEqual({ base, local, remote }, before);
    assert.deepEqual(plain(merge({ tags: ['A'] }, { tags: ['A', 'B'] }, { tags: ['A', 'B'] })), { row: { tags: ['A', 'B'] }, conflicts: [] });
    assert.deepEqual(plain(merge(
        { deaths: { a: 0 }, tags: [] },
        { deaths: { a: 1, b: 2 }, tags: [] },
        { deaths: { b: 2, a: 1 }, tags: ['Remote'] }
    )), { row: { deaths: { a: 1, b: 2 }, tags: ['Remote'] }, conflicts: [] });
});

test('mergeRow handles new and removed fields and a null base', () => {
    const merge = createApp().app('mergeRow');
    assert.deepEqual(plain(merge(null, { a: 1, shared: null }, { b: 2, shared: null })), { row: { a: 1, b: 2, shared: null }, conflicts: [] });
    assert.deepEqual(plain(merge(null, { value: 0 }, { value: null })), { row: { value: null }, conflicts: ['value'] });
    assert.deepEqual(plain(merge({ a: 1, b: 2, c: 3 }, { b: 2, c: 3 }, { a: 1, c: 3 })), { row: { c: 3 }, conflicts: [] });
    const result = merge({ value: 1 }, { value: 2 }, {});
    assert.deepEqual(plain(result), { row: {}, conflicts: ['value'] });
});

test('mergeRow ignores all server columns, including when one side is null', () => {
    const merge = createApp().app('mergeRow');
    const server = { user_id: 'owner', version: 2, created_at: 'yesterday', updated_at: 'today' };
    assert.deepEqual(plain(merge({ value: 1, ...server }, { value: 1, ...server, version: 3 }, { value: 2, ...server, version: 4 })), { row: { value: 2 }, conflicts: [] });
    for (const [local, remote] of [[{ value: 1, ...server }, null], [null, { value: 1, ...server }]])
        assert.deepEqual(plain(merge({ value: 0 }, local, remote)), { row: { value: 1 }, conflicts: [] });
    assert.deepEqual(plain(merge({ value: 0 }, null, null)), { row: null, conflicts: [] });
});
