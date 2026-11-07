import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const { context, app } = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/api.js', 'js/sheet.js', 'js/gdbrowser.js', 'js/gd.js'], { localStorage: {}, AbortSignal });

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
        return { ok: true, json: async () => url.includes('10565740') ? [result({ featured: true }), result({ id: '13519', difficulty: 'Easy Demon', stars: 10, epic: true, featured: true })] : -1 };
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

const freshSearch = (rows = [], remote = []) => {
    let now = 1000;
    const asked = [];
    const scripts = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/api.js', 'js/sheet.js', 'js/gdbrowser.js', 'js/gd.js'], {
        localStorage: {}, AbortSignal, Date: { now: () => now },
        fetch: async url => {
            asked.push(url);
            if (url == 'data/levels.json')
                return { ok: rows != null, json: async () => rows };
            return { ok: remote != null, status: 403, json: async () => remote };
        }
    });
    return { ...scripts, asked, advance(ms) { now += ms; } };
};

test('coverage describes rated, all and unrated scopes with only the sheet', async () => {
    const cases = [
        [{ rated: 'rated' }, 'complete', 1], [{}, 'partial', 1], [{ rated: 'unrated' }, 'unavailable', 0],
        [{ diffs: ['Hard'] }, 'complete', 1], [{ diffs: ['NA'] }, 'unavailable', 0],
        [{ diffs: ['NA', 'Hard'] }, 'partial', 1]
    ];
    for (const [f, coverage, count] of cases) {
        const search = freshSearch([[1, 'Comb', '', 3, 0, 2]], null);
        const state = await search.app('startLevelSearch')('comb', filters(f));
        const page = await search.app('nextLevelSearchPage')(state);
        assert.equal(page.coverage, coverage, JSON.stringify(f));
        assert.equal(page.levels.length, count);
    }
});

test('a working game covers a failed sheet; both failing reports error', async () => {
    for (const [remote, coverage] of [[[result({})], 'complete'], [null, 'error']]) {
        const search = freshSearch(null, remote);
        const state = await search.app('startLevelSearch')('blood', filters());
        assert.equal(state.local, null);
        const page = await search.app('nextLevelSearchPage')(state);
        assert.equal(page.coverage, coverage);
        assert.equal(page.levels.length, remote ? 1 : 0);
    }
});

test('local matches rank ID first, then normalized exact, prefix, substring and length', async () => {
    const search = freshSearch([[1, 'Honeycomb Runner', '', 3], [2, 'COMB', '', 3], [3, 'Catacomb', '', 3], [4, 'Comb Breaker', '', 3], [5, 'Comb A', '', 3], [6, 'Cursed Catacombs', '', 3, 1], [7, 'Cóm b', '', 3], [8, 'Unrelated', '', 3]], null);
    const state = await search.app('startLevelSearch')('cOmB', filters());
    assert.deepEqual(Array.from(state.local, l => l.levelId), ['2', '7', '5', '4', '3', '1', '6']);
    const page = await search.app('nextLevelSearchPage')(state);
    assert.deepEqual(Array.from(page.levels, l => l.levelId), ['2', '7', '5', '4', '3', '1', '6']);
    const idSearch = freshSearch([[123, 'Other', '', 3], [1, '123', '', 1], [2, '123 prefix', '', 3], [3, 'x123', '', 3]], null);
    const byId = await idSearch.app('startLevelSearch')('123', filters());
    assert.deepEqual(Array.from((await idSearch.app('nextLevelSearchPage')(byId)).levels, l => l.levelId), ['123', '1', '2', '3']);
});

test('unknown cached tiers pass Rated but fail an explicit tier filter', async () => {
    const search = freshSearch([[1, 'Comb old', '', 3, 0], [2, 'Comb epic', '', 3, 0, 2], [3, 'Comb unknown', '', 3, 0, -1]], null);
    const rated = await search.app('startLevelSearch')('comb', filters({ rated: 'rated' }));
    assert.equal(rated.local.length, 3);
    const epic = await search.app('startLevelSearch')('comb', filters({ rated: 'rated', rates: ['epic'] }));
    assert.deepEqual(Array.from(epic.local, l => l.levelId), ['2']);
});

test('merged duplicates prefer current game fields and fill nulls from the sheet before filtering', async () => {
    const search = freshSearch([[1, 'Comb old', 'Sheet creator', 3, 1, 4], [2, 'Comb stale', 'Old', 3, 0, 2], [3, 'Comb rerated', 'Same', 3, 0, 0]], [result({ id: 1, name: 'Comb live', author: '-', difficulty: 'Unknown', epic: true, downloads: 0 }), result({ id: 2, name: 'Comb stale', stars: 0 }), result({ id: 3, name: 'Comb rerated', difficulty: 'Insane', stars: 8 })]);
    const state = await search.app('startLevelSearch')('comb', filters({ rated: 'rated' }));
    const page = await search.app('nextLevelSearchPage')(state);
    assert.deepEqual({ ...page.levels.find(l => l.levelId == '1') }, { levelId: '1', name: 'Comb live', creator: 'Sheet creator', diff: 'Hard', rating: 'epic', kind: 'classic', downloads: 0 });
    assert.equal(page.levels.find(l => l.levelId == '3').diff, 'Insane', 'a difficulty the game knows wins over the sheet');
    assert.equal(page.coverage, 'complete');
    assert.equal(search.asked.some(url => url.endsWith('?list')), false);
    const all = await search.app('nextLevelSearchPage')(await search.app('startLevelSearch')('comb', filters()));
    assert.deepEqual([...all.levels.map(l => [l.levelId, l.rating, l.diff])].sort(), [['1', 'epic', 'Hard'], ['2', 'unrated', null], ['3', 'rated', 'Insane']], 'a level the game now lists as unrated takes no difficulty from the sheet');
});

test('pages rank ID, name match, known downloads descending, unknown downloads, then name length', async () => {
    const search = freshSearch([[8, '123 unknown longer', '', 3], [9, '123 unknown', '', 3], [10, '123 a', '', 3]], [result({ id: 123, name: 'Other', downloads: null }), result({ id: 1, name: '123', downloads: 0 }), result({ id: 2, name: '123 popular', downloads: 100 }), result({ id: 3, name: '123 zero', downloads: 0 }), result({ id: 4, name: 'x123', downloads: 9000 })]);
    const state = await search.app('startLevelSearch')('123', filters());
    const page = await search.app('nextLevelSearchPage')(state);
    assert.deepEqual(Array.from(page.levels, l => l.levelId), ['123', '1', '2', '3', '10', '9', '8', '4'], 'a known zero ranks above a shorter name with unknown downloads');
});

test('server results are rechecked and raw ten-entry pages still have more', async () => {
    const search = freshSearch([], [result({ id: 1, epic: true, difficulty: 'Hard' }), result({ id: 2, stars: 0 }), result({ id: 3, difficulty: 'Easy' }), ...Array.from({ length: 7 }, () => result({ id: 'bad' }))]);
    const state = await search.app('startLevelSearch')('dash / 2', filters({ rated: 'rated', rates: ['epic'], diffs: ['Hard'] }));
    const page = await search.app('nextLevelSearchPage')(state);
    assert.deepEqual(Array.from(page.levels, l => l.levelId), ['1']);
    assert.equal(page.more, true);
    assert.equal(search.asked.at(-1), 'https://gdbrowser.com/api/search/dash%20%2F%202?page=0&epic&diff=3');
});

test('a page-two failure stops game pages for that search while all local pages continue, even after recovery', async () => {
    const search = freshSearch(Array.from({ length: 35 }, (_, i) => [i + 1, 'Comb ' + String(i).padStart(2, '0'), '', 3, 0, 2]), Array.from({ length: 10 }, (_, i) => result({ id: i + 101, name: 'Comb live ' + i })));
    const state = await search.app('startLevelSearch')('comb', filters());
    const first = await search.app('nextLevelSearchPage')(state);
    assert.equal(first.coverage, 'complete');
    assert.equal(first.more, true);
    let calls = 0;
    search.context.fetch = async () => { calls++; return { ok: false, status: 429 }; };
    const second = await search.app('nextLevelSearchPage')(state);
    assert.equal(second.coverage, 'partial');
    assert.equal(second.levels.length, 10);
    assert.equal(second.more, true);
    assert.equal(state.gameFailed, true);
    assert.equal(state.gameMore, false);
    search.advance(300001);
    search.context.fetch = async () => { calls++; return { ok: true, json: async () => [] }; };
    const third = await search.app('nextLevelSearchPage')(state);
    const last = await search.app('nextLevelSearchPage')(state);
    assert.equal(calls, 1, 'even recovered GDBrowser cannot skip a page in this search');
    assert.equal(third.levels.length, 10);
    assert.equal(last.levels.length, 5);
    assert.equal(last.more, false);
    assert.equal(last.coverage, 'partial');
    const allIds = [...first.levels, ...second.levels, ...third.levels, ...last.levels].filter(l => +l.levelId < 100).map(l => l.levelId);
    assert.equal(new Set(allIds).size, 35);
    const next = await search.app('startLevelSearch')('comb', filters());
    assert.equal((await search.app('nextLevelSearchPage')(next)).coverage, 'complete');
    assert.equal(calls, 2, 'a new search uses the recovered provider');
});

test('fillRatings stops after its first failed batch and does not fetch during cooldown', async () => {
    const search = freshSearch(), levels = Array.from({ length: 21 }, (_, i) => ({ levelId: String(i + 1) }));
    let calls = 0;
    search.context.fetch = async () => { calls++; return { ok: false, status: 503 }; };
    await search.app('fillRatings')(levels);
    assert.equal(calls, 1);
    assert.equal(levels.every(l => l.rating == null), true);
    await search.app('fillRatings')(levels);
    assert.equal(calls, 1);
});

test('sync fills saved levels and wishlist tiers from the sheet before asking GDBrowser', async () => {
    const search = freshSearch();
    search.context.fetch = async url => {
        search.asked.push(url);
        if (url == 'data/levels.json')
            return { ok: true, json: async () => [[1, 'Saved', 'Creator', 3, 0, 2], [2, 'Wish', 'Other', 1, 1, 4], [3, 'Kept', 'Another', 2, 0, 1]] };
        if (url.includes('api.aredl.net'))
            return { json: async () => [{ level_id: 1, name: 'Saved', position: 1 }] };
        return { ok: false, status: 403 };
    };
    search.context.renderSyncStatus = () => {};
    search.context.document = { querySelector: () => true };
    search.app("profile = { levels: [{ name: 'Saved', levelId: '1' }], wishlists: [{ items: [{ name: 'Wish' }, { name: 'Kept', rating: 'epic' }] }] }");
    await search.app('syncWithAredl()');
    assert.equal(search.app('profile.levels[0].rating'), 'epic');
    assert.deepEqual({ ...search.app('profile.wishlists[0].items[0]') }, { name: 'Wish', kind: 'platform', levelId: '2', creator: 'Other', diff: 'Easy', rating: 'mythic' });
    assert.equal(search.app('profile.wishlists[0].items[1].rating'), 'epic');
    assert.equal(search.asked.some(url => url.includes('gdbrowser')), false);
});
