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
