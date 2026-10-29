import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

const searchRow = (id, name) => ({ id, name, author: 'Creator', difficulty: 'Hard', stars: 5, downloads: 10 });
const settleSearch = async () => {
    for (let i = 0; i < 30; i++)
        await Promise.resolve();
};

function searchForm() {
    let now = 0, timerId = 0, reports = 0;
    const timers = new Map(), asked = [];
    const input = { id: 'gdq', value: '', validity: '', matches: () => false, setCustomValidity(message) { this.validity = message; }, reportValidity() { reports++; } };
    const results = { innerHTML: '', hidden: true }, message = { textContent: '' }, clear = { hidden: true };
    const document = { body: {}, querySelector: selector => ({ '#gdq': input, '#gdr': results, '#gdm': message, '.gdclr': clear })[selector], querySelectorAll: () => [], addEventListener() {} };
    const scripts = loadScripts(['js/config.js', 'js/utils.js', 'js/state.js', 'js/i18n.js', 'js/api.js', 'js/sheet.js', 'js/gd.js', 'js/components/faces.js', 'js/components/search.js'], {
        document, localStorage: {}, window: { addEventListener() {} },
        setTimeout(callback, delay) { timers.set(++timerId, { at: now + delay, callback }); return timerId; },
        clearTimeout(id) { timers.delete(id); },
        fetch: async url => {
            asked.push(url);
            return { ok: true, json: async () => url == 'data/levels.json' ? [] : [searchRow('1', 'Honeycomb')] };
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
    assert.match(form.asked.at(-1), /search\/comb\?page=0$/);
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
    form.context.fetch = async url => ({ ok: true, json: async () => url == 'data/levels.json' ? [] : Array.from({ length: 10 }, (_, i) => searchRow(String(i), 'Honeycomb')) });
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
    assert.match(form.asked.at(-1), /search\/co\?page=0$/);
    form.type('c');
    await form.app('ACTIONS.gdgo()');
    assert.match(form.asked.at(-1), /search\/c\?page=0$/);
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
    pending[1]({ ok: true, json: async () => [searchRow('2', 'New level')] });
    await settleSearch();
    pending[0]({ ok: true, json: async () => [searchRow('1', 'Old level')] });
    await settleSearch();
    assert.match(form.results.innerHTML, /New level/);
    assert.doesNotMatch(form.results.innerHTML, /Old level/);
    assert.deepEqual(Array.from(form.app('levelSearch.results'), l => l.levelId), ['2']);
    form.type('running');
    await form.tick(400);
    form.type('');
    pending[2]({ ok: true, json: async () => [searchRow('3', 'Late level')] });
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
        return { ok: true, json: async () => url.endsWith('?list') ? url.split('/').at(-1).split('?')[0].split(',').map(id => searchRow(id, 'Comb ' + id)) : [searchRow('10', 'Comb 10')] };
    };
    form.type('comb');
    await form.tick(400);
    assert.equal(form.app('levelSearch.results.length'), 10);
    assert.equal(form.app('levelSearch.more'), true);
    form.app("useSheetLevels([[50, 'Comb New', '', 3]])");
    await form.app('runLevelSearch(true)');
    assert.equal(asked.some(url => url.endsWith('/20?list')), true, 'page two uses the original matches');
    assert.equal(form.app('levelSearch.results.length'), 11);
    assert.equal(form.app('levelSearch.more'), false);
    form.app("levelSearch.f.diffs = ['Hard']; changeLevelFilters()");
    await settleSearch();
    assert.equal(asked.at(-2).endsWith('/50?list'), true, 'a filter change recomputes matches');
    form.app("useSheetLevels([[60, 'Other', '', 3]])");
    form.type('other');
    await form.tick(400);
    assert.equal(asked.at(-2).endsWith('/60?list'), true, 'a text change recomputes matches');
});

test('later pages only look up sheet IDs after the game is exhausted, and new searches reset both sources', async () => {
    const form = searchForm(), asked = [];
    form.context.fetch = async url => {
        asked.push(url);
        if (url == 'data/levels.json')
            return { ok: true, json: async () => Array.from({ length: 13 }, (_, i) => [i + 1, 'Catacomb ' + i, '', 3]) };
        if (url.endsWith('?list'))
            return { ok: true, json: async () => url.split('/').at(-1).split('?')[0].split(',').map(id => searchRow(id, 'Catacomb ' + id)) };
        if (url.includes('?page=0'))
            return { ok: true, json: async () => Array.from({ length: 5 }, (_, i) => searchRow(String(101 + i), 'Acomb ' + i)) };
        return { ok: false, status: 500 };
    };
    form.type('acomb');
    await form.tick(400);
    assert.equal(form.app('levelSearch.results.length'), 15);
    assert.equal(form.app('levelSearch.more'), true, 'three sheet matches remain');
    const pageStart = asked.length;
    await form.app('runLevelSearch(true)');
    assert.deepEqual(asked.slice(pageStart), ['https://gdbrowser.com/api/search/11,12,13?list']);
    assert.equal(form.app('levelSearch.results.length'), 18);
    assert.equal(form.app('levelSearch.more'), false, 'both sources are exhausted');
    const filterStart = asked.length;
    form.app("levelSearch.f.diffs = ['Hard']; changeLevelFilters()");
    await settleSearch();
    assert.deepEqual(asked.slice(filterStart), [
        'https://gdbrowser.com/api/search/1,2,3,4,5,6,7,8,9,10?list',
        'https://gdbrowser.com/api/search/acomb?page=0&starred&diff=3'
    ]);
    form.type('other');
    await form.tick(400);
    assert.equal(asked.at(-1), 'https://gdbrowser.com/api/search/other?page=0&starred&diff=3');
    assert.equal(form.app('levelSearch.results.length'), 5, 'a new query clears old results and sheet matches');
    assert.equal(form.app('levelSearch.more'), false);
});

test('a full game page still requests its next page when the sheet is exhausted', async () => {
    const form = searchForm();
    form.context.fetch = async url => {
        form.asked.push(url);
        return { ok: true, json: async () => url == 'data/levels.json' ? [] : url.includes('?page=0')
            ? Array.from({ length: 10 }, (_, i) => searchRow(String(i), 'Comb ' + i)) : [searchRow('10', 'Comb 10')] };
    };
    form.type('comb');
    await form.tick(400);
    assert.equal(form.app('levelSearch.more'), true);
    await form.app('runLevelSearch(true)');
    assert.equal(form.asked.at(-1), 'https://gdbrowser.com/api/search/comb?page=1');
    assert.equal(form.app('levelSearch.results.length'), 11);
    assert.equal(form.app('levelSearch.more'), false);
});

test('an ID lookup failure reaches the existing search error message', async () => {
    const form = searchForm();
    form.context.fetch = async url => ({ ok: !url.endsWith('?list'), status: 503, json: async () => url == 'data/levels.json' ? [[1, 'Comb', '', 3]] : [] });
    form.type('comb');
    await form.tick(400);
    assert.equal(form.app('levelSearch.status'), 'error');
    assert.match(form.message.textContent, /GDBrowser/);
});

test('a missing sheet leaves the game search working with no ID lookup', async () => {
    const form = searchForm();
    form.context.fetch = async url => {
        form.asked.push(url);
        return { ok: url != 'data/levels.json', status: 404, json: async () => [searchRow('1', 'Comb Breaker')] };
    };
    form.type('comb');
    await form.tick(400);
    assert.deepEqual(form.asked, ['data/levels.json', 'https://gdbrowser.com/api/search/comb?page=0']);
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
