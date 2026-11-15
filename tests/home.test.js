import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

function homeApp() {
    const root = { innerHTML: '', contains: () => false };
    const document = { body: {}, documentElement: { dataset: {} }, activeElement: null,
        querySelector: selector => selector == '#app' ? root : null, querySelectorAll: () => [], addEventListener() {} };
    const loaded = loadScripts(['data/demo-data.js', 'js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js',
        'js/components/faces.js', 'js/components/levels.js', 'js/components/timeline.js', 'js/components/rankings.js', 'js/components/compare.js',
        'js/components/stats.js', 'js/components/wishlists.js', 'js/components/home.js', 'js/components/shell.js',
        'js/components/account-ui.js', 'js/render.js', 'js/events.js'], {
        document, window: { addEventListener() {} }, localStorage: {},
        publicUsernameValid: true, alerts: () => [], account: { status: 'signed-out' }, cloudUser: null, viewing: { identity: null },
        localProfileSummary: () => 'Local profile', publicIdentityCard: () => '<div class=profile-card>Public player</div>',
        initSort() {}, initWishlistSort() {}, renderTagSuggestions() {}, finishAccountSignIn() {},
        lcol: () => 'List content', panel: () => 'Level panel', publicViewScreen: () => 'Loading public profile'
    });
    loaded.app("profile = JSON.parse(JSON.stringify(window.DEMO_PROFILE)); store = { cur: 'demo', profs: { demo: { data: profile } } }; ui.lang = 'en'; ui.tab = 'home'");
    Object.assign(loaded.context, { lcol: () => 'List content', panel: () => 'Level panel' });
    return { ...loaded, root };
}

test('Home cards use ranked leads, faces, localized counts and attempts without nested controls', () => {
    const { app } = homeApp();
    const html = app('home()');
    assert.equal((html.match(/class="hcard hcard-/g) || []).length, 2);
    for (const text of ['Bloodbath', 'Demo Platformer A', '9 Levels', '2 Levels', '95,596 attempts', '6,057 attempts'])
        assert.ok(html.includes(text), text);
    assert.equal((html.match(/class=hbadge>#1/g) || []).length, 2);
    assert.match(html, /class="face/);
    assert.equal((html.match(/--th:/g) || []).length, app("['classic', 'platform'].filter(kind => thumbUrl(findLevel(rankedIds(kind)[0]))).length"));
    assert.match(html, /data-act=add/);
    assert.match(html, /data-act=tab data-v=stats/);
    app("profile.levels = [{ id: 'one', kind: 'classic', name: '<Lead>', attN: 0 }]; profile.order.classic = ['one']; profile.order.platform = []");
    const card = app("homeListCard('classic')");
    assert.match(card, /&lt;Lead&gt;/);
    assert.doesNotMatch(card, /--th:|attempts|<button/);
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
        assert.doesNotMatch(html, /class=hbadge|class="face|--th:/);
    }
});

test('Platformer has its own icon and fallback art is absent when a thumbnail URL exists', () => {
    const { app } = homeApp();
    app("profile = emptyProfile(); profile.levels = [{ id: 'p', kind: 'platform', name: 'Platform', levelId: '123' }]; profile.order.platform = ['p']");
    assert.match(app("homeListCard('platform')"), /--th:/);
    assert.doesNotMatch(app("homeListCard('platform')"), /class=hghost/);
    app('delete profile.levels[0].levelId');
    const card = app("homeListCard('platform')"), icon = app('ICONS.platform');
    assert.equal(typeof icon, 'string');
    assert.match(card, /class=hghost/);
    assert.ok(card.includes(icon));
    assert.ok(!card.includes(app('ICONS.wish')));
    const menu = app('homeNavigation()').match(/<div id=hlists[\s\S]*?<\/div>/)[0];
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
    const listsLabel = () => app('homeNavigation()').match(/<button popovertarget=hlists>[\s\S]*?<span>([^<]+)<\/span><\/button>/)[1];
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
    const html = app('home()');
    assert.match(html, /Public player/);
    assert.doesNotMatch(html, /data-act=add|data-act=wnew/);
    const utilities = app('homeUtilities()');
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

test('render isolates Home chrome and preserves the list and statistics shells', () => {
    const { app, root } = homeApp();
    app('render()');
    assert.match(root.innerHTML, /^<div class=hl>/);
    assert.match(root.innerHTML, /data-act=tab data-v=home aria-current=page/);
    assert.match(root.innerHTML, /<nav class=hnav aria-label="Navigation"/);
    assert.equal((root.innerHTML.match(/id=syncst/g) || []).length, 1);
    assert.doesNotMatch(root.innerHTML, /class=toolbar|class=top|id=cloudst/);
    for (const tab of ['classic', 'stats']) {
        app(`ui.tab = '${tab}'; render()`);
        assert.match(root.innerHTML, /class="top/);
        assert.match(root.innerHTML, /class=toolbar/);
        assert.doesNotMatch(root.innerHTML, /class=hl>/);
    }
});

test('wishlist index renders every original card in status order using the sub-screen shell', () => {
    const { app, root } = homeApp();
    app(wishlistFixture);
    app("ui.tab = 'wish'; ui.wl = null; render()");
    assert.deepEqual([...root.innerHTML.matchAll(/data-act=wopen data-id="([^"]+)"/g)].map(match => match[1]), ['prog', 'prog2', 'todo', 'done']);
    assert.match(root.innerHTML, /class="obj trig"/);
    assert.match(root.innerHTML, /<h1>Wishlists<\/h1>/);
    assert.match(root.innerHTML, /aria-label="Back"/);
    assert.match(root.innerHTML, /class=toolbar/);
    assert.match(root.innerHTML, /data-act=wnew/);
    app("viewing = { username: 'player', identity: { display_name: 'Public player' } }; render()");
    assert.match(root.innerHTML, /<h1>@player<\/h1>/);
    assert.match(root.innerHTML, /data-act=myprogress/);
    assert.doesNotMatch(root.innerHTML, /data-act=wnew/);
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
