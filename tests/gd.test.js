import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ localStorage: {} });
for (const file of ['js/config.js', 'js/utils.js', 'js/state.js', 'js/api.js', 'js/sheet.js', 'js/gd.js'])
    vm.runInContext(readFileSync(file, 'utf8'), context, { filename: file });
const app = name => vm.runInContext(name, context);

const result = extra => ({ id: '10565740', name: 'Bloodbath', author: 'Riot', difficulty: 'Extreme Demon', stars: 10, downloads: 193000000, platformer: false, featured: false, epic: false, legendary: false, mythic: false, ...extra });
const filters = extra => ({ rated: 'all', rates: [], diffs: [], ...extra });

test('difficulty uses NA for unrated levels and missing difficulties', () => {
    const difficultyOf = app('difficultyOf');
    assert.equal(difficultyOf({ rating: 'unrated', diff: 'Hard' }), 'NA');
    assert.equal(difficultyOf({ rating: 'rated', diff: null }), 'NA');
    assert.equal(difficultyOf({ rating: 'epic', diff: 'Hard Demon' }), 'Hard Demon');
});

test('Rated includes star-only levels and moons, while Unrated excludes both', () => {
    const matches = app('matchesSearchFilters');
    for (const platformer of [false, true]) {
        const level = app('fromGdb')(result({ platformer }));
        assert.equal(matches(level, filters({ rated: 'rated' })), true);
        assert.equal(matches(level, filters({ rated: 'unrated' })), false);
    }
    assert.equal(matches({ rating: 'unrated', diff: 'Hard' }, filters({ diffs: ['NA'] })), true);
});

test('rating tiers and difficulties are OR within each selection and AND across selections', () => {
    const matches = app('matchesSearchFilters');
    const f = filters({ rated: 'rated', rates: ['rated', 'epic'], diffs: ['Hard Demon', 'Extreme Demon'] });
    for (const rating of ['unrated', 'rated', 'featured', 'epic', 'legendary', 'mythic'])
        for (const diff of ['Hard', 'Hard Demon', 'Extreme Demon'])
            assert.equal(matches({ rating, diff }, f), ['rated', 'epic'].includes(rating) && ['Hard Demon', 'Extreme Demon'].includes(diff), rating + ' / ' + diff);
});

test('inapplicable selections are ignored without being lost', () => {
    const matches = app('matchesSearchFilters');
    const f = filters({ rates: ['epic'], diffs: ['NA', 'Hard'] });
    const before = structuredClone(f);
    assert.equal(matches({ rating: 'rated', diff: 'Hard' }, f), true);
    assert.equal(matches({ rating: 'unrated', diff: 'Easy' }, { ...f, rated: 'unrated' }), true);
    assert.equal(matches({ rating: 'epic', diff: null }, { ...f, rated: 'rated' }), false);
    assert.equal(matches({ rating: 'epic', diff: 'Easy' }, filters({ rated: 'rated', diffs: ['NA'] })), true);
    assert.equal(matches({ rating: 'rated', diff: 'Hard' }, { ...f, rated: 'rated' }), false);
    assert.deepEqual(f, before);
});

test('search parameters use rating flags only when their selections apply', () => {
    const params = app('searchParams');
    const cases = [
        [{}, ''],
        [{ rates: ['epic'] }, ''],
        [{ rated: 'unrated', rates: ['epic'], diffs: ['Hard'] }, '&noStar'],
        [{ diffs: ['NA'] }, '&noStar'],
        [{ rated: 'rated' }, '&starred'],
        [{ rated: 'rated', rates: ['rated'] }, '&starred'],
        [{ rated: 'rated', rates: ['epic', 'mythic'] }, '&starred'],
        [{ rated: 'rated', diffs: ['NA'] }, '&starred'],
        [{ diffs: ['NA', 'Hard'], rates: ['epic'] }, ''],
        [{ diffs: ['Hard'], rates: ['epic'] }, '&starred&diff=3']
    ];
    for (const [f, expected] of cases)
        assert.equal(params(filters(f)), expected, JSON.stringify(f));
    for (const tier of ['featured', 'epic', 'legendary', 'mythic'])
        assert.equal(params(filters({ rated: 'rated', rates: [tier] })), '&' + tier);
});

test('search parameters narrow supported difficulty groups and leave mixed groups broad', () => {
    const params = app('searchParams');
    const cases = [
        [['Insane', 'Easy', 'Hard', 'Normal', 'Harder'], '&starred&diff=1,2,3,4,5'],
        [['Harder', 'Normal'], '&starred&diff=2,4'],
        [['Auto'], '&starred&diff=-3'],
        [['Hard Demon', 'Extreme Demon'], '&starred&diff=-2'],
        [['Auto', 'Easy'], '&starred'],
        [['Auto', 'Easy Demon'], '&starred'],
        [['Hard', 'Extreme Demon'], '&starred'],
        [['NA', 'Hard Demon'], '']
    ];
    for (const [diffs, expected] of cases)
        assert.equal(params(filters({ diffs })), expected, diffs.join(', '));
    for (const [i, diff] of ['Easy Demon', 'Medium Demon', 'Hard Demon', 'Insane Demon', 'Extreme Demon'].entries())
        assert.equal(params(filters({ diffs: [diff] })), '&starred&diff=-2&demonFilter=' + (i + 1));
    assert.equal(params(filters({ rated: 'rated', rates: ['epic'], diffs: ['NA', 'Hard'] })), '&epic&diff=3');
});

test('search filters server results again, sorts downloads and keeps raw-page pagination', async () => {
    const asked = [];
    context.fetch = async url => {
        asked.push(url);
        return { ok: true, json: async () => [result({ id: '156124', name: 'Dash of dash 2', downloads: 5 }), result({ id: '2', epic: true, downloads: 100 }), result({ id: '3', stars: 0 }), ...Array.from({ length: 7 }, () => result({ id: 'bad' }))] };
    };
    const found = await app('searchLevels')('dash / 2', filters({ rated: 'rated' }), 3);
    assert.equal(asked[0], 'https://gdbrowser.com/api/search/dash%20%2F%202?page=3&starred');
    assert.deepEqual(Array.from(found.levels, l => l.levelId), ['2', '156124']);
    assert.equal(found.more, true);
    const epic = await app('searchLevels')('dash', filters({ rated: 'rated', rates: ['epic'] }), 0);
    assert.deepEqual(Array.from(epic.levels, l => l.levelId), ['2']);
    const unrated = await app('searchLevels')('dash', filters({ rated: 'unrated' }), 0);
    assert.deepEqual(Array.from(unrated.levels, l => l.levelId), ['3']);
});

test('empty server responses and search failures retain the existing fallback behavior', async () => {
    context.fetch = async () => ({ ok: true, json: async () => -1 });
    let found = await app('searchLevels')('dash', filters(), 0);
    assert.equal(found.levels.length, 0);
    assert.equal(found.more, false);
    context.fetch = async url => ({ ok: url.endsWith('level/128'), status: 500 });
    found = await app('searchLevels')('dash', filters(), 0);
    assert.equal(found.levels.length, 0);
    assert.equal(found.more, false);
    context.fetch = async () => { throw Error('offline'); };
    await assert.rejects(app('searchLevels')('dash', filters(), 0), /offline/);
});

test('a GDBrowser result keeps its ID, name, creator, difficulty, list and downloads', () => {
    assert.deepEqual({ ...app('fromGdb')(result({ featured: true })) }, { levelId: '10565740', name: 'Bloodbath', creator: 'Riot', diff: 'Extreme Demon', rating: 'featured', kind: 'classic', downloads: 193000000 });
});

test('the highest rating wins, and a level without stars is unrated with no difficulty', () => {
    const fromGdb = app('fromGdb');
    assert.equal(fromGdb(result({})).rating, 'rated');
    assert.equal(fromGdb(result({ featured: true, epic: true })).rating, 'epic');
    assert.equal(fromGdb(result({ featured: true, epic: true, legendary: true })).rating, 'legendary');
    assert.equal(fromGdb(result({ featured: true, mythic: true })).rating, 'mythic');
    const unrated = fromGdb(result({ stars: 0, difficulty: 'Hard', featured: true }));
    assert.equal(unrated.rating, 'unrated');
    assert.equal(unrated.diff, null);
});

test('platformers, unknown creators and unknown difficulties are read safely', () => {
    const l = app('fromGdb')(result({ platformer: true, author: '-', difficulty: 'Weird' }));
    assert.equal(l.kind, 'platform');
    assert.equal(l.creator, null);
    assert.equal(l.diff, null);
});

test('search text is trimmed and collapsed, and text with nothing to search for is rejected', () => {
    const cleanQuery = app('cleanQuery');
    assert.equal(cleanQuery('  sonic   wave '), 'sonic wave');
    assert.equal(cleanQuery('26681070'), '26681070');
    assert.equal(cleanQuery('Ñandú'), 'Ñandú');
    assert.equal(cleanQuery(' *** '), '');
    assert.equal(cleanQuery(''), '');
});

test('fillRatings fills difficulty and rating of saved levels without one, ten IDs per request', async () => {
    const asked = [];
    context.fetch = async url => {
        asked.push(url);
        return { json: async () => url.includes('10565740') ? [result({ featured: true }), result({ id: '13519', difficulty: 'Easy Demon', stars: 10, epic: true, featured: true })] : -1 };
    };
    const levels = [{ levelId: '10565740', diff: 'Hard Demon' }, { levelId: '13519' }, { levelId: '999', rating: 'rated' }, { levelId: null }, ...Array.from({ length: 9 }, (_, i) => ({ levelId: String(100 + i) }))];
    await app('fillRatings')(levels);
    assert.equal(asked.length, 2, '11 levels without a rating take two requests');
    assert.match(asked[0], /search\/10565740,13519,100,.*\?list$/);
    assert.deepEqual([levels[0].diff, levels[0].rating], ['Extreme Demon', 'featured']);
    assert.deepEqual([levels[1].diff, levels[1].rating], ['Easy Demon', 'epic']);
    assert.equal(levels[2].rating, 'rated', 'a level that has a rating is not asked for');
    assert.equal(levels[12].rating, undefined, 'a level the API does not return keeps no rating');
});
