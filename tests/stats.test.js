import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

function statsApp() {
    const document = { body: {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] };
    const files = ['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/components/faces.js',
        'js/components/timeline.js', 'js/components/rankings.js', 'js/components/compare.js', 'js/components/stats.js', 'js/events.js'];
    const loaded = loadScripts(files, { localStorage: {}, document, window: { addEventListener() {} } });
    loaded.app('profile = emptyProfile(); ui.lang = "en"');
    return loaded.app;
}

const plainStats = value => JSON.parse(JSON.stringify(value));
const statsFixture = `profile.levels = [
    { id: 'b', name: 'Beta', kind: 'classic', attN: 10, tN: 36000, enj: -10, date: '2025-01-01', levelId: '123' },
    { id: 'a', name: 'Alpha', kind: 'classic', attC: 10, tP: 77400, enj: 5, date: '2025-01-02' },
    { id: 'z', name: 'Zero', kind: 'classic', attN: 0, tN: 0, enj: 0, date: '2025-01-03' },
    { id: 'm', name: 'Missing', kind: 'classic', attN: null, enj: null, date: '2025-01-04' },
    { id: 'n', name: 'Absent', kind: 'classic' },
    { id: 'u', name: 'Undated', kind: 'classic', attN: 20, enj: 8 },
    { id: 'p', name: 'Platform', kind: 'platform', attN: 30, tN: 18000, date: '2025-01-01' }
]`;

test('rankings sort both directions with alphabetical ties, preserving zero and excluding missing metrics', () => {
    const app = statsApp();
    app(statsFixture);
    assert.deepEqual(plainStats(app('rankingData().ranked.map(level => level.id)')), ['u', 'a', 'b', 'z']);
    app('ui.rankingDirection = "asc"');
    assert.deepEqual(plainStats(app('rankingData().ranked.map(level => level.id)')), ['z', 'a', 'b', 'u']);
    app('ui.rankingMetric = "time"');
    assert.deepEqual(plainStats(app('rankingData().ranked.map(level => level.id)')), ['z', 'b', 'a']);
    assert.equal(app('LEVEL_METRICS.time.read(findLevel("m"))'), null);
    assert.equal(app('LEVEL_METRICS.att.read(findLevel("m"))'), null);
    app('ui.rankingMetric = "enj"');
    assert.deepEqual(plainStats(app('rankingData().ranked.map(level => level.id)')), ['b', 'z', 'a', 'u']);
    app('ui.rankingDirection = "desc"');
    assert.deepEqual(plainStats(app('rankingData().ranked.map(level => level.id)')), ['u', 'a', 'z', 'b']);
    app('ui.rankingMode = "platform"');
    assert.deepEqual(plainStats(app('rankingData().ranked')), []);
    app('ui.rankingMetric = "att"');
    assert.deepEqual(plainStats(app('rankingData().ranked.map(level => level.id)')), ['p']);
});

test('top ten limits results; View all keeps ordering and appends alphabetized missing levels with no position', () => {
    const app = statsApp();
    app(`profile.levels = Array.from({ length: 12 }, (_, index) => ({ id: 'l' + index, name: 'Level ' + index, kind: 'classic', attN: index }));
        profile.levels.push({ id: 'm', name: 'Missing', kind: 'classic' }, { id: 'a', name: 'Absent', kind: 'classic' })`);
    assert.equal(app('rankingData().ranked.length'), 10);
    assert.equal(app('rankingData().missing.length'), 0);
    app('ui.rankingAll = true');
    assert.equal(app('rankingData().ranked.length'), 12);
    assert.deepEqual(plainStats(app('rankingData().missing.map(level => level.id)')), ['a', 'm']);
    const markup = app('rankingsHtml()');
    assert.ok(markup.indexOf('Level 0') < markup.indexOf('Absent'));
    assert.match(markup, /<h3 class=grp>Attempts not recorded<\/h3>/);
    assert.match(app('statCard(profile.levels.at(-1), null, [])'), /class=stat-position>—<\/span>/);
    app('ui.rankingDirection = "asc"; ui.rankingMetric = "time"; setRankingAll()');
    assert.deepEqual(plainStats(app('[ui.rankingAll, ui.rankingDirection, ui.rankingMetric]')), [false, 'asc', 'time']);
});

test('rankings distinguish an empty mode from no recorded metric and escape card data', () => {
    const app = statsApp();
    assert.match(app('rankingsHtml()'), /No levels in this mode/);
    app(`profile.levels = [{ id: 'x"', name: '<img onerror=bad>', kind: 'classic', levelId: '123' }]`);
    assert.match(app('rankingsHtml()'), /No levels have this metric/);
    app('ui.rankingAll = true');
    assert.match(app('rankingsHtml()'), />&lt;img onerror=bad&gt;<\/span>/);
    assert.doesNotMatch(app('rankingsHtml()'), /<img onerror=bad>/);
    assert.doesNotMatch(app('statCard(profile.levels[0], null, [])'), /<button|data-act=compare-pick/);
    app('ui.comparison.open = true');
    assert.match(app('statCard(profile.levels[0], null, comparisonLevels())'), /<button[^>]*data-id="x&quot;"[^>]*aria-pressed=false/);
});

test('card picks fill slot one then two, replace only two, and remove a selected card without changing its partner', () => {
    const app = statsApp();
    app(statsFixture);
    app('ui.comparison.open = true; pickComparisonLevel("a")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['a', null]);
    app('pickComparisonLevel("b")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['a', 'b']);
    app('pickComparisonLevel("z")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['a', 'z']);
    app('pickComparisonLevel("z")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['a', null]);
    app('pickComparisonLevel("b"); pickComparisonLevel("a")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), [null, 'b']);
    app('pickComparisonLevel("z")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['z', 'b']);
    app('pickComparisonLevel("p")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['z', 'b']);
    app('setRankingMode("platform")');
    assert.deepEqual(plainStats(app('[ui.rankingMode, ui.comparison.open, ui.comparison.slots]')), ['platform', true, [null, null]]);
});

test('comparison search requires the exact option in the selected mode; stale ids count as empty', () => {
    const app = statsApp();
    app(statsFixture);
    app('ui.comparison.open = true; ui.comparison.slots = ["gone", "b"]');
    assert.deepEqual(plainStats(app('comparisonLevels().map(level => level?.id || null)')), [null, 'b']);
    app('pickComparisonLevel("a")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['a', 'b']);
    app('setComparisonSearch({ dataset: { compareSlot: "0" }, value: "Zero" })');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['z', 'b']);
    app('setComparisonSearch({ dataset: { compareSlot: "1" }, value: "Beta · ID 123" })');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['z', 'b']);
    app('setComparisonSearch({ dataset: { compareSlot: "0" }, value: "Platform" })');
    app('setComparisonSearch({ dataset: { compareSlot: "0" }, value: "Beta" })');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['z', 'b']);
    assert.match(app('comparisonHtml()'), /value="Beta · ID 123"/);
    assert.doesNotMatch(app('comparisonHtml()'), /value="Platform"/);
    app('clearComparisonSlot(0)');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), [null, 'b']);
});

test('comparison search moves an already selected level between slots without duplicating it or clearing an unrelated partner', () => {
    const app = statsApp();
    app(statsFixture);
    app('ui.comparison.open = true; ui.comparison.slots = ["a", "b"]');
    app('setComparisonSearch({ dataset: { compareSlot: "1" }, value: "Alpha" })');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), [null, 'a']);
    app('setComparisonSearch({ dataset: { compareSlot: "0" }, value: "Alpha" })');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['a', null]);
    app('setComparisonSearch({ dataset: { compareSlot: "1" }, value: "Beta · ID 123" })');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['a', 'b']);
    app('setComparisonSearch({ dataset: { compareSlot: "0" }, value: "Alpha" })');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['a', 'b']);
});

test('filled comparison slots keep search inputs empty while their selection row identifies the level', () => {
    const app = statsApp();
    app(statsFixture);
    const markup = app('comparisonSlotHtml(findLevel("b"), 0)');
    const inputMarkup = markup.match(/<input\b[^>]*>/)[0];
    assert.doesNotMatch(inputMarkup, /\bvalue="[^"]+"/);
    assert.match(inputMarkup, /placeholder="Name or ID"/);
    assert.match(markup, /class=nm[^>]*>Beta<\/span>/);
    assert.match(markup, /class=by>ID 123<\/span>/);
});

test('changing-label ranking buttons omit pressed state while Compare and segments expose it', () => {
    const app = statsApp();
    for (const allLevels of [false, true]) {
        app(`ui.rankingAll = ${allLevels}; ui.rankingDirection = '${allLevels ? 'asc' : 'desc'}'; ui.comparison.open = ${allLevels}`);
        const markup = app('rankingControls(7)');
        for (const action of ['ranking-order', 'ranking-all'])
            assert.doesNotMatch(markup.match(new RegExp(`<button[^>]*data-act=${action}[^>]*>`))[0], /aria-pressed/);
        assert.match(markup, new RegExp(`data-act=compare-toggle aria-pressed=${allLevels}`));
        assert.match(markup, /data-act=ranking-mode data-v="classic" aria-pressed=true/);
        assert.match(markup, /data-act=ranking-metric data-v="att" aria-pressed=true/);
        assert.ok(markup.includes(allLevels ? '>Lowest first</button>' : '>Highest first</button>'));
        assert.ok(markup.includes(allLevels ? '>Top 10</button>' : '>View all (7)</button>'));
    }
});

test('comparison calculates neutral differences, larger side and relative or fixed range bar shares', () => {
    const app = statsApp();
    app(statsFixture);
    const row = (metric, left, right) => plainStats(app(`comparisonMetric(LEVEL_METRICS.${metric}, findLevel('${left}'), findLevel('${right}'))`));
    assert.deepEqual(row('att', 'a', 'b'), { values: [10, 10], shares: [100, 100], difference: '', arrow: '=' });
    assert.deepEqual(row('time', 'a', 'b'), { values: [77400, 36000], shares: [100, 36000 / 774], difference: '11h 30m 0s', arrow: '←' });
    assert.deepEqual(row('att', 'z', 'u'), { values: [0, 20], shares: [0, 100], difference: '20', arrow: '→' });
    assert.deepEqual(row('att', 'z', 'z'), { values: [0, 0], shares: [0, 0], difference: '', arrow: '=' });
    assert.deepEqual(row('enj', 'b', 'a'), { values: [-10, 5], shares: [0, 75], difference: '15', arrow: '→' });
    assert.deepEqual(row('enj', 'z', 'u'), { values: [0, 8], shares: [50, 90], difference: '8', arrow: '→' });
    assert.deepEqual(row('att', 'm', 'b'), { values: [null, 10], shares: [null, 100], difference: null, arrow: null });
    assert.deepEqual(row('enj', 'm', 'a'), { values: [null, 5], shares: [null, 75], difference: null, arrow: null });
    app('ui.comparison.open = true; ui.comparison.slots = ["m", "b"]');
    assert.match(app('comparisonHtml()'), /class=compare-value>-<\/span>/);
    assert.match(app('comparisonHtml()'), /Difficulty/);
    assert.doesNotMatch(app('comparisonMetricHtml(LEVEL_METRICS.att, findLevel("m"), findLevel("b"))'), /class=compare-gap|compare-track compare-1"><i/);
    assert.match(app('comparisonMetricHtml(LEVEL_METRICS.enj, findLevel("b"), findLevel("a"))'), /class=compare-gap>→ 15/);
    assert.match(app('comparisonMetricHtml(LEVEL_METRICS.att, findLevel("a"), findLevel("b"))'), /class=compare-gap>=<\/small>/);
    assert.match(app('comparisonMetricHtml(LEVEL_METRICS.enj, findLevel("b"), findLevel("a"))'), /class=compare-value>\+5<\/span>/);
    assert.match(app('comparisonMetricHtml(LEVEL_METRICS.enj, findLevel("b"), findLevel("a"))'), /compare-track compare-2"><i style="width:75%"/);
});

test('timeline selects dated levels with the active metric and keeps recorded zero', () => {
    const app = statsApp();
    app(statsFixture);
    assert.deepEqual(plainStats(app('timelineData().levels.map(level => level.id)')), ['b', 'a', 'z', 'p']);
    app('ui.timelineMetric = "time"');
    assert.deepEqual(plainStats(app('timelineData().levels.map(level => level.id)')), ['b', 'a', 'z', 'p']);
    app('profile.levels[0].tN = null; profile.levels[3].tN = 1');
    assert.deepEqual(plainStats(app('timelineData().levels.map(level => level.id)')), ['a', 'z', 'm', 'p']);
    const markup = app('timelineHtml()');
    assert.match(markup, /data-id="z"/);
    assert.doesNotMatch(markup, /data-id="b"|data-id="u"|data-id="n"/);
    app('ui.timelineMetric = "att"; profile.levels[0].attN = 21500');
    assert.deepEqual(plainStats(app('timelineData().grid')), [10000, 20000, 21500]);
});

test('playtime timeline draws ten-hour grid lines and a solid maximum with short hour labels at high zoom', () => {
    const app = statsApp();
    app(statsFixture);
    app('ui.timelineMetric = "time"; ui.z = 60');
    assert.deepEqual(plainStats(app('timelineData().grid')), [36000, 72000, 77400]);
    const markup = app('timelineHtml()');
    assert.match(markup, />10h<\/text>/);
    assert.match(markup, />20h<\/text>/);
    assert.equal((markup.match(/>21\.5h<\/text>/g) || []).length, 2);
    assert.equal((markup.match(/stroke-dasharray="4"/g) || []).length, 2);
    assert.equal((markup.match(/stroke-dasharray=""/g) || []).length, 1);
    app('profile.levels = [{ id: "only", name: "Only", kind: "classic", date: "2025-01-01", tN: 72001 }]');
    assert.deepEqual(plainStats(app('timelineData().grid')), [36000, 72001]);
    app('profile.levels = []');
    assert.doesNotMatch(app('timelineHtml()'), /NaN|Infinity/);
});

test('timeline tooltip uses the current metric, formatted date and escaped user content', () => {
    const app = statsApp();
    app(statsFixture);
    app('profile.levels[0].name = "<b>Beta</b>"');
    assert.equal(app('timelineTooltip(findLevel("b"))'), '<img src="https://levelthumbs.prevter.me/thumbnail/123" alt=""><b>&lt;b&gt;Beta&lt;/b&gt;</b><br>10 attempts · 01/01/2025');
    app('ui.timelineMetric = "time"');
    assert.match(app('timelineTooltip(findLevel("b"))'), /10h 0m 0s · 01\/01\/2025/);
    assert.doesNotMatch(app('timelineTooltip(findLevel("a"))'), /<img/);
});

test('rankings changes preserve metric, direction and comparison partner; all comparison states render', () => {
    const app = statsApp();
    app(statsFixture);
    app('toggleComparison()');
    assert.equal(app('ui.comparison.open'), true);
    assert.match(app('comparisonHtml()'), /Pick two levels/);
    app('pickComparisonLevel("a")');
    assert.match(app('comparisonHtml()'), /Pick a second level/);
    assert.match(app('statCard(findLevel("a"), 1, comparisonLevels())'), /aria-pressed=true/);
    assert.match(app('statCard(findLevel("a"), 1, comparisonLevels())'), /compare-badge compare-1">1/);
    app('setRankingMetric("time"); setRankingOrder(); setRankingAll()');
    assert.deepEqual(plainStats(app('[ui.rankingMetric, ui.rankingDirection, ui.rankingAll, ui.comparison.slots]')), ['time', 'asc', true, ['a', null]]);
    app('setRankingMode("classic")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['a', null]);
    app('toggleComparison()');
    assert.equal(app('ui.comparison.open'), false);
    app('closeComparison()');
    assert.equal(app('ui.comparison.open'), false);
});

test('existing totals and distributions remain before rankings and count all modes', () => {
    const app = statsApp();
    app(statsFixture);
    const markup = app('stats()');
    assert.match(markup, /<small>Levels<\/small><b>7<\/b>/);
    assert.match(markup, /<small>Total attempts<\/small><b>70<\/b>/);
    assert.match(markup, /<small>Hours<\/small><b>37<\/b>/);
    assert.match(markup, /<small>Attempts per level<\/small><b>14<\/b>/);
    assert.match(markup, /Most attempts<\/small><b>Platform · 30/);
    assert.match(markup, /<span>2025<\/span>.*<b>5<\/b>/);
    assert.ok(markup.indexOf('class=kpis') < markup.indexOf('id=timeline-well'));
    assert.ok(markup.indexOf('By difficulty') < markup.indexOf('id=rankings-well'));
    assert.ok(markup.indexOf('By year') < markup.indexOf('id=rankings-well'));
});

// Run through the browser tool's Playwright page, so the project needs no browser dependency.
export async function checkStatisticsBrowser(page) {
    const origin = 'http://127.0.0.1:8806';
    const failures = [];
    const environmentMessages = [];
    const results = [];
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    page.on('pageerror', error => failures.push(error.message));
    page.on('console', message => {
        // The local antivirus appends child-src to the CSP without a separating semicolon.
        if (/form-action.*child-src|form-action.*keyword 'none'/.test(message.text())) {
            environmentMessages.push(message.text());
            return;
        }
        if (message.type() == 'error' && !/Failed to load resource|net::ERR_|fetch|NetworkError/i.test(message.text()))
            failures.push(message.text());
    });
    await page.addInitScript(() => {
        const { navigator, localStorage } = globalThis;
        navigator.serviceWorker.register = () => Promise.reject(new Error('Disabled for verification'));
        localStorage.removeItem('gdp');
        localStorage.removeItem('gl');
    });
    await page.unroute('**/*');
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    for (const width of [1280, 390]) {
        for (const language of ['es', 'en']) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(origin);
            await page.locator('[data-act=pause]').first().click();
            await page.locator('[data-act=lang][data-v=' + language + ']').click();
            await page.locator('#md [data-act=close]').click();
            await page.locator('[data-act=tab][data-v=stats]').click();
            check(await page.locator('.kpi').count() == 5, 'Five original KPIs');
            check(await page.locator('.side .well').count() == 2, 'Both original distributions');
            check(await page.locator('.stat-card').count() == 9, 'Nine Classic demo levels');
            check(await page.locator('.stat-card button').count() == 0, 'Closed cards are plain elements');
            const wellOrder = await page.evaluate(() => {
                const { document } = globalThis;
                return [...document.querySelector('main').children].map(element => element.className);
            });
            check(wellOrder[0] == 'kpis' && wellOrder[1] == 'stats2' && wellOrder[2] == 'well', 'Statistics section order');
            const kpis = await page.locator('.kpis').innerHTML();
            const distributions = await page.locator('.side').innerHTML();
            await page.locator('#timeline-well').evaluate(element => element.dataset.sentinel = 'timeline');
            await page.locator('[data-act=ranking-metric][data-v=time]').click();
            check(await page.locator('#timeline-well').getAttribute('data-sentinel') == 'timeline', 'Ranking leaves timeline node intact');
            check(await page.locator('.stat-card').count() == 8, 'Playtime omits missing records');
            await page.locator('[data-act=ranking-all]').click();
            check(await page.locator('.stat-card').count() == 9, 'View all appends missing playtime');
            check(await page.locator('.ranking-list .grp').count() == 1, 'Missing playtime group');
            check(await page.locator('.stat-position').last().textContent() == '—', 'Missing record has no rank');
            await page.locator('[data-act=ranking-order]').click();
            check(await page.locator('[data-act=ranking-order]').textContent() == (language == 'en' ? 'Lowest first' : 'De menor a mayor'), 'Ascending order label');
            check(await page.locator('[data-act=ranking-order]').getAttribute('aria-pressed') == null && await page.locator('[data-act=ranking-all]').getAttribute('aria-pressed') == null, 'Changing-label buttons omit pressed state');
            await page.locator('[data-act=ranking-metric][data-v=enj]').click();
            check(await page.locator('[data-act=ranking-metric][data-v=enj]').getAttribute('aria-pressed') == 'true', 'Enjoyment state');
            await page.locator('[data-act=ranking-mode][data-v=platform]').click();
            check(await page.locator('.stat-card').count() == 2, 'Platform filter');
            await page.locator('[data-act=ranking-mode][data-v=classic]').click();
            await page.locator('[data-act=ranking-metric][data-v=att]').click();
            await page.locator('[data-act=ranking-order]').click();
            await page.locator('[data-act=compare-toggle]').click();
            const layout = await page.evaluate(() => {
                const { document } = globalThis;
                const list = document.querySelector('.ranking-list').getBoundingClientRect();
                const panel = document.querySelector('.compare-panel').getBoundingClientRect();
                return { listX: list.x, listY: list.y, listWidth: list.width, panelX: panel.x, panelBottom: panel.bottom, panelWidth: panel.width };
            });
            check(width >= 900 ? layout.panelX > layout.listX && layout.listWidth / (layout.listWidth + layout.panelWidth) >= .55 : layout.panelBottom <= layout.listY, 'Responsive comparison placement');
            check(await page.locator('.compare-panel [role=status]').count() == 1, 'Empty comparison hint');
            const cards = page.locator('[data-act=compare-pick]');
            const firstName = await cards.nth(0).locator('.nm').textContent();
            await cards.nth(0).click();
            check(await cards.nth(0).getAttribute('aria-pressed') == 'true', 'First card selected');
            check(await cards.nth(0).locator('.compare-badge').textContent() == '1', 'First slot number');
            await cards.nth(1).click();
            check(await page.locator('.compare-row').count() == 3, 'Three comparison metrics');
            await cards.nth(2).click();
            check(await cards.nth(1).getAttribute('aria-pressed') == 'false', 'Only second slot replaced');
            check(await cards.nth(0).getAttribute('aria-pressed') == 'true', 'First slot preserved');
            await cards.nth(2).click();
            check(await page.locator('.compare-row').count() == 0, 'Clicking a selected card removes it');
            const secondOption = await page.locator('#compare-options option').nth(1).getAttribute('value');
            await page.locator('#compare-search-1').fill('no exact match');
            check(await page.locator('.compare-row').count() == 0, 'Free search text is ignored');
            await page.locator('#compare-search-1').fill(secondOption);
            check(await page.locator('.compare-row').count() == 3, 'Exact datalist value selects a level');
            check(await page.locator('#compare-search-1').evaluate(element => element === element.ownerDocument.activeElement), 'Search focus restored');
            check(await page.locator('.compare-selection .nm').first().textContent() == firstName, 'Searching preserves first slot');
            await page.locator('[data-act=compare-clear][data-v="0"]').click();
            check(await page.locator('#compare-search-0').inputValue() == '', 'Clear empties one slot');
            check(await page.locator('#compare-search-1').inputValue() == '', 'Filled slot keeps search empty');
            check(await page.locator('.compare-selection .nm').textContent() == secondOption.split(' · ID ')[0], 'Clear preserves other slot');
            await page.locator('[data-act=ranking-mode][data-v=platform]').click();
            check(await page.locator('.compare-panel').count() == 1, 'Mode change keeps comparison open');
            check(await page.locator('#compare-search-0').inputValue() == '' && await page.locator('#compare-search-1').inputValue() == '', 'Mode change empties both slots');
            check(await page.locator('#compare-options option').count() == 2, 'Datalist contains only selected mode');
            await page.locator('[data-act=compare-close]').click();
            check(await page.locator('.compare-panel').count() == 0, 'Close panel');
            check(await page.locator('[data-act=compare-toggle]').evaluate(element => element === element.ownerDocument.activeElement), 'Close returns focus to toggle');
            await page.locator('[data-act=ranking-mode][data-v=classic]').click();
            await page.locator('[data-act=ranking-order]').focus();
            await page.locator('[data-act=ranking-order]').scrollIntoViewIfNeeded();
            const beforeScroll = await page.evaluate(() => globalThis.scrollY);
            await page.keyboard.press('Enter');
            check(await page.evaluate(() => globalThis.scrollY) == beforeScroll, 'Ranking preserves page scroll');
            check(await page.locator('[data-act=ranking-order]').evaluate(element => element === element.ownerDocument.activeElement), 'Ranking restores keyboard focus');
            await page.locator('#rankings-well').evaluate(element => element.dataset.sentinel = 'rankings');
            for (let index = 0; index < 4; index++)
                await page.locator('[data-act=zi]').click();
            const zoom = await page.locator('.zoom .by').textContent();
            const attemptPoint = page.locator('.pt').first();
            await attemptPoint.hover();
            check((await page.locator('#tip').textContent()).includes(language == 'en' ? 'attempts' : 'intentos'), 'Attempts tooltip');
            await page.locator('[data-act=timeline-metric][data-v=time]').focus();
            const timelineScroll = await page.locator('#tlw').evaluate(element => {
                element.scrollLeft = Math.min(40, element.scrollWidth - element.clientWidth);
                return element.scrollLeft;
            });
            const timelinePageY = await page.evaluate(() => globalThis.scrollY);
            await page.keyboard.press('Enter');
            check(await page.locator('#tlw').evaluate(element => element.scrollLeft) == timelineScroll, 'Metric toggle preserves horizontal scroll');
            check(await page.evaluate(() => globalThis.scrollY) == timelinePageY, 'Timeline preserves page scroll');
            check(await page.locator('.zoom .by').textContent() == zoom, 'Metric toggle preserves zoom');
            check(await page.locator('[data-act=timeline-metric][data-v=time]').evaluate(element => element === element.ownerDocument.activeElement), 'Timeline keyboard focus');
            check(await page.locator('#rankings-well').getAttribute('data-sentinel') == 'rankings', 'Timeline leaves rankings node intact');
            check((await page.locator('#timeline-well').textContent()).includes('10h'), 'Playtime axis uses hours');
            await page.locator('#tlw').evaluate(element => element.scrollLeft = 0);
            await page.locator('.pt').first().hover();
            check(/\dh \d+m \d+s/.test(await page.locator('#tip').textContent()), 'Playtime tooltip');
            check(await page.locator('.kpis').innerHTML() == kpis && await page.locator('.side').innerHTML() == distributions, 'KPIs and distributions preserved');
            const overflow = await page.evaluate(() => {
                const { document, innerWidth } = globalThis;
                return document.documentElement.scrollWidth > innerWidth;
            });
            check(!overflow, 'No horizontal page overflow');
            check(failures.length == 0, failures.join('; '));
            results.push({ width, language, status: 'passed' });
        }
    }
    return { results, errors: failures, environmentMessages: [...new Set(environmentMessages)] };
}
