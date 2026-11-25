import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

function editor(deaths = {}) {
    let active;
    const node = extra => ({ focus() { active = this; }, ...extra });
    const field = id => node({ id, value: '', dataset: { deathField: '' }, setCustomValidity(message) { this.validationMessage = message; }, reportValidity() { this.reported = true; }, setAttribute(key, value) { this[key] = value; }, closest: () => root });
    const percent = field('death-percent'), count = field('death-count');
    const prompt = node({ innerHTML: '', querySelector: () => choice });
    const choice = node({ closest: () => root, dataset: {} });
    const add = node({ textContent: '' }), cancel = node({ hidden: true });
    const errors = { '#death-percent-error': {}, '#death-count-error': {} };
    const list = {
        children: [],
        insertBefore(chip, before) { this.children.splice(before ? this.children.indexOf(before) : this.children.length, 0, chip); }
    };
    const chip = value => {
        const input = { value, closest: () => element };
        const edit = node({ closest: selector => selector == '.death-chip' ? element : root });
        const element = {
            querySelector: selector => selector == 'input' ? input : edit,
            closest: () => root,
            remove() { list.children.splice(list.children.indexOf(this), 1); },
            get nextElementSibling() { return list.children[list.children.indexOf(this) + 1]; },
            get previousElementSibling() { return list.children[list.children.indexOf(this) - 1]; }
        };
        return element;
    };
    const root = {
        dataset: {},
        querySelector: selector => ({ '#death-percent': percent, '#death-count': count, '.death-prompt': prompt, '.death-chips': list, '[data-act=dthadd]': add, '[data-act=dthcancel]': cancel, ...errors })[selector],
        querySelectorAll: () => list.children.map(element => element.querySelector('input'))
    };
    for (const [p, c] of Object.entries(deaths)) list.children.push(chip(`${p}:${c}`));
    const document = {
        body: {}, addEventListener() {},
        createElement(tag) {
            assert.equal(tag, 'template');
            return { set innerHTML(html) { this.content = { firstElementChild: chip(html.match(/name=dth value="([^"]+)"/)[1]) }; } };
        }
    };
    const fixture = loadScripts(['js/config.js', 'js/i18n.js', 'js/utils.js', 'js/components/help-tip.js', 'js/components/deaths-input.js', 'js/events.js'], { ui: { lang: 'en' }, document, window: { addEventListener() {} } });
    const enter = target => {
        let prevented = false;
        document.onkeydown({ key: 'Enter', target, preventDefault() { prevented = true; } });
        assert.equal(prevented, true, 'Enter must prevent implicit form submission');
    };
    return {
        ...fixture, root, percent, count, prompt, list, add, cancel, enter,
        values: () => list.children.map(element => element.querySelector('input').value),
        active: () => active,
        type(p, c) { percent.value = p; count.value = c; },
        submit() { fixture.app('ACTIONS.dthadd')(percent); },
        resolve(value) { choice.dataset.choice = value; fixture.app('ACTIONS.dthresolve')(choice); },
        edit(index) { fixture.app('ACTIONS.dthedit')(list.children[index].querySelector('button')); },
        remove(index) { fixture.app('ACTIONS.dthremove')(list.children[index].querySelector('button')); }
    };
}

test('renders existing entries in ascending order including an explicit zero, with labelled draft fields', () => {
    const f = editor();
    const html = f.app('deathsInput')({ 90: 2, 24: 135, 0: 0 });
    assert.deepEqual([...html.matchAll(/name=dth value="([^"]+)"/g)].map(match => match[1]), ['0:0', '24:135', '90:2']);
    assert.match(html, /24% · 135/);
    assert.match(html, /aria-label="Remove 24%"/);
    assert.match(html, /<label for=death-percent>Percentage<\/label>/);
    assert.match(html, /<label for=death-count>Death count<\/label>/);
    assert.equal((html.match(/inputmode=numeric/g) || []).length, 2);
    assert.doesNotMatch(html, /name=(?:deaths|percent|count)/);
    f.app('ui.lang = "es"');
    const spanish = f.app('deathsInput')({ 24: 135 });
    assert.match(spanish, /<span class=lab id=death-label>Muertes por porcentaje<\/span>/);
    assert.match(spanish, /<label for=death-count>Cantidad de muertes<\/label>/);
    assert.match(spanish, /aria-label="Quitar 24%"/);
});

test('adds from the button or Enter and sorts chips while clearing and refocusing the draft', () => {
    const f = editor();
    f.type('24', '135'); f.submit();
    f.type('37', '82'); f.enter(f.count);
    f.type('12', '84'); f.enter(f.percent);
    assert.deepEqual(f.values(), ['12:84', '24:135', '37:82']);
    assert.equal(f.percent.value, ''); assert.equal(f.count.value, '');
    assert.equal(f.active(), f.percent);
    f.type('0', '0'); f.submit();
    f.type('100', '10000000'); f.submit();
    assert.deepEqual(f.values(), ['0:0', '12:84', '24:135', '37:82', '100:10000000']);
});

for (const value of ['101', '-1', '2.5', 'letters', '', '1e2', ' 24'])
    test(`rejects percentage ${JSON.stringify(value)} without losing typed text or changing chips`, () => {
        const f = editor({ 24: 135 });
        f.type(value, '12'); f.submit();
        assert.deepEqual(f.values(), ['24:135']);
        assert.equal(f.percent.value, value);
        assert.ok(f.percent.validationMessage); assert.equal(f.percent.reported, true);
        assert.equal(f.root.querySelector('#death-percent-error').textContent, f.percent.validationMessage);
    });

for (const value of ['10000001', '-1', '2.5', 'letters', ''])
    test(`rejects count ${JSON.stringify(value)} and retains the draft`, () => {
        const f = editor();
        f.type('24', value); f.submit();
        assert.deepEqual(f.values(), []);
        assert.equal(f.count.value, value); assert.ok(f.count.validationMessage);
    });

test('Enter on the percentage with no count focuses the count and never submits', () => {
    const f = editor();
    f.type('24', ''); f.enter(f.percent);
    assert.equal(f.active(), f.count); assert.deepEqual(f.values(), []);
});

for (const [choice, expected] of [['sum', '37:99'], ['replace', '37:17']])
    test(`duplicates stay unchanged until ${choice} is chosen`, () => {
        const f = editor({ 12: 84, 37: 82 });
        f.type('37', '17'); f.submit();
        assert.deepEqual(f.values(), ['12:84', '37:82']);
        assert.match(f.prompt.innerHTML, /37% already has 82 deaths\./);
        assert.match(f.prompt.innerHTML, /Add up \(99\)/);
        assert.equal(f.active(), f.prompt.querySelector('button'));
        f.resolve(choice);
        assert.deepEqual(f.values(), ['12:84', expected]);
        assert.equal(f.percent.value, ''); assert.equal(f.active(), f.percent);
    });

test('cancelling a duplicate preserves all chips and the draft', () => {
    const f = editor({ 37: 82 });
    f.type('37', '17'); f.submit(); f.resolve('cancel');
    assert.deepEqual(f.values(), ['37:82']);
    assert.equal(f.percent.value, '37'); assert.equal(f.count.value, '17');
    assert.equal(f.prompt.innerHTML, ''); assert.equal(f.active(), f.percent);
});

test('sum beyond the count limit is rejected without changing chips', () => {
    const f = editor({ 37: 10000000 });
    f.type('37', '1'); f.submit(); f.resolve('sum');
    assert.deepEqual(f.values(), ['37:10000000']);
    assert.ok(f.count.validationMessage); assert.equal(f.count.value, '1');
    f.resolve('replace'); assert.deepEqual(f.values(), ['37:1']);
});

test('editing replaces just that chip, preserves other nodes and supports cancellation', () => {
    const f = editor({ 12: 84, 24: 135, 37: 82 }), untouched = f.list.children.slice(0, 2);
    f.edit(2);
    assert.equal(f.percent.value, '37'); assert.equal(f.count.value, '82');
    assert.equal(f.add.textContent, 'Update'); assert.equal(f.cancel.hidden, false);
    f.type('40', '83'); f.submit();
    assert.deepEqual(f.values(), ['12:84', '24:135', '40:83']);
    assert.deepEqual(f.list.children.slice(0, 2), untouched);
    assert.equal(f.cancel.hidden, true);
    f.edit(0); f.type('15', '1'); f.app('ACTIONS.dthcancel')(f.percent);
    assert.deepEqual(f.values(), ['12:84', '24:135', '40:83']);
    assert.equal(f.percent.value, ''); assert.equal(f.add.textContent, '+ Add');
});

test('editing into another percentage prompts before replacing either chip', () => {
    const f = editor({ 12: 84, 24: 135, 37: 82 });
    f.edit(2); f.type('24', '17'); f.submit();
    assert.deepEqual(f.values(), ['12:84', '24:135', '37:82']);
    f.resolve('cancel');
    assert.equal(f.add.textContent, 'Update');
    f.submit(); f.resolve('sum');
    assert.deepEqual(f.values(), ['12:84', '24:152']);
});

test('editing a count at its existing percentage does not prompt or alter other chips', () => {
    const f = editor({ 24: 135, 37: 82 });
    f.edit(0); f.type('24', '0'); f.submit();
    assert.equal(f.prompt.innerHTML, '');
    assert.deepEqual(f.values(), ['24:0', '37:82']);
});

test('replacing an editing collision can explicitly store zero', () => {
    const f = editor({ 24: 135, 37: 82 });
    f.edit(1); f.type('24', '0'); f.submit();
    assert.deepEqual(f.values(), ['24:135', '37:82']);
    f.resolve('replace'); assert.deepEqual(f.values(), ['24:0']);
});

test('duplicate messages are translated and zero is still a duplicate', () => {
    const f = editor({ 24: 0 });
    f.app('ui.lang = "es"');
    f.type('24', '3'); f.submit();
    assert.match(f.prompt.innerHTML, /El 24% ya tiene 0 muertes\./);
    assert.match(f.prompt.innerHTML, /Sumar \(3\)/);
    f.resolve('sum'); assert.deepEqual(f.values(), ['24:3']);
});

test('removal focuses next, previous, then the percentage when no chips remain', () => {
    const f = editor({ 12: 84, 24: 135, 37: 82 });
    const next = f.list.children[2].querySelector('button');
    f.remove(1);
    assert.deepEqual(f.values(), ['12:84', '37:82']); assert.equal(f.active(), next);
    const previous = f.list.children[0].querySelector('button');
    f.remove(1); assert.equal(f.active(), previous);
    f.remove(0); assert.deepEqual(f.values(), []); assert.equal(f.active(), f.percent);
});

test('removing the chip being edited cancels the edit without reintroducing it', () => {
    const f = editor({ 24: 135, 37: 82 });
    f.edit(0); f.remove(0);
    assert.equal(f.cancel.hidden, true); assert.equal(f.percent.value, '');
    assert.deepEqual(f.values(), ['37:82']);
    f.type('12', '1'); f.submit(); assert.deepEqual(f.values(), ['12:1', '37:82']);
});

test('input clears stale duplicate choices and reports field errors through delegated events', () => {
    const f = editor({ 37: 82 });
    f.type('37', '17'); f.submit();
    f.percent.value = '101'; f.context.document.body.oninput({ target: f.percent });
    assert.equal(f.prompt.innerHTML, ''); assert.ok(f.percent.validationMessage);
    f.percent.value = '40'; f.context.document.body.oninput({ target: f.percent });
    assert.equal(f.percent.validationMessage, '');
    f.submit(); assert.deepEqual(f.values(), ['37:82', '40:17']);
});
