import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const searchRow = (id, name) => ({ levelId: id, name, creator: 'Creator', diff: 'Hard', rating: 'rated', kind: 'classic', downloads: 10 });
// A relay answer; a full page means more pages exist
const relayPage = levels => ({ levels, more: levels.length == 10 });
const RELAY = loadScripts(['js/config.js']).app('LEVEL_RELAY_API');
const settleSearch = async () => {
    for (let i = 0; i < 30; i++)
        await Promise.resolve();
};

function searchForm() {
    let now = 0, timerId = 0, reports = 0;
    const timers = new Map(), asked = [];
    const input = { id: 'gdq', value: '', validity: '', dataset: {}, matches: () => false, setCustomValidity(message) { this.validity = message; }, reportValidity() { reports++; } };
    const classes = new Set();
    let html = '', cards = [], more = null;
    const button = dataset => ({ dataset, focus() { document.activeElement = this; } });
    const results = { hidden: true,
        get innerHTML() { return html; },
        set innerHTML(value) {
            if (cards.includes(document.activeElement) || more && document.activeElement == more)
                document.activeElement = document.body;
            html = value;
            cards = [...value.matchAll(/data-act=gdpick data-i=(\d+)/g)].map(m => button({ act: 'gdpick', i: m[1] }));
            more = value.includes('data-act=gdmore') ? button({ act: 'gdmore' }) : null;
        }
    }, message = { textContent: '', classList: {
        toggle(name, force) { if (force) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); }
    } }, clear = { hidden: true };
    const document = { body: {}, querySelector: selector => {
        if (selector == '.gdmore' || selector == '[data-act=gdmore]')
            return more;
        if (selector.includes('data-act=gdpick')) {
            const index = selector.match(/data-i=["']?(\d+)/);
            return index ? cards.find(c => c.dataset.i == index[1]) : cards[0];
        }
        return { '#gdq': input, '#gdr': results, '#gdm': message, '.gdclr': clear }[selector];
    }, querySelectorAll: () => [], addEventListener() {} };
    input.focus = () => { document.activeElement = input; };
    const scripts = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/i18n.js', 'js/api.js', 'js/sheet.js', 'js/relay.js', 'js/gd.js', 'js/components/faces.js', 'js/components/search.js'], {
        document, localStorage: {}, AbortSignal, URLSearchParams, Date: { now: () => now }, window: { addEventListener() {} },
        setTimeout(callback, delay) { timers.set(++timerId, { at: now + delay, callback }); return timerId; },
        clearTimeout(id) { timers.delete(id); },
        fetch: async url => {
            asked.push(url);
            return { ok: true, json: async () => url == 'data/levels.json' ? [] : relayPage([searchRow('1', 'Honeycomb')]) };
        }
    });
    scripts.app('levelSearchBox()');
    scripts.load(['js/events.js']);
    return {
        ...scripts, input, results, message, asked, timers, document,
        reports: () => reports,
        type(value) { input.value = value; document.body.oninput({ target: input }); },
        async tick(ms) {
            now += ms;
            for (const [id, timer] of timers)
                if (timer.at <= now) {
                    timers.delete(id);
                    timer.callback();
                }
            await settleSearch();
        },
        async enter() {
            document.onkeydown({ key: 'Enter', target: input, preventDefault() {} });
            await settleSearch();
        }
    };
}

const searchMessages = {
    es: {
        busy: 'Buscando…', one: '1 resultado.', many: '2 resultados, los más parecidos primero.', none: 'Ningún nivel coincide.', suggestion: '¿Quisiste decir:',
        partial: 'GDHistory no responde: solo se muestran niveles rated de la hoja de la comunidad.',
        noneRated: 'Ningún nivel rated coincide. GDHistory no responde, así que no se han podido buscar los niveles sin rate.',
        unavailable: 'Ahora no se pueden buscar niveles sin rate porque GDHistory no responde. Prueba de nuevo en unos minutos, o elige Todos o Rateados para buscar en la hoja de la comunidad.',
        error: 'La búsqueda no está disponible: no se ha podido cargar la hoja de la comunidad y GDHistory no responde. Prueba de nuevo en unos minutos.'
    },
    en: {
        busy: 'Searching…', one: '1 result.', many: '2 results, best matches first.', none: 'No levels match.', suggestion: 'Did you mean:',
        partial: 'GDHistory is not responding: only rated levels from the community sheet are shown.',
        noneRated: 'No rated level matches. GDHistory is not responding, so unrated levels could not be searched.',
        unavailable: 'Unrated levels cannot be searched right now because GDHistory is not responding. Try again in a few minutes, or choose All or Rated to search the community sheet.',
        error: 'Search is not available: the community sheet could not be loaded and GDHistory is not responding. Try again in a few minutes.'
    }
};

for (const [lang, m] of Object.entries(searchMessages)) {
    const cases = [
        ...['complete', 'partial', 'unavailable', 'error'].map(coverage => ['busy', coverage, 1, true, m.busy, false]),
        ['idle', 'complete', 1, false, m.one, false],
        ['idle', 'complete', 2, false, m.many, false],
        ['idle', 'partial', 1, false, m.one + ' ' + m.partial, true],
        ['idle', 'partial', 2, false, m.many + ' ' + m.partial, true],
        ['idle', 'unavailable', 1, false, m.one, false],
        ['idle', 'error', 2, false, m.many, false],
        ['idle', 'complete', 0, false, '', false],
        ['none', 'complete', 0, false, m.none, false],
        ['none', 'complete', 0, true, m.none + ' ' + m.suggestion, false],
        ['none', 'partial', 0, false, m.noneRated, true],
        ['none', 'partial', 0, true, m.noneRated + ' ' + m.suggestion, true],
        ['none', 'unavailable', 0, false, m.unavailable, true],
        ['none', 'error', 0, false, m.error, true]
    ];
    for (const [status, coverage, count, similar, text, warn] of cases)
        test(`${lang}: ${status}/${coverage}, ${count} results, suggestions ${similar}`, () => {
            const form = searchForm();
            form.app(`ui.lang = '${lang}'; levelSearch = { ...levelSearch, status: '${status}', coverage: '${coverage}', results: Array.from({ length: ${count} }, (_, i) => ({ levelId: String(i), name: 'Comb', diff: 'Hard', rating: 'rated' })), similar: ${similar ? "['Comb']" : '[]'} }`);
            const state = form.app('levelSearch'), before = JSON.stringify(state);
            const outcome = form.app('levelSearchMessage(levelSearch)');
            assert.deepEqual({ ...outcome }, { text, warn });
            assert.equal(JSON.stringify(state), before, 'message selection does not mutate the search');
            form.message.classList.toggle('warn', !warn);
            form.app('renderLevelSearch()');
            assert.equal(form.message.textContent, text);
            assert.equal(form.message.classList.contains('warn'), warn);
            if (status == 'none')
                assert.equal(form.results.innerHTML.includes('data-act=gdtry'), similar);
        });
}

test('the search status announces the entire message atomically', () => {
    const markup = searchForm().app('levelSearchBox()');
    const status = markup.match(/<p\b[^>]*id=gdm[^>]*>/)[0];
    assert.match(status, /\brole=status\b/);
    assert.match(status, /\baria-atomic=(?:true|"true")/);
});

for (const coverage of ['unavailable', 'error'])
    test(`${coverage} searches skip suggestions and never retry the sheet`, async () => {
        const form = searchForm();
        let suggestions = 0;
        form.context.countSuggestion = () => { suggestions++; };
        form.app('const realSimilarLevelNames = similarLevelNames; similarLevelNames = q => { countSuggestion(); return realSimilarLevelNames(q); }');
        form.context.fetch = async url => {
            form.asked.push(url);
            return url == 'data/levels.json' && coverage == 'unavailable'
                ? { ok: true, json: async () => [[1, 'Comb Breaker', 'Creator', 3, 0, 0]] }
                : { ok: false, status: 403 };
        };
        if (coverage == 'unavailable')
            form.app("levelSearch.f.rated = 'unrated'");
        form.type('combx');
        await form.tick(400);
        assert.equal(form.app('levelSearch.coverage'), coverage);
        assert.equal(suggestions, 0);
        assert.equal(form.asked.filter(url => url == 'data/levels.json').length, 1);
        assert.equal(form.app('levelSearch.similar.length'), 0);
        assert.equal(form.results.innerHTML, '');
    });

for (const added of [true, false])
    test(`Load more focuses ${added ? 'the first new card' : 'the search box when only duplicates return'}`, async () => {
        const form = searchForm();
        let finishPage;
        form.context.fetch = async url => {
            if (url == 'data/levels.json')
                return { ok: true, json: async () => [] };
            if (url.includes('&page=0'))
                return { ok: true, json: async () => relayPage(Array.from({ length: 10 }, (_, i) => searchRow(String(i), 'Comb ' + i))) };
            return new Promise(resolve => { finishPage = resolve; });
        };
        form.input.value = 'comb';
        await form.app('runLevelSearch()');
        form.document.querySelector('.gdmore').focus();
        const pending = form.app('ACTIONS.gdmore()');
        assert.doesNotMatch(form.results.innerHTML, /data-act=gdmore/);
        assert.equal(form.document.activeElement, form.document.body, 'redrawing removes the focused button');
        finishPage({ ok: true, json: async () => relayPage(added ? [searchRow('1', 'Comb 1'), searchRow('10', 'Comb 10'), searchRow('11', 'Comb 11')] : [searchRow('1', 'Comb 1')]) });
        await pending;
        assert.equal(form.app('levelSearch.results.length'), added ? 12 : 10);
        assert.equal(form.document.activeElement, added ? form.document.querySelector('[data-act=gdpick][data-i="10"]') : form.input);
    });

test('typing keeps focus through the search and rendering', async () => {
    const form = searchForm();
    form.input.focus();
    form.type('comb');
    await form.tick(400);
    assert.equal(form.document.activeElement, form.input);
});

test('picking a suggestion searches its name and returns focus to the search box', async () => {
    const form = searchForm();
    form.document.activeElement = { dataset: { act: 'gdtry' } };
    form.app("ACTIONS.gdtry({ dataset: { v: 'Comb Breaker' } })");
    assert.equal(form.document.activeElement, form.input);
    await settleSearch();
    assert.equal(form.input.value, 'Comb Breaker');
    assert.equal(form.app('levelSearch.q'), 'Comb Breaker');
    assert.match(form.asked.at(-1), /search\?q=Comb\+Breaker&page=0&scope=all$/);
});

test('typing debounces for 400 ms after the last input and searches through the event hook', async () => {
    const form = searchForm();
    form.type('com');
    await form.tick(399);
    assert.equal(form.asked.length, 0);
    form.type('comb');
    await form.tick(399);
    assert.equal(form.asked.length, 0);
    await form.tick(1);
    assert.equal(form.app('levelSearch.q'), 'comb');
    assert.match(form.asked.at(-1), /search\?q=comb&page=0&scope=all$/);
    assert.match(form.results.innerHTML, /Honeycomb/);
    assert.equal(form.app('levelSearch.status'), 'idle');
    assert.equal(form.reports(), 0);
});

test('typing requires three cleaned characters, stays silent for invalid text and skips the shown query', async () => {
    const form = searchForm();
    for (const value of ['c', '  co  ', '***']) {
        form.type(value);
        await form.tick(500);
        assert.equal(form.asked.length, 0, value);
        assert.equal(form.reports(), 0, value);
    }
    form.type('com');
    await form.tick(400);
    assert.equal(form.app('levelSearch.q'), 'com');
    form.type('  com   b  ');
    await form.tick(400);
    assert.equal(form.app('levelSearch.q'), 'com b');
    const count = form.asked.length;
    form.type('com b');
    await form.tick(500);
    assert.equal(form.asked.length, count);
    form.type('abc');
    form.type('ab');
    await form.tick(500);
    assert.equal(form.asked.length, count, 'a shorter edit cancels the pending search');
});

test('emptying the box clears results and status and cancels a pending search', async () => {
    const form = searchForm();
    form.context.fetch = async url => ({ ok: true, json: async () => url == 'data/levels.json' ? [] : relayPage(Array.from({ length: 10 }, (_, i) => searchRow(String(i), 'Honeycomb'))) });
    form.type('comb');
    await form.app('runLevelSearch()');
    assert.match(form.results.innerHTML, /Honeycomb/);
    assert.equal(form.app('levelSearch.more'), true);
    form.type('other');
    form.type('');
    const count = form.asked.length;
    await form.tick(500);
    assert.equal(form.asked.length, count);
    assert.equal(form.results.innerHTML, '');
    assert.equal(form.results.hidden, true);
    assert.equal(form.message.textContent, '');
    assert.equal(form.app('levelSearch.results.length'), 0);
    assert.equal(form.app('levelSearch.q'), '');
    assert.equal(form.app('levelSearch.more'), false);
});

test('Enter and Search run short queries immediately and cancel pending timers; only explicit searches report invalid text', async () => {
    const form = searchForm();
    form.type('comb');
    await form.enter();
    const count = form.asked.length;
    assert.match(form.results.innerHTML, /Honeycomb/);
    await form.tick(400);
    assert.equal(form.asked.length, count);
    form.type('co');
    await form.enter();
    assert.match(form.asked.at(-1), /search\?q=co&page=0&scope=all$/);
    form.type('c');
    await form.app('ACTIONS.gdgo()');
    assert.match(form.asked.at(-1), /search\?q=c&page=0&scope=all$/);
    form.type('comb');
    await form.app('ACTIONS.gdgo()');
    const buttonCount = form.asked.length;
    await form.tick(400);
    assert.equal(form.asked.length, buttonCount);
    form.type('***');
    await form.enter();
    assert.equal(form.reports(), 1);
    assert.equal(form.input.validity.length > 0, true);
    form.type('**');
    assert.equal(form.input.validity, '');
    await form.app('ACTIONS.gdgo()');
    assert.equal(form.reports(), 2);
});

test('emptying the box and newer timed searches discard answers still in flight', async () => {
    const form = searchForm(), pending = [];
    form.context.fetch = async url => url == 'data/levels.json'
        ? { ok: true, json: async () => [] }
        : new Promise(resolve => pending.push(resolve));
    form.type('old');
    await form.tick(400);
    form.type('new');
    await form.tick(400);
    pending[1]({ ok: true, json: async () => relayPage([searchRow('2', 'New level')]) });
    await settleSearch();
    pending[0]({ ok: true, json: async () => relayPage([searchRow('1', 'Old level')]) });
    await settleSearch();
    assert.match(form.results.innerHTML, /New level/);
    assert.doesNotMatch(form.results.innerHTML, /Old level/);
    assert.deepEqual(Array.from(form.app('levelSearch.results'), l => l.levelId), ['2']);
    form.type('running');
    await form.tick(400);
    form.type('');
    pending[2]({ ok: true, json: async () => relayPage([searchRow('3', 'Late level')]) });
    await settleSearch();
    assert.equal(form.results.innerHTML, '');
    assert.equal(form.message.textContent, '');
    assert.equal(form.app('levelSearch.status'), 'idle');
    assert.equal(form.app('levelSearch.results.length'), 0);
});

test('sheet matches are reused across pages, refreshed on query and filter changes, and results never repeat', async () => {
    const form = searchForm(), asked = [];
    form.context.fetch = async url => {
        asked.push(url);
        if (url == 'data/levels.json')
            return { ok: true, json: async () => Array.from({ length: 11 }, (_, i) => [i + 10, 'Comb ' + String(i).padStart(2, '0'), '', i ? 1 : 3]) };
        return { ok: true, json: async () => relayPage([searchRow('10', 'Comb 10')]) };
    };
    form.type('comb');
    await form.tick(400);
    assert.equal(form.app('levelSearch.results.length'), 10);
    assert.equal(form.app('levelSearch.more'), true);
    form.app("useSheetLevels([[50, 'Comb New', '', 3]])");
    await form.app('runLevelSearch(true)');
    assert.equal(form.app("levelSearch.results.some(l => l.levelId == '20')"), true, 'page two uses the original matches');
    assert.equal(asked.some(url => url.includes('/levels?')), false);
    assert.equal(form.app('levelSearch.results.length'), 11);
    assert.equal(form.app('levelSearch.more'), false);
    form.app("levelSearch.f.diffs = ['Hard']; changeLevelFilters()");
    await settleSearch();
    assert.equal(form.app("levelSearch.results.some(l => l.levelId == '50')"), true, 'a filter change recomputes matches');
    form.app("useSheetLevels([[60, 'Other', '', 3]])");
    form.type('other');
    await form.tick(400);
    assert.equal(form.app("levelSearch.results.some(l => l.levelId == '60')"), true, 'a text change recomputes matches');
});

test('later pages use only the sheet after the game is exhausted, and new searches reset both sources', async () => {
    const form = searchForm(), asked = [];
    form.context.fetch = async url => {
        asked.push(url);
        if (url == 'data/levels.json')
            return { ok: true, json: async () => Array.from({ length: 13 }, (_, i) => [i + 1, 'Catacomb ' + i, '', 3]) };
        if (url.includes('&page=0'))
            return { ok: true, json: async () => relayPage(Array.from({ length: 5 }, (_, i) => searchRow(String(101 + i), 'Acomb ' + i))) };
        return { ok: false, status: 500 };
    };
    form.type('acomb');
    await form.tick(400);
    assert.equal(form.app('levelSearch.results.length'), 15);
    assert.equal(form.app('levelSearch.more'), true, 'three sheet matches remain');
    const pageStart = asked.length;
    await form.app('runLevelSearch(true)');
    assert.deepEqual(asked.slice(pageStart), []);
    assert.equal(form.app('levelSearch.results.length'), 18);
    assert.equal(form.app('levelSearch.more'), false, 'both sources are exhausted');
    const filterStart = asked.length;
    form.app("levelSearch.f.diffs = ['Hard']; changeLevelFilters()");
    await settleSearch();
    assert.deepEqual(asked.slice(filterStart), [
        RELAY + 'search?q=acomb&page=0&scope=rated&diff=Hard'
    ]);
    form.type('other');
    await form.tick(400);
    assert.equal(asked.at(-1), RELAY + 'search?q=other&page=0&scope=rated&diff=Hard');
    assert.equal(form.app('levelSearch.results.length'), 5, 'a new query clears old results and sheet matches');
    assert.equal(form.app('levelSearch.more'), false);
});

test('a full game page still requests its next page when the sheet is exhausted', async () => {
    const form = searchForm();
    form.context.fetch = async url => {
        form.asked.push(url);
        return { ok: true, json: async () => url == 'data/levels.json' ? [] : url.includes('&page=0')
            ? relayPage(Array.from({ length: 10 }, (_, i) => searchRow(String(i), 'Comb ' + i))) : relayPage([searchRow('10', 'Comb 10')]) };
    };
    form.type('comb');
    await form.tick(400);
    assert.equal(form.app('levelSearch.more'), true);
    await form.app('runLevelSearch(true)');
    assert.equal(form.asked.at(-1), RELAY + 'search?q=comb&page=1&scope=all');
    assert.equal(form.app('levelSearch.results.length'), 11);
    assert.equal(form.app('levelSearch.more'), false);
});

test('a relay outage renders sheet results and a note that a new online search clears', async () => {
    const form = searchForm();
    form.context.fetch = async url => {
        if (url == 'data/levels.json')
            return { ok: true, json: async () => [[1, 'Comb', '', 3]] };
        throw TypeError('Failed to fetch');
    };
    form.type('comb');
    await form.tick(400);
    assert.match(form.results.innerHTML, /class=gdc/);
    assert.match(form.results.innerHTML, /Comb/);
    assert.equal(form.app('levelSearch.status'), 'idle');
    assert.equal(form.app('levelSearch.coverage'), 'partial');
    assert.equal(form.message.textContent, '1 resultado. ' + searchMessages.es.partial);
    assert.equal(form.message.classList.contains('warn'), true);
    form.context.fetch = async () => ({ ok: true, json: async () => relayPage([searchRow('2', 'Other')]) });
    await form.tick(300000);
    form.type('other');
    await form.tick(400);
    assert.equal(form.app('levelSearch.coverage'), 'complete');
    assert.equal(form.message.textContent, '1 resultado.');
    assert.equal(form.message.classList.contains('warn'), false);
});

test('no results during an outage announces no rated matches, then suggestions', async () => {
    const form = searchForm();
    form.context.fetch = async url => {
        if (url == 'data/levels.json')
            return { ok: true, json: async () => [[1, 'Comb Breaker', '', 3]] };
        throw TypeError('Failed to fetch');
    };
    form.type('combx');
    await form.tick(400);
    assert.equal(form.app('levelSearch.status'), 'none');
    assert.equal(form.message.textContent, searchMessages.es.noneRated + ' ¿Quisiste decir:');
    assert.equal(form.message.classList.contains('warn'), true);
    assert.match(form.results.innerHTML, /data-act=gdtry/);
    assert.match(form.results.innerHTML, /Comb Breaker/);
});

test('an incomplete search keeps the note through later local pages', async () => {
    const form = searchForm();
    form.context.fetch = async url => {
        if (url == 'data/levels.json')
            return { ok: true, json: async () => Array.from({ length: 11 }, (_, i) => [i + 1, 'Comb ' + i, '', 3]) };
        throw TypeError('Failed to fetch');
    };
    form.type('comb');
    await form.tick(400);
    assert.equal(form.app('levelSearch.more'), true);
    form.context.fetch = async () => ({ ok: true, json: async () => relayPage([searchRow('11', 'Comb 10')]) });
    await form.app('runLevelSearch(true)');
    assert.equal(form.app('levelSearch.results.length'), 11);
    assert.equal(form.app('levelSearch.coverage'), 'partial');
    assert.equal(form.message.classList.contains('warn'), true);
    assert.equal(form.message.textContent, '11 resultados, los más parecidos primero. ' + searchMessages.es.partial);
});

test('a missing sheet leaves the game search working with no ID lookup', async () => {
    const form = searchForm();
    form.context.fetch = async url => {
        form.asked.push(url);
        return { ok: url != 'data/levels.json', status: 404, json: async () => relayPage([searchRow('1', 'Comb Breaker')]) };
    };
    form.type('comb');
    await form.tick(400);
    assert.deepEqual(form.asked, ['data/levels.json', RELAY + 'search?q=comb&page=0&scope=all']);
    assert.match(form.results.innerHTML, /Comb Breaker/);
    assert.equal(form.app('levelSearch.status'), 'idle');
});

test('clearing during the initial sheet download prevents a stale search from starting', async () => {
    const form = searchForm();
    let finishSheet;
    form.context.fetch = url => {
        form.asked.push(url);
        return new Promise(resolve => { finishSheet = resolve; });
    };
    form.type('comb');
    await form.tick(400);
    form.type('');
    finishSheet({ ok: true, json: async () => [] });
    await settleSearch();
    assert.deepEqual(form.asked, ['data/levels.json']);
    assert.equal(form.results.innerHTML, '');
    assert.equal(form.message.textContent, '');
});

test('Rated sheet-only results keep complete coverage and show no outage note', async () => {
    const form = searchForm();
    form.context.fetch = async url => {
        if (url == 'data/levels.json')
            return { ok: true, json: async () => [[1, 'Comb', 'Creator', 3, 0, 2]] };
        return { ok: false, status: 403 };
    };
    form.app("levelSearch.f.rated = 'rated'");
    form.type('comb');
    await form.tick(400);
    assert.equal(form.app('levelSearch.coverage'), 'complete');
    assert.equal(form.message.classList.contains('warn'), false);
    assert.match(form.results.innerHTML, /hard-epic/);
});

test('a newer search during sheet loading drops the old coordinator answer', async () => {
    const form = searchForm();
    let finishSheet;
    form.context.fetch = async url => {
        form.asked.push(url);
        if (url == 'data/levels.json')
            return new Promise(resolve => { finishSheet = resolve; });
        return { ok: true, json: async () => relayPage([searchRow('2', 'New level')]) };
    };
    form.type('old');
    await form.tick(400);
    form.type('new');
    await form.tick(400);
    finishSheet({ ok: true, json: async () => [] });
    await settleSearch();
    assert.deepEqual(form.asked, ['data/levels.json', RELAY + 'search?q=new&page=0&scope=all']);
    assert.match(form.results.innerHTML, /New level/);
});

test('at most five empty filtered pages are tried before suggesting names', async () => {
    const form = searchForm();
    form.context.fetch = async url => {
        form.asked.push(url);
        return { ok: true, json: async () => url == 'data/levels.json' ? [] : relayPage(Array.from({ length: 10 }, (_, i) => ({ ...searchRow(String(i), 'Comb'), rating: 'unrated', diff: null }))) };
    };
    form.app("levelSearch.f.rated = 'rated'");
    form.input.value = 'comb';
    await form.app('runLevelSearch()');
    assert.equal(form.asked.filter(url => url.includes('&page=')).length, 5);
    assert.equal(form.app('levelSearch.status'), 'none');
    assert.equal(form.app('levelSearch.more'), true);
});

test('load more deduplicates levels already shown on earlier game pages', async () => {
    const form = searchForm();
    form.context.fetch = async url => ({ ok: true, json: async () => url == 'data/levels.json' ? [] : url.includes('&page=0')
        ? relayPage(Array.from({ length: 10 }, (_, i) => searchRow(String(i), 'Comb ' + i))) : relayPage([searchRow('1', 'Comb 1'), searchRow('10', 'Comb 10')]) });
    form.input.value = 'comb';
    await form.app('runLevelSearch()');
    await form.app('runLevelSearch(true)');
    assert.deepEqual(Array.from(form.app('levelSearch.results'), l => l.levelId).sort(), ['0', '1', '10', '2', '3', '4', '5', '6', '7', '8', '9']);
    assert.equal(form.app('levelSearch.more'), false);
});

test('a newer search discards suggestions delayed by a sheet retry', async () => {
    const form = searchForm();
    let calls = 0, finishSheet;
    form.context.fetch = async url => {
        if (url == 'data/levels.json') {
            if (++calls == 1)
                return { ok: false, status: 404 };
            return new Promise(resolve => { finishSheet = resolve; });
        }
        return { ok: true, json: async () => relayPage(url.includes('q=oldx&') ? [] : [searchRow('2', 'New level')]) };
    };
    form.type('oldx');
    await form.tick(400);
    assert.equal(calls, 2, 'suggestions retry the failed sheet');
    form.type('new');
    await form.tick(400);
    finishSheet({ ok: true, json: async () => [[1, 'Oldx suggestion', '', 3, 0, 2]] });
    await settleSearch();
    assert.equal(form.app('levelSearch.q'), 'new');
    assert.equal(form.app('levelSearch.similar.length'), 0);
    assert.match(form.results.innerHTML, /New level/);
});
