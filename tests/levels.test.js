import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const { context, app } = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/components/faces.js', 'js/components/search.js', 'js/components/deaths-input.js', 'js/components/duration-input.js', 'js/components/levels.js'], { localStorage: {}, clearTimeout });

for (const publicView of [false, true]) {
    const mode = publicView ? 'public' : 'editable';
    const drawDetail = (fields = {}, language = 'en') => {
        app(`profile = emptyProfile(); viewing = ${publicView ? '{ username: "player" }' : 'null'}; ui.lang = '${language}'`);
        assert.equal(app('canEdit()'), !publicView);
        const level = { id: 'details', name: 'Level', kind: 'classic', ...fields };
        const before = JSON.stringify(level);
        const html = app('detail')(level);
        assert.equal(JSON.stringify(level), before);
        assert.equal(html.includes('data-act=edit'), !publicView);
        return html;
    };

    test(`detail shows a translated empty message without optional sections in ${mode} mode`, () => {
        for (const [language, message] of [['es', 'Sin datos adicionales'], ['en', 'No additional details']]) {
            const html = drawDetail({}, language);
            assert.ok(html.includes(`<p class=by>${message}</p>`));
            assert.doesNotMatch(html, /<details|<summary|class=(?:dgrid|grid|hist)\b/);
            assert.match(html, /data-act=lvclose/);
        }
    });

    test(`detail hides null, undefined and blank optional values in ${mode} mode`, () => {
        for (const value of [null, undefined, '', ' \t\n ']) {
            const fields = Object.fromEntries(['attN', 'attC', 'tN', 'tP', 'tPC', 'date', 'link', 'enj', 'lik', 'notes'].map(key => [key, value]));
            const html = drawDetail({ ...fields, tags: [], deaths: {} });
            assert.match(html, /No additional details/);
            assert.doesNotMatch(html, /<details|<summary|class=(?:dgrid|grid|hist)\b/);
        }
    });

    test(`detail retains zero enjoyment and fractional appeal in ${mode} mode`, () => {
        const html = drawDetail({ enj: 0, lik: 3.5 });
        assert.equal((html.match(/<details class=level-section open>/g) || []).length, 1);
        assert.match(html, /<summary>Rating<\/summary>/);
        assert.match(html, /<small>Enjoyment<\/small><div class=mh><b[^>]*>0<\/b>/);
        assert.match(html, /<small>Level appeal<\/small><div class=mh><b[^>]*>3\.5<\/b>/);
        assert.doesNotMatch(html, /No additional details/);
    });

    test(`detail draws only recorded attempts and their total in ${mode} mode`, () => {
        for (const attempts of [0, 12]) {
            const html = drawDetail({ attN: attempts, deaths: {} });
            assert.equal((html.match(/<details class=level-section open>/g) || []).length, 1);
            assert.equal((html.match(/class="st /g) || []).length, 2);
            assert.ok(html.includes(`<small>Total attempts</small><b>${attempts}</b>`));
            assert.ok(html.includes(`<small>Normal attempts</small><b>${attempts}</b>`));
            assert.doesNotMatch(html, /Copy attempts|Best %|Deaths per percent|class=hist/);
        }
    });

    test(`detail hides whitespace notes while preserving tags in ${mode} mode`, () => {
        const html = drawDetail({ notes: ' \n\t ', tags: ['Recorded'] });
        assert.equal((html.match(/<details class=level-section open>/g) || []).length, 1);
        assert.match(html, /<summary>Tags & notes<\/summary>/);
        assert.match(html, /data-tag="Recorded"/);
        assert.doesNotMatch(html, /white-space:pre-wrap|No additional details/);
    });

    test(`detail renders each optional cell independently in ${mode} mode`, () => {
        const cases = [
            [{ attC: 4 }, ['Total attempts', 'Copy attempts'], ['Normal attempts', 'Best %']],
            [{ tN: 0 }, ['Total time', 'Normal time', '0h 0m 0s'], ['Practice time', 'Copy or StartPos playtime']],
            [{ tP: 60 }, ['Total time', 'Practice time', '0h 1m 0s'], ['Normal time', 'Copy or StartPos playtime']],
            [{ tPC: 5 }, ['Total time', 'Copy or StartPos playtime', '0h 0m 5s'], ['Normal time', 'Practice time']],
            [{ date: '2026-01-02' }, ['Completion date', '02/01/2026'], ['class=yt', 'Video link']],
            [{ link: 'https://example.com/video' }, ['href="https://example.com/video"'], ['Completion date', 'class=grid']],
            [{ enj: 0 }, ['Enjoyment'], ['Level appeal']],
            [{ lik: 3.5 }, ['Level appeal'], ['Enjoyment']],
            [{ notes: '<Recorded>' }, ['&lt;Recorded&gt;'], ['<Recorded>']],
            [{ deaths: { 63: 2 } }, ['Best %', '63% ×2', 'class=hist'], ['Total attempts', 'Normal attempts', 'Copy attempts']]
        ];
        for (const [fields, present, absent] of cases) {
            const html = drawDetail(fields);
            for (const text of present) assert.ok(html.includes(text), text);
            for (const text of absent) assert.equal(html.includes(text), false, text);
            assert.doesNotMatch(html, /No additional details|<b>-<\/b>/);
        }
    });

    test(`detail keeps every section for a fully recorded level in ${mode} mode`, () => {
        const html = drawDetail({ attN: 12, attC: 3, tN: 60, tP: 120, tPC: 180, date: '2026-01-02', link: 'https://youtu.be/Ab_12-cDef3', enj: 8, lik: 3.5, tags: ['Recorded'], notes: 'A recorded note', deaths: { 63: 2, 90: 1 } });
        assert.equal((html.match(/<details class=level-section open>/g) || []).length, 5);
        for (const label of [app("t('s3')"), 'Completion', 'Rating', 'Tags & notes', 'Deaths per percent'])
            assert.ok(html.includes(`<summary>${label}</summary>`), label);
        for (const text of ['<small>Total attempts</small><b>15</b>', '<small>Total time</small><b>0h 6m 0s</b>', 'Copy or StartPos playtime', '90% ×1', 'A recorded note', 'class=yt', 'class=hist'])
            assert.ok(html.includes(text), text);
        assert.doesNotMatch(html, /No additional details|<b>-<\/b>/);
    });
}

test('levelForm translates copy or StartPos playtime', () => {
    app('profile = emptyProfile(); viewing = null');
    for (const [language, label] of [['es', 'Tiempo en copia o StartPos'], ['en', 'Copy or StartPos playtime']]) {
        app(`ui.lang = '${language}'`);
        assert.ok(app('levelForm()').includes(label));
    }
});

test('the level form reopens saved deaths as chips instead of a text field', () => {
    const fixture = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/components/faces.js', 'js/components/deaths-input.js', 'js/components/duration-input.js', 'js/components/levels.js', 'js/components/search.js'], { localStorage: {}, clearTimeout() {} });
    fixture.app('profile = emptyProfile()');
    const html = fixture.app('levelForm')({ id: 'saved', name: 'Level', kind: 'classic', tags: [], deaths: { 37: 82, 0: 0, 24: 135 } });
    assert.deepEqual([...html.matchAll(/name=dth value="([^"]+)"/g)].map(match => match[1]), ['0:0', '24:135', '37:82']);
    assert.doesNotMatch(html, /name=deaths/);
    assert.match(html, /class=death-prompt role=status/);
    assert.match(html, /data-act=dthcancel hidden/);
});

for (const url of [
    'https://www.youtube.com/watch?v=Ab_12-cDef3&t=42',
    'https://youtu.be/Ab_12-cDef3?si=example',
    'https://www.youtube.com/shorts/Ab_12-cDef3',
    'https://www.youtube.com/embed/Ab_12-cDef3'
])
    test(`youtubeId extracts the video ID from ${url}`, () => {
        assert.equal(app('youtubeId')(url), 'Ab_12-cDef3');
    });

test('youtubeId returns undefined for a non-YouTube link or an incomplete ID', () => {
    for (const url of ['https://medal.tv/clips/example?v=Ab_12-cDef3', 'https://www.twitch.tv/videos/123', 'https://example.com/video', 'https://youtu.be/short', '', undefined])
        assert.equal(app('youtubeId')(url), undefined);
});

test('matchesListFilters accepts levels without tags when the selection is empty', () => {
    assert.equal(app('matchesListFilters')({ name: 'Bloodbath' }, '', []), true);
    assert.equal(app('matchesListFilters')({ name: 'Bloodbath', tags: [] }, 'blood', []), true);
    assert.equal(app('matchesListFilters')({ name: 'Bloodbath' }, 'other', []), false);
});

test('matchesListFilters matches any selected tag and includes a level with both only once', () => {
    const levels = [
        { name: 'First', tags: ['Rebeated'] },
        { name: 'Second', tags: ['Fluked'] },
        { name: 'Both', tags: ['Rebeated', 'Fluked'] },
        { name: 'Other', tags: ['Pre-Extremes'] },
        { name: 'Untagged' }
    ];
    assert.deepEqual(levels.filter(level => app('matchesListFilters')(level, '', ['Rebeated', 'Fluked'])).map(level => level.name), ['First', 'Second', 'Both']);
});

test('matchesListFilters requires the name query and tag selection to match together', () => {
    const matches = app('matchesListFilters'), level = { name: 'BloodBATH', tags: ['Rebeated'] };
    assert.equal(matches(level, 'bath', ['Fluked', 'Rebeated']), true);
    assert.equal(matches(level, 'other', ['Rebeated']), false);
    assert.equal(matches(level, 'bath', ['Fluked']), false);
    assert.equal(matches({ name: 'Bloodbath' }, 'bath', ['Rebeated']), false);
});

test('listTagOptions returns unique sorted names used by the supplied list', () => {
    const levels = [{ tags: ['Zulu', 'Alpha', 'Zulu'] }, {}, { tags: ['Beta', 'Alpha'] }];
    assert.deepEqual(Array.from(app('listTagOptions')(levels, [])), ['Alpha', 'Beta', 'Zulu']);
    assert.deepEqual(levels, [{ tags: ['Zulu', 'Alpha', 'Zulu'] }, {}, { tags: ['Beta', 'Alpha'] }]);
    assert.deepEqual(Array.from(app('listTagOptions')([], [])), []);
});

test('listTagOptions keeps selected but unused names and does not repeat used selections', () => {
    const selected = ['Missing', 'Alpha'];
    assert.deepEqual(Array.from(app('listTagOptions')([{ tags: ['Zulu', 'Alpha'] }], selected)), ['Alpha', 'Missing', 'Zulu']);
    assert.deepEqual(Array.from(app('listTagOptions')([], selected)), ['Alpha', 'Missing']);
    assert.deepEqual(selected, ['Missing', 'Alpha']);
});

test('listTagOptions sorts names with locale collation rather than character codes', () => {
    assert.deepEqual(Array.from(app('listTagOptions')([{ tags: ['zulu', 'Beta', 'alpha'] }], [])), ['alpha', 'Beta', 'zulu']);
});

test('detail renders keyboard-accessible tag filters with escaped translated labels', () => {
    app('profile = emptyProfile()');
    const level = { id: 'tag-test', levelId: '4125776', name: 'Tagged level', kind: 'classic', tags: ['safe', 'a"><img src=x>'] };
    for (const [lang, label] of [['es', 'Filtrar por tag: '], ['en', 'Filter by tag: ']]) {
        context.lang = lang;
        app('ui.lang = lang');
        const html = app('detail')(level);
        assert.ok(html.includes(`<div class=hero style="background-image:url('https://levelthumbs.prevter.me/thumbnail/4125776')"></div>`));
        const chips = html.match(/<span class=chip\b[^>]*>/g);
        assert.equal(chips.length, 2);
        for (const chip of chips) {
            assert.match(chip, /\brole=button(?:\s|>)/);
            assert.match(chip, /\btabindex=0(?:\s|>)/);
        }
        assert.ok(chips[0].includes(`aria-label="${label}safe"`));
        assert.ok(chips[1].includes(`aria-label="${label}a&quot;&gt;&lt;img src=x&gt;"`));
        assert.ok(chips[1].includes('data-tag="a&quot;&gt;&lt;img src=x&gt;"'));
        assert.equal(html.includes('<img src=x>'), false);
    }
});

test('cards omit tags in both level lists', () => {
    app('profile = emptyProfile()');
    for (const kind of ['classic', 'platform']) {
        const html = app('card')({ id: 'tag-test', levelId: '4125776', name: 'Tagged level', kind, tags: ['first', 'second'] });
        assert.ok(html.includes("--th:url('https://levelthumbs.prevter.me/thumbnail/4125776/small')"));
        assert.match(html, /role=button tabindex=0/);
        assert.doesNotMatch(html, /data-tag=|class=chip/);
    }
});

test('card renders optional decorative grips and thumbnail layers', () => {
    const level = { id: 'grip-test', name: 'Level', kind: 'classic' };
    for (const [lang, hint] of [['es', 'Arrastra para reordenar'], ['en', 'Drag to reorder']]) {
        context.lang = lang;
        app('ui.lang = lang');
        const html = app('card')(level, 0, 1, true);
        assert.doesNotMatch(html, /<i class=th\b/);
        assert.match(app('card')({ ...level, levelId: '42' }, 0, 1, true), /<i class=th aria-hidden=true><\/i>/);
        assert.match(html, new RegExp(`^<div[^>]*><span class=grip aria-hidden=true title="${hint}">`));
        const grip = html.match(/<span class=grip[^>]*>(.*?)<\/span>/)[0];
        assert.doesNotMatch(grip, /\b(?:tabindex|role)=/);
        assert.ok(grip.includes(app('ICONS.grip')));
        assert.match(grip, /<svg class=i\b[^>]*aria-hidden=true/);
        assert.match(grip, /fill="?currentColor\b/);
        assert.equal((grip.match(/<circle\b/g) || []).length, 6);
        for (const reorderable of [false, undefined])
            assert.doesNotMatch(app('card')(level, 0, 1, reorderable), /class=grip/);
    }
});

for (const kind of ['classic', 'platform'])
    test(`list gives grips only to unfiltered ranked ${kind} cards`, () => {
        app('profile = emptyProfile(); ui.q = ""; ui.tagFilter = []');
        context.kind = kind;
        app(`ui.tab = kind;
            profile.levels = [
                { id: 'ranked', name: 'Level ranked', kind, tags: ['A'] },
                { id: 'second', name: 'Level second', kind, tags: ['A'] },
                { id: 'unplaced', name: 'Level unplaced', kind, tags: ['A'] },
                { id: 'first', name: 'Level first', kind, tags: [PRE_TAG, 'A'] }
            ];
            profile.order[kind] = ['ranked', 'second', 'first'];`);
        const html = app('list()');
        const [ranked, ...groups] = html.split('</div><h2 class=grp>');
        const outside = groups.join('');
        assert.equal((ranked.match(/class=grip/g) || []).length, 2);
        assert.match(outside, /data-id="unplaced"/);
        assert.match(outside, /data-id="first"/);
        assert.doesNotMatch(outside, /class=grip/);
        for (const filters of ['ui.q = "level"; ui.tagFilter = []', 'ui.q = ""; ui.tagFilter = ["A"]']) {
            app(filters);
            const filtered = app('list()');
            assert.match(filtered, /data-id="ranked"/);
            assert.doesNotMatch(filtered, /class=grip/);
        }
    });

for (const [type, pointerType] of [['pointerdown', 'mouse'], ['mousedown', undefined], ['pointerdown', 'touch'], ['pointerdown', 'pen'], ['touchstart', undefined]])
    for (const location of ['body', 'grip', 'svg child'])
        test(`startsAwayFromGrip handles ${pointerType || type} on the ${location}`, () => {
            const grip = {}, target = {
                closest(selector) {
                    assert.equal(selector, '.grip');
                    return location == 'body' ? null : grip;
                }
            };
            const isMouse = pointerType == 'mouse' || type == 'mousedown';
            assert.equal(app('startsAwayFromGrip')({ type, pointerType, target }), !isMouse && location == 'body');
        });

for (const [type, canceled] of [
    ['dragend', true], ['touchcancel', true], ['pointercancel', true],
    ['drop', false], ['pointerup', false], ['touchend', false], ['mouseup', false]
])
    test(`dragWasCanceled returns ${canceled} for ${type}`, () => {
        assert.equal(app('dragWasCanceled')({ type }), canceled);
    });

for (const kind of ['classic', 'platform'])
    for (const type of ['drop', 'pointerup', 'touchend', 'mouseup', 'dragend', 'touchcancel', 'pointercancel'])
        test(`reorderList handles ${type} in the ${kind} list`, () => {
            const calls = [], listNode = { children: ['third', 'first', 'second'].map(id => ({ dataset: { id } })) };
            const fixture = loadScripts(['js/components/levels.js'], {
                ui: { tab: kind },
                profile: { order: { classic: ['first', 'second', 'third'], platform: ['first', 'second', 'third'] } },
                qs(selector) {
                    assert.equal(selector, '#lst');
                    return listNode;
                },
                save: () => calls.push('save'),
                render: () => calls.push('render')
            });
            const order = fixture.app('profile.order'), previous = order[kind], canceled = ['dragend', 'touchcancel', 'pointercancel'].includes(type);
            fixture.app('reorderList')({ originalEvent: { type } });
            assert.deepEqual(Array.from(order[kind]), canceled ? ['first', 'second', 'third'] : ['third', 'first', 'second']);
            if (canceled)
                assert.equal(order[kind], previous);
            assert.deepEqual(order[kind == 'classic' ? 'platform' : 'classic'], ['first', 'second', 'third']);
            assert.deepEqual(calls, canceled ? ['render'] : ['save', 'render']);
        });

test('initSort registers the grip filter and saves only updates on an unfiltered list', () => {
    const created = [], listNode = { parentElement: { scrollHeight: 500, clientHeight: 200 } };
    const fixture = loadScripts(['js/components/levels.js'], {
        ui: { q: '', tagFilter: [] },
        qs(selector) {
            assert.equal(selector, '#lst');
            return listNode;
        },
        Sortable: function (element, options) { created.push({ element, options }); }
    });
    fixture.app('initSort()');
    assert.equal(created.length, 1);
    const { element, options } = created[0];
    assert.equal(element, listNode);
    assert.equal(options.animation, 180);
    assert.equal(options.scroll, listNode.parentElement);
    assert.equal(options.bubbleScroll, false);
    assert.equal(options.forceAutoScrollFallback, true);
    assert.ok(options.scrollSensitivity >= 60);
    assert.equal(options.filter, fixture.app('startsAwayFromGrip'));
    assert.equal(options.preventOnFilter, false);
    assert.equal(options.fallbackTolerance, 5);
    assert.equal(options.onUpdate, fixture.app('reorderList'));
    assert.equal('onEnd' in options, false);
    for (const filters of ['ui.q = "level"; ui.tagFilter = []', 'ui.q = ""; ui.tagFilter = ["A"]']) {
        fixture.app(filters);
        fixture.app('initSort()');
        assert.equal(created.length, 1);
    }
    fixture.app('ui.q = ""; ui.tagFilter = []');
    fixture.context.qs = () => null;
    fixture.app('initSort()');
    assert.equal(created.length, 1);
});

test('rating meters fill from the left, use localized decimals and omit plus signs', () => {
    app("ui.lang = 'es'");
    for (const value of [0, 2.5, 8, 10]) {
        const html = app('meter')(value);
        assert.ok(html.includes(`left:0%;width:${value * 10}%`));
        assert.doesNotMatch(html, /\+/);
        assert.equal(html.includes('class="meter g"'), value >= 8);
    }
    assert.match(app('meter(2.5)'), />2,5<\/b>/);
    assert.match(app('meter(7.3)'), />7,3<\/b>/);
    const field = app("formField('lik', 7.3, 'number', 'min=0 max=10 step=0.1 inputmode=decimal')");
    assert.match(field, /aria-label="\u22120,1"/);
    assert.match(field, /aria-label="\+0,1"/);
    assert.match(app("formField('enj', null, 'number', 'min=0 max=10 step=0.1 inputmode=decimal')"), /min=0 max=10 step=0.1 inputmode=decimal value=""/);
});

test('step buttons use decimal steps without floating noise and stop at bounds', () => {
    const input = { value: '0', min: '0', max: '10', step: '0.1', dispatchEvent(event) { assert.equal(event.type, 'input'); } };
    const env = loadScripts(['js/events.js'], { document: { body: {}, addEventListener() {} }, window: { addEventListener() {} }, Event: class { constructor(type) { this.type = type; } } });
    const button = { parentNode: { querySelector: () => input }, dataset: { d: '1' } };
    for (let i = 1; i <= 105; i++) {
        env.app('ACTIONS.step')(button);
        assert.equal(Number(input.value), Math.min(i, 100) / 10);
    }
    button.dataset.d = '-1';
    for (let i = 99; i >= -5; i--) {
        env.app('ACTIONS.step')(button);
        assert.equal(Number(input.value), Math.max(i, 0) / 10);
    }
    input.step = ''; button.dataset.d = '1';
    env.app('ACTIONS.step')(button);
    assert.equal(Number(input.value), 1);
});
test('list rows pair the creator with the name and keep only the completion date below', () => {
    app("profile = emptyProfile(); viewing = null; ui.lang = 'en'");
    const level = { id: 'row', kind: 'classic', name: 'Example', creator: 'Player', date: '2026-01-02', ar: { s: 'r', p: 25 } };
    const html = app('card')(level, 0, 1);
    assert.match(html, /class=level-title><span class=nm>Example<\/span><span class=level-creator>by Player<\/span><\/div>/i);
    assert.match(html, /<time class=level-date datetime="2026-01-02">02\/01\/2026<\/time>/);
    assert.doesNotMatch(html, /AREDL|#25/);
    assert.doesNotMatch(app('card')({ ...level, date: '', creator: '' }), /class=level-creator|class=level-date/);
});

test('details distinguish level identity from external ranks for both modes', () => {
    app("profile = emptyProfile(); viewing = null; ui.lang = 'en'");
    for (const kind of ['classic', 'platform']) {
        const html = app('detail')({ id: 'row', name: 'Level', creator: 'Player', levelId: '123', diff: 'Hard', kind, ar: { s: 'r', p: 12 }, gdl: 7 });
        assert.ok(html.includes(`<dt>${app("t('creator')")}</dt><dd>Player</dd>`));
        assert.match(html, /<dt>ID<\/dt><dd>123<\/dd>/);
        assert.match(html, /<dt>Difficulty<\/dt><dd>Hard/);
        assert.ok(html.includes('<dt>' + (kind === 'classic' ? 'AREDL' : 'AREPL') + '</dt><dd>#12</dd>'));
        assert.equal(html.includes('<dt>GDL</dt><dd>#7</dd>'), kind === 'classic');
    }
});
