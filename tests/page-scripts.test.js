import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('every script the page loads is deferred, so Chrome downloads them in parallel despite the CSP meta tag', () => {
    const scripts = readFileSync('index.html', 'utf8').match(/<script\b[^>]*>/gi);
    assert.deepEqual(scripts.filter(tag => !/\sdefer(?:\s|=|>)/i.test(tag)), []);
});
