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

const blocks = [];
const ancestors = [];
let start = 0;
for (const token of css.matchAll(/"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[{};]/g)) {
    const statement = css.slice(start, token.index).trim();
    if (token[0] === '{') {
        const block = { selector: statement, parents: [...ancestors], declarations: [] };
        blocks.push(block);
        ancestors.push(block);
    }
    else if (token[0] === '}' || token[0] === ';') {
        if (statement)
            ancestors.at(-1)?.declarations.push(statement);
        if (token[0] === '}')
            ancestors.pop();
    }
    else {
        continue;
    }
    start = token.index + 1;
}

test('buttons have no global brightness filter on hover', () => {
    for (const { selector, declarations } of blocks) {
        if (/(?:^|,)\s*button:hover\s*(?:,|$)/.test(selector))
            assert.ok(!declarations.some(value => /^filter\s*:.*\bbrightness\(/.test(value)), selector);
    }
});

test('metallic rim angles interpolate and reach the inner reflection', () => {
    const angle = blocks.find(({ selector }) => selector === '@property --rim-angle');
    assert.ok(angle, 'Expected a registered --rim-angle');
    assert.ok(angle.declarations.some(value => /^syntax:\s*(['"])<angle>\1$/.test(value)));
    assert.ok(angle.declarations.includes('inherits: true'));
    assert.ok(blocks.some(({ selector, declarations }) => !/:hover\b/.test(selector) &&
        declarations.some(value => /^transition\s*:[\s\S]*--rim-angle\s+var\(--hover-motion\)/.test(value))));
});

test('hover paint and transitions respect input and motion preferences', () => {
    for (const { selector, parents, declarations } of blocks) {
        const insideMedia = feature => parents.some(parent => parent.selector.startsWith('@media') && parent.selector.includes(feature));
        if (/:hover\b/.test(selector)) {
            assert.ok(insideMedia('(hover: hover)'), selector);
            assert.ok(insideMedia('(forced-colors: none)'), selector);
        }
        if (declarations.some(value => /^transition(?:-[\w-]+)?\s*:/.test(value) && !/^transition\s*:\s*none\b/.test(value)))
            assert.ok(insideMedia('(prefers-reduced-motion: no-preference)'), selector);
    }
});
