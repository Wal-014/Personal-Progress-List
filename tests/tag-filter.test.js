import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

/** Loads the list scripts and the event handlers with a stub DOM; `calls` records the redraws they ask for. */
const createApp = () => {
    const calls = [], dom = {};
    const document = { body: {}, addEventListener() {}, querySelector: selector => dom[selector] ?? null, querySelectorAll: selector => dom[selector] ?? [] };
    const { context, app } = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/api.js', 'js/components/faces.js', 'js/components/levels.js', 'js/events.js'], { localStorage: {}, document, window: { addEventListener() {} } });
    for (const name of ['render', 'closeModal', 'openModal', 'tagsUI'])
        context[name] = () => calls.push(name);
    context.askConfirm = async () => true;
    app('store = { cur: "p", profs: { p: { name: "P", color: "#ffe94d", data: emptyProfile() } } }; profile = store.profs.p.data; ui.tab = "classic"');
    return { app, calls, context, dom };
};
const tagFilter = app => [...app('ui.tagFilter')];
const flush = () => new Promise(resolve => setImmediate(resolve));

test('clicking a tag chip filters the list by that tag alone', () => {
    const { app, calls } = createApp();
    app('ui.tagFilter = ["A", "B"]; ui.tab = "home"');
    const target = { classList: { contains: () => false }, closest: selector => selector == '[data-tag]' ? { dataset: { tag: 'C' } } : null };
    app('document.body.onclick')({ target });
    assert.deepEqual(tagFilter(app), ['C']);
    assert.equal(app('ui.tab'), 'classic', 'a chip outside the lists opens the Classic list');
    assert.ok(calls.includes('render'));
});

test('leaving the list clears the name search and the tag filter', () => {
    const { app } = createApp();
    app('ui.q = "blood"; ui.tagFilter = ["A"]');
    app('ACTIONS.tab({ dataset: { v: "home" } })');
    assert.equal(app('ui.q'), '');
    assert.deepEqual(tagFilter(app), []);
});

test('opening a level from the timeline or from a dialog clears the list filters so the level shows', () => {
    const { app, dom } = createApp();
    app('profile.levels = [{ id: "l1", kind: "platform", name: "Level" }]; ui.tab = "stats"; ui.q = "other"; ui.tagFilter = ["A"]');
    const point = { classList: { contains: name => name == 'pt' }, dataset: { id: 'l1' } };
    const target = { classList: { contains: () => false }, closest: selector => selector == '[data-id]' ? point : null };
    app('document.body.onclick')({ target });
    assert.deepEqual([app('ui.tab'), app('ui.sel'), app('ui.q'), tagFilter(app)], ['platform', 'l1', '', []]);
    app('ui.q = "other"; ui.tagFilter = ["A"]');
    dom['#md .modal'] = {};
    app('ACTIONS.edit(null, "l1")');
    assert.deepEqual([app('ui.edit'), app('ui.q'), tagFilter(app)], [1, '', []]);
});

test('the clear button empties only the tag filter and focuses the dropdown', () => {
    const { app, context, dom } = createApp();
    let focused = false;
    const redraws = [];
    dom['.lh .ms summary'] = { focus: () => focused = true };
    context.renderListTagFilters = () => redraws.push('filters');
    context.renderList = () => redraws.push('list');
    app('ui.q = "blood"; ui.tagFilter = ["A", "B"]');
    app('ACTIONS.ct()');
    assert.deepEqual(tagFilter(app), []);
    assert.equal(app('ui.q'), 'blood');
    assert.deepEqual(redraws, ['filters', 'list']);
    assert.equal(focused, true);
});

test('ticking the dropdown sets the tag filter from every checked box', () => {
    const { app, context, dom } = createApp();
    const redraws = [];
    dom['.lh input[name=tagf]:checked'] = [{ value: 'A' }, { value: 'C' }];
    context.renderListTagFilters = () => redraws.push('filters');
    context.renderList = () => redraws.push('list');
    app('document.body.onchange')({ target: { name: 'tagf', dataset: {} } });
    assert.deepEqual(tagFilter(app), ['A', 'C']);
    assert.deepEqual(redraws, ['filters', 'list']);
});

test('deleting a tag removes it from the active filter', async () => {
    const { app } = createApp();
    app('profile.tags = [{ name: "A", color: "#000000" }, { name: "B", color: "#ffffff" }]; ui.tagFilter = ["A", "B"]');
    app('ACTIONS.tdel({ dataset: { i: "0" } })');
    await flush();
    assert.deepEqual(tagFilter(app), ['B']);
});

test('renaming a tag renames it inside the active filter', () => {
    const { app } = createApp();
    app('profile.tags = [{ name: "A", color: "#000000" }, { name: "B", color: "#ffffff" }]; ui.tagFilter = ["A", "B"]');
    app('renameTag')({ dataset: { tn: '0' }, value: 'Z' });
    assert.deepEqual(tagFilter(app), ['Z', 'B']);
});

test('the dropdown summary names one selected tag and counts several', () => {
    const { app } = createApp();
    const summary = selection => app(`ui.tagFilter = ${JSON.stringify(selection)}; listTagSummary()`);
    assert.equal(summary([]), 'Tags · Todos');
    assert.equal(summary(['Fluked']), 'Tags · Fluked');
    assert.equal(summary(['Fluked', 'Rebeated']), 'Tags · 2');
});

test('renderListTagFilters syncs the checkboxes, summary and clear button in place', () => {
    const { app, dom } = createApp();
    const inputs = [{ value: 'A', checked: true }, { value: 'B', checked: false }], summary = {}, clear = {};
    dom['.lh .ms'] = { querySelectorAll: () => inputs, querySelector: () => summary };
    dom['.lh [data-act=ct]'] = clear;
    app('ui.tagFilter = ["B"]; renderListTagFilters()');
    assert.deepEqual(inputs.map(input => input.checked), [false, true]);
    assert.equal(summary.textContent, 'Tags · B');
    assert.equal(clear.hidden, false);
    app('ui.tagFilter = []; renderListTagFilters()');
    assert.deepEqual(inputs.map(input => input.checked), [false, false]);
    assert.equal(clear.hidden, true);
});

test('the list header offers only its own tags, escaped, with the selection checked', () => {
    const { app } = createApp();
    app(`profile.levels = [
        { id: 'c1', kind: 'classic', name: 'Classic one', tags: ['x"y', 'B'] },
        { id: 'c2', kind: 'classic', name: 'Classic two', tags: ['B'] },
        { id: 'p1', kind: 'platform', name: 'Platform one', tags: ['Plat'] },
        { id: 'p2', kind: 'platform', name: 'Platform two' }
    ]; profile.order = { classic: ['c1', 'c2'], platform: ['p1', 'p2'] }; ui.tagFilter = ['B']`);
    const classic = app('lcol()');
    assert.deepEqual([...classic.matchAll(/name=tagf value="([^"]*)"/g)].map(m => m[1]), ['B', 'x&quot;y']);
    assert.match(classic, /value="B" checked>/);
    assert.match(classic, /<summary>Tags · B<\/summary>/);
    assert.match(classic, /data-act=ct aria-label="Quitar filtros de tags" title="Quitar filtros de tags">/);
    assert.equal(classic.includes('Plat'), false);
    app('ui.tab = "platform"; ui.tagFilter = []');
    const platform = app('lcol()');
    assert.deepEqual([...platform.matchAll(/name=tagf value="([^"]*)"/g)].map(m => m[1]), ['Plat']);
    assert.match(platform, /data-act=ct [^>]* hidden>/);
    app('profile.levels = profile.levels.map(level => ({ ...level, tags: [] }))');
    assert.equal(app('lcol()').includes('<details'), false, 'a list without tags has no dropdown');
});

test('a finished AREDL update does not redraw over an open dropdown', async () => {
    const { app, calls, context } = createApp();
    let present = ['.ms[open]'];
    context.document.querySelector = selector => selector.split(', ').some(part => present.includes(part)) ? {} : null;
    context.loadAredlList = async () => false;
    context.renderSyncStatus = () => {};
    await app('syncWithAredl()');
    assert.equal(calls.includes('render'), false);
    present = [];
    await app('syncWithAredl()');
    assert.ok(calls.includes('render'));
});
