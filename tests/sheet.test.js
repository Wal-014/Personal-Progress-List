import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';
import { parseCsv, toLevels, DIFFICULTIES, RATING_TIERS } from '../scripts/build-levels.js';

const { app } = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/api.js', 'js/sheet.js'], { localStorage: {} });

test('parseCsv handles quoted commas, newlines, doubled quotes and CRLF', () => {
    assert.deepEqual(parseCsv('a,"b, c","say ""hi"""\r\n"two\nlines",,x\n'), [['a', 'b, c', 'say "hi"'], ['two\nlines', '', 'x']]);
    assert.deepEqual(parseCsv('last,row'), [['last', 'row']]);
});

test('toLevels keeps rated levels, skips headers and repeated IDs, and marks platformers by their moons', () => {
    const row = (name, creator, id, diff, reward) => [name, creator, '1', id, 'song', 'artist', '1', '0:01:00', diff, reward];
    const rows = [
        ['Level Name Update 1.0', 'Creator ', 'User ID ', 'Level ID '],
        row('Bloodbath', 'Riot', '10565740', 'Extreme Demon', '10⭐'),
        row('Copy', 'Someone', '10565740', 'Easy', '2⭐'),
        row('Nautical Nightmares', 'RealMatter', '138993732', 'Extreme Demon', '10🌙'),
        row('Odd', '', '42', 'Unknown', '1⭐'),
        ['Level Name Update 2.2']
    ];
    assert.deepEqual(toLevels(rows), [[10565740, 'Bloodbath', 'Riot', 10, 0, -1], [138993732, 'Nautical Nightmares', 'RealMatter', 10, 1, -1], [42, 'Odd', '', -1, 0, -1]]);
});

test('the build script and the app list difficulties and rating tiers in the same order', () => {
    assert.deepEqual(DIFFICULTIES, [...app('DIFFICULTIES')]);
    assert.deepEqual(RATING_TIERS, [...app('RATING_TIERS')]);
});

test('fillFromSheet fills missing data by ID or by a name only one level of that kind has', () => {
    app('useSheetLevels')([[1, 'Bloodbath', 'Riot', 10, 0, 2], [2, 'Shared', 'A', 4, 0, 1], [3, 'Shared', 'B', 5, 0], [4, 'Shared', 'C', 9, 1]]);
    const fill = app('fillFromSheet');

    const byName = { name: 'blood bath' };
    fill(byName, 'd');
    assert.deepEqual(byName, { name: 'blood bath', kind: 'classic', levelId: '1', creator: 'Riot', diff: 'Extreme Demon', rating: 'epic' });

    const byId = { name: 'Renamed', levelId: '2', creator: 'Kept', rating: 'mythic' };
    fill(byId, 'd');
    assert.deepEqual(byId, { name: 'Renamed', kind: 'classic', levelId: '2', creator: 'Kept', diff: 'Harder', rating: 'mythic' });

    assert.equal(fill({ name: 'Shared' }, 'd'), null, 'two classic levels share the name');
    assert.equal(fill({ name: 'Shared' }, 'p')[0], 4, 'only one platformer has it');
    assert.equal(fill({ name: 'Bloodbath' }, 'p'), null, 'wrong kind');
    assert.equal(fill({ name: 'Bloodbath' })[0], 1, 'any kind when none is given');
});

test('toLevels maps every rating emoji, ignoring variation selectors and whitespace, and tolerates unknown tiers', () => {
    const rows = ['✔', '✨', '🔥', '🌸', '💎', ' ✔️ \t', '', 'unknown'].map((tier, i) => ['Level', 'Creator', '', String(i + 1), '', '', '', '', 'Hard', '5⭐', tier]);
    assert.deepEqual(toLevels(rows).map(x => x[5]), [0, 1, 2, 3, 4, 0, -1, -1]);
});

test('fromSheet normalizes current and cached entries without inventing downloads or tiers', () => {
    assert.deepEqual({ ...app('fromSheet')([1, 'Level', 'Creator', 3, 1, 4]) }, { levelId: '1', name: 'Level', creator: 'Creator', diff: 'Hard', rating: 'mythic', kind: 'platform', downloads: null });
    for (const entry of [[2, 'Old', '', -1, 0], [2, 'Old', '', -1, 0, -1]])
        assert.deepEqual({ ...app('fromSheet')(entry) }, { levelId: '2', name: 'Old', creator: null, diff: null, rating: null, kind: 'classic', downloads: null });
});

test('findSheetLevels returns unfiltered ID and normalized substring matches', () => {
    app('useSheetLevels')([[123, 'Other', '', 3, 0, 2], [2, 'Cóm b', '', 1, 0], [3, 'Honeycomb', '', 3, 1, 4]]);
    assert.deepEqual(Array.from(app('findSheetLevels')('123'), l => l.levelId), ['123']);
    assert.deepEqual(Array.from(app('findSheetLevels')('cOmB'), l => l.levelId), ['2', '3']);
    assert.equal(app('findSheetLevels')('***').length, 0);
});

test('loadSheetLevels caches a successful array and reports true even for an empty copy', async () => {
    for (const rows of [[], [[1, 'Level', '', 3, 0, 2]]]) {
        let calls = 0;
        const fresh = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/api.js', 'js/sheet.js'], { localStorage: {}, fetch: async () => { calls++; return { ok: true, json: async () => rows }; } });
        assert.equal(await fresh.app('loadSheetLevels()'), true);
        assert.equal(await fresh.app('loadSheetLevels()'), true);
        assert.equal(calls, 1);
        assert.equal(fresh.app('sheetById.size'), rows.length);
    }
});

test('loadSheetLevels reports false for network, HTTP, JSON and non-array failures and retries next time', async () => {
    for (const failure of ['network', 'http', 'json', 'shape']) {
        let calls = 0;
        const fresh = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/api.js', 'js/sheet.js'], { localStorage: {}, fetch: async () => {
            if (++calls > 1)
                return { ok: true, json: async () => [[1, 'Recovered', '', 3, 0, 2]] };
            if (failure == 'network')
                throw TypeError('Offline');
            return { ok: failure != 'http', json: async () => { if (failure == 'json') throw SyntaxError('JSON'); return {}; } };
        } });
        assert.equal(await fresh.app('loadSheetLevels()'), false, failure);
        assert.equal(await fresh.app('loadSheetLevels()'), true, failure);
        assert.equal(calls, 2);
        assert.equal(fresh.app('sheetById.size'), 1);
    }
});
