import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

function guardFixture(answer = false) {
    const prompts = [], focused = [];
    const form = { entries: [['name', 'Level'], ['attN', '5'], ['notes', '']], listeners: {}, addEventListener(name, handler) { this.listeners[name] = handler; }, contains: () => false };
    const root = { querySelector: selector => selector == '#fm' ? form : null };
    const f = loadScripts(['js/i18n.js', 'js/components/level-form-guard.js'], {
        ui: { lang: 'en' }, document: { activeElement: null },
        FormData: class extends URLSearchParams { constructor(source) { super(source.entries); } },
        showDialog: async options => { prompts.push(options); return answer; }
    });
    const set = (name, value) => form.entries.find(entry => entry[0] == name)[1] = value;
    return { ...f, form, root, prompts, focused, set };
}

test('a level form is unchanged until a value differs from when it was drawn, ignoring the search filters', () => {
    const f = guardFixture();
    assert.equal(f.app('levelFormChanged')(f.root), false);
    f.app('rememberLevelForm')(f.root);
    f.form.entries.push(['gddiff', 'Hard'], ['gdrate', 'epic']);
    assert.equal(f.app('levelFormChanged')(f.root), false);
    f.set('notes', 'typed');
    assert.equal(f.app('levelFormChanged')(f.root), true);
    f.set('notes', '');
    assert.equal(f.app('levelFormChanged')(f.root), false);
    f.form.entries.push(['tg', 'New tag']);
    assert.equal(f.app('levelFormChanged')(f.root), true);
});

test('a form is remembered once, so a later redraw check keeps the original values', () => {
    const f = guardFixture();
    f.app('rememberLevelForm')(f.root);
    f.set('attN', '0');
    f.app('rememberLevelForm')(f.root);
    assert.equal(f.app('levelFormChanged')(f.root), true);
    assert.equal(f.app('levelFormChanged')({ querySelector: () => null }), false);
});

test('closing an unchanged form needs no question; a changed one asks once and keeps the form when the user keeps editing', async () => {
    const f = guardFixture(false);
    f.app('rememberLevelForm')(f.root);
    assert.equal(await f.app('confirmLevelFormExit')(f.root), true);
    assert.equal(f.prompts.length, 0);
    f.set('attN', '6');
    const field = { focus: () => f.focused.push('attN') };
    f.form.listeners.focusin({ target: field });
    const answers = await Promise.all([f.app('confirmLevelFormExit')(f.root), f.app('confirmLevelFormExit')(f.root)]);
    assert.deepEqual([...answers], [false, false]);
    assert.equal(f.prompts.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(f.prompts[0])), { title: 'Discard changes?', msg: 'Your unsaved changes to this level will be lost.', ok: 'Discard changes', cancel: 'Keep editing', danger: 1 });
    assert.equal(f.focused[0], 'attN');
    await f.app('confirmLevelFormExit')(f.root);
    assert.equal(f.prompts.length, 2);
});

test('discarding resolves true without moving focus', async () => {
    const f = guardFixture(true);
    f.app('rememberLevelForm')(f.root);
    f.set('name', 'Other');
    f.form.listeners.focusin({ target: { focus: () => f.focused.push('name') } });
    assert.equal(await f.app('confirmLevelFormExit')(f.root), true);
    assert.deepEqual(f.focused, []);
});
