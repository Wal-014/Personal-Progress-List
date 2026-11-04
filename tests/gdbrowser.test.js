import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const filters = { rated: 'all', rates: [], diffs: [] };
const row = extra => ({ id: 1, name: 'Level', author: 'Creator', stars: 5, difficulty: 'Hard', downloads: 10, ...extra });

function provider(fetch) {
    let now = 1000;
    const asked = [], signals = [];
    const scripts = loadScripts(['js/config.js', 'js/gdbrowser.js'], {
        Date: { now: () => now }, AbortSignal,
        fetch: async (url, options) => { asked.push(url); signals.push(options?.signal); return fetch(url); }
    });
    scripts.context.effectiveFilters = f => ({ rates: f.rates, diffs: f.diffs });
    scripts.context.searchScope = () => 'all';
    return { ...scripts, asked, signals, advance(ms) { now += ms; } };
}

test('only a thrown search fetch probes; a working probe means an empty successful page', async () => {
    const gdb = provider(async url => {
        if (url.endsWith('level/128'))
            return { ok: true, json: async () => ({ id: 128 }) };
        throw TypeError('Failed to fetch');
    });
    const page = await gdb.app('searchGdb')('missing', filters, 0);
    assert.deepEqual({ ...page, levels: Array.from(page.levels) }, { levels: [], more: false });
    assert.equal(gdb.app('gdbAvailable()'), true);
    assert.deepEqual(gdb.asked, ['https://gdbrowser.com/api/search/missing?page=0', 'https://gdbrowser.com/api/level/128']);
    assert.equal(gdb.signals.every(signal => signal instanceof AbortSignal), true);
});

test('a thrown search and failed probe start cooldown, block both provider functions, then recover at five minutes', async () => {
    for (const probe of ['network', 'http', 'json']) {
        const gdb = provider(async url => {
            if (!url.endsWith('level/128') || probe == 'network')
                throw TypeError('Failed to fetch');
            return { ok: probe != 'http', json: async () => { throw SyntaxError('Invalid JSON'); } };
        });
        assert.equal(await gdb.app('searchGdb')('comb', filters, 0), null);
        assert.equal(gdb.app('gdbAvailable()'), false);
        gdb.advance(299999);
        assert.equal(await gdb.app('searchGdb')('comb', filters, 0), null);
        assert.equal(await gdb.app('fetchGdbLevelsById')(['1']), null);
        assert.equal(gdb.asked.length, 2);
        gdb.advance(1);
        gdb.context.fetch = async () => { gdb.asked.push('recovered'); return { ok: true, json: async () => [row({})] }; };
        const recovered = await gdb.app('searchGdb')('comb', filters, 0);
        assert.equal(recovered.levels[0].levelId, '1');
        assert.equal(gdb.asked.length, 3);
        assert.equal(gdb.app('gdbAvailable()'), true);
    }
});

test('readable 429 and invalid JSON fail directly without a probe and share cooldown with ID lookups', async () => {
    for (const failure of ['http', 'json']) {
        const gdb = provider(async () => ({ ok: failure != 'http', status: 429, json: async () => { throw SyntaxError('Invalid JSON'); } }));
        assert.equal(await gdb.app('searchGdb')('comb', filters, 0), null);
        assert.equal(await gdb.app('fetchGdbLevelsById')(['1']), null);
        assert.equal(gdb.asked.length, 1, failure);
    }
});

test('each request receives the eight-second timeout signal, including ID lookups and the probe', async () => {
    const delays = [], signals = [];
    const gdb = provider(async url => {
        if (url.includes('search/missing'))
            throw TypeError('Network');
        return { ok: true, json: async () => [] };
    });
    gdb.context.AbortSignal = { timeout: ms => { delays.push(ms); const signal = {}; signals.push(signal); return signal; } };
    await gdb.app('searchGdb')('comb', filters, 0);
    await gdb.app('fetchGdbLevelsById')(['1']);
    await gdb.app('searchGdb')('missing', filters, 0);
    assert.deepEqual(delays, [8000, 8000, 8000, 8000]);
    assert.deepEqual(gdb.signals, signals);
});

test('a timeout rejection is a failure and cannot leave ID lookup requests enabled', async () => {
    const gdb = provider(async () => { throw new DOMException('Timeout', 'TimeoutError'); });
    assert.equal(await gdb.app('fetchGdbLevelsById')(['1']), null);
    assert.equal(await gdb.app('searchGdb')('comb', filters, 0), null);
    assert.equal(gdb.asked.length, 1);
});

test('non-array JSON is an empty successful page and raw page size controls more', async () => {
    for (const [raw, count, more] of [[-1, 0, false], [[row({}), ...Array.from({ length: 9 }, () => row({ id: 'bad' }))], 1, true]]) {
        const gdb = provider(async () => ({ ok: true, json: async () => raw }));
        const page = await gdb.app('searchGdb')('comb', filters, 2);
        assert.equal(page.levels.length, count);
        assert.equal(page.more, more);
        assert.equal(gdb.app('gdbAvailable()'), true);
    }
});

test('ID lookups cap requests at ten, skip invalid IDs and do not request empty batches', async () => {
    const gdb = provider(async () => ({ ok: true, json: async () => [null, row({ id: 'bad' }), row({ id: 4, epic: true, platformer: true })] }));
    const levels = await gdb.app('fetchGdbLevelsById')(Array.from({ length: 12 }, (_, i) => String(i + 1)));
    assert.deepEqual(Array.from(levels, l => [l.levelId, l.rating, l.kind]), [['4', 'epic', 'platform']]);
    assert.deepEqual(gdb.asked, ['https://gdbrowser.com/api/search/1,2,3,4,5,6,7,8,9,10?list']);
    assert.equal((await gdb.app('fetchGdbLevelsById')([])).length, 0);
    assert.equal(gdb.asked.length, 1);
});

test('downloads keep a known count, zero included, and leave anything that is not a number null', () => {
    const gdb = provider(async () => {});
    for (const [value, expected] of [[undefined, null], [null, null], ['', null], ['123', null], [NaN, null], [0, 0], [123, 123]])
        assert.equal(gdb.app('fromGdb')(row({ downloads: value })).downloads, expected);
});
