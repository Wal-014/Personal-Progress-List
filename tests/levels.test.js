import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const { context, app } = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/components/faces.js', 'js/components/levels.js'], { localStorage: {} });

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

test('detail renders keyboard-accessible tag filters with escaped translated labels', () => {
    app('profile = emptyProfile()');
    const level = { id: 'tag-test', name: 'Tagged level', kind: 'classic', tags: ['safe', 'a"><img src=x>'] };
    for (const [lang, label] of [['es', 'Filtrar por tag: '], ['en', 'Filter by tag: ']]) {
        context.lang = lang;
        app('ui.lang = lang');
        const html = app('detail')(level);
        const chips = html.match(/<span class=chip\b[^>]*>/g);
        assert.equal(chips.length, 2);
        for (const chip of chips) {
            assert.match(chip, /\brole=button(?:\s|>)/);
            assert.match(chip, /\btabindex=0(?:\s|>)/);
        }
        assert.ok(chips[0].includes(`aria-label="${label}safe"`));
        assert.ok(chips[1].includes(`aria-label="${label}a&quot;&gt;&lt;img src=x&gt;"`));
        assert.ok(chips[1].includes('data-tag="a&quot;&gt;&lt;img src=x&gt;"'));
        assert.equal(html.includes('<img src=x>'), false);
    }
});

test('card tag filters stay outside the tab order in both level lists', () => {
    app('profile = emptyProfile()');
    for (const kind of ['classic', 'platform']) {
        const html = app('card')({ id: 'tag-test', name: 'Tagged level', kind, tags: ['first', 'second'] });
        assert.match(html, /role=button tabindex=0/);
        const chips = html.match(/<span class=chip\b[^>]*>/g);
        assert.equal(chips.length, 2);
        for (const chip of chips)
            assert.doesNotMatch(chip, /\b(?:role|tabindex|aria-label)=/);
    }
});
