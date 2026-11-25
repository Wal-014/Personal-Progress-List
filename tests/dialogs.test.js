import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

function dialogApp() {
    const nodes = {};
    const body = { appendChild() {} };
    const appRoot = { contains: control => control?.inApp };
    const document = { body, activeElement: body, querySelector: selector => nodes[selector], querySelectorAll: () => [], addEventListener() {}, createElement: () => newDialog() };
    const control = (id, inApp = false) => ({
        id, inApp, isConnected: true, value: '', dataset: {}, attributes: {},
        focus() { if (this.isConnected) document.activeElement = this; },
        select() {},
        closest() { return null; },
        classList: { contains: () => false },
        getAttribute(key) { return this.attributes[key] ?? null; },
        setAttribute(key, value) { this.attributes[key] = value; },
        removeAttribute(key) { delete this.attributes[key]; },
        setCustomValidity(message) { this.validationMessage = message; },
        reportValidity() { this.focus(); return false; }
    });
    function newDialog() {
        const dialog = new EventTarget();
        const input = control('dgi'), cancel = control('cancel'), accept = control('accept'), error = control('dgi-error');
        Object.assign(dialog, {
            classList: { contains: name => dialog.className === name },
            closest() { return null; },
            input, error, cancel, accept, open: false, innerHTML: '',
            hasPointerCapture: () => false,
            setAttribute() {}, contains: element => [input, error, cancel, accept].includes(element),
            querySelector(selector) {
                if (selector === '#dgi') return this.innerHTML.includes('id=dgi') ? input : null;
                if (selector === '#dgi-error') return error;
                if (selector === '[data-r="0"]') return cancel;
                if (selector === '[data-r="1"]') return accept;
                return null;
            },
            showModal() { this.previousFocus = document.activeElement; this.open = true; accept.focus(); },
            close() {
                if (!this.open) return;
                this.open = false;
                this.previousFocus.focus();
                if (this.contains(document.activeElement)) document.activeElement = body;
                setImmediate(() => this.dispatchEvent(new Event('close')));
            },
            remove() { if (nodes['#md dialog'] === this) delete nodes['#md dialog']; }
        });
        accept.dataset.r = '1';
        cancel.dataset.r = '0';
        return (nodes.dialog = dialog);
    }
    nodes['#app'] = appRoot;
    nodes['#md'] = { set innerHTML(value) {
        if (value) nodes['#md dialog'] = Object.assign(newDialog(), { className: 'modal' });
        else delete nodes['#md dialog'];
    } };
    const replaceOpener = () => {
        if (nodes['#opener']) nodes['#opener'].isConnected = false;
        return (nodes['#opener'] = control('opener', true));
    };
    replaceOpener().focus();
    const env = loadScripts(['js/utils.js', 'js/components/dialogs.js', 'js/components/level-form-guard.js', 'js/render.js', 'js/components/help-tip.js', 'js/events.js'], {
        document, window: { addEventListener() {} }, CSS: { escape: String }, t: key => key, renderTagSuggestions() {}
    });
    const dispatchModalEvent = (type, target = nodes.dialog) => {
        const event = new Event(type, { bubbles: true });
        Object.defineProperty(event, 'target', { value: target });
        nodes.dialog.dispatchEvent(event);
        if (type === 'click') body.onclick(event);
    };
    return { ...env, document, nodes, replaceOpener, dispatchModalEvent };
}

const nextCloseEvent = () => new Promise(resolve => setImmediate(resolve));

test('showDialog returns focus to the rebuilt opener on close', async () => {
    const { app, nodes, document, replaceOpener } = dialogApp();
    const result = app('showDialog({ title: "Title" })');
    const replacement = replaceOpener();
    nodes.dialog.onclick({ stopPropagation() {}, target: nodes.dialog.accept });
    assert.equal(await result, true);
    await nextCloseEvent();
    assert.equal(document.activeElement, replacement);
});

test('openModal returns to the rebuilt opener after replacing dialog contents', async () => {
    const { app, document, replaceOpener } = dialogApp();
    app('openModal("<div>Settings</div>")');
    const replacement = replaceOpener();
    app('openModal("<div>Updated settings</div>"); closeModal()');
    await nextCloseEvent();
    assert.equal(document.activeElement, replacement);
});

test('openModal stays open when a press inside the box ends on the backdrop', () => {
    const { app, nodes, dispatchModalEvent } = dialogApp();
    app('openModal("<div>Settings</div>")');
    dispatchModalEvent('pointerdown', nodes.dialog.input);
    dispatchModalEvent('pointerup');
    dispatchModalEvent('click');
    assert.equal(nodes.dialog.open, true);
});

test('openModal stays open when a backdrop press ends inside the box', () => {
    const { app, nodes, dispatchModalEvent } = dialogApp();
    app('openModal("<div>Settings</div>")');
    dispatchModalEvent('pointerdown');
    dispatchModalEvent('pointerup', nodes.dialog.input);
    dispatchModalEvent('click');
    assert.equal(nodes.dialog.open, true);
});

test('openModal closes after a press and release on the backdrop', async () => {
    const { app, nodes, dispatchModalEvent } = dialogApp();
    app('openModal("<div>Settings</div>")');
    dispatchModalEvent('pointerdown');
    dispatchModalEvent('pointerup');
    dispatchModalEvent('click');
    await new Promise(setImmediate);
    assert.equal(nodes.dialog.open, false);
});

test('openModal stays open when a click targets the box', () => {
    const { app, nodes, dispatchModalEvent } = dialogApp();
    app('openModal("<div>Settings</div>")');
    dispatchModalEvent('pointerdown');
    dispatchModalEvent('pointerup');
    dispatchModalEvent('click', nodes.dialog.input);
    assert.equal(nodes.dialog.open, true);
});

test('openModal ignores a backdrop press interrupted by pointercancel', () => {
    const { app, nodes, dispatchModalEvent } = dialogApp();
    app('openModal("<div>Settings</div>")');
    dispatchModalEvent('pointerdown');
    dispatchModalEvent('pointercancel');
    dispatchModalEvent('pointerup');
    dispatchModalEvent('click');
    assert.equal(nodes.dialog.open, true);
});

test('openModal clears gesture state after every click', () => {
    const { app, nodes, dispatchModalEvent } = dialogApp();
    app('openModal("<div>Settings</div>")');
    dispatchModalEvent('pointerdown');
    dispatchModalEvent('pointerup');
    dispatchModalEvent('click', nodes.dialog.input);
    dispatchModalEvent('click');
    assert.equal(nodes.dialog.open, true);
});

test('a reopened modal starts with no backdrop gesture state', () => {
    const { app, nodes, dispatchModalEvent } = dialogApp();
    app('openModal("<div>Settings</div>")');
    dispatchModalEvent('pointerdown');
    dispatchModalEvent('pointerup');
    app('closeModal(); openModal("<div>Settings</div>")');
    dispatchModalEvent('click');
    assert.equal(nodes.dialog.open, true);
});

test('native Escape cancellation resolves a confirmation as false and a prompt as null', async () => {
    for (const [options, expected] of [['danger: 1', false], ['input: 1', null]]) {
        const { app, nodes } = dialogApp();
        const result = app(`showDialog({ title: "Title", ${options} })`);
        const event = new Event('cancel', { cancelable: true });
        if (nodes.dialog.dispatchEvent(event)) nodes.dialog.close();
        assert.equal(await Promise.race([result, nextCloseEvent()]), expected);
        assert.equal(nodes.dialog.open, false);
    }
});

test('blank prompts keep the dialog open and clear their adjacent error when corrected', async () => {
    const { app, nodes } = dialogApp();
    const result = app('askText("Name", "")');
    const { input, error, accept } = nodes.dialog;
    const submit = () => nodes.dialog.onclick({ stopPropagation() {}, target: accept });
    input.value = '   ';
    submit();
    assert.equal(nodes.dialog.open, true);
    assert.equal(error.textContent, 'errName');
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    input.value = ' Player ';
    input.oninput();
    assert.equal(error.textContent, '');
    assert.equal(input.getAttribute('aria-invalid'), null);
    submit();
    assert.equal(await result, 'Player');
});

test('typed destructive prompts focus Cancel and keep incorrect text available for correction', async () => {
    const { app, document, nodes } = dialogApp();
    app('showDialog({ title: "Delete", input: 1, danger: 1, validate: value => value === "owner" ? "" : "Mismatch" })');
    const { input, error, cancel, accept } = nodes.dialog;
    assert.equal(document.activeElement, cancel);
    input.value = 'wrong';
    nodes.dialog.onclick({ stopPropagation() {}, target: accept });
    assert.equal(nodes.dialog.open, true);
    assert.equal(input.value, 'wrong');
    assert.equal(error.textContent, 'Mismatch');
});

for (const [label, dismiss] of [['backdrop', f => { f.dispatchModalEvent('pointerdown'); f.dispatchModalEvent('pointerup'); f.dispatchModalEvent('click'); }], ['Escape', f => f.dispatchModalEvent('cancel')], ['Close', f => f.app('ACTIONS.close()')]])
    test(`${label} asks before closing a modal whose level form changed, and closes once when the user discards`, async () => {
        const f = dialogApp(), asked = [];
        f.app('openModal("<form id=fm></form>")');
        f.context.answer = false;
        f.app('confirmLevelFormExit = root => { asked.push(root); return Promise.resolve(answer); }');
        f.context.asked = asked;
        dismiss(f);
        await new Promise(setImmediate);
        assert.equal(f.nodes.dialog.open, true);
        assert.equal(asked[0], f.nodes['#md dialog']);
        f.context.answer = true;
        dismiss(f);
        dismiss(f);
        await new Promise(setImmediate);
        assert.equal(f.nodes.dialog.open, false);
    });

test('saving closes the level form directly, without the unsaved-changes question', () => {
    const f = dialogApp();
    f.app('openModal("<form id=fm></form>")');
    f.app('confirmLevelFormExit = () => { throw new Error("asked"); }');
    f.app('closeModal()');
    assert.equal(f.nodes.dialog.open, false);
});
