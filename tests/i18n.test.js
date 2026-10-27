import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({});
vm.runInContext(readFileSync('js/i18n.js', 'utf8'), context, { filename: 'js/i18n.js' });

test('Spanish and English define exactly the same translation keys', () => {
    const { es, en } = vm.runInContext('TRANSLATIONS', context);
    assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
});
