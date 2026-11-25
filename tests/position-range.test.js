import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDurationFields, loadScripts } from './load-scripts.js';

function fixture() {
    const nodes = Object.fromEntries(['#lf-face', '#lf-diffT', '#gdq', '#fm-pos-hint'].map(key => [key, { textContent: '', setCustomValidity() {} }]));
    const f = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/state.js', 'js/components/faces.js', 'js/components/search.js', 'js/components/deaths-input.js', 'js/components/duration-input.js', 'js/components/levels.js', 'js/events.js'], {
        localStorage: {}, clearTimeout, Event,
        document: { querySelector: key => nodes[key], body: {}, addEventListener() {} },
        window: { addEventListener() {} },
        FormData: class extends URLSearchParams { constructor(form) { super(form.entries); } },
        matchWithAredl() {}, matchWithDemonlist() {}, closeModal() {}, render() {}
    });
    f.app(`profile = emptyProfile(); ui.lang = 'en'; ui.tab = 'classic';
        profile.levels = Array.from({ length: 6 }, (_, i) => ({ id: 'c' + i, name: 'Classic', kind: 'classic' }));
        profile.order.classic = profile.levels.map(level => level.id);
        profile.levels.push({ id: 'unplaced', kind: 'classic' }, { id: 'p', kind: 'platform' });
        profile.order.platform = ['p'];
        fillAredlPosition = () => {};`);
    return { ...f, nodes };
}

for (const [id, kind, maximum] of [[null, 'classic', 7], ['c0', 'classic', 6], ['unplaced', 'classic', 7], [null, 'platform', 2], ['p', 'platform', 1]])
    test(`position range for ${id || 'new'} in ${kind} is 1 to ${maximum}`, () => {
        const f = fixture();
        f.app(`ui.tab = '${kind}'`);
        const level = id ? f.app('findLevel')(id) : undefined;
        for (const [lang, text] of [['en', 'Available positions'], ['es', 'Posiciones disponibles']]) {
            f.app(`ui.lang = '${lang}'`);
            const html = f.app('levelForm')(level);
            const input = html.match(/<input id=fm-pos\b[^>]*>/)[0];
            for (const attribute of ['min=1', 'step=1', `max=${maximum}`, 'aria-describedby=fm-pos-hint']) assert.ok(input.includes(attribute), input);
            assert.ok(html.includes(`${text}: 1–${maximum}`));
            assert.match(html, /id=fm-pos-hint/);
        }
    });

test('an empty list permits position one', () => {
    const f = fixture();
    f.app('profile = emptyProfile()');
    assert.match(f.app('levelForm()'), /max=1\b/);
    assert.match(f.app('levelForm()'), /Available positions: 1–1/);
});

test('picking another kind refreshes bounds and hint without changing the typed position', () => {
    const f = fixture();
    const form = { id: 'fm', dataset: { id: 'c0' }, elements: { kind: { value: 'classic' }, pos: { value: '6', max: '6' } } };
    for (const [kind, max] of [['platform', 2], ['classic', 6]]) {
        f.app('pickLevel')(form, { kind });
        assert.equal(+form.elements.pos.max, max);
        assert.equal(f.nodes['#fm-pos-hint'].textContent, `Available positions: 1–${max}`);
        assert.equal(form.elements.pos.value, '6');
    }
});

for (const [position, expected] of [['99', ['c1', 'c2', 'c3', 'c4', 'c5', 'c0']], ['-2', ['c0', 'c1', 'c2', 'c3', 'c4', 'c5']], ['0', ['c0', 'c1', 'c2', 'c3', 'c4', 'c5']], ['2', ['c1', 'c0', 'c2', 'c3', 'c4', 'c5']], ['', ['c1', 'c2', 'c3', 'c4', 'c5']]])
    test(`saveLevel clamps position ${position || 'empty'} while preserving unplaced behavior`, () => {
        const f = fixture();
        const form = { dataset: { id: 'c0' }, elements: { ...emptyDurationFields(), pos: { value: position }, kind: { value: 'classic' } }, entries: [['name', 'Edited'], ['kind', 'classic']] };
        f.app('saveLevel')(form);
        assert.deepEqual([...f.app("rankedIds('classic')")], expected);
        assert.deepEqual([...f.app('profile.order.platform')], ['p']);
    });

test('position step buttons stop at the rendered bounds', () => {
    const f = fixture(), html = f.app('levelForm()');
    const input = { min: '1', max: html.match(/id=fm-pos[^>]*max=(\d+)/)[1], value: '6', dispatchEvent() {} };
    const button = { parentNode: { querySelector: () => input }, dataset: { d: '1' } };
    f.app('ACTIONS.step')(button);
    assert.equal(+input.value, 7);
    f.app('ACTIONS.step')(button);
    assert.equal(+input.value, 7);
    input.value = '1';
    button.dataset.d = '-1';
    f.app('ACTIONS.step')(button);
    assert.equal(+input.value, 1);
});

for (const id of ['', 'unplaced', 'c0'])
    test(`saving ${id || 'a new level'} at an excessive platform position uses the destination list`, () => {
        const f = fixture();
        const form = { dataset: { id }, elements: { ...emptyDurationFields(), pos: { value: '99' } }, entries: [['name', 'Moved'], ['kind', 'platform']] };
        f.app('saveLevel')(form);
        const savedId = f.app('ui.sel');
        assert.deepEqual([...f.app('profile.order.platform')], ['p', savedId]);
        assert.equal(f.app('profile.order.classic').includes(savedId), false);
    });

test('a level tagged Pre-Extremes takes its position like any other', () => {
    const f = fixture();
    f.app('saveLevel')({ dataset: { id: 'unplaced' }, elements: { ...emptyDurationFields(), pos: { value: '2' } }, entries: [['name', 'Tagged'], ['kind', 'classic'], ['tg', 'Pre-Extremes']] });
    assert.deepEqual([...f.app("rankedIds('classic')")], ['c0', 'unplaced', 'c1', 'c2', 'c3', 'c4', 'c5']);
});

test('notes over 5000 characters block the save with a message and are never cut', () => {
    const f = fixture();
    const errors = [];
    let reported = 0;
    const save = notes => f.app('saveLevel')({
        dataset: { id: 'c0' }, reportValidity() { reported++; },
        elements: { ...emptyDurationFields(), pos: { value: '1' }, notes: { setCustomValidity: message => errors.push(message) } },
        entries: [['name', 'Edited'], ['kind', 'classic'], ['notes', notes]]
    });
    const before = JSON.stringify(f.app('findLevel("c0")'));
    save('x'.repeat(5001));
    assert.equal(JSON.stringify(f.app('findLevel("c0")')), before);
    assert.deepEqual(errors, ['Notes can have up to 5,000 characters']);
    assert.equal(reported, 1);
    const emoji = '🎮'.repeat(5000);
    save(emoji);
    assert.equal(f.app('findLevel("c0").notes'), emoji);
    assert.equal(reported, 1);
});

test('the notes field states its limit and keeps longer legacy notes whole', () => {
    const f = fixture();
    const legacy = 'y'.repeat(6000);
    for (const [lang, hint] of [['en', 'Up to 5,000 characters.'], ['es', 'Hasta 5000 caracteres.']]) {
        f.app(`ui.lang = '${lang}'`);
        const html = f.app('levelForm')({ id: 'c0', name: 'Classic', kind: 'classic', notes: legacy, tags: [] });
        assert.match(html, /<textarea id=fm-notes name=notes rows=3 maxlength=5000 aria-describedby=fm-notes-hint>y{6000}<\/textarea><small id=fm-notes-hint class=by>/);
        assert.ok(html.includes(hint));
    }
    assert.equal(f.app('fieldError')('notes', 'z'.repeat(5000)), '');
});
