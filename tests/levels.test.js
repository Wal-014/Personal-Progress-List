import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({ localStorage: {} });
for (const file of ['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/components/faces.js', 'js/components/levels.js'])
    vm.runInContext(readFileSync(file, 'utf8'), context, { filename: file });
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
