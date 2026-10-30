import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const { context, app } = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/api.js', 'js/sheet.js', 'js/gd.js'], { localStorage: {} });

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

test('search filters server results again, ranks matching names and keeps raw-page pagination', async () => {
    const asked = [];
    context.fetch = async url => {
        asked.push(url);
        return { ok: true, json: async () => [result({ id: '156124', name: 'Dash of dash 2', downloads: 5 }), result({ id: '2', epic: true, downloads: 100 }), result({ id: '3', stars: 0 }), ...Array.from({ length: 7 }, () => result({ id: 'bad' }))] };
    };
    const found = await app('searchLevels')('dash / 2', filters({ rated: 'rated' }), 3);
    assert.equal(asked[0], 'https://gdbrowser.com/api/search/dash%20%2F%202?page=3&starred');
    assert.deepEqual(Array.from(found.levels, l => l.levelId), ['156124', '2']);
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
    found = await app('searchLevels')('dash', filters(), 0);
    assert.equal(found.offline, true);
    assert.equal(found.more, false);
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

const freshSearch = () => loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/api.js', 'js/sheet.js', 'js/gd.js'], { localStorage: {} });

test('sheet matches any part ignoring case and accents, ordered by exact, prefix, contains and length', () => {
    const search = freshSearch();
    search.app(`useSheetLevels([
        [1, 'Honeycomb Runner', '', 3], [2, 'COMB', '', 3], [3, 'Catacomb', '', 3],
        [4, 'Comb Breaker', '', 3], [5, 'Comb A', '', 3], [6, 'Cursed Catacombs', '', 3, 1],
        [7, 'Cómb', '', 3], [8, 'Unrelated', '', 3], [9, 'C o m b', '', 3]
    ])`);
    assert.deepEqual(Array.from(search.app('findSheetMatches')('cOmB', filters())), ['2', '7', '9', '5', '4', '3', '1', '6']);
    assert.deepEqual(Array.from(search.app('findSheetMatches')('***', filters())), []);
});

test('sheet pre-filters Unrated and effective difficulties without guessing rating tiers or level kind', () => {
    const search = freshSearch();
    search.app(`useSheetLevels([[1, 'Comb', '', 3], [2, 'Comb P', '', 1, 1], [3, 'Comb Unknown', '', -1]])`);
    const find = search.app('findSheetMatches');
    assert.deepEqual(Array.from(find('comb', filters({ rated: 'unrated', diffs: ['Hard'] }))), []);
    assert.deepEqual(Array.from(find('comb', filters({ diffs: ['Easy', 'Hard'] }))), ['1', '2']);
    assert.deepEqual(Array.from(find('comb', filters({ diffs: ['NA'] }))), ['3']);
    assert.deepEqual(Array.from(find('comb', filters({ rated: 'rated', diffs: ['NA'], rates: ['mythic'] }))), ['1', '2', '3']);
});

test('pages request both sources in parallel, dedupe IDs, recheck filters and rank before downloads', async () => {
    const search = freshSearch(), asked = [], pending = [];
    search.context.fetch = url => {
        asked.push(url);
        return new Promise(resolve => pending.push(resolve));
    };
    const page = search.app('searchLevels')('comb', filters({ rated: 'rated', rates: ['epic'], diffs: ['Hard'] }), 1, ['99', '98', '97', '96', '95', '94', '93', '92', '91', '90', '1', '2']);
    assert.deepEqual(asked, ['https://gdbrowser.com/api/search/1,2?list', 'https://gdbrowser.com/api/search/comb?page=1&epic&diff=3']);
    const ratedHard = extra => result({ epic: true, difficulty: 'Hard', ...extra });
    pending[0]({ ok: true, json: async () => [ratedHard({ id: 1, name: 'Honeycomb', downloads: 900 }), ratedHard({ id: 2, name: 'Comb A', downloads: 100 }), ratedHard({ id: 9, name: 'Comb wrong difficulty', difficulty: 'Easy' }), ratedHard({ id: 10, name: 'Comb wrong rating', epic: false })] });
    pending[1]({ ok: true, json: async () => [ratedHard({ id: 2, name: 'Comb A', downloads: 100 }), ratedHard({ id: 3, name: 'Comb', downloads: 1 }), ratedHard({ id: 4, name: 'Comb B', downloads: 200 }), ratedHard({ id: 5, name: 'Other', downloads: 1000 })] });
    const found = await page;
    assert.deepEqual(Array.from(found.levels, l => l.levelId), ['3', '4', '2', '1', '5']);
    assert.equal(found.more, false);
});

test('ID matches outrank names and pagination continues while either source may have more', async () => {
    const search = freshSearch();
    let remote = [result({ id: '123', name: 'Other', downloads: 0 }), result({ id: '2', name: '123 prefix', downloads: 100 }), result({ id: '3', name: 'x123', downloads: 200 })];
    search.context.fetch = async url => ({ ok: true, json: async () => url.endsWith('?list') ? [] : remote });
    const ids = Array.from({ length: 11 }, (_, i) => String(i + 20));
    let found = await search.app('searchLevels')('123', filters(), 0, ids);
    assert.deepEqual(Array.from(found.levels, l => l.levelId), ['123', '2', '3']);
    assert.equal(found.more, true, 'the sheet still has one match');
    found = await search.app('searchLevels')('123', filters(), 1, ids);
    assert.equal(found.more, false, 'both sources are exhausted');
    remote = Array.from({ length: 10 }, (_, i) => result({ id: String(i + 40) }));
    found = await search.app('searchLevels')('123', filters(), 1, ids);
    assert.equal(found.more, true, 'a full remote page may have a successor');
});

test('sheet entries keep known data and leave rating unknown for a later sync', () => {
    const fromSheet = app('fromSheet');
    assert.deepEqual({ ...fromSheet([10565740, 'Bloodbath', 'Riot', 10]) }, { levelId: '10565740', name: 'Bloodbath', creator: 'Riot', diff: 'Extreme Demon', rating: null, kind: 'classic', downloads: 0 });
    assert.deepEqual({ ...fromSheet([1, 123, '', -1, 1]) }, { levelId: '1', name: '123', creator: null, diff: null, rating: null, kind: 'platform', downloads: 0 });
});

test('a failed ID lookup returns only that sheet page and rechecks filters', async () => {
    const search = freshSearch();
    search.app("useSheetLevels([...Array.from({ length: 10 }, (_, i) => [i + 10, 'Comb Old ' + i, '', 3]), [1, 'Comb B', '', 3], [2, 'Comb A', '', 1]])");
    const ids = [...Array.from({ length: 10 }, (_, i) => String(i + 10)), '1', '2'];
    for (const failure of ['network', 'http', 'json']) {
        search.context.fetch = async url => {
            if (!url.endsWith('?list'))
                return { ok: true, json: async () => [] };
            if (failure == 'network')
                throw TypeError('Failed to fetch');
            return { ok: failure != 'http', status: 503, json: async () => { throw SyntaxError('Bad JSON'); } };
        };
        const found = await search.app('searchLevels')('comb', filters(), 1, ids);
        assert.deepEqual(Array.from(found.levels, l => l.levelId), ['1', '2'], failure + ': ties keep sheet order');
        assert.equal(found.offline, true);
        assert.equal(found.more, false);
        const hard = await search.app('searchLevels')('comb', filters({ diffs: ['Hard'] }), 1, ids);
        assert.deepEqual(Array.from(hard.levels, l => l.levelId), ['1']);
        const epic = await search.app('searchLevels')('comb', filters({ rated: 'rated', rates: ['epic'] }), 1, ids);
        assert.equal(epic.levels.length, 0, 'unknown tiers cannot satisfy a rate filter');
        assert.equal(epic.offline, true);
        await assert.rejects(search.app('fetchLevelsById')(['1']));
    }
});

test('a failed search and probe leave pagination driven by the sheet alone', async () => {
    const search = freshSearch();
    search.app("useSheetLevels(Array.from({ length: 11 }, (_, i) => [i + 1, 'Comb ' + i, '', 3]))");
    const ids = Array.from(search.app('findSheetMatches')('comb', filters()));
    for (const failure of ['network', 'http', 'json']) {
        search.context.fetch = async () => {
            if (failure == 'network')
                throw TypeError('Failed to fetch');
            return { ok: failure != 'http', status: 403, json: async () => { throw SyntaxError('Bad JSON'); } };
        };
        const found = await search.app('searchLevels')('comb', filters(), 0, ids);
        assert.equal(found.levels.length, 10);
        assert.equal(found.offline, true);
        assert.equal(found.gameMore, false);
        assert.equal(found.more, true);
        const last = await search.app('searchLevels')('comb', filters(), 1, ids, found.gameMore);
        assert.deepEqual(Array.from(last.levels, l => l.levelId), ['11']);
        assert.equal(last.offline, true);
        assert.equal(last.gameMore, false);
        assert.equal(last.more, false);
    }
});

test('a working no-results probe preserves sheet results and stays online', async () => {
    const search = freshSearch();
    search.context.fetch = async url => {
        if (url.endsWith('?list'))
            return { ok: true, json: async () => [result({ id: '1', name: 'Honeycomb' })] };
        return { ok: url.endsWith('level/128'), status: 500 };
    };
    const found = await search.app('searchLevels')('comb', filters(), 0, ['1']);
    assert.deepEqual(Array.from(found.levels, l => l.name), ['Honeycomb']);
    assert.equal(found.offline, false);
    assert.equal(found.gameMore, false);
    assert.equal(found.more, false);
});

test('an ID query puts its sheet entry before name matches and respects difficulty and Unrated', () => {
    const search = freshSearch();
    search.app("useSheetLevels([[1, '123', '', 1], [2, '123 prefix', '', 3], [123, 'Other', '', 3], [3, 'x123', '', 3]])");
    const find = search.app('findSheetMatches');
    assert.deepEqual(Array.from(find('123', filters())), ['123', '1', '2', '3']);
    assert.deepEqual(Array.from(find('123', filters({ diffs: ['Easy'] }))), ['1']);
    assert.deepEqual(Array.from(find('123', filters({ rated: 'unrated' }))), []);
});

test('shared ID lookup caps batches at ten and converts only valid level IDs', async () => {
    const search = freshSearch(), asked = [];
    search.context.fetch = async url => {
        asked.push(url);
        return { ok: true, json: async () => [null, result({ id: 'bad' }), result({ id: 4, epic: true, platformer: true })] };
    };
    const found = await search.app('fetchLevelsById')(Array.from({ length: 12 }, (_, i) => String(i + 1)));
    assert.deepEqual(asked, ['https://gdbrowser.com/api/search/1,2,3,4,5,6,7,8,9,10?list']);
    assert.deepEqual(Array.from(found, l => [l.levelId, l.rating, l.kind]), [['4', 'epic', 'platform']]);
    assert.deepEqual(Array.from(await search.app('fetchLevelsById')([])), []);
    assert.equal(asked.length, 1);
});

test('fillRatings skips a failed batch and still fills the following batch through the shared lookup', async () => {
    const search = freshSearch(), levels = Array.from({ length: 11 }, (_, i) => ({ levelId: String(i + 1) }));
    search.context.fetch = async url => ({ ok: url.includes('/11?list'), status: 503, json: async () => [result({ id: url.includes('/11?list') ? 11 : 1, epic: true, difficulty: 'Hard' })] });
    await search.app('fillRatings')(levels);
    assert.equal(levels[0].rating, undefined);
    assert.deepEqual([levels[10].rating, levels[10].diff], ['epic', 'Hard']);
});
