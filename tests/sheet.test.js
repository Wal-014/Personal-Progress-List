import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';
import { parseCsv, toLevels, DIFFICULTIES } from '../scripts/build-levels.js';

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
    assert.deepEqual(toLevels(rows), [[10565740, 'Bloodbath', 'Riot', 10, 0], [138993732, 'Nautical Nightmares', 'RealMatter', 10, 1], [42, 'Odd', '', -1, 0]]);
});

test('the build script and the app list difficulties in the same order', () => {
    assert.deepEqual(DIFFICULTIES, [...app('DIFFICULTIES')]);
});

test('fillFromSheet fills missing data by ID or by a name only one level of that kind has', () => {
    app('useSheetLevels')([[1, 'Bloodbath', 'Riot', 10, 0], [2, 'Shared', 'A', 4, 0], [3, 'Shared', 'B', 5, 0], [4, 'Shared', 'C', 9, 1]]);
    const fill = app('fillFromSheet');

    const byName = { name: 'blood bath' };
    fill(byName, 'd');
    assert.deepEqual(byName, { name: 'blood bath', levelId: '1', creator: 'Riot', diff: 'Extreme Demon' });

    const byId = { name: 'Renamed', levelId: '2', creator: 'Kept' };
    fill(byId, 'd');
    assert.deepEqual(byId, { name: 'Renamed', levelId: '2', creator: 'Kept', diff: 'Harder' });

    assert.equal(fill({ name: 'Shared' }, 'd'), null, 'two classic levels share the name');
    assert.equal(fill({ name: 'Shared' }, 'p')[0], 4, 'only one platformer has it');
    assert.equal(fill({ name: 'Bloodbath' }, 'p'), null, 'wrong kind');
    assert.equal(fill({ name: 'Bloodbath' })[0], 1, 'any kind when none is given');
});
