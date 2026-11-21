import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadScripts } from './load-scripts.js';

const thumb = 'https://levelthumbs.prevter.me/thumbnail/123456789012';

function element(attributes = {}, children = []) {
    const properties = {};
    return {
        nodeType: 1,
        properties,
        getAttribute: name => attributes[name] ?? null,
        querySelectorAll: selectors => children.filter(child => selectors.split(',').some(selector => child.getAttribute(selector.trim().slice(1, -1)) != null)),
        style: { setProperty: (name, value) => { properties[name] = String(value); } }
    };
}

function fixture(root = element()) {
    let notify, observed;
    const { app } = loadScripts(['js/config.js', 'js/data-styles.js'], {
        document: { documentElement: root },
        MutationObserver: class {
            constructor(callback) { notify = callback; }
            observe(target, options) { observed = { target, options: { ...options } }; }
        }
    });
    return { apply: app('applyDataStyles'), notify, observed };
}

test('applyDataStyles styles the root and matching descendants', () => {
    const child = element({ 'data-th': thumb, 'data-tag-color': 'var(--fg)', 'data-pct': '100' });
    const root = element({ 'data-th': `${thumb}/small`, 'data-pct': '73.34567', 'data-from': '0', 'data-tag-color': '#12ab9F', 'data-swatch': '#abcdef' }, [child]);
    fixture().apply(root);
    assert.deepEqual(root.properties, {
        '--th': `url("${thumb}/small")`, '--pct': '73.34567', '--from': '0', '--tag-color': '#12ab9F', '--swatch': '#abcdef'
    });
    assert.deepEqual(child.properties, { '--th': `url("${thumb}")`, '--tag-color': 'var(--fg)', '--pct': '100' });
});

test('the data style allowlist ignores invalid values and unknown attributes', () => {
    const { apply } = fixture();
    const invalid = {
        'data-th': [
            'javascript:alert(1)', 'https://example.org/thumbnail/1', `x${thumb}`, `https://example.org/?${thumb}`,
            `${thumb}/small/extra`, `${thumb}?x=1`, `${thumb}3`, ''
        ],
        'data-pct': ['-1', '101', 'NaN', '1e3', '', ' ', '3%', '0x10', 'Infinity'],
        'data-tag-color': ['red', '#fff;background:url(x)', 'var(--other)', ''],
        'data-swatch': ['red', '#fff;background:url(x)', 'var(--fg)', ''],
        'data-style': ['width:100%']
    };
    invalid['data-from'] = invalid['data-pct'];
    for (const [attribute, values] of Object.entries(invalid)) {
        for (const value of values) {
            const root = element({ [attribute]: value });
            apply(root);
            assert.deepEqual(root.properties, {}, `${attribute}=${JSON.stringify(value)}`);
        }
    }
});

test('data styles are applied at load and on newly added elements', () => {
    const initial = element({ 'data-pct': '25' });
    const root = element({}, [initial]);
    const { notify, observed } = fixture(root);
    assert.deepEqual(initial.properties, { '--pct': '25' });
    assert.deepEqual(observed, { target: root, options: { childList: true, subtree: true } });
    const child = element({ 'data-swatch': '#123456' });
    const added = element({ 'data-from': '24.5' }, [child]);
    notify([{ addedNodes: [{ nodeType: 3 }, added] }]);
    assert.deepEqual(added.properties, { '--from': '24.5' });
    assert.deepEqual(child.properties, { '--swatch': '#123456' });
});

test('app source contains no inline style attributes', () => {
    const inlineStyles = readdirSync('js', { recursive: true, withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => join(entry.parentPath, entry.name))
        .filter(file => /(?:^|[\s"'`])style\s*=/im.test(readFileSync(file, 'utf8')));
    assert.deepEqual(inlineStyles, []);
});

test('the page only allows same-origin styles in its content security policy', () => {
    const html = readFileSync('index.html', 'utf8');
    const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1];
    assert.equal(policy?.split(';').map(directive => directive.trim()).find(directive => /^style-src\s/i.test(directive)), "style-src 'self'");
});
