import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDurationFields, loadScripts } from './load-scripts.js';

function fixture(width = 1366) {
    const root = { contains: () => false }, nodes = { '#app': root }, focused = [];
    const control = name => ({ focus: () => focused.push(name) });
    nodes['.rcol .box > h2'] = control('heading');
    nodes['.rcol [data-act=edit]'] = control('edit');
    nodes['.lh .ms summary'] = control('filters');
    nodes['.list-add'] = control('add');
    nodes['.lv[data-id="c1"]'] = control('c1');
    const document = {
        body: {}, documentElement: { dataset: {} }, addEventListener() {},
        querySelector: selector => nodes[selector], querySelectorAll: () => []
    };
    const { app, context } = loadScripts([
        'js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/components/faces.js',
        'js/components/duration-input.js', 'js/components/deaths-input.js', 'js/components/search.js',
        'js/components/help-tip.js', 'js/components/levels.js', 'js/render.js', 'js/events.js'
    ], {
        document, innerWidth: width, CSS: { escape: String }, window: { addEventListener() {} },
        localStorage: {}, FormData: class extends URLSearchParams { constructor(form) { super(form.entries); } },
        sharedShell: screen => screen, askConfirm: async () => true, syncDrawer() {}, initWishlistSort() {},
        matchWithAredl() {}, matchWithDemonlist() {}, closeModal() {}, showToast() {}
    });
    app(`accountRendered = () => {};
        profile = emptyProfile();
        store = { cur: 'local', profs: { local: { data: profile } } };
        ui.lang = 'en'; ui.tab = 'classic'; ui.sel = 'c1';
        profile.levels = [
            { id: 'c1', kind: 'classic', name: 'Classic first', tags: ['A'] },
            { id: 'c2', kind: 'classic', name: 'Classic second' },
            { id: 'p1', kind: 'platform', name: 'Platform first' }
        ];
        profile.order = { classic: ['c1', 'c2'], platform: ['p1'] };
        render();`);
    const save = (kind = 'classic') => app('saveLevel')({
        dataset: { id: 'c1' }, elements: { ...emptyDurationFields(), pos: { value: '1' } },
        entries: [['name', 'Edited first'], ['kind', kind], ['attN', '42'], ['tg', 'A']]
    });
    const order = kind => [...app('profile.order')[kind]];
    const detail = () => root.innerHTML.split('class="rcol')[1];
    const keydown = (key, closest = () => null) => document.onkeydown({
        key, target: { closest, dataset: {}, matches: () => false }, preventDefault() {}
    });
    return { app, context, nodes, document, focused, save, order, detail, keydown };
}

test('switching modes clears search, tag filters, bulk selection and edit state and preserves both orders', () => {
    const f = fixture();
    f.app(`ui.q = 'classic'; ui.tagFilter = ['A']; ui.edit = 1;
        ui.levelSelection = { profile, kind: 'classic', ids: new Set(['c1']) };
        ACTIONS.tab({ dataset: { v: 'platform' } });`);
    assert.deepEqual([...f.app('[ui.tab, ui.q, ui.tagFilter.length, ui.sel, ui.edit, ui.levelSelection]')], ['platform', '', 0, null, 0, null]);
    assert.deepEqual(f.order('classic'), ['c1', 'c2']);
    assert.deepEqual(f.order('platform'), ['p1']);
    assert.doesNotMatch(f.detail(), /Classic first|Platform first/);
    f.app('ACTIONS.tab({ dataset: { v: "classic" } })');
    assert.deepEqual([...f.app('rankedIds(ui.tab)')], ['c1', 'c2']);
});

test('saving and reordering by keyboard or drag renders the same edited level until it is deleted', async () => {
    const f = fixture();
    f.app('ui.edit = 1');
    f.save();
    assert.equal(f.app('findLevel(ui.sel).attN'), 42);
    assert.equal(f.app('ui.edit'), 0);
    assert.match(f.detail(), /Edited first/);
    assert.equal(f.focused.at(-1), 'heading');

    assert.equal(f.app('moveRankedLevel("c1", 1)'), true);
    assert.deepEqual(f.order('classic'), ['c2', 'c1']);
    assert.equal(f.app('ui.sel'), 'c1');
    assert.match(f.detail(), /Edited first/);
    f.nodes['#lst'] = { children: ['c1', 'c2'].map(id => ({ dataset: { id } })), parentElement: {} };
    f.context.Sortable = class {};
    f.app('reorderList({ originalEvent: { type: "drop" } })');
    assert.deepEqual(f.order('classic'), ['c1', 'c2']);
    assert.equal(f.app('ui.sel'), 'c1');
    assert.match(f.detail(), /Edited first/);

    await f.app('ACTIONS.del')({}, 'c1');
    assert.equal(f.app('findLevel("c1")'), undefined);
    assert.equal(f.app('ui.sel'), null);
    assert.deepEqual(f.order('classic'), ['c2']);
    assert.deepEqual(f.order('platform'), ['p1']);
    assert.doesNotMatch(f.detail(), /Edited first|Classic second/);
});

test('saving a level into the other mode resets its filters and picks the saved level in the new list', () => {
    const f = fixture();
    f.app(`ui.q = 'classic'; ui.tagFilter = ['A']; ui.edit = 1;
        ui.levelSelection = { profile, kind: 'classic', ids: new Set(['c1']) };`);
    f.save('platform');
    assert.deepEqual([...f.app('[ui.tab, ui.q, ui.tagFilter.length, ui.sel, ui.edit, ui.levelSelection]')], ['platform', '', 0, 'c1', 0, null]);
    assert.deepEqual(f.order('classic'), ['c2']);
    assert.deepEqual(f.order('platform'), ['c1', 'p1']);
    assert.match(f.detail(), /Edited first/);
});

test('a redraw uses refreshed data for the selected ID and clears the panel when that ID leaves the list', () => {
    const f = fixture(390);
    f.app(`profile.levels[0] = { ...profile.levels[0], levelId: '123', ar: { s: 'r', p: 18 }, gdl: 45 };
        profile.levels.reverse();
        render();`);
    assert.equal(f.app('ui.sel'), 'c1');
    assert.match(f.detail(), /thumbnail\/123/);
    assert.match(f.detail(), /<dd>#18<\/dd>.*<dd>#45<\/dd>/);
    f.app('findLevel("c1").kind = "platform"; ui.edit = 1; render()');
    assert.deepEqual([...f.app('[ui.sel, ui.edit, rankedIds("classic").join(",")]')], [null, 0, 'c2']);
    assert.doesNotMatch(f.detail(), /^ has|Classic first/);
    f.app('ui.sel = "removed"; render()');
    assert.equal(f.app('ui.sel'), null);
});

test('filter hint responds to search and tags and stays hidden in bulk-only and public views', () => {
    const f = fixture();
    f.nodes['#lw'] = { innerHTML: '' };
    const hint = f.nodes['#list-reorder-hint'] = { hidden: true };
    f.document.body.oninput({ target: { id: 'q', value: 'First', dataset: {} } });
    assert.equal(f.app('ui.q'), 'first');
    assert.equal(f.app('canReorder()'), false);
    assert.equal(hint.hidden, false);
    f.document.body.oninput({ target: { id: 'q', value: '', dataset: {} } });
    f.app('ui.levelSelection = { profile, kind: ui.tab, ids: new Set() }; renderList()');
    assert.equal(f.app('canReorder()'), false);
    assert.equal(hint.hidden, true);

    f.document.querySelectorAll = selector => selector.includes('name=tagf') ? [{ value: 'A' }] : [];
    f.app('ui.levelSelection = null; setListTagFilter()');
    assert.deepEqual([...f.app('ui.tagFilter')], ['A']);
    assert.equal(hint.hidden, false);
    f.app('viewing = { identity: {} }; renderList()');
    assert.equal(f.app('canReorder()'), false);
    assert.equal(hint.hidden, true);
});

test('mobile Escape returns to the same card and remembered list scroll', () => {
    const f = fixture(390);
    f.nodes['#lw'] = { scrollTop: 0, getClientRects: () => [], innerHTML: '' };
    f.app('ui.listReturnY = 4100');
    f.keydown('Escape', selector => selector === '.rcol.has' ? {} : null);
    assert.equal(f.app('ui.sel'), null);
    assert.equal(f.nodes['#lw'].scrollTop, 4100);
    assert.equal(f.focused.at(-1), 'c1');
});

test('activating a tag in mobile detail returns to the filtered list and focuses its filter', () => {
    const f = fixture(390);
    const tag = { dataset: { tag: 'A' }, closest: selector => selector === '.rcol' ? {} : null };
    const target = { classList: { contains: () => false }, closest: selector => selector === '[data-tag]' ? tag : null };
    f.document.body.onclick({ target });
    assert.deepEqual([...f.app('ui.tagFilter')], ['A']);
    assert.equal(f.app('ui.sel'), null);
    assert.equal(f.app('canReorder()'), false);
    assert.equal(f.focused.at(-1), 'filters');
});
