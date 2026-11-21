import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

function fixture() {
    const listeners = {}, document = { body: {}, listeners, addEventListener(type, handler) { listeners[type] = handler; } };
    const { app } = loadScripts(['js/i18n.js', 'js/utils.js', 'js/components/duration-input.js', 'js/components/levels.js', 'js/events.js'], {
        ui: { lang: 'en' }, document, window: { addEventListener() {} },
        FormData: class extends URLSearchParams {
            constructor(form) { super(Object.entries(form.elements).map(([key, input]) => [key, input.value])); }
        }, deathsFromValues: () => ({})
    });
    const form = { id: 'fm', elements: {}, reportValidity() { this.reported = true; } };
    for (const field of ['tN', 'tP', 'tPC'])
        for (const part of ['h', 'm', 's']) {
            const name = `${field}_${part}`;
            form.elements[name] = { name, value: '', dataset: { duration: field }, form, setCustomValidity(message) { this.error = message; }, focus() { form.focused = name; }, select() { this.selectionStart = 0; this.selectionEnd = this.value.length; } };
        }
    for (const name of ['attN', 'attC', 'attT', 'tT', 'name', 'enj', 'lik'])
        form.elements[name] = { value: '' };
    return { app, form, document, set(field, parts) { parts.forEach((value, index) => { form.elements[`${field}_${'hms'[index]}`].value = value; }); } };
}

for (const [seconds, parts] of [[18483, ['05', '08', '03']], [3686542, ['1024', '02', '22']], [1000000000, ['277777', '46', '40']], [null, ['', '', '']], [0, ['00', '00', '00']]])
    test(`renders and reads ${seconds}`, () => {
        const { app, form, set } = fixture();
        const html = app('durationInput')('tN', seconds);
        assert.match(html, /role=group aria-labelledby="fm-tN-label"/);
        parts.forEach((value, index) => assert.ok(html.includes(`name="tN_${'hms'[index]}" aria-labelledby="fm-tN-label fm-tN_${'hms'[index]}-unit" value="${value}"`)));
        set('tN', parts);
        assert.equal(app('readDuration')(form, 'tN'), seconds);
    });

for (const [part, value] of [['m', '60'], ['s', '75'], ['h', '-1'], ['m', '1.5'], ['s', 'abc'], ['h', '277778'], ['h', 'Infinity'], ['m', ' 2']])
    test(`rejects ${part}=${value} without discarding it`, () => {
        const { app, form } = fixture(), input = form.elements[`tN_${part}`];
        input.value = value;
        assert.ok(Number.isNaN(app('readDuration')(form, 'tN')));
        assert.ok(input.error);
        assert.equal(input.value, value);
        app('saveLevel')(form);
        assert.equal(form.reported, true);
    });

test('validates the combined limit and clears errors after correction', () => {
    const { app, form, set, document } = fixture();
    set('tN', ['277777', '46', '41']);
    document.body.oninput({ target: form.elements.tN_s });
    assert.ok(form.elements.tN_h.error);
    assert.equal(form.elements.tT.value, '');
    form.elements.tN_s.value = '40';
    document.body.oninput({ target: form.elements.tN_s });
    assert.equal(form.elements.tN_h.error, '');
    assert.equal(app('readDuration')(form, 'tN'), 1000000000);
});

test('form serialization and live totals preserve independent durations', () => {
    const { app, form, set, document } = fixture();
    set('tN', ['12', '45', '30']); set('tP', ['3', '20', '15']);
    document.body.oninput({ target: form.elements.tP_s });
    assert.equal(form.elements.tT.value, '16:05:45');
    assert.equal(form.elements.attT.value, '');
    let level = app('levelFromForm')(form);
    assert.equal(level.tN, 45930); assert.equal(level.tP, 12015); assert.equal(level.tPC, null);
    set('tN', ['5', '', '']);
    document.body.oninput({ target: form.elements.tN_h });
    level = app('levelFromForm')(form);
    assert.equal(level.tN, 18000); assert.equal(level.tP, 12015); assert.equal(level.tPC, null);
    assert.equal(app('formatDuration')(level.tP), '3h 20m 15s');
    form.elements.attN.value = '12'; form.elements.attC.value = '3';
    document.body.oninput({ target: form.elements.tN_h });
    assert.equal(form.elements.attT.value, 15);
});

test('keyboard navigation, stepping and blur padding use delegated events', () => {
    const { form, document } = fixture();
    const press = (part, key) => {
        let prevented = false;
        document.onkeydown({ target: form.elements[`tN_${part}`], key, preventDefault() { prevented = true; } });
        return prevented;
    };
    form.elements.tN_h.value = '5';
    assert.equal(press('h', ':'), true); assert.equal(form.focused, 'tN_m');
    assert.equal(press('m', ':'), true); assert.equal(form.focused, 'tN_s');
    assert.equal(press('s', 'Tab'), false);
    assert.equal(press('h', 'a'), true);
    assert.equal(press('h', '1'), false);
    press('m', 'ArrowDown'); assert.equal(form.elements.tN_m.value, '0');
    press('m', 'ArrowUp'); assert.equal(form.elements.tN_m.value, '1');
    form.elements.tN_m.value = '59'; press('m', 'ArrowUp'); assert.equal(form.elements.tN_m.value, '59');
    document.listeners.focusout({ target: form.elements.tN_h }); assert.equal(form.elements.tN_h.value, '05');
    form.elements.tN_s.value = 'bad'; document.listeners.focusout({ target: form.elements.tN_s }); assert.equal(form.elements.tN_s.value, 'bad');
});

for (const [part, next] of [['h', 'm'], ['m', 's']])
    test(`colon from ${part} selects the existing ${next} content`, () => {
        const { form, document } = fixture();
        const target = form.elements[`tN_${next}`];
        target.value = '20';
        document.onkeydown({ target: form.elements[`tN_${part}`], key: ':', preventDefault() {} });
        assert.equal(form.focused, `tN_${next}`);
        assert.equal(target.value, '20');
        assert.equal(target.selectionStart, 0);
        assert.equal(target.selectionEnd, 2);
    });

for (const part of ['h', 'm', 's'])
    test(`blur pads valid ${part} independently of invalid siblings`, () => {
        const { form, document, set } = fixture();
        set('tN', ['bad', '60', '75']);
        const target = form.elements[`tN_${part}`];
        target.value = '4';
        document.listeners.focusout({ target });
        assert.equal(target.value, '04');
        for (const other of ['h', 'm', 's'].filter(value => value != part))
            assert.equal(form.elements[`tN_${other}`].value, { h: 'bad', m: '60', s: '75' }[other]);
    });

for (const [part, value] of [['h', '277778'], ['m', '60'], ['s', '75'], ['h', '-1'], ['m', '1.5'], ['s', 'bad'], ['h', '']])
    test(`blur preserves invalid or empty ${part}=${value}`, () => {
        const { form, document } = fixture();
        const target = form.elements[`tN_${part}`];
        target.value = value;
        document.listeners.focusout({ target });
        assert.equal(target.value, value);
    });
