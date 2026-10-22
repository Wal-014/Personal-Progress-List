import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ localStorage: {} });
for (const file of ['js/config.js', 'js/utils.js', 'js/state.js', 'js/api.js', 'js/sheet.js', 'js/gd.js'])
    vm.runInContext(readFileSync(file, 'utf8'), context, { filename: file });
const app = name => vm.runInContext(name, context);

const result = extra => ({ id: '10565740', name: 'Bloodbath', author: 'Riot', difficulty: 'Extreme Demon', stars: 10, downloads: 193000000, platformer: false, featured: false, epic: false, legendary: false, mythic: false, ...extra });

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
