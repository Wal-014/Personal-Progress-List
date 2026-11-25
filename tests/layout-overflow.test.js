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

test('level actions stick to the bottom of the panel scrollport', () => {
    const bar = blocks.find(({ selector }) => selector === '.level-action-bar');
    assert.ok(bar);
    assert.ok(bar.declarations.includes('position: sticky'));
    assert.ok(bar.declarations.includes('inset-block-end: 0'));
});

test('the responsive drawer header stays transparent and only its button catches clicks', () => {
    const header = blocks.find(({ selector }) => selector === '.shell-drawer-header');
    const button = blocks.find(({ selector }) => selector === '.shell-drawer-header > button');
    assert.ok(header?.declarations.includes('background: transparent'));
    assert.ok(header.declarations.includes('position: sticky'));
    assert.ok(header.declarations.includes('pointer-events: none'));
    assert.ok(button?.declarations.includes('pointer-events: auto'));
});

test('the first-visit guide spans its own Home row instead of sharing one with the lists', () => {
    const intro = blocks.find(({ selector, parents }) => selector === '.hintro' && !parents.length);
    assert.ok(intro?.declarations.includes('grid-column: 1 / -1'));
});

test('Home text links underline only their label on hover, so the arrow stays clean', () => {
    const hovered = blocks.filter(({ selector, parents }) => selector === '&.htext' && parents.some(parent => parent.selector.includes(':hover')));
    assert.equal(hovered.length, 1);
    assert.ok(!hovered[0].declarations.some(value => value.startsWith('text-decoration')));
    const label = blocks.find(({ selector, parents }) => selector === '& > .htext-label' && parents.includes(hovered[0]));
    assert.ok(label?.declarations.includes('text-decoration: underline'));
});

test('generic dialog and panel button styles leave the small help buttons alone', () => {
    const exclusions = blocks.flatMap(({ selector }) => [...selector.matchAll(/(?:\.modal|\.rcol\)) button:where\(:not\(([^)]*)\)\)/g)].map(match => match[1]));
    assert.ok(exclusions.length >= 2);
    for (const list of exclusions)
        assert.match(list, /\.help-tip/);
    assert.ok(blocks.some(({ selector }) => selector === '.deaths-input button:not(.help-tip)'));
});

test('a help button keeps clear of the field under its label', () => {
    const head = blocks.find(({ selector }) => selector === '.field-head');
    const ring = blocks.find(({ selector }) => selector === '.help-tip::after');
    const [vertical] = ring.declarations.find(value => value.startsWith('inset:')).match(/-?\d+px/g).map(parseFloat);
    assert.ok(head.declarations.includes('margin-bottom: var(--space-4)'));
    assert.ok(-vertical < 4, 'the hit ring must stay inside the 4px gap');
});

test('dropdown panels float over the form in every context instead of pushing it down', () => {
    const positioned = blocks.filter(({ selector, declarations }) => /\.msp\b/.test(selector) && declarations.some(value => value.startsWith('position:')));
    assert.ok(positioned.length);
    for (const { selector, declarations } of positioned)
        assert.ok(declarations.includes('position: absolute'), selector);
});

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
