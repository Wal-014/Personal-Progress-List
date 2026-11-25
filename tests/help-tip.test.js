import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadScripts } from './load-scripts.js';

function helpFixture({ width = 400, height = 600, anchor = { left: 20, top: 100, bottom: 120 } } = {}) {
    const popover = {
        id: 'help-enj', offsetWidth: 200, offsetHeight: 80, dataset: {}, open: false, props: {},
        matches(selector) { return selector == ':popover-open' ? this.open : selector == '.help-pop'; },
        showPopover() { this.open = true; }, hidePopover() { this.open = false; },
        style: { setProperty(name, value) { popover.props[name] = value; } }
    };
    const button = {
        getAttribute: () => 'help-enj', getBoundingClientRect: () => anchor,
        closest: selector => selector == '.help-tip' ? button : null, contains: node => node === button
    };
    const f = loadScripts(['js/utils.js', 'js/i18n.js', 'js/components/help-tip.js'], {
        ui: { lang: 'en' }, innerWidth: width, innerHeight: height,
        document: { getElementById: () => popover, querySelector: () => button }
    });
    return { ...f, popover, button };
}

test('help tips render a named button that controls an escaped popover explanation', () => {
    const f = helpFixture();
    const html = f.app('helpTip')('enj', 'Enjoyment');
    assert.match(html, /^<button type=button class=help-tip popovertarget=help-enj aria-label="Help: Enjoyment">\?<\/button>/);
    assert.match(html, /<span id=help-enj class=help-pop popover role=tooltip>How much you enjoyed playing the level throughout the time it took you to complete it\.<\/span>$/);
    f.app("ui.lang = 'es'");
    assert.match(f.app('helpTip')('lik', 'Valoración "x"'), /aria-label="Ayuda: Valoración &quot;x&quot;"/);
});

test('every help key used by the level form has Spanish and English text', () => {
    const f = helpFixture();
    const keys = ['gdS', 'filters', 's1', 's2', 's3', 's4', 's5', 's6', 'pos', 'ap', 'gdl', 'attN', 'attC', 'tN', 'tP', 'tPC', 'enj', 'lik', 'tags', 'notes', 'deaths'];
    for (const lang of ['es', 'en']) {
        f.app(`ui.lang = '${lang}'`);
        for (const key of keys) {
            const text = f.app('t')('help_' + key);
            assert.notEqual(text, 'help_' + key, `${lang} help_${key}`);
            assert.ok(text.length < 240, `${lang} help_${key} is short`);
        }
    }
});

test('an explanation opens below its button and moves above or inward when it would leave the viewport', () => {
    let f = helpFixture();
    f.app('positionHelp')(f.popover);
    assert.deepEqual({ ...f.popover.props }, { '--help-left': '20px', '--help-top': '126px' });
    f = helpFixture({ width: 300, anchor: { left: 260, top: 550, bottom: 570 } });
    f.app('positionHelp')(f.popover);
    assert.deepEqual({ ...f.popover.props }, { '--help-left': '92px', '--help-top': '464px' });
});

test('a mouse hover opens and closes an explanation unless a click pinned it; touch and pen use the click only', () => {
    const f = helpFixture();
    const pointer = (type, pointerType = 'mouse', relatedTarget = null) => f.app('hoverHelp')({ type, pointerType, relatedTarget, target: f.button });
    pointer('pointerover', 'touch');
    assert.equal(f.popover.open, false);
    pointer('pointerover');
    assert.equal(f.popover.open, true);
    pointer('pointerout', 'mouse', f.button);
    assert.equal(f.popover.open, true);
    pointer('pointerout');
    assert.equal(f.popover.open, false);
    pointer('pointerover');
    let prevented = false;
    f.app('pinHelp')({ target: f.button, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    pointer('pointerout');
    assert.equal(f.popover.open, true);
    prevented = false;
    f.app('pinHelp')({ target: f.button, preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
});
