import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

test('scroll edges allow a pixel of rounding at either end and disappear without overflow', () => {
    const { app } = loadScripts(['js/utils.js']);
    assert.equal(typeof app('globalThis.scrollEdges'), 'function');
    const scrollEdges = app('scrollEdges');
    for (const [scrollTop, scrollHeight, top, bottom] of [
        [0, 300, false, true],
        [60, 300, true, true],
        [200, 300, true, false],
        [0, 100, false, false],
        [0.5, 101, false, false],
        [-0.5, 300, false, true],
        [0.75, 300, false, true],
        [199.25, 300, true, false]
    ])
        assert.deepEqual({ ...scrollEdges({ scrollTop, clientHeight: 100, scrollHeight }) }, { top, bottom }, `scrollTop=${scrollTop}, scrollHeight=${scrollHeight}`);
});

test('panes apply and clear fades after redraw, scrolling and content resize', () => {
    const listeners = new Map(), observed = new Set();
    let resize, panes = [];
    const document = {
        body: {},
        addEventListener(name, handler) { listeners.set(name, handler); },
        querySelectorAll: () => panes
    };
    const { app } = loadScripts(['js/utils.js', 'js/events.js'], {
        document, window: { addEventListener() {} },
        ResizeObserver: class {
            constructor(handler) { resize = handler; }
            observe(node) { observed.add(node); }
            disconnect() { observed.clear(); }
        }
    });
    const refresh = app('globalThis.refreshScrollFades');
    assert.equal(typeof refresh, 'function');
    const makePane = () => {
        const classes = new Set();
        return {
            scrollTop: 0, scrollHeight: 300, clientHeight: 100, children: [{}], classes,
            matches: selector => selector.includes('#lw'),
            classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } }
        };
    };
    const listPane = makePane();
    panes = [listPane];
    refresh();
    assert.deepEqual([...listPane.classes], ['fade-bottom']);
    assert.deepEqual([...observed], [listPane, ...listPane.children]);

    listPane.scrollTop = 100;
    listeners.get('scroll')({ target: listPane });
    assert.deepEqual(listPane.classes, new Set(['fade-top', 'fade-bottom']));

    listPane.scrollHeight = 200;
    resize();
    assert.deepEqual([...listPane.classes], ['fade-top']);

    const replacement = makePane();
    replacement.scrollHeight = 100;
    panes = [replacement];
    refresh();
    assert.deepEqual([...replacement.classes], []);
    assert.deepEqual([...observed], [replacement, ...replacement.children]);
});
