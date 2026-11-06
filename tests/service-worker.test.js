import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { appScripts } from '../eslint.config.js';
import { loadScripts } from './load-scripts.js';

const shell = [...loadScripts(['sw.js'], { self: { addEventListener() {} } }).app('SHELL')];

test('the service worker caches every script the page loads, so the app also starts offline', () => {
    assert.deepEqual(appScripts.filter(file => !shell.includes(file)), []);
});

test('every file the service worker caches exists', () => {
    assert.deepEqual(shell.filter(file => file != './' && !existsSync(file)), []);
});
