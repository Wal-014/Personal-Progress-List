import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRequest } from '../relay/src/request.js';
import { fromHistory, levelsUrl, searchFilter, searchUrl, toResult } from '../relay/src/gdhistory.js';
import { handle } from '../relay/src/index.js';

const ORIGIN = 'https://wal-014.github.io';
const env = (success = true) => ({ ALLOWED_ORIGINS: `${ORIGIN},http://127.0.0.1:8790`, LIMITER: { limit: async () => ({ success }) } });
const get = (path, origin = ORIGIN, method = 'GET') => new Request('https://relay.test' + path, { method, headers: origin ? { Origin: origin } : {} });
const parse = path => parseRequest(new URL('https://relay.test' + path));

// Trimmed GDHistory records
const BLOODBATH = { online_id: 10565740, cache_level_name: 'Bloodbath', cache_username: 'Riot', cache_stars: 10, cache_filter_difficulty: 12, cache_featured: 3206, cache_epic: 0, cache_length: 3, cache_downloads: 195910557 };
const UNRATED_PLAT = { online_id: 97459032, cache_level_name: 'Bloodbath Platformer', cache_username: 'someone', cache_stars: 0, cache_filter_difficulty: 0, cache_featured: 0, cache_epic: 0, cache_length: 5, cache_downloads: 1200 };

test('search requests are validated against the allowlist', () => {
    assert.deepEqual(parse('/search?q=%20blood%20&page=2&scope=rated&diff=Easy,Extreme%20Demon&rate=epic'),
        { kind: 'search', query: 'blood', page: 2, scope: 'rated', diffs: ['Easy', 'Extreme Demon'], rates: ['epic'] });
    assert.deepEqual(parse('/search?q=x'), { kind: 'search', query: 'x', page: 0, scope: 'all', diffs: [], rates: [] });
    for (const bad of ['/search', '/search?q=%20', '/search?q=' + 'a'.repeat(101), '/search?q=x&page=100', '/search?q=x&page=-1', '/search?q=x&page=1.5',
        '/search?q=x&scope=any', '/search?q=x&diff=Hardest', '/search?q=x&rate=epic,epic', '/search?q=x&q=y', '/search?q=x&extra=1'])
        assert.equal(parse(bad).status, 400, bad);
    assert.equal(parse('/admin').status, 404);
});

test('level ID requests take one to ten numeric IDs', () => {
    assert.deepEqual(parse('/levels?ids=128,10565740,128'), { kind: 'levels', ids: ['128', '10565740'] });
    for (const bad of ['/levels', '/levels?ids=', '/levels?ids=0', '/levels?ids=12a', '/levels?ids=1,,2', '/levels?ids=' + Array.from({ length: 11 }, (_, i) => i + 1).join(',')])
        assert.equal(parse(bad).status, 400, bad);
});

test('search filters narrow by scope, difficulty code and tier', () => {
    assert.equal(searchFilter({ scope: 'unrated', diffs: ['Easy'], rates: ['epic'] }), 'is_deleted = false AND cache_stars = 0');
    assert.equal(searchFilter({ scope: 'all', diffs: ['Auto', 'Insane', 'Easy Demon', 'Extreme Demon'], rates: [] }),
        'is_deleted = false AND cache_filter_difficulty IN [1, 6, 8, 12]');
    assert.equal(searchFilter({ scope: 'all', diffs: ['Easy', 'NA'], rates: [] }), 'is_deleted = false');
    assert.equal(searchFilter({ scope: 'rated', diffs: [], rates: ['rated', 'mythic'] }),
        'is_deleted = false AND cache_stars > 0 AND ((cache_featured <= 0 AND cache_epic = 0) OR cache_epic = 3)');
    const url = searchUrl({ query: 'blood', page: 3, scope: 'all', diffs: [], rates: [] });
    assert.equal(url.searchParams.get('query'), 'blood');
    assert.equal(url.searchParams.get('offset'), '30');
    assert.equal(levelsUrl(['128', '7']).searchParams.get('filter'), 'online_id IN [128, 7]');
});

test('GDHistory records map to the app level shape', () => {
    assert.deepEqual(fromHistory(BLOODBATH), { levelId: '10565740', name: 'Bloodbath', creator: 'Riot', diff: 'Extreme Demon', rating: 'featured', kind: 'classic', downloads: 195910557 });
    assert.deepEqual(fromHistory(UNRATED_PLAT), { levelId: '97459032', name: 'Bloodbath Platformer', creator: 'someone', diff: null, rating: 'unrated', kind: 'platform', downloads: 1200 });
    const tier = epic => fromHistory({ ...BLOODBATH, cache_epic: epic }).rating;
    assert.deepEqual([1, 2, 3].map(tier), ['epic', 'legendary', 'mythic']);
    assert.equal(fromHistory({ ...BLOODBATH, cache_featured: 0 }).rating, 'rated');
    assert.equal(fromHistory({ ...BLOODBATH, cache_filter_difficulty: 1 }).diff, 'Auto');
    assert.equal(fromHistory({ ...BLOODBATH, cache_filter_difficulty: 7 }).diff, null);
});

test('results drop malformed records and report whether more pages exist', () => {
    const page = Array.from({ length: 10 }, (_, i) => ({ ...BLOODBATH, online_id: i + 1 }));
    assert.equal(toResult({ hits: page, estimatedTotalHits: 25 }, 10).more, true);
    assert.equal(toResult({ hits: page, estimatedTotalHits: 20 }, 10).more, false);
    assert.equal(toResult({ hits: page.slice(0, 4), estimatedTotalHits: 99 }).more, false);
    assert.deepEqual(toResult({ hits: [null, { online_id: '1', cache_level_name: 'x' }, { ...BLOODBATH, cache_level_name: '' }, BLOODBATH] }).levels.map(l => l.levelId), ['10565740']);
    assert.deepEqual(toResult(null), { levels: [], more: false });
});

test('the handler refuses other origins, other methods and rate-limited clients', async () => {
    const noFetch = () => assert.fail('must not reach GDHistory');
    let r = await handle(get('/search?q=x', 'https://evil.example'), env(), noFetch);
    assert.equal(r.status, 403);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal((await handle(get('/search?q=x', null), env(), noFetch)).status, 403);
    assert.equal((await handle(get('/search?q=x', ORIGIN), { ...env(), ALLOWED_ORIGINS: undefined }, noFetch)).status, 403);
    r = await handle(get('/search?q=x', ORIGIN, 'POST'), env(), noFetch);
    assert.equal(r.status, 405);
    r = await handle(get('/search?q=x'), env(false), noFetch);
    assert.equal(r.status, 429);
    assert.equal(r.headers.get('Retry-After'), '60');
    assert.equal((await handle(get('/search?q=x&page=abc'), env(), noFetch)).status, 400);
});

test('the handler relays a search with CORS and security headers', async () => {
    let asked;
    const fakeFetch = async url => {
        asked = url;
        return new Response(JSON.stringify({ hits: [BLOODBATH], estimatedTotalHits: 1 }));
    };
    const r = await handle(get('/search?q=bloodbath&scope=rated'), env(), fakeFetch);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGIN);
    assert.equal(r.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.match(r.headers.get('Content-Security-Policy'), /default-src 'none'/);
    assert.equal(asked.searchParams.get('filter'), 'is_deleted = false AND cache_stars > 0');
    assert.deepEqual(await r.json(), { levels: [fromHistory(BLOODBATH)], more: false });
});

test('the handler answers 502 when GDHistory fails', async () => {
    const original = console.error;
    console.error = () => {};
    try {
        assert.equal((await handle(get('/levels?ids=1'), env(), async () => new Response('down', { status: 503 }))).status, 502);
        assert.equal((await handle(get('/levels?ids=1'), env(), async () => { throw Error('network'); })).status, 502);
    }
    finally {
        console.error = original;
    }
});
