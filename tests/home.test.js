import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

function homeApp() {
    const root = { innerHTML: '', contains: () => false };
    const document = { body: {}, documentElement: { dataset: {} }, activeElement: null,
        querySelector: selector => selector == '#app' ? root : null, querySelectorAll: () => [], addEventListener() {} };
    const loaded = loadScripts(['data/demo-data.js', 'js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js',
        'js/ranking-sync.js', 'js/components/faces.js', 'js/components/levels.js', 'js/components/timeline.js', 'js/components/rankings.js', 'js/components/compare.js',
        'js/components/stats.js', 'js/components/wishlists.js', 'js/notifications.js', 'js/components/home.js', 'js/components/shell.js',
        'js/components/account-ui.js', 'js/render.js', 'js/events.js'], {
        document, window: { addEventListener() {} }, localStorage: {},
        publicUsernameValid: true, account: { status: 'signed-out' }, cloudUser: null, viewing: { identity: null },
        cloudHeaderStatus: () => '', localProfileSummary: () => 'Local profile', publicIdentityCard: () => '<div class=profile-card>Public player</div>',
        initSort() {}, initWishlistSort() {}, renderTagSuggestions() {}, finishAccountSignIn() {},
        lcol: () => 'List content', panel: () => 'Level panel', publicViewScreen: () => 'Loading public profile'
    });
    loaded.app("profile = JSON.parse(JSON.stringify(window.DEMO_PROFILE)); store = { cur: 'demo', profs: { demo: { name: 'Demo', color: '#123456', data: profile } } }; ui.lang = 'en'; ui.tab = 'home'");
    Object.assign(loaded.context, { lcol: () => 'List content', panel: () => 'Level panel' });
    return { ...loaded, root };
}

test('entering either list keeps the sidebar disclosure closed until the user expands it', () => {
    const { app } = homeApp();
    for (const kind of ['classic', 'platform']) {
        app(`ui.tab = '${kind}'`);
        assert.match(app('shellNavigation()'), /data-act=listchoices aria-expanded=false/);
    }
    app('ui.listsExpanded = true');
    assert.match(app('shellNavigation()'), /data-act=listchoices aria-expanded=true/);
});

test('Home cards use ranked leads, faces, localized counts and attempts without nested controls', () => {
    const { app } = homeApp();
    const html = app('home()');
    assert.equal((html.match(/class="hcard hcard-/g) || []).length, 2);
    for (const text of ['Bloodbath', 'Demo Platformer A', '9 Levels', '2 Levels', '95,596 attempts', '6,057 attempts'])
        assert.ok(html.includes(text), text);
    assert.equal((html.match(/class=hbadge>#1/g) || []).length, 2);
    assert.match(html, /class="face/);
    assert.equal((html.match(/data-th=/g) || []).length, app("['classic', 'platform'].filter(kind => thumbUrl(findLevel(rankedIds(kind)[0]))).length"));
    assert.match(html, /data-act=add/);
    assert.match(html, /data-act=tab data-v=stats/);
    app("profile.levels = [{ id: 'one', kind: 'classic', name: '<Lead>', attN: 0 }]; profile.order.classic = ['one']; profile.order.platform = []");
    const card = app("homeListCard('classic')");
    assert.match(card, /&lt;Lead&gt;/);
    assert.doesNotMatch(card, /data-th=|attempts|<button/);
    app('profile.order.classic = []');
    assert.match(app("homeListCard('classic')"), /Unplaced/);
    assert.doesNotMatch(app("homeListCard('classic')"), /No levels yet|class=hbadge/);
});

test('empty cards stay navigable, show the empty label and omit badges, faces and thumbnails', () => {
    const { app } = homeApp();
    app('profile = emptyProfile()');
    for (const kind of ['classic', 'platform']) {
        const html = app(`homeListCard('${kind}')`);
        assert.match(html, /No levels yet/);
        assert.match(html, /0 Levels/);
        assert.match(html, new RegExp('data-act=tab data-v=' + kind));
        assert.doesNotMatch(html, /class=hbadge|class="face|data-th=/);
    }
});

test('Platformer has its own icon and keeps fallback art underneath the optional thumbnail', () => {
    const { app } = homeApp();
    app("profile = emptyProfile(); profile.levels = [{ id: 'p', kind: 'platform', name: 'Platform', levelId: '123' }]; profile.order.platform = ['p']");
    assert.match(app("homeListCard('platform')"), /data-th=/);
    assert.match(app("homeListCard('platform')"), /class=hghost[\s\S]+class=hcover/);
    app('delete profile.levels[0].levelId');
    const card = app("homeListCard('platform')"), icon = app('ICONS.platform');
    assert.equal(typeof icon, 'string');
    assert.match(card, /class=hghost/);
    assert.ok(card.includes(icon));
    assert.ok(!card.includes(app('ICONS.wish')));
    const menu = app('shellNavigation()').match(/<div id=hlists[\s\S]*?<\/div>/)[0];
    assert.ok(menu.includes(icon));
    assert.ok(!menu.includes(app('ICONS.wish')));
});

const wishlistFixture = `profile.wishlists = [
    { id: 'done', name: 'Done', items: [{ status: 'done' }] },
    { id: 'todo', name: 'To do', items: [{ status: 'todo' }] },
    { id: 'prog', name: '<In progress>', items: [{ status: 'prog' }] },
    { id: 'prog2', name: 'Also in progress', items: [{ status: 'prog' }] }
]`;

test('wishlist preview caps at three, keeps stable status order, escapes names and links to the index', () => {
    const { app } = homeApp();
    app(wishlistFixture);
    const html = app('homeWishlists()');
    assert.deepEqual([...html.matchAll(/data-act=wopen data-id="([^"]+)"/g)].map(match => match[1]), ['prog', 'prog2', 'todo']);
    assert.match(html, /&lt;In progress&gt;/);
    assert.match(html, /data-act=tab data-v=wish[^>]*>View all \(4\)/);
    assert.doesNotMatch(html, /data-act=wnew/);
    app('profile.wishlists.pop()');
    assert.doesNotMatch(app('homeWishlists()'), /data-act=wnew/);
    app('profile.wishlists.pop()');
    assert.match(app('homeWishlists()'), /data-act=wnew/);
});

test('View all omits a count when the preview shows every wishlist', () => {
    const { app } = homeApp();
    for (const count of [3, 2, 1, 0]) {
        app(wishlistFixture);
        app(`profile.wishlists = profile.wishlists.slice(0, ${count})`);
        assert.match(app('homeWishlists()'), /data-act=tab data-v=wish>View all<span/, `${count} wishlists`);
    }
});

test('Home navigation distinguishes own lists from public lists', () => {
    const { app } = homeApp();
    const listsLabel = () => app('shellNavigation()').match(/<button[^>]*data-act=listchoices[^>]*>[\s\S]*?<span>([^<]+)<\/span>/)[1];
    assert.equal(listsLabel(), 'My lists');
    app("viewing = { identity: { display_name: 'Public player' } }");
    assert.equal(listsLabel(), 'Lists');
});

test('empty wishlist preview exposes creation to the owner and an empty message to everyone', () => {
    const { app } = homeApp();
    app('profile.wishlists = []');
    assert.match(app('homeWishlists()'), /No wishlists yet/);
    assert.match(app('homeWishlists()'), /data-act=wnew/);
    const preview = app('homeWishlists()');
    assert.ok(preview.indexOf('No wishlists yet') < preview.indexOf('data-act=wnew'));
    app("viewing = { identity: { display_name: 'Public player' } }");
    const html = app('sharedShell(home())');
    assert.match(html, /Public player/);
    assert.doesNotMatch(html, /data-act=add|data-act=wnew/);
    const utilities = app('shellFooter()');
    assert.match(utilities, /data-act=myprogress/);
    assert.match(utilities, /data-act=pause/);
    assert.doesNotMatch(utilities, /data-act=bell|data-act=tags|guest-account|id=syncst/);
});

test('stats summary and both screens share totals, include recorded zeros and exclude missing attempts from the average', () => {
    const { app } = homeApp();
    app(`profile = emptyProfile(); profile.levels = [
        { id: 'a', name: 'Alpha', kind: 'classic', attN: 1000, attC: 500, tN: 3600 },
        { id: 'b', name: 'Beta', kind: 'platform', attN: 0, tP: 10800 },
        { id: 'c', name: 'Missing', kind: 'classic' }
    ]`);
    const summary = JSON.parse(JSON.stringify(app('statsSummary()')));
    assert.equal(summary.levelCount, 3);
    assert.equal(summary.attemptTotal, 1500);
    assert.equal(summary.playHours, 4);
    assert.equal(summary.average, 750);
    assert.equal(summary.mostAttemptsLevel.id, 'a');
    for (const draw of ['stats()', 'homeStats()']) {
        const html = app(draw);
        assert.match(html, />3</);
        assert.match(html, />1,500</);
        assert.match(html, />4</);
    }
    app("ui.lang = 'es'");
    assert.match(app('homeStats()'), />1500</);
    app('profile = emptyProfile()');
    assert.deepEqual(JSON.parse(JSON.stringify(app('statsSummary()'))), {
        levelCount: 0, attemptTotal: 0, playHours: 0, average: null, mostAttemptsLevel: null
    });
});

test('every screen uses the shared shell, active destination and page actions', () => {
    const { app, root } = homeApp();
    for (const tab of ['home', 'classic', 'platform', 'wish', 'stats']) {
        app(`ui.tab = '${tab}'; render()`);
        assert.match(root.innerHTML, /id=shell-sidebar/);
        assert.match(root.innerHTML, /<h1>Personal Progress List<\/h1>/);
        assert.doesNotMatch(root.innerHTML, /class=toolbar|class=tabbar|class=fab|class="top/);
        const destination = ['classic', 'platform'].includes(tab) ? 'aria-controls=hlists' : 'data-act=tab data-v=' + tab;
        assert.match(root.innerHTML, new RegExp(destination + ' aria-current=page'));
        const title = app('shellPageTitle()');
        if (tab == 'home') assert.equal(title, '');
        else {
            assert.match(title, /class=page-title/);
            assert.match(title, /<h2 id=screen-title tabindex=-1>/);
            assert.ok(title.includes(app(`t('${['classic', 'platform'].includes(tab) ? 'lists' : tab}')`)));
        }
        if (['classic', 'platform'].includes(tab)) assert.doesNotMatch(title, /data-act=add/);
        if (tab == 'wish') assert.match(title, /data-act=wnew/);
        app("viewing = { identity: { display_name: 'Public player' } }; render()");
        assert.match(root.innerHTML, /Public player/);
        assert.match(root.innerHTML, new RegExp(destination + ' aria-current=page'));
        assert.match(root.innerHTML, /data-act=myprogress/);
        assert.doesNotMatch(root.innerHTML, /data-act=add|data-act=wnew|id=profile-pill/);
        app('viewing = null');
    }
    app("ui.tab = 'wish'; ui.wl = 'w1'; profile.wishlists = [{ id: 'w1', name: '<Goals>', items: [] }]");
    assert.match(app('shellPageTitle()'), /&lt;Goals&gt;/);
    assert.match(app('shellPageTitle()'), /data-act=tab data-v=wish/);
    assert.doesNotMatch(app('shellPageTitle()'), /data-act=wnew/);
});

test('local profile menu retains every action without sharing', () => {
    const { app } = homeApp();
    const html = app('profileSwitcher()');
    for (const action of ['localuse', 'pedit', 'localbackup', 'localimport', 'localdata', 'asignin'])
        assert.match(html, new RegExp('data-act=' + action));
    assert.match(html, /id=profile-pill/);
    assert.doesNotMatch(html, /data-act=ashare/);
});

test('signed-in Home provides exactly one account menu and live status hook without a cloud chip', () => {
    const { app, context, root } = homeApp();
    context.cloudStatusSentence = () => 'Saved';
    context.cloudRetryButton = () => '';
    context.hasRealLocalData = () => false;
    app("account = { status: 'signed-in', profile: { display_name: '<Player>', username: 'player', color: '#123456' } }; render()");
    for (const pattern of [/id=amenu/g, /popovertarget=amenu/g, /data-cloud-status/g, /data-cloud-retry/g])
        assert.equal((root.innerHTML.match(pattern) || []).length, 1);
    assert.match(root.innerHTML, /&lt;Player&gt;/);
    assert.doesNotMatch(root.innerHTML, /id=cloudst/);
});

test('popover geometry chooses below or above and stays inside narrow and short viewports', () => {
    const { app } = homeApp();
    const place = (rect, viewport, height) => JSON.parse(JSON.stringify(app(`popoverPlacement(${JSON.stringify(rect)}, ${JSON.stringify(viewport)}, ${height})`)));
    assert.deepEqual(place({ left: 100, top: 30, bottom: 74 }, { width: 800, height: 600 }, 180), {
        width: '360px', left: '100px', top: '80px', maxHeight: '508px'
    });
    assert.deepEqual(place({ left: 740, top: 540, bottom: 584 }, { width: 800, height: 600 }, 180), {
        width: '360px', left: '428px', top: '354px', maxHeight: '522px'
    });
    const narrow = place({ left: -10, top: 150, bottom: 194 }, { width: 320, height: 240 }, 500);
    assert.equal(narrow.width, '296px');
    assert.equal(narrow.left, '12px');
    assert.equal(narrow.top, '12px');
    assert.equal(narrow.maxHeight, '132px');
    const cramped = place({ left: 100, top: 100, bottom: 144 }, { width: 800, height: 600 }, 1000);
    assert.equal(cramped.top, '150px');
    assert.equal(cramped.maxHeight, '438px');
    const aboveViewport = place({ left: 100, top: -40, bottom: 0 }, { width: 800, height: 600 }, 180);
    assert.equal(aboveViewport.top, '12px');
});

test('pause menu exposes independent named appearance groups and pressed options', () => {
    const { app } = homeApp();
    app("ui.theme = 'porcelain'; ui.background = 'orbital'");
    const html = app('pauseUI()');
    assert.match(html, /role=group aria-labelledby=colour-theme/);
    assert.match(html, /role=group aria-labelledby=background-design/);
    assert.equal((html.match(/data-act=theme /g) || []).length, 6);
    assert.equal((html.match(/data-act=background /g) || []).length, 4);
    assert.match(html, /data-act=theme data-v=porcelain aria-pressed=true/);
    assert.match(html, /data-act=background data-v=orbital aria-pressed=true/);
});

test('guest appearance actions persist independently and update the existing controls', () => {
    const { app, context } = homeApp(), pressed = {};
    const options = values => values.map(v => ({
        dataset: { v }, setAttribute: (key, value) => { assert.equal(key, 'aria-pressed'); pressed[v] = value; }
    }));
    const themes = options(['nebula', 'porcelain']), backgrounds = options(['grid', 'celestial', 'orbital']);
    context.document.querySelectorAll = selector => selector.endsWith('theme]') ? themes : backgrounds;
    context.openModal = () => assert.fail('appearance changes must leave the settings dialog intact');
    context.render = () => assert.fail('appearance changes must leave the inline app form intact');
    app("ACTIONS.background({ dataset: { v: 'celestial' } }); ACTIONS.theme({ dataset: { v: 'porcelain' } })");
    assert.equal(app('ui.background'), 'celestial');
    assert.equal(context.localStorage.gbg, 'celestial');
    assert.equal(context.localStorage.gt, 'porcelain');
    assert.equal(pressed.porcelain, 'true');
    assert.equal(pressed.nebula, 'false');
    app("ACTIONS.background({ dataset: { v: 'orbital' } })");
    assert.equal(app('ui.theme'), 'porcelain');
    assert.equal(pressed.orbital, 'true');
    assert.equal(context.document.documentElement.dataset.theme, 'porcelain');
    assert.equal(context.document.documentElement.dataset.bg, 'orbital');
    assert.equal(pressed.celestial, 'false');
    const reloaded = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js'], { localStorage: context.localStorage });
    assert.equal(reloaded.app('ui.theme'), 'porcelain');
    assert.equal(reloaded.app('ui.background'), 'orbital');
});

test('render applies appearance and screen motifs without changing the saved background', () => {
    const { app, context } = homeApp();
    app("ui.background = 'celestial'");
    for (const [tab, motif] of [['home', 'mixed'], ['classic', 'stars'], ['platform', 'moons']]) {
        app(`ui.tab = '${tab}'; render()`);
        assert.equal(context.document.documentElement.dataset.motif, motif);
        assert.equal(context.document.documentElement.dataset.bg, 'celestial');
        assert.equal(context.document.documentElement.dataset.theme, 'nebula');
    }
});


test('the sidebar starts with a localized close button above the profile', () => {
    const { app, root } = homeApp();
    for (const [lang, label] of [['en', 'Close menu'], ['es', 'Cerrar menú']]) {
        app("ui.lang = '" + lang + "'; render()");
        const sidebar = root.innerHTML.match(/<aside id=shell-sidebar[^>]*>([\s\S]*?)<\/aside>/)[1];
        const close = sidebar.match(/<button[^>]*data-act=drawerclose[^>]*>/);
        assert.ok(close, 'the sidebar has a drawer close button');
        assert.ok(close.index < sidebar.indexOf('class=shell-identity'));
        assert.ok(close[0].includes('aria-label="' + label + '"'));
        assert.ok(close[0].includes('title="' + label + '"'));
    }
});

test('drawer traps focus and restores it to the opener on close button, Escape and backdrop', () => {
    const { app, context } = homeApp();
    const nodes = {}, attributes = {};
    const focusable = () => ({ focus() { context.document.activeElement = this; }, getClientRects: () => [1], closest: () => null });
    const closeButton = { ...focusable(), dataset: { act: 'drawerclose' }, closest: selector => selector == '#shell-sidebar' ? nodes[selector] : null };
    const last = focusable();
    nodes['#shell-sidebar'] = { inert: false, setAttribute(key, value) { attributes[key] = value; }, removeAttribute(key) { delete attributes[key]; }, querySelectorAll: () => [closeButton, last] };
    nodes['#shell-menu'] = { ...focusable(), setAttribute(key, value) { attributes[key] = value; } };
    nodes['.shell-content'] = { inert: false };
    nodes['.drawer-backdrop'] = { hidden: true };
    context.document.querySelector = selector => nodes[selector] || null;
    context.document.querySelectorAll = () => [];
    context.window.matchMedia = () => ({ matches: true });
    app('setDrawer(true)');
    assert.equal(app('ui.drawer'), true);
    assert.equal(attributes['aria-expanded'], 'true');
    assert.equal(nodes['.shell-content'].inert, true);
    assert.equal(nodes['.drawer-backdrop'].hidden, false);
    assert.equal(context.document.activeElement, closeButton);
    context.document.activeElement = last;
    let prevented = false;
    context.keyEvent = { key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } };
    app('drawerKeydown(keyEvent)');
    assert.equal(prevented, true);
    assert.equal(context.document.activeElement, closeButton);
    context.keyEvent = { key: 'Escape', preventDefault() {} };
    app('drawerKeydown(keyEvent)');
    assert.equal(nodes['.shell-content'].inert, false);
    assert.equal(context.document.activeElement, nodes['#shell-menu']);
    assert.equal(attributes['aria-expanded'], 'false');
    app('ACTIONS.drawer(); ACTIONS.drawerclose()');
    assert.equal(app('ui.drawer'), false);
    assert.equal(context.document.activeElement, nodes['#shell-menu']);
    app('setDrawer(true)');
    context.closeButton = closeButton;
    app('runAction(closeButton)');
    assert.equal(app('ui.drawer'), false);
    assert.equal(nodes['.drawer-backdrop'].hidden, true);
    assert.equal(context.document.activeElement, nodes['#shell-menu']);
    app('setDrawer(true)');
    context.window.matchMedia = () => ({ matches: false });
    app('syncDrawer()');
    assert.equal(app('ui.drawer'), false);
    assert.equal(nodes['#shell-sidebar'].inert, false);
    assert.equal(nodes['.shell-content'].inert, false);
});


test('focus selectors cover the drawer menu, profile pill and list chooser', () => {
    const { app, context, root } = homeApp();
    root.contains = () => true;
    context.CSS = { escape: value => value };
    for (const id of ['shell-menu', 'profile-pill']) {
        context.control = { id };
        assert.equal(app('controlSelector(control)'), '#' + id);
    }
    context.control = { tagName: 'BUTTON', hasAttribute: name => name == 'popovertarget', getAttribute: () => 'hlists' };
    assert.equal(app('controlSelector(control)'), 'button[popovertarget="hlists"]');
});

test('the document title and manifest match the shared brand', async () => {
    const { readFile } = await import('node:fs/promises');
    assert.match(await readFile('index.html', 'utf8'), /<title>Personal Progress List<\/title>/);
    const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
    assert.equal(manifest.name, 'Personal Progress List');
    assert.equal(manifest.short_name, 'PPL');
});


test('all local menu actions have a leading outline icon', () => {
    const { app } = homeApp();
    const html = app('profileSwitcher()');
    for (const action of ['pedit', 'localbackup', 'localimport', 'localdata', 'asignin']) {
        const icon = html.match(new RegExp('data-act=' + action + '[^>]*>(<svg.*?</svg>)<span>'))?.[1];
        assert.ok(icon, action + ' has a leading icon');
        assert.match(icon, /viewBox="0 0 24 24" fill=none stroke=currentColor stroke-width=1\.[57] stroke-linecap=round stroke-linejoin=round/);
        assert.doesNotMatch(icon, /(?:fill|stroke)="#/);
    }
});

test('profile actions keep deletion in Local data and tags in the sidebar; loading disables sign-in', () => {
    const { app } = homeApp();
    app("store.profs.other = { name: '<Other>', color: '#123456', data: emptyProfile() }");
    const html = app('profileSwitcher()');
    assert.doesNotMatch(html, /data-act=localdelete|data-act=tags/);
    assert.match(app('shellFooter()'), /data-act=tags/);
    app("account.status = 'loading'");
    assert.match(app('profileSwitcher()'), /data-act=asignin disabled aria-busy=true><svg.*?<\/svg><span>Loading account\u2026<\/span>/);
});


test('legacy screens isolate content below the themed page title', () => {
    const { app } = homeApp();
    for (const tab of ['classic', 'platform', 'wish', 'stats']) {
        app(`ui.tab = '${tab}'`);
        const html = app("sharedShell('<p>Content</p>')");
        const surface = ['classic', 'platform'].includes(tab) ? 'list-surface' : 'legacy-surface';
        assert.ok(html.includes(`class=${surface}>`));
        assert.match(html, /class=(?:legacy|list)-surface><p>Content<\/p><\/div><\/main>/);
        assert.ok(html.indexOf('class=page-title') < html.indexOf(`class=${surface}`));
    }
    app("ui.tab = 'home'");
    assert.doesNotMatch(app("sharedShell('Home')"), /class=legacy-surface/);
    assert.ok(app('profileSwitcher()').includes(app('ICONS.chevronDown')));
});
