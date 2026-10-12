import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// The app files are classic browser scripts, so they run in one shared context like in index.html.
const context = vm.createContext({});
for (const file of ['js/config.js', 'js/utils.js'])
    vm.runInContext(readFileSync(file, 'utf8'), context, { filename: file });
const app = name => vm.runInContext(name, context);

test('escapeHtml escapes every HTML-significant character', () => {
    assert.equal(app('escapeHtml')(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
    assert.equal(app('escapeHtml')(null), '');
});

test('safeUrl only lets http and https links through', () => {
    const safeUrl = app('safeUrl');
    assert.equal(safeUrl('https://youtu.be/abc'), 'https://youtu.be/abc');
    assert.equal(safeUrl('HTTP://example.com'), 'HTTP://example.com');
    assert.equal(safeUrl('javascript:alert(1)'), '');
    assert.equal(safeUrl('data:text/html,<script>'), '');
    assert.equal(safeUrl(undefined), '');
});

test('durations round-trip and invalid text is rejected', () => {
    const parse = app('parseDuration'), format = app('formatDuration');
    assert.equal(parse('1h 30m 5s'), 5405);
    assert.equal(format(5405), '1h 30m 5s');
    assert.equal(parse('45m'), 2700);
    assert.equal(parse('1h30'), null);
    assert.equal(parse(''), null);
});

test('death lines are summed per percent and limited to 100%', () => {
    assert.deepEqual({ ...app('parseDeaths')('63% x4\n63% x2\n90% x1') }, { 63: 6, 90: 1 });
    assert.equal(app('isDeathLine')('100% x3'), true);
    assert.equal(app('isDeathLine')('101% x3'), false);
});

test('thumbnails are only requested for numeric level IDs', () => {
    assert.equal(app('thumbUrl')({ levelId: '4125776' }), 'https://levelthumbs.prevter.me/thumbnail/4125776');
    assert.equal(app('thumbUrl')({ levelId: '../x' }), '');
});

test('saved themes from before the redesign map to the current ones', () => {
    const themeOf = app('themeOf');
    assert.equal(themeOf('dark'), 'night');
    assert.equal(themeOf('light'), 'blue');
    assert.equal(themeOf('synth'), 'synth');
    assert.equal(themeOf('unknown'), 'blue');
});
