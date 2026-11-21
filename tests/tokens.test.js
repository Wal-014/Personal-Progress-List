import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
const properties = body => Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
const defaults = properties(css.match(/:root(?:,\s*\.sw-nebula)?\s*\{([^}]+)\}/)[1]);
function luminance(hex) {
    assert.match(hex, /^#[a-f\d]{6}$/i);
    const [r, g, b] = hex.slice(1).match(/../g).map(v => {
        const n = parseInt(v, 16) / 255;
        return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
    });
    return .2126 * r + .7152 * g + .0722 * b;
}
for (const theme of ['nebula', 'graphite', 'ocean', 'amber', 'crimson', 'porcelain']) {
    test(`${theme} text and semantic status contrast`, () => {
        const block = css.match(new RegExp('\\[data-theme=' + theme + '\\](?:,\\s*\\.sw-' + theme + ')?\\s*\\{([^}]+)\\}'));
        assert.ok(block || theme == 'nebula', theme);
        const values = { ...defaults, ...properties(block?.[1] || '') };
        for (const [fg, bg] of [['text', 'bg'], ...['text', 'text-muted', 'success', 'warning', 'error', 'info'].map(v => [v, 'surface'])]) {
            const resolve = value => value.startsWith('var(') ? resolve(values[value.slice(4, -1)]) : value;
            const a = luminance(resolve(values['--color-' + fg])), b = luminance(resolve(values['--color-' + bg]));
            const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
            assert.ok(ratio >= 4.5, `${fg} on ${bg}: ${ratio.toFixed(2)}`);
        }
    });
}

test('appearance stylesheet and self-hosted fonts are available offline', () => {
    const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    const html = read('index.html'), worker = read('sw.js');
    assert.ok(html.indexOf('css/tokens.css') < html.indexOf('css/styles.css'));
    assert.match(html, /<html data-theme=nebula data-bg=grid/);
    assert.ok(worker.includes('css/tokens.css'));
    for (const font of ['inter', 'oxanium']) {
        for (const subset of ['latin', 'latin-ext']) {
            const path = `fonts/${font}-${subset}.woff2`;
            assert.ok(worker.includes(path), path);
            assert.ok(css.includes(path), path);
            assert.equal(readFileSync(new URL('../' + path, import.meta.url)).subarray(0, 4).toString(), 'wOF2');
        }
    }
});
