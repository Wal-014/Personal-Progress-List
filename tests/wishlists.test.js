import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

function fixture(extra = {}) {
    const calls = [], timers = [], nodes = new Map();
    const item = { id: 'i1', name: 'A $& <level>', levelId: '42', creator: 'Maker', diff: 'Hard', rating: 'epic', status: 'prog', pct: 63 };
    const wishlist = { id: 'w1', name: 'Goals', items: [item] };
    nodes.set('#md', { innerHTML: '' });
    const f = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/sheet.js', 'js/components/faces.js', 'js/components/empty-list.js', 'js/components/levels.js', 'js/components/wishlists.js', 'js/components/search.js', 'js/components/dialogs.js'], {
        profile: { levels: [], order: { classic: [], platform: [] }, tags: [], wishlists: [wishlist] },
        ui: { tab: 'wish', wl: 'w1', lang: 'en', wishFx: null },
        document: { body: {}, querySelector: s => nodes.get(s) || null, querySelectorAll: () => [], addEventListener() {} },
        window: { addEventListener() {} }, localStorage: {},
        CSS: { escape: s => s },
        save: () => calls.push('save'),
        render() { calls.push(['render', JSON.parse(JSON.stringify(f.app('ui.wishFx') ?? null))]); },
        renderTagSuggestions() {},
        matchWithAredl: levels => { calls.push(['match', levels[0]]); levels[0].ar = { s: 'r', p: 9 }; },
        enrichWishlistItem: () => calls.push('enrich'),
        matchMedia: () => ({ matches: false }),
        setTimeout: (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
        clearTimeout: id => calls.push(['clear', id]),
        FormData: class { constructor(form) { return Object.entries(form.fields); } },
        ...extra
    });
    return { ...f, calls, timers, nodes, item, wishlist };
}

for (const [name, level, expected] of [
    ['matching IDs', { kind: 'classic', levelId: 42, name: 'Other' }, true],
    ['different IDs with the same name', { kind: 'classic', levelId: 43, name: 'A $& <level>' }, false],
    ['missing saved ID', { kind: 'classic', name: 'a $& <LEVEL>' }, true],
    ['different kind', { kind: 'platform', levelId: 42, name: 'A $& <level>' }, false]
])
    test(`isInList handles ${name}`, () => {
        const f = fixture();
        f.context.profile.levels = [level];
        assert.equal(f.app('isInList')(f.item, 'classic'), expected);
    });

test('isInList falls back to name when the wishlist ID is missing', () => {
    const f = fixture();
    delete f.item.levelId;
    f.context.profile.levels = [{ kind: 'classic', levelId: 99, name: 'a $& <LEVEL>' }];
    assert.equal(f.app('isInList')(f.item, 'classic'), true);
});

test('transferred state follows the current lists and ignores old added flags', () => {
    const f = fixture();
    f.item.status = 'done';
    f.item.added = true;
    assert.equal(f.app('wishlistTransferred')(f.item), false);
    f.context.profile.levels.push({ kind: 'platform', name: f.item.name, levelId: 42 });
    assert.equal(f.app('wishlistTransferred')(f.item), true);
    f.item.kind = 'classic';
    assert.equal(f.app('wishlistTransferred')(f.item), false);
    f.item.kind = 'platform';
    assert.equal(f.app('wishlistTransferred')(f.item), true);
    f.context.profile.levels = [];
    assert.equal(f.app('wishlistTransferred')(f.item), false);
});

test('fillFromSheet fills kind without overwriting an existing kind', () => {
    const f = fixture();
    f.app('useSheetLevels')([[42, 'Level', 'Creator', 3, 1, 2], [43, 'Classic', '', 2, 0, 0]]);
    f.app('fillFromSheet')(f.item);
    assert.equal(f.item.kind, 'platform');
    const classic = { levelId: '43' }, saved = { levelId: '42', kind: 'classic' };
    f.app('fillFromSheet')(classic);
    f.app('fillFromSheet')(saved);
    assert.equal(classic.kind, 'classic');
    assert.equal(saved.kind, 'classic');
});

test('ensureProfileDefaults removes invalid kinds and percentages from imported data', () => {
    const f = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js'], { localStorage: {} });
    f.app(`profile = emptyProfile(); profile.wishlists = [{ id: 'w', items: [
        { id: 'a', name: 'A', kind: 'classic', pct: 0 },
        { id: 'b', name: 'B', kind: 'platform', pct: 100 },
        { id: 'c', name: 'C', kind: 'other', pct: 63.6 },
        { id: 'd', name: 'D', kind: '<script>', pct: '50' },
        { id: 'e', name: 'E', kind: null, pct: -1 },
        { id: 'f', name: 'F', pct: 101 }
    ] }]; ensureProfileDefaults()`);
    const items = f.app('profile.wishlists[0].items');
    assert.equal(items[0].kind, 'classic');
    assert.equal(items[0].pct, 0);
    assert.equal(items[1].kind, 'platform');
    assert.equal(items[1].pct, 100);
    for (const item of items.slice(2)) {
        assert.equal('kind' in item, false);
        assert.equal('pct' in item, false);
    }
});

test('setWishlistStatus leaves a repeated state untouched', () => {
    const f = fixture();
    f.app('setWishlistStatus')('i1', 'prog');
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.timers, []);
});

test('status changes retain percentage and expose transient motion only during render', () => {
    const f = fixture();
    f.wishlist.items.push({ id: 'i2', name: 'Done', status: 'done' });
    f.app('setWishlistStatus')('i1', 'done');
    assert.equal(f.item.pct, 63);
    assert.deepEqual(f.calls.slice(0, 2), ['save', ['render', { id: 'i1', from: 63, ratio: 50 }]]);
    assert.equal(f.app('ui.wishFx'), null);
    assert.equal(f.timers.filter(x => x.delay == 1200).length, 1);
    f.app('setWishlistStatus')('i1', 'todo');
    f.app('setWishlistStatus')('i1', 'prog');
    assert.equal(f.item.pct, 63);
    assert.match(f.app('wishView()'), /data-wp="i1" value="63"/);
    assert.equal(f.timers.filter(x => x.delay == 1200).length, 1);
    assert.deepEqual(f.calls.at(-1), ['render', { id: null, from: 0, ratio: 50 }]);
});

test('completion from todo starts at zero and offers immediately with reduced motion', () => {
    const f = fixture({ matchMedia: () => ({ matches: true }) });
    f.item.status = 'todo';
    f.app('setWishlistStatus')('i1', 'done');
    assert.deepEqual(f.calls[1], ['render', { id: 'i1', from: 0, ratio: 0 }]);
    assert.equal(f.timers.some(x => x.delay == 0), true);
});

for (const reason of ['closed', 'other wishlist', 'status changed', 'removed', 'modal', 'transferred'])
    test(`completion offer is skipped when ${reason}`, () => {
        const f = fixture();
        f.item.status = 'done';
        assert.equal(f.app('canOfferWishlistTransfer')(f.wishlist, f.item), true);
        if (reason == 'closed') f.context.ui.tab = 'home';
        if (reason == 'other wishlist') f.context.ui.wl = 'w2';
        if (reason == 'status changed') f.item.status = 'prog';
        if (reason == 'removed') f.wishlist.items = [];
        if (reason == 'modal') f.nodes.set('#md dialog', {});
        if (reason == 'transferred') f.context.profile.levels.push({ kind: 'classic', name: f.item.name, levelId: 42 });
        assert.equal(f.app('canOfferWishlistTransfer')(f.wishlist, f.item), false);
    });

for (const status of ['todo', 'done'])
    test(`setWishlistPercent ignores a ${status} item`, () => {
        const f = fixture();
        f.item.status = status;
        f.app('setWishlistPercent')({ dataset: { wp: 'i1' }, value: '10' });
        assert.equal(f.item.pct, 63);
        assert.deepEqual(f.calls, []);
    });

for (const [value, expected] of [['-5', 0], ['150', 100], ['63.6', 64], ['', 0]])
    test(`setWishlistPercent normalizes ${JSON.stringify(value)} and updates without rendering`, () => {
        const f = fixture(), bar = { style: {} };
        const input = { dataset: { wp: 'i1' }, value, closest: () => ({ querySelector: () => bar }) };
        f.app('setWishlistPercent')(input);
        assert.equal(f.item.pct, expected);
        assert.equal(String(input.value), String(expected));
        assert.equal(bar.style.width, `${expected}%`);
        assert.deepEqual(f.calls, ['save']);
    });

for (const kind of ['classic', 'platform'])
    test(`transferWishlistItem adds an unplaced ${kind} level without changing wishlist progress`, () => {
        const f = fixture(), before = { ...f.item };
        f.app('transferWishlistItem')('i1', kind);
        assert.deepEqual(f.item, { ...before, kind });
        assert.equal(f.wishlist.items[0], f.item);
        const level = f.context.profile.levels[0];
        assert.ok(level.id);
        assert.equal(level.name, before.name);
        assert.equal(level.kind, kind);
        assert.equal(level.levelId, '42');
        assert.equal(level.creator, 'Maker');
        assert.equal(level.diff, 'Hard');
        assert.equal(level.rating, 'epic');
        assert.deepEqual(JSON.parse(JSON.stringify(level.ar)), { s: 'r', p: 9 });
        assert.deepEqual(JSON.parse(JSON.stringify(level.deaths)), {});
        assert.deepEqual(Array.from(level.tags), []);
        assert.equal(level.notes, '');
        assert.equal(level.date, f.app('todayLocal()'));
        assert.equal(f.context.profile.order[kind].length, 0);
        assert.ok(f.calls.includes('save'));
        assert.equal(f.nodes.get('#md').innerHTML, '');
    });

test('a transfer moves keyboard focus from the replaced button to the card status control', () => {
    const f = fixture();
    let focused = false;
    f.nodes.set('.wi[data-id="i1"] [data-act=wstatus][data-v=done]', { focus: () => focused = true });
    f.app('transferWishlistItem')('i1', 'classic');
    assert.equal(focused, true);
});

test('duplicate transfer preserves the existing level and announces literal user text', () => {
    const f = fixture(), existing = { id: 'existing', kind: 'classic', name: f.item.name, levelId: 42, notes: 'Keep' };
    const toast = { textContent: '', classList: { add() {}, remove() {} } };
    f.nodes.set('#toast', toast);
    f.context.profile.levels.push(existing);
    f.app('transferWishlistItem')('i1', 'classic');
    assert.equal(f.context.profile.levels.length, 1);
    assert.equal(f.context.profile.levels[0], existing);
    assert.equal(existing.notes, 'Keep');
    assert.match(toast.textContent, /A \$& <level> is already in your Classic list\./);
    assert.equal(f.item.kind, 'classic');
    assert.equal(f.item.status, 'prog');
    assert.equal(f.item.pct, 63);
});

test('transferDialog offers the detected kind or both unknown choices and escapes names', () => {
    const f = fixture();
    for (const kind of [undefined, 'classic', 'platform']) {
        f.item.kind = kind;
        const html = f.app('transferDialog')(f.item, true);
        assert.equal((html.match(/data-act=wto/g) || []).length, kind ? 1 : 2);
        assert.match(html, /Level completed!/);
        assert.match(html, /Congratulations on completing A \$&amp; &lt;level&gt;!/);
        assert.doesNotMatch(html, /<level>/);
        assert.match(html, /data-act=close>Not now/);
        if (kind) assert.match(html, new RegExp(`data-v=${kind}[^>]*autofocus`));
    }
    assert.match(f.app('transferDialog')(f.item, false), /<h2>Add to a list<\/h2>/);
});

test('reorderWishlist saves DOM order without changing item data, while canceled drags only redraw', () => {
    for (const type of ['drop', 'dragend', 'touchcancel', 'pointercancel']) {
        const f = fixture(), other = { id: 'i2', name: 'Other', status: 'done', pct: 20 };
        f.wishlist.items.push(other);
        f.nodes.set('.wl', { children: [{ dataset: { id: 'i2' } }, { dataset: { id: 'i1' } }] });
        f.app('reorderWishlist')({ originalEvent: { type } });
        assert.deepEqual(Array.from(f.wishlist.items), type == 'drop' ? [other, f.item] : [f.item, other]);
        assert.equal(f.item.pct, 63);
        assert.equal(other.status, 'done');
        assert.equal(f.calls.includes('save'), type == 'drop');
        assert.equal(f.calls.filter(x => Array.isArray(x) && x[0] == 'render').length, 1);
    }
});

test('initWishlistSort keeps controls clickable and requires the grip for touch and pen', () => {
    const created = [], f = fixture({ Sortable: function (element, options) { created.push({ element, options }); } });
    f.nodes.set('.wl', {});
    f.app('initWishlistSort()');
    const { options } = created[0];
    assert.equal(options.animation, 180);
    assert.equal(options.preventOnFilter, false);
    assert.equal(options.fallbackTolerance, 5);
    assert.equal(options.onUpdate, f.app('reorderWishlist'));
    assert.equal('onEnd' in options, false);
    for (const pointerType of ['mouse', 'touch', 'pen'])
        for (const location of ['body', 'grip', 'button', 'input']) {
            const target = { closest: selector => selector == '.grip' ? location == 'grip' : ['button', 'input'].includes(location) };
            assert.equal(Boolean(options.filter({ type: 'pointerdown', pointerType, target })), pointerType == 'mouse' ? ['button', 'input'].includes(location) : location != 'grip');
        }
    f.nodes.delete('.wl');
    f.app('initWishlistSort()');
    assert.equal(created.length, 1);
});

test('saveWishlistItem stores valid kinds and moves an edited item to its chosen position', () => {
    const f = fixture();
    f.load(['js/events.js']);
    f.wishlist.items.push({ id: 'i2', name: 'Second' }, { id: 'i3', name: 'Third' });
    const form = { dataset: { id: 'i1' }, fields: { name: 'Edited', lid: '42', creator: 'Maker', kind: 'platform', wpos: '3' } };
    f.app('saveWishlistItem')(form);
    assert.deepEqual(Array.from(f.wishlist.items, i => i.id), ['i2', 'i3', 'i1']);
    assert.equal(f.item.kind, 'platform');
    assert.equal(f.item.pct, 63);
    form.fields.kind = 'invalid';
    f.app('saveWishlistItem')(form);
    assert.equal('kind' in f.item, false);
});

test('wishlist form includes list data and an accessible position only for existing items', () => {
    const f = fixture();
    const html = f.app('wform')(f.item);
    assert.match(html, /name=kind value=""/);
    assert.match(html, /name=kindT value=""/);
    assert.doesNotMatch(html, /undefined/);
    assert.match(html, /name=wpos[^>]*min=1[^>]*max=1[^>]*value="1"/);
    assert.doesNotMatch(f.app('wform()'), /name=wpos/);
});

test('wishView renders fixed card structure and state specific accessible controls', () => {
    const f = fixture();
    f.item.kind = 'platform';
    for (const status of ['todo', 'prog', 'done']) {
        f.item.status = status;
        const html = f.app('wishView()');
        assert.match(html, new RegExp(`class="obj wi s-${status}"`));
        assert.equal((html.match(/data-act=wstatus/g) || []).length, 3);
        assert.match(html, new RegExp(`data-v=${status} aria-pressed=true`));
        assert.match(html, /role=group aria-label="Status · A \$&amp; &lt;level&gt;"/);
        assert.match(html, /class=grip aria-hidden=true/);
        assert.match(html, /class=wprog/);
        assert.equal(html.includes('data-wp='), status == 'prog');
        assert.equal(html.includes('data-act=wto'), status == 'done');
        assert.doesNotMatch(html, /data-wi=|<select/);
        if (status == 'todo') assert.match(html, /Set it to In progress/);
        if (status == 'done') assert.match(html, /data-v=platform>Add to Platformer/);
        if (status == 'done') assert.match(html, /class=wprog><div class="pb" aria-hidden=true><i style="width:100%;/, 'a completed card shows a full bar whatever percentage was recorded');
    }
    f.context.profile.levels.push({ kind: 'platform', levelId: '42', name: 'Level' });
    assert.match(f.app('wishView()'), /class=wadded/);
    assert.doesNotMatch(f.app('wishView()'), /data-act=wto/);
    f.context.profile.levels = [];
    delete f.item.kind;
    assert.match(f.app('wishView()'), /data-act=wask/);
});

test('header shows three counts, completion and motion only for the celebrated card', () => {
    const f = fixture();
    f.item.status = 'todo';
    f.wishlist.items.push({ id: 'i2', name: 'Active', status: 'prog' }, { id: 'i3', name: 'Done', status: 'done' });
    let html = f.app('wishView()');
    assert.match(html, /1 \/ 3 completed/);
    for (const text of ['Not started: 1', 'In progress: 1', 'Completed: 1']) assert.ok(html.includes(text));
    assert.doesNotMatch(html, /class=wstamp|class="wh done"/);
    f.wishlist.items.forEach(i => i.status = 'done');
    f.context.ui.wishFx = { id: 'i1', from: 63, ratio: 33 };
    html = f.app('wishView()');
    assert.match(html, /class="wh done"/);
    assert.match(html, /Wishlist completed!/);
    assert.equal((html.match(/class=wstamp/g) || []).length, 1);
    assert.match(html, /--from:63%/);
    assert.match(html, /<div class="pb wfill" aria-hidden=true><i style="width:100%;--from:33%">/, 'the header bar grows from its previous ratio');
    f.context.ui.wishFx = null;
    assert.doesNotMatch(f.app('wishView()'), /class=wstamp|celebrate/);
    f.wishlist.items = [];
    assert.doesNotMatch(f.app('wishView()'), /class="wh done"/);
});

test('bell alerts derive transfer state and offer again after the saved level is removed', () => {
    const f = fixture();
    f.item.status = 'done';
    f.item.added = true;
    assert.equal(f.app('alerts()').length, 1);
    f.context.profile.levels.push({ id: 'n1', kind: 'classic', levelId: 42, name: f.item.name });
    f.context.profile.order.classic.push('n1');
    assert.equal(f.app('alerts()').length, 0);
    f.context.profile.levels = [];
    assert.equal(f.app('alerts()').length, 1);
});


test('askTransfer waits for sheet kind detection and keeps unknown levels as a choice', async () => {
    for (const found of [true, false]) {
        const f = fixture();
        f.item.status = 'done';
        const dialog = { querySelector: () => null, addEventListener() {}, showModal() {} };
        let html = '', fetches = 0;
        const host = {
            get innerHTML() { return html; },
            set innerHTML(value) { html = value; if (value) f.nodes.set('#md dialog', dialog); }
        };
        f.nodes.set('#md', host);
        f.context.fetch = async () => {
            fetches++;
            return { ok: true, json: async () => found ? [[42, 'Level', '', 3, 1, 2]] : [] };
        };
        const promise = f.app('askTransfer')(f.item, true);
        assert.equal(html, '');
        await promise;
        assert.equal(fetches, 1);
        assert.equal(f.item.kind, found ? 'platform' : undefined);
        assert.equal(f.calls.some(x => Array.isArray(x) && x[0] == 'render'), found, 'the card redraws only when the sheet filled its data');
        assert.equal((html.match(/data-act=wto/g) || []).length, found ? 1 : 2);
        assert.equal(f.item.status, 'done');
        assert.equal(f.item.pct, 63);
    }
});

test('a delayed completion offer rechecks screen and item after loading the sheet', async () => {
    for (const reason of ['screen', 'removed', 'modal', 'transferred']) {
        const f = fixture();
        let resolveFetch;
        f.context.fetch = () => new Promise(resolve => resolveFetch = resolve);
        f.app('setWishlistStatus')('i1', 'done');
        const timer = f.timers.find(x => x.delay == 1200);
        timer.fn();
        if (reason == 'screen') f.context.ui.tab = 'home';
        if (reason == 'removed') f.wishlist.items = [];
        if (reason == 'modal') f.nodes.set('#md dialog', {});
        if (reason == 'transferred') f.context.profile.levels.push({ kind: 'classic', levelId: '42', name: f.item.name });
        resolveFetch({ ok: true, json: async () => [[42, 'Level', '', 3, 0, 2]] });
        await f.app('sheetLoad');
        await Promise.resolve();
        assert.equal(f.nodes.get('#md').innerHTML, '');
    }
});

test('showToast replaces feedback and restarts its lifetime without inserting user HTML', () => {
    const f = fixture(), classes = new Set();
    const toast = { textContent: '', classList: { add: s => classes.add(s), remove: s => classes.delete(s) } };
    f.nodes.set('#toast', toast);
    f.app('showToast')('First');
    f.app('showToast')('<img src=x> $&');
    assert.equal(toast.textContent, '<img src=x> $&');
    assert.equal(classes.has('show'), true);
    assert.deepEqual(f.calls.at(-1), ['clear', 1]);
    assert.equal(f.timers.at(-1).delay, 4000);
    f.timers.at(-1).fn();
    assert.equal(classes.has('show'), false);
});

test('only the last completed item announces the whole wishlist completion', () => {
    const f = fixture(), toast = { textContent: '', classList: { add() {}, remove() {} } };
    f.nodes.set('#toast', toast);
    f.wishlist.items.push({ id: 'i2', name: 'Second', status: 'todo' });
    f.app('setWishlistStatus')('i1', 'done');
    assert.equal(toast.textContent, '');
    f.app('setWishlistStatus')('i2', 'done');
    assert.equal(toast.textContent, 'Wishlist completed!');
});

test('home progress bars remain static even while the open wishlist is celebrating', () => {
    const f = fixture();
    f.context.ui.wishFx = { id: 'i1', from: 63, ratio: 0 };
    const html = f.app('progressBar')(f.wishlist);
    assert.match(html, /width:0%/);
    assert.doesNotMatch(html, /wfill|--from/);
});

test('saving a new item keeps detected kind and starts without manual progress', () => {
    const f = fixture();
    f.app('saveWishlistItem')({ dataset: {}, fields: { name: ' New ', kind: 'classic', lid: '99' } });
    const item = f.wishlist.items[1];
    assert.equal(item.name, 'New');
    assert.equal(item.kind, 'classic');
    assert.equal(item.status, 'todo');
    assert.equal('pct' in item, false);
    assert.equal('added' in item, false);
});

for (const lang of ['es', 'en'])
    test(`transfer feedback preserves dollar patterns and escapes names in ${lang}`, () => {
        const f = fixture();
        f.context.ui.lang = lang;
        f.item.name = '<name> $& $\' $$ {list}';
        const toast = { textContent: '', classList: { add() {}, remove() {} } };
        f.nodes.set('#toast', toast);
        f.app('transferWishlistItem')('i1', 'platform');
        assert.ok(toast.textContent.startsWith(f.item.name));
        assert.match(f.app('transferDialog')(f.item, true), /&lt;name&gt; \$&amp;/);
    });


for (const kind of ['classic', 'platform'])
    test(`transfer matches cached ${kind} ranking and publisher without modifying the wishlist item`, () => {
        const f = fixture();
        f.load(['js/api.js']);
        f.item.creator = null;
        f.context.seed = [{ k: kind == 'classic' ? 'd' : 'p', i: 42, n: 'Known', p: 12, u: 'Publisher' }];
        f.app('aredlCache = seed');
        f.app('transferWishlistItem')('i1', kind);
        const level = f.context.profile.levels[0];
        assert.equal(level.creator, 'Publisher');
        assert.deepEqual(JSON.parse(JSON.stringify(level.ar)), { s: 'r', p: 12 });
        assert.equal(f.item.creator, null);
        assert.equal(f.item.pct, 63);
        assert.equal(f.context.profile.order[kind].length, 0);
    });

test('an unmatched transfer starts as unplaced with no AREDL position', () => {
    const f = fixture();
    f.load(['js/api.js']);
    f.app('transferWishlistItem')('i1', 'classic');
    assert.deepEqual(JSON.parse(JSON.stringify(f.context.profile.levels[0].ar)), { s: 'n' });
});

test('controlSelector restores the specific status button and percentage input', () => {
    const f = fixture();
    f.load(['js/render.js']);
    f.nodes.set('#app', { contains: () => true });
    for (const [tag, attrs, expected] of [
        ['BUTTON', { 'data-act': 'wstatus', 'data-id': 'i1', 'data-v': 'prog' }, 'button[data-act="wstatus"][data-id="i1"][data-v="prog"]'],
        ['INPUT', { 'data-wp': 'i1' }, 'input[data-wp="i1"]']
    ]) {
        const element = { tagName: tag, hasAttribute: name => name in attrs, getAttribute: name => attrs[name] };
        assert.equal(f.app('controlSelector')(element), expected);
    }
});
