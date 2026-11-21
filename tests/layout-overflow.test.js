import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');

test('visually hidden live regions add no scrollable overflow', () => {
    const rule = css.match(/^\.visually-hidden\s*\{([^}]+)\}/m)?.[1] ?? '';
    assert.match(rule, /(?:^|;)\s*margin:\s*-1px\s*(?:;|$)/);
});

test('the body fits the visible viewport when mobile browser controls are shown', () => {
    const rule = css.match(/^body\s*\{([^}]+)\}/m)?.[1] ?? '';
    assert.match(rule, /(?:^|;)\s*min-height:\s*100dvh\s*(?:;|$)/);
    assert.doesNotMatch(rule, /\b100vh\b/);
});
