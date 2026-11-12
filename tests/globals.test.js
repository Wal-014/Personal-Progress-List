import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { appScripts, topLevelNames } from '../eslint.config.js';

// The classic scripts share one global scope, which ESLint only sees one file at a time
const code = appScripts.map(file => readFileSync(file, 'utf8')).join('\n');

test('no two scripts declare the same top-level name', () => {
    assert.deepEqual(topLevelNames.filter((name, i) => topLevelNames.indexOf(name) != i), []);
});

test('every top-level name is used outside its declaration', () => {
    // A property access (x.name) is not a use of the global; a spread (...name) is
    const uses = name => code.match(new RegExp(`(?<![\\w$])(?<!(?<!\\.)\\.)${name.replaceAll('$', '\\$')}(?![\\w$])`, 'g')).length;
    assert.deepEqual(topLevelNames.filter(name => uses(name) < 2), []);
});
