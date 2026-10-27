import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(readFileSync('js/components/levels.js', 'utf8'), context);
const app = name => vm.runInContext(name, context);

for (const url of [
    'https://www.youtube.com/watch?v=Ab_12-cDef3&t=42',
    'https://youtu.be/Ab_12-cDef3?si=example',
    'https://www.youtube.com/shorts/Ab_12-cDef3',
    'https://www.youtube.com/embed/Ab_12-cDef3'
])
    test(`youtubeId extracts the video ID from ${url}`, () => {
        assert.equal(app('youtubeId')(url), 'Ab_12-cDef3');
    });

test('youtubeId returns undefined for a non-YouTube link or an incomplete ID', () => {
    for (const url of ['https://example.com/video', 'https://youtu.be/short', '', undefined])
        assert.equal(app('youtubeId')(url), undefined);
});

test('matchesListFilters accepts levels without tags when the selection is empty', () => {
    assert.equal(app('matchesListFilters')({ name: 'Bloodbath' }, '', []), true);
    assert.equal(app('matchesListFilters')({ name: 'Bloodbath', tags: [] }, 'blood', []), true);
    assert.equal(app('matchesListFilters')({ name: 'Bloodbath' }, 'other', []), false);
});

test('matchesListFilters matches any selected tag and includes a level with both only once', () => {
    const levels = [
        { name: 'First', tags: ['Rebeated'] },
        { name: 'Second', tags: ['Fluked'] },
        { name: 'Both', tags: ['Rebeated', 'Fluked'] },
        { name: 'Other', tags: ['Pre-Extremes'] },
        { name: 'Untagged' }
    ];
    assert.deepEqual(levels.filter(level => app('matchesListFilters')(level, '', ['Rebeated', 'Fluked'])).map(level => level.name), ['First', 'Second', 'Both']);
});

test('matchesListFilters requires the name query and tag selection to match together', () => {
    const matches = app('matchesListFilters'), level = { name: 'BloodBATH', tags: ['Rebeated'] };
    assert.equal(matches(level, 'bath', ['Fluked', 'Rebeated']), true);
    assert.equal(matches(level, 'other', ['Rebeated']), false);
    assert.equal(matches(level, 'bath', ['Fluked']), false);
    assert.equal(matches({ name: 'Bloodbath' }, 'bath', ['Rebeated']), false);
});

test('listTagOptions returns unique sorted names used by the supplied list', () => {
    const levels = [{ tags: ['Zulu', 'Alpha', 'Zulu'] }, {}, { tags: ['Beta', 'Alpha'] }];
    assert.deepEqual(Array.from(app('listTagOptions')(levels, [])), ['Alpha', 'Beta', 'Zulu']);
    assert.deepEqual(levels, [{ tags: ['Zulu', 'Alpha', 'Zulu'] }, {}, { tags: ['Beta', 'Alpha'] }]);
    assert.deepEqual(Array.from(app('listTagOptions')([], [])), []);
});

test('listTagOptions keeps selected but unused names and does not repeat used selections', () => {
    const selected = ['Missing', 'Alpha'];
    assert.deepEqual(Array.from(app('listTagOptions')([{ tags: ['Zulu', 'Alpha'] }], selected)), ['Alpha', 'Missing', 'Zulu']);
    assert.deepEqual(Array.from(app('listTagOptions')([], selected)), ['Alpha', 'Missing']);
    assert.deepEqual(selected, ['Missing', 'Alpha']);
});

test('listTagOptions sorts names with locale collation rather than character codes', () => {
    assert.deepEqual(Array.from(app('listTagOptions')([{ tags: ['zulu', 'Beta', 'alpha'] }], [])), ['alpha', 'Beta', 'zulu']);
});
