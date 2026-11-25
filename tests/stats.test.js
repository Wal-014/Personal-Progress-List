import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

function statsApp(nodes = new Map()) {
    const document = { body: {}, addEventListener() {}, querySelector: selector => nodes.get(selector) ?? null, querySelectorAll: () => [] };
    const files = ['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/components/faces.js', 'js/components/empty-list.js',
        'js/components/timeline.js', 'js/components/rankings.js', 'js/components/compare.js', 'js/components/stats.js', 'js/render.js', 'js/events.js'];
    const loaded = loadScripts(files, { localStorage: {}, document, window: { addEventListener() {}, scrollTo() {} } });
    loaded.app('profile = emptyProfile(); ui.lang = "en"');
    return loaded.app;
}

const plainStats = value => JSON.parse(JSON.stringify(value));
const statsFixture = `profile.levels = [
    { id: 'b', name: 'Beta', kind: 'classic', diff: 'Easy', attN: 10, tN: 36000, enj: 0, date: '2025-01-01', levelId: '123' },
    { id: 'a', name: 'Alpha', kind: 'classic', diff: 'Hard', attC: 10, tP: 77400, enj: 7.5, date: '2025-01-02' },
    { id: 'z', name: 'Zero', kind: 'classic', attN: 0, tN: 0, enj: 5, date: '2025-01-03' },
    { id: 'm', name: 'Missing', kind: 'classic', attN: null, enj: null, date: '2025-01-04' },
    { id: 'n', name: 'Absent', kind: 'classic' },
    { id: 'u', name: 'Undated', kind: 'classic', attN: 20, enj: 9 },
    { id: 'p', name: 'Platform', kind: 'platform', diff: 'Hard', attN: 30, tN: 18000, date: '2025-01-01' }
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
    assert.match(app('comparisonOptions("a", 0)'), />Beta · ID 123<\/button>/);
    assert.doesNotMatch(app('comparisonOptions("a", 0)'), />Platform<\/button>/);
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

test('comparison picker arrows wrap through the options and Escape returns to its search box', () => {
    const app = statsApp(), focused = [];
    const control = name => ({ name, focus() { focused.push(name); } });
    const input = control('input'), list = { hidden: true }, options = ['first', 'second', 'third'].map(control);
    const picker = { querySelector: selector => selector == 'input' ? input : list, querySelectorAll: () => options };
    [input, ...options].forEach(el => el.closest = selector => selector == '.compare-picker' ? picker : null);
    const press = (key, target) => {
        const event = { key, target, prevented: false, preventDefault() { this.prevented = true; } };
        return [app('comparePickerKeydown')(event), event.prevented];
    };
    assert.deepEqual(press('ArrowDown', input), [true, true]);
    assert.equal(list.hidden, false);
    press('ArrowDown', options[2]);
    press('ArrowUp', options[0]);
    press('ArrowUp', input);
    assert.deepEqual(focused, ['first', 'first', 'third', 'third']);
    assert.deepEqual(press('Escape', options[1]), [true, true]);
    assert.equal(focused.at(-1), 'input');
    assert.equal(list.hidden, true);
    assert.deepEqual(press('Enter', options[1]), [false, false]);
    assert.deepEqual(press('ArrowDown', { closest: () => null }), [false, false]);
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
    assert.deepEqual(row('enj', 'b', 'a'), { values: [0, 7.5], shares: [0, 75], difference: '7.5', arrow: '→' });
    assert.deepEqual(row('enj', 'z', 'u'), { values: [5, 9], shares: [50, 90], difference: '4', arrow: '→' });
    assert.deepEqual(row('att', 'm', 'b'), { values: [null, 10], shares: [null, 100], difference: null, arrow: null });
    assert.deepEqual(row('enj', 'm', 'a'), { values: [null, 7.5], shares: [null, 75], difference: null, arrow: null });
    app('ui.comparison.open = true; ui.comparison.slots = ["m", "b"]');
    assert.match(app('comparisonHtml()'), /class=compare-value>-<\/span>/);
    assert.match(app('comparisonHtml()'), /Difficulty/);
    assert.doesNotMatch(app('comparisonMetricHtml(LEVEL_METRICS.att, findLevel("m"), findLevel("b"))'), /class=compare-gap|compare-track compare-1"><i/);
    assert.match(app('comparisonMetricHtml(LEVEL_METRICS.enj, findLevel("b"), findLevel("a"))'), /class=compare-gap>→ 7\.5/);
    assert.match(app('comparisonMetricHtml(LEVEL_METRICS.att, findLevel("a"), findLevel("b"))'), /class=compare-gap>=<\/small>/);
    assert.match(app('comparisonMetricHtml(LEVEL_METRICS.enj, findLevel("b"), findLevel("a"))'), /class=compare-value>7\.5<\/span>/);
    assert.match(app('comparisonMetricHtml(LEVEL_METRICS.enj, findLevel("b"), findLevel("a"))'), /compare-track compare-2"><i data-pct="75"/);
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

test('playtime timeline labels ten-hour guides and shows short hour values at high zoom', () => {
    const app = statsApp();
    app(statsFixture);
    app('ui.timelineMetric = "time"; ui.z = 60');
    assert.deepEqual(plainStats(app('timelineData().grid')), [36000, 72000, 77400]);
    const markup = app('timelineHtml()');
    assert.match(markup, />10h<\/text>/);
    assert.match(markup, />20h<\/text>/);
    assert.equal((markup.match(/>21\.5h<\/text>/g) || []).length, 2);
    app('profile.levels = [{ id: "only", name: "Only", kind: "classic", date: "2025-01-01", tN: 72001 }]');
    assert.deepEqual(plainStats(app('timelineData().grid')), [36000, 72001]);
    app('profile.levels = []');
    assert.doesNotMatch(app('timelineHtml()'), /NaN|Infinity/);
});

for (const metric of ['att', 'time']) {
    test(`${metric} timeline keeps full-width guides and axis fixed while the plot zooms`, () => {
        const app = statsApp();
        app(statsFixture);
        app(`ui.timelineMetric = '${metric}'; findLevel('b').attN = 21500`);
        const layersAt = zoom => {
            app(`ui.z = ${zoom}`);
            const markup = app('timelineHtml()');
            const grid = markup.match(/<svg class=timeline-grid\b[^>]*>[\s\S]*?<\/svg>/)?.[0];
            const plot = markup.match(/<div id=tlw tabindex=-1>(<svg\b[^>]*>[\s\S]*?<\/svg>)<\/div>/)?.[1];
            assert.ok(grid && plot, 'The fixed grid and scrolling plot are separate SVGs');
            return { grid, plot };
        };
        const minimum = layersAt(6), maximum = layersAt(160);
        assert.equal(minimum.grid, maximum.grid);
        assert.match(minimum.grid, /<svg\b[^>]*aria-hidden=true[^>]*width="100%"[^>]*height=370/);
        assert.match(minimum.plot, /<svg\b[^>]*width="68"/);
        assert.match(maximum.plot, /<svg\b[^>]*width="530"/);
        const lines = minimum.grid.match(/<line\b[^>]*>/g);
        assert.equal(lines.length, 4);
        for (const line of lines)
            assert.match(line, /\bx1=0 x2="100%"/);
        for (const guide of lines.slice(0, 2))
            assert.match(guide, /stroke-dasharray="4"/);
        assert.match(lines[2], /y1=25 y2=25/);
        assert.doesNotMatch(lines[2], /stroke-dasharray/);
        assert.match(lines[3], /y1=290 y2=290[^>]*stroke-width=2/);
        for (const { plot } of [minimum, maximum]) {
            assert.doesNotMatch(plot, /<line\b/);
            assert.match(plot, /<polyline\b/);
            assert.match(plot, /<rect class=pt\b/);
        }
    });
}

test('timeline markers sit on the grid line of their value', () => {
    const app = statsApp();
    app('profile.levels = [{ id: "mid", name: "Mid", kind: "classic", date: "2025-01-01", attN: 10000 }, { id: "top", name: "Top", kind: "classic", date: "2025-01-02", attN: 25000 }]');
    const markup = app('timelineHtml()'), grid = plainStats(app('timelineData().grid'));
    const gridLineY = [...markup.matchAll(/y1=([\d.]+) y2=[\d.]+ stroke="var\(--ln\)"/g)].map(match => +match[1]);
    const markerCenterY = id => +markup.split(`<rect class=pt data-id="${id}"`)[1].match(/y=(-?[\d.]+)/)[1] + 6;
    assert.deepEqual(grid, [10000, 20000, 25000]);
    assert.equal(markerCenterY('mid'), gridLineY[grid.indexOf(10000)]);
    assert.equal(markerCenterY('top'), gridLineY[grid.indexOf(25000)]);
});

test('timeline tooltip uses the current metric, formatted date and escaped user content', () => {
    const app = statsApp();
    app(statsFixture);
    app('profile.levels[0].name = "<b>Beta</b>"');
    assert.equal(app('timelineTooltip(findLevel("b"))'), '<img src="https://levelthumbs.prevter.me/thumbnail/123/small" alt=""><b>&lt;b&gt;Beta&lt;/b&gt;</b><br>10 attempts · 01/01/2025');
    app('ui.timelineMetric = "time"');
    assert.match(app('timelineTooltip(findLevel("b"))'), /10h 0m 0s · 01\/01\/2025/);
    assert.doesNotMatch(app('timelineTooltip(findLevel("a"))'), /<img/);
});

for (const [metric, ids, rows] of [
    ['att', ['b', 'p', 'a', 'z'], [
        ['01/01/2025', '&lt;b&gt;Beta&lt;/b&gt;', '10'], ['01/01/2025', 'Platform', '1,234'],
        ['02/01/2025', 'Alpha', '10'], ['03/01/2025', 'Zero', '0']
    ]],
    ['time', ['p', 'b', 'a', 'z'], [
        ['01/01/2025', 'Platform', '5h'], ['01/01/2025', '&lt;b&gt;Beta&lt;/b&gt;', '10h'],
        ['02/01/2025', 'Alpha', '21.5h'], ['03/01/2025', 'Zero', '0h']
    ]]
]) {
    test('timeline table matches the plotted ' + metric + ' points and their order', () => {
        const app = statsApp();
        app(statsFixture);
        app("ui.timelineMetric = '" + metric + "'; findLevel('p').attN = 1234; findLevel('b').name = '<b>Beta</b>'");
        const markup = app('timelineHtml()');
        assert.deepEqual([...markup.matchAll(/<rect class=pt data-id="([^"]+)"/g)].map(match => match[1]), ids);
        const details = markup.match(/<details([^>]*)>([\s\S]*?)<\/details>/);
        assert.ok(details);
        assert.doesNotMatch(details[1], /\bopen\b/);
        assert.match(details[2], /<summary[^>]*>Show data<\/summary>/);
        assert.match(details[2], /<table><caption>[^<]+<\/caption>/);
        assert.deepEqual([...details[2].matchAll(/<th scope=col>([^<]+)<\/th>/g)].map(match => match[1]), ['Date', 'Level', 'Value']);
        assert.deepEqual([...details[2].matchAll(/<tr><td>([^<]+)<\/td><td>([^<]+)<\/td><td>([^<]+)<\/td><\/tr>/g)].map(match => match.slice(1)), rows);
    });
}

test('timeline exposes a localized chart summary and distinct zoom names', () => {
    const app = statsApp();
    app(statsFixture);
    let markup = app('timelineHtml()');
    const label = markup.match(/role=img aria-label="([^"]+)"/)[1];
    assert.match(label, /Attempts per level.*\b4\b.*January 1, 2025.*January 3, 2025.*\b30\b/);
    assert.equal((markup.match(/<svg aria-hidden=true/g) || []).length, 2);
    assert.match(markup, /data-act=zo aria-label="Zoom out timeline"/);
    assert.match(markup, /data-act=zi aria-label="Zoom in timeline"/);
    app('ui.lang = "es"; ui.timelineMetric = "time"; profile.levels = [findLevel("z")]');
    markup = app('timelineHtml()');
    assert.match(markup, /aria-label="Tiempo de juego por nivel[^"]*\b1\b[^"]*3 de enero de 2025[^"]*3 de enero de 2025[^"]*0h/);
    assert.match(markup, /<summary[^>]*>Ver datos<\/summary>/);
});

test('Statistics offers an add action only on an editable empty profile', () => {
    const app = statsApp();
    let markup = app('stats()');
    assert.match(markup, /class=empty/);
    assert.ok(markup.includes(app('ICONS.metricLevels')));
    assert.match(markup, /<h3>No levels yet<\/h3><p>[^<]+<\/p><button[^>]*data-act=add>.* Add level<\/button>/);
    assert.doesNotMatch(markup, /class=kpis|id=timeline-well/);
    app('viewing = {}');
    markup = app('stats()');
    assert.equal(markup, '<p class=by>No levels yet</p>');
});

test('Statistics uses a singular level KPI label for one level', () => {
    const app = statsApp();
    for (const [lang, singular, plural] of [['en', 'Level', 'Levels'], ['es', 'Nivel', 'Niveles']]) {
        app(`ui.lang = '${lang}'; profile.levels = []`);
        assert.doesNotMatch(app('stats()'), /class=kpis/);
        app(statsFixture);
        for (const [count, label] of [[2, plural], [1, singular]]) {
            app(`profile.levels = profile.levels.slice(0, ${count})`);
            assert.match(app('stats()'), new RegExp(`>${label}</small><b>${count}</b>`));
        }
    }
});

test('timeline keeps metric controls when levels lack a dated value', () => {
    const app = statsApp();
    app("profile.levels = [{ attN: 10 }, { date: '2025-01-01', tN: 20 }]");
    const markup = app('timelineHtml()');
    assert.equal((markup.match(/data-act=timeline-metric/g) || []).length, 2);
    assert.match(markup, /No dated levels have this metric/);
    assert.doesNotMatch(markup, /<svg|<details/);
});

test('timeline keeps its data disclosure open after metric changes, including an empty metric', () => {
    const nodes = new Map();
    const well = {
        dataset: {},
        set innerHTML(markup) {
            const details = markup.match(/<details[^>]*>/);
            nodes.set('#timeline-data', details ? { open: /\bopen\b/.test(details[0]) } : null);
        }
    };
    nodes.set('#timeline-well', well);
    const app = statsApp(nodes);
    app(statsFixture);
    well.innerHTML = app('timelineHtml()');
    assert.equal(nodes.get('#timeline-data').open, false);
    nodes.get('#timeline-data').open = true;
    app('ACTIONS["timeline-metric"]({ dataset: { v: "time" } })');
    assert.equal(nodes.get('#timeline-data').open, true);
    app('profile.levels = [{ date: "2025-01-01", tN: 10 }]; setTimelineMetric("att")');
    assert.equal(nodes.get('#timeline-data'), null);
    app('setTimelineMetric("time")');
    assert.equal(nodes.get('#timeline-data').open, true);
    nodes.get('#timeline-data').open = false;
    app('setTimelineMetric("time")');
    assert.equal(nodes.get('#timeline-data').open, false);
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
    assert.deepEqual(plainStats(app('statsSummary()')), { levelCount: 7, attemptTotal: 70, playSeconds: 131400, playHours: 37, average: 14, averageSeconds: 32850 });
    const markup = app('stats()').replace(/<svg\b[^>]*aria-hidden=true[^>]*>[\s\S]*?<\/svg>/g, '');
    assert.match(markup, /<small>Levels<\/small><b>7<\/b>/);
    assert.match(markup, /<small>Total attempts<\/small><b>70<\/b><small class=kpi-sub>Average attempts per level<\/small><b class=kpi-sub-value>14<\/b>/);
    assert.match(markup, /<small>Total hours<\/small><b>36.5<\/b><small class=kpi-sub>Average time per level<\/small><b class=kpi-sub-value>9 h 7 min<\/b>/);
    assert.doesNotMatch(markup, /Most attempts/);
    const counts = type => [...markup.match(new RegExp('<div class="well ' + type + '">([\\s\\S]+?)</div></div>'))[1]
        .matchAll(/<div class=hb><span>([^<]+)<\/span>.*?<b>(\d+)<\/b>/g)]
        .map(match => [match[1], Number(match[2])]);
    assert.deepEqual(counts('d'), [['Easy', 1], ['Hard', 2], ['Unknown', 4]]);
    assert.deepEqual(counts('y'), [['2025', 5]]);
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
            check(await page.locator('.kpi').count() == 3, 'Levels, attempts and time KPIs');
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
                const slots = [...document.querySelectorAll('.compare-slot')].map(slot => slot.getBoundingClientRect());
                return panel.bottom <= list.top && slots[0].right <= slots[1].left;
            });
            check(layout, 'Comparison slots sit side by side above the rankings');
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
            const secondOption = await page.locator('.compare-slot.compare-2 .compare-options button').nth(1).textContent();
            await page.locator('#compare-search-1').fill('no exact match');
            check(await page.locator('.compare-row').count() == 0, 'Free search text is ignored');
            await page.locator('#compare-search-1').fill(secondOption);
            check(await page.locator('.compare-row').count() == 3, 'Exact search value selects a level');
            check(await page.locator('#compare-search-1').evaluate(element => element === element.ownerDocument.activeElement), 'Search focus restored');
            check(await page.locator('.compare-selection .nm').first().textContent() == firstName, 'Searching preserves first slot');
            await page.locator('[data-act=compare-clear][data-v="0"]').click();
            check(await page.locator('#compare-search-0').inputValue() == '', 'Clear empties one slot');
            check(await page.locator('#compare-search-1').inputValue() == '', 'Filled slot keeps search empty');
            check(await page.locator('.compare-selection .nm').textContent() == secondOption.split(' · ID ')[0], 'Clear preserves other slot');
            await page.locator('[data-act=ranking-mode][data-v=platform]').click();
            check(await page.locator('.compare-panel').count() == 1, 'Mode change keeps comparison open');
            check(await page.locator('#compare-search-0').inputValue() == '' && await page.locator('#compare-search-1').inputValue() == '', 'Mode change empties both slots');
            check(await page.locator('.compare-slot.compare-1 .compare-options button').count() == 2, 'Dropdown contains only selected mode');
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

export async function checkStatisticsAndWishlistsBrowser(page, screenshotDirectory) {
    const origin = 'http://localhost:8827';
    const sizes = [[1366, 768], [390, 844], [360, 740], [1280, 900]];
    const results = [], pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript(() => {
        globalThis.localStorage.clear();
        globalThis.navigator.serviceWorker.register = async () => ({});
    });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const tab = async name => {
        const menu = page.locator('#shell-menu');
        if (await menu.isVisible())
            await menu.click();
        await page.locator('#shell-sidebar [data-act=tab][data-v="' + name + '"]').click();
    };
    const noOverflow = async () => assert.ok(await page.evaluate(() => {
        const { document, innerWidth } = globalThis;
        return document.documentElement.scrollWidth <= innerWidth
            && [...document.querySelectorAll('.legacy-surface, .kpi, .stat-card, .compare-slot, .wi, #timeline-data')]
                .every(element => element.scrollWidth <= element.clientWidth);
    }), 'Views and cards fit the viewport');
    const active = selector => page.locator(selector).evaluate(element => element.ownerDocument.activeElement === element);
    const overflowFreeText = selector => page.locator(selector).first().evaluate(element =>
        element.scrollWidth <= element.clientWidth || globalThis.getComputedStyle(element).textOverflow === 'ellipsis');
    const tabTo = async selector => {
        await page.keyboard.press('Tab');
        assert.ok(await active(selector), 'Tab focuses ' + selector);
    };
    const details = page.locator('#timeline-data');
    const summary = page.locator('#timeline-data summary');
    for (const [width, height] of sizes) {
        for (const theme of ['nebula', 'porcelain']) {
            const capture = async name => {
                if (screenshotDirectory && width !== 1280)
                    await page.screenshot({ path: `${screenshotDirectory}/${theme}-${width}-${name}.png`, animations: 'disabled' });
            };
            await page.setViewportSize({ width, height });
            await page.goto(origin, { waitUntil: 'domcontentloaded' });
            await page.evaluate(`ui.lang = 'en'; ui.theme = '${theme}'; render()`);
            await tab('stats');
            assert.equal(await page.locator('html').getAttribute('data-theme'), theme);
            assert.match(await page.getByRole('img', { name: /Attempts per level.*Maximum/ }).getAttribute('aria-label'), /From .* to /);
            assert.equal(await details.getAttribute('open'), null);
            await noOverflow();
            await capture('statistics-closed');
            await page.locator('[data-act=timeline-metric][data-v=att]').focus();
            for (const selector of ['[data-act=timeline-metric][data-v=time]', '[data-act=zo]', '[data-act=zi]', '#timeline-data summary'])
                await tabTo(selector);
            await page.keyboard.press('Enter');
            assert.equal(await details.getAttribute('open'), '');
            assert.equal(await details.locator('tbody tr').count(), await page.locator('#tlw .pt').count());
            await noOverflow();
            await capture('statistics-open');
            for (const selector of [
                '[data-act=ranking-mode][data-v=classic]', '[data-act=ranking-mode][data-v=platform]',
                '[data-act=ranking-metric][data-v=att]', '[data-act=ranking-metric][data-v=time]', '[data-act=ranking-metric][data-v=enj]',
                '[data-act=ranking-order]', '[data-act=ranking-all]', '[data-act=compare-toggle]'
            ])
                await tabTo(selector);
            await page.locator('[data-act=timeline-metric][data-v=time]').focus();
            await page.keyboard.press('Enter');
            assert.ok(await active('[data-act=timeline-metric][data-v=time]'));
            assert.equal(await details.getAttribute('open'), '');
            await page.locator('[data-act=zi]').focus();
            const zoom = await page.locator('.zoom .by').textContent();
            await page.keyboard.press('Enter');
            assert.ok(await active('[data-act=zi]'));
            assert.notEqual(await page.locator('.zoom .by').textContent(), zoom);
            assert.equal(await details.getAttribute('open'), '');
            await summary.focus();
            await page.keyboard.press('Space');
            assert.equal(await details.getAttribute('open'), null);

            await page.evaluate(`
                rankingData().ranked[0].name = 'LongUnbrokenLevelName'.repeat(10);
                profile.wishlists[0].items[0].name = 'LongUnbrokenLevelName'.repeat(10);
                setTimelineMetric('att');
                render();
            `);
            await page.locator('[data-act=compare-toggle]').click();
            await page.locator('[data-act=compare-pick]').first().click();
            await summary.click();
            assert.ok(await overflowFreeText('.stat-card .nm'));
            assert.ok(await overflowFreeText('.compare-selection .nm'));
            await noOverflow();

            await tab('wish');
            await noOverflow();
            await capture('wishlists-index');
            await page.locator('[data-act=wopen]').first().click();
            assert.ok(await overflowFreeText('.wi .nm'));
            if (width <= 900) {
                const fits = await page.locator('.wi').first().evaluate(card =>
                    card.querySelector('.info').getBoundingClientRect().bottom <= card.querySelector('.wseg').getBoundingClientRect().top);
                assert.ok(fits, 'Wishlist name fits above its status controls');
            }
            await noOverflow();
            await capture('wishlist-cards');

            await page.evaluate('profile = emptyProfile(); ui.tab = "stats"; ui.wl = null; render()');
            assert.equal(await page.locator('.kpis').count(), 0);
            await noOverflow();
            await capture('statistics-empty');
            await page.locator('.empty [data-act=add]').press('Enter');
            assert.ok(await page.locator('#md dialog #fm').isVisible());
            assert.ok(await active('#gdq'));
            await page.locator('#fm [data-act=close]').click();
            await tab('wish');
            assert.equal(await page.locator('.empty [data-act=wnew]').count(), 1);
            await noOverflow();
            await capture('wishlists-empty');
            await page.locator('.empty [data-act=wnew]').press('Enter');
            assert.ok(await page.getByRole('dialog', { name: 'Wishlist name' }).isVisible());
            await page.keyboard.press('Escape');
            results.push({ width, height, theme });
        }
    }
    assert.deepEqual(pageErrors, []);
    return results;
}

test('comparison suggestions stay empty until something is typed and report no matches', () => {
    const app = statsApp();
    app(statsFixture);
    app('ui.comparison.open = true');
    for (const query of ['', '   '])
        assert.equal(app('comparisonOptions')(query, 0), '');
    assert.match(app('comparisonHtml()'), /<div class=compare-options><\/div>/);
    assert.deepEqual([...app('comparisonOptions')('ALP', 1).matchAll(/data-id="([^"]+)" data-v=1/g)].map(match => match[1]), ['a']);
    assert.match(app('comparisonOptions')('123', 0), />Beta · ID 123</);
    assert.match(app('comparisonOptions')('nothing', 0), /<p class=compare-empty role=status>No levels match the search<\/p>/);
});

test('a focused comparison search makes its slot the destination of card clicks until the panel closes or the mode changes', () => {
    const marks = [new Set(), new Set()];
    const slots = marks.map(set => ({ classList: { toggle: (name, on) => on ? set.add(name) : set.delete(name) } }));
    const app = statsApp();
    app(statsFixture);
    app('ui.comparison.open = true; ui.comparison.slots = ["a", "b"]');
    app('document').querySelectorAll = selector => selector == '.compare-slot' ? slots : [];
    app('setComparisonTarget(0)');
    assert.deepEqual(marks.map(set => [...set]), [['is-target'], []]);
    app('pickComparisonLevel("z")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['z', 'b']);
    assert.match(app('comparisonHtml()'), /class="compare-slot compare-1 is-target"/);
    assert.match(app('comparisonHtml()'), /class="compare-slot compare-2">/);
    app('pickComparisonLevel("u")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['u', 'b']);
    app('setComparisonTarget(1)');
    assert.deepEqual(marks.map(set => [...set]), [[], ['is-target']]);
    app('pickComparisonLevel("a")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), ['u', 'a']);
    app('pickComparisonLevel("u")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), [null, 'a']);
    app('pickComparisonLevel("b")');
    assert.deepEqual(plainStats(app('ui.comparison.slots')), [null, 'b']);
    app('setRankingMode("platform")');
    assert.equal(app('ui.comparison.target'), null);
    app('setRankingMode("classic"); setComparisonTarget(1); closeComparison()');
    assert.equal(app('ui.comparison.target'), null);
    app('setComparisonTarget(0); toggleComparison(); toggleComparison()');
    assert.equal(app('ui.comparison.target'), null);
});

test('the comparison panel explains both ways to choose levels in both languages', () => {
    const app = statsApp();
    app(statsFixture);
    app('ui.comparison.open = true');
    assert.match(app('comparisonHtml()'), /<p class="by compare-help">Compare the attempts, play time and enjoyment of two levels of this mode\. Type a name or ID, or click a level in the rankings/);
    app("ui.lang = 'es'");
    assert.match(app('comparisonHtml()'), /<p class="by compare-help">Compara intentos, tiempo de juego y disfrutabilidad de dos niveles de este modo\. Escribe un nombre o ID, o pulsa un nivel/);
    assert.match(app('comparisonHtml()'), /<small class=compare-target>Destino<\/small>/);
});

test('the difficulty chart tells unrated levels from unknown difficulties without changing saved data', () => {
    const app = statsApp();
    app(`profile.levels = [
        { id: 'r', name: 'Rated', kind: 'classic', diff: 'Insane', rating: 'rated' },
        { id: 'u', name: 'Unrated', kind: 'classic', diff: null, rating: 'unrated' },
        { id: 'k', name: 'Unknown', kind: 'classic', rating: 'featured' },
        { id: 'o', name: 'Old value', kind: 'platform', diff: 'Legacy' }
    ]`);
    for (const [lang, unrated, unknown] of [['es', 'Sin rate', 'Desconocida'], ['en', 'Unrated', 'Unknown']]) {
        app(`ui.lang = '${lang}'`);
        const chart = app('stats()').match(/<div class="well d">([\s\S]+?)<\/div><\/div>/)[1];
        assert.deepEqual([...chart.matchAll(/<div class=hb><span>([^<]+)<\/span>.*?<b>(\d+)<\/b>/g)].map(match => [match[1], Number(match[2])]),
            [['Insane', 1], [unrated, 1], [unknown, 2]]);
    }
    assert.equal(app('findLevel("o").diff'), 'Legacy');
    assert.equal(app('findLevel("u").diff'), null);
});

test('summary play time reads in hours and minutes, or seconds under a minute', () => {
    const app = statsApp();
    app("ui.lang = 'en'");
    for (const [seconds, text] of [[0, '0 s'], [59, '59 s'], [60, '1 min'], [3599, '59 min'], [3600, '1 h 0 min'], [36000000 + 120, '10,000 h 2 min']])
        assert.equal(app('formatPlaytime')(seconds), text);
});
