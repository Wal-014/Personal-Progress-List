import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadScripts } from './load-scripts.js';

const RELAY = loadScripts(['js/config.js']).app('LEVEL_RELAY_API');
const filters = extra => ({ rated: 'all', rates: [], diffs: [], ...extra });
const level = extra => ({ levelId: '1', name: 'Level', creator: 'Creator', diff: 'Hard', rating: 'rated', kind: 'classic', downloads: 10, ...extra });
const answer = (levels, more = false) => ({ ok: true, json: async () => ({ levels, more }) });

function provider(fetch) {
    let now = 1000;
    const asked = [], signals = [];
    const scripts = loadScripts(['js/config.js', 'js/gd.js', 'js/relay.js'], {
        Date: { now: () => now }, AbortSignal, URLSearchParams,
        fetch: async (url, options) => { asked.push(url); signals.push(options?.signal); return fetch(url); }
    });
    return { ...scripts, asked, signals, advance(ms) { now += ms; } };
}

test('searches send the text, page, scope and only the selections that apply', async () => {
    const relay = provider(async () => answer([]));
    const search = (f, page = 0) => relay.app('searchRelay')('dash / 2', filters(f), page);
    await search({});
    await search({ rated: 'unrated', rates: ['epic'], diffs: ['Hard'] }, 3);
    await search({ rated: 'rated', rates: ['epic', 'mythic'], diffs: ['Hard', 'Extreme Demon'] });
    await search({ rates: ['epic'], diffs: ['NA', 'Easy'] });
    assert.deepEqual(relay.asked, [
        RELAY + 'search?q=dash+%2F+2&page=0&scope=all',
        RELAY + 'search?q=dash+%2F+2&page=3&scope=unrated',
        RELAY + 'search?q=dash+%2F+2&page=0&scope=rated&diff=Hard%2CExtreme+Demon&rate=epic%2Cmythic',
        RELAY + 'search?q=dash+%2F+2&page=0&scope=all&diff=NA%2CEasy'
    ]);
    assert.equal(relay.signals.every(signal => signal instanceof AbortSignal), true);
});

test('answers are checked field by field and malformed levels are dropped', async () => {
    const relay = provider(async () => answer([
        null, level({ levelId: 7 }), level({ levelId: '12a' }), level({ name: '' }),
        level({ levelId: '2', rating: 'unrated', diff: 'Hard' }),
        level({ levelId: '3', rating: 'weird', creator: '', diff: 'Hardest', kind: 'space', downloads: '5' }),
        level({ levelId: '4', rating: 'mythic', kind: 'platform', downloads: 0 })
    ], true));
    const page = await relay.app('searchRelay')('comb', filters(), 0);
    assert.equal(page.more, true);
    assert.deepEqual(Array.from(page.levels, l => ({ ...l })), [
        { levelId: '2', name: 'Level', creator: 'Creator', diff: null, rating: 'unrated', kind: 'classic', downloads: 10 },
        { levelId: '3', name: 'Level', creator: null, diff: null, rating: 'unrated', kind: 'classic', downloads: null },
        { levelId: '4', name: 'Level', creator: 'Creator', diff: 'Hard', rating: 'mythic', kind: 'platform', downloads: 0 }
    ]);
});

test('anything but a true more flag ends the search, and a non-object answer is an empty page', async () => {
    for (const [body, more] of [[{ levels: [level()], more: 'yes' }, false], [-1, false], [null, false]]) {
        const relay = provider(async () => ({ ok: true, json: async () => body }));
        const page = await relay.app('searchRelay')('comb', filters(), 0);
        assert.equal(page.more, more);
        assert.equal(page.levels.length, body?.levels ? 1 : 0);
    }
});

test('any failure starts a five-minute cooldown shared by both provider functions', async () => {
    for (const failure of ['network', 'http', 'json', 'timeout']) {
        const relay = provider(async () => {
            if (failure == 'network')
                throw TypeError('Failed to fetch');
            if (failure == 'timeout')
                throw new DOMException('Timeout', 'TimeoutError');
            return { ok: failure != 'http', status: 429, json: async () => { throw SyntaxError('Invalid JSON'); } };
        });
        assert.equal(await relay.app('searchRelay')('comb', filters(), 0), null, failure);
        assert.equal(relay.app('relayAvailable()'), false);
        relay.advance(299999);
        assert.equal(await relay.app('fetchRelayLevelsById')(['1']), null);
        assert.equal(relay.asked.length, 1, 'no request during cooldown');
        relay.advance(1);
        relay.context.fetch = async () => answer([level()]);
        assert.equal((await relay.app('searchRelay')('comb', filters(), 0)).levels[0].levelId, '1');
        assert.equal(relay.app('relayAvailable()'), true);
    }
});

test('ID lookups cap requests at ten, use the timeout and skip empty batches', async () => {
    const delays = [];
    const relay = provider(async () => answer([level({ levelId: '4', rating: 'epic' })]));
    relay.context.AbortSignal = { timeout: ms => { delays.push(ms); return {}; } };
    const levels = await relay.app('fetchRelayLevelsById')(Array.from({ length: 12 }, (_, i) => String(i + 1)));
    assert.deepEqual(Array.from(levels, l => [l.levelId, l.rating]), [['4', 'epic']]);
    assert.deepEqual(relay.asked, [RELAY + 'levels?ids=1,2,3,4,5,6,7,8,9,10']);
    assert.equal((await relay.app('fetchRelayLevelsById')([])).length, 0);
    assert.equal(relay.asked.length, 1);
    assert.deepEqual(delays, [8000]);
});

test('the page Content Security Policy allows the configured relay', () => {
    const csp = readFileSync('index.html', 'utf8').match(/connect-src ([^;"]*)/)[1].split(' ');
    // Host names are case-insensitive, and URL lowercases them
    assert.ok(csp.map(s => s.toLowerCase()).includes(new URL(RELAY).origin), csp.join(' '));
});
