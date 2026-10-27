import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';
import { existsSync } from 'node:fs';

const { app } = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/components/faces.js'], { localStorage: {} });

test('each difficulty and rating gets its face and halo', () => {
    const faceFile = app('faceFile');
    assert.equal(faceFile({ diff: 'Extreme Demon', rating: 'mythic' }), 'demon-extreme-mythic');
    assert.equal(faceFile({ diff: 'Hard', rating: 'featured' }), 'hard-featured');
    assert.equal(faceFile({ diff: 'Auto', rating: 'rated' }), 'auto');
    assert.equal(faceFile({ diff: 'Insane', rating: 'unrated' }), 'unrated', 'unrated levels show NA even with a voted difficulty');
    assert.equal(faceFile({ diff: 'Medium Demon' }), 'demon-medium', 'a level saved before ratings shows its bare face');
    assert.equal(faceFile({}), 'unrated', 'an empty form shows the NA placeholder');
});

test('every face the app can ask for exists', () => {
    for (const face of app('FACES'))
        for (const halo of ['', ...app('HALOS').map(h => '-' + h)])
            assert.ok(existsSync(`assets/faces/${face}${halo}.webp`), face + halo);
    assert.ok(existsSync('assets/faces/unrated.webp'));
});

test('a missing difficulty is told apart from an unrated level', () => {
    const faceUnknown = app('faceUnknown');
    assert.equal(faceUnknown({ name: 'Old level' }), true);
    assert.equal(faceUnknown({ name: 'New level', rating: 'unrated' }), false);
    assert.equal(faceUnknown({ name: 'Rated', diff: 'Easy', rating: 'rated' }), false);
    assert.equal(faceUnknown({}), false, 'the empty form placeholder is not a level');
    assert.equal(app('difficultyLabel')({ diff: 'Extreme Demon', rating: 'epic' }), 'Extreme Demon · Epic');
    assert.equal(app('difficultyLabel')({ rating: 'unrated' }), 'NA');
});
