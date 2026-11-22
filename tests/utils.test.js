import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const { app } = loadScripts(['js/config.js', 'js/utils.js']);

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

test('duration display retains its existing format', () => {
    assert.equal(app('formatDuration')(5405), '1h 30m 5s');
    assert.equal(app('formatDuration')(null), '');
});

test('levelLabel returns the localized singular only for one level', () => {
    const { app, context } = loadScripts(['js/i18n.js', 'js/utils.js'], { ui: {} });
    for (const [lang, singular, plural] of [['en', 'Level', 'Levels'], ['es', 'Nivel', 'Niveles']]) {
        context.ui.lang = lang;
        const levelLabel = app('levelLabel');
        assert.equal(levelLabel(0), plural);
        assert.equal(levelLabel(1), singular);
        assert.equal(levelLabel(2), plural);
    }
});

test('thumbnails are only requested for numeric level IDs', () => {
    assert.equal(app('thumbUrl')({ levelId: '4125776' }), 'https://levelthumbs.prevter.me/thumbnail/4125776/small');
    assert.equal(app('thumbUrl')({ levelId: '../x' }), '');
    assert.equal(app('fullThumbUrl')({ levelId: '4125776' }), 'https://levelthumbs.prevter.me/thumbnail/4125776');
    assert.equal(app('fullThumbUrl')({ levelId: '../x' }), '');
});

test('saved appearance preferences normalize independently', () => {
    for (const [old, value] of Object.entries({ blue: 'nebula', night: 'graphite', synth: 'crimson', dark: 'graphite', light: 'porcelain', unknown: 'nebula', constructor: 'nebula' }))
        assert.equal(app('themeOf')(old), value);
    for (const value of app('THEMES')) assert.equal(app('themeOf')(value), value);
    for (const value of app('BACKGROUNDS')) assert.equal(app('backgroundOf')(value), value);
    for (const value of [null, undefined, 'night', 'unknown']) assert.equal(app('backgroundOf')(value), 'grid');
});

test('prefersReducedMotion reads the reduced-motion media query and tolerates a missing matchMedia', () => {
    const queries = [];
    const { app: withMedia } = loadScripts(['js/utils.js'], { matchMedia: query => (queries.push(query), { matches: true }) });
    assert.equal(withMedia('prefersReducedMotion()'), true);
    assert.deepEqual(queries, ['(prefers-reduced-motion: reduce)']);
    assert.equal(loadScripts(['js/utils.js']).app('prefersReducedMotion()'), undefined);
});
