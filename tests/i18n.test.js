import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const { app } = loadScripts(['js/i18n.js']);

test('Spanish and English define exactly the same translation keys', () => {
    const { es, en } = app('TRANSLATIONS');
    assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
});
