import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const { app } = loadScripts(['js/i18n.js']);

test('Spanish and English define exactly the same translation keys', () => {
    const { es, en } = app('TRANSLATIONS');
    assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
});

// A question mark between letters is what a lost accented character turns into when a file is saved in the wrong encoding.
test('no translation contains a character lost to an encoding error', () => {
    for (const [lang, entries] of Object.entries(app('TRANSLATIONS')))
        for (const [key, text] of Object.entries(entries))
            assert.doesNotMatch(text, /\p{L}\?\p{L}|\uFFFD/u, lang + '.' + key);
});
