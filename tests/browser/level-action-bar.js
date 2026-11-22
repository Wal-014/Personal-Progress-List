/* global document, getComputedStyle */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function demoProfile() {
    const context = { window: {} };
    vm.runInNewContext(readFileSync(new URL('../fixtures/demo-profile.js', import.meta.url), 'utf8'), context);
    return context.window.DEMO_PROFILE;
}

/** Run on the app; it stores the demo fixture as the local profile, since first visits start empty. */
export default async function checkLevelActionBar(page) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    await page.evaluate(data => { localStorage.gdp = JSON.stringify({ cur: 'p1', profs: { p1: { name: 'Demo', data } } }); }, demoProfile());

    const checkPanel = async (selector, actions, label) => {
        const pane = page.locator(selector);
        const bar = pane.locator('.level-action-bar');
        const buttons = await bar.locator('button').evaluateAll(nodes =>
            nodes.map(node => ({ action: node.dataset.act || node.type, height: node.getBoundingClientRect().height })));
        check(buttons.map(button => button.action).join(' ') === actions, label + ': action order');
        check(buttons.every(button => button.height >= 44), label + ': button hit areas');

        for (const fraction of [0.5, 1]) {
            const state = await pane.evaluate((node, fraction) => {
                const bar = node.querySelector('.level-action-bar');
                const max = node.scrollHeight - node.clientHeight;
                node.scrollTop = max * fraction;
                const { top, bottom } = bar.getBoundingClientRect();
                const viewport = node.getBoundingClientRect();
                return {
                    max, offset: node.scrollTop, top, bottom, viewportTop: viewport.top, viewportBottom: viewport.bottom,
                    lastContentBottom: bar.previousElementSibling.getBoundingClientRect().bottom,
                    padding: parseFloat(getComputedStyle(node).scrollPaddingBlockEnd)
                };
            }, fraction);
            check(state.max > 0 && Math.abs(state.offset - state.max * fraction) <= 1, label + ': panel scrolling');
            check(state.top >= state.viewportTop && state.bottom <= state.viewportBottom + 1 &&
                state.viewportBottom - state.bottom <= 24, label + ': actions stay at the bottom');
            check(state.padding >= state.bottom - state.top, label + ': scroll padding clears the actions');
            if (fraction === 1)
                check(state.lastContentBottom <= state.top, label + ': final content is reachable');
        }

        if (!actions.endsWith('submit')) return;

        await pane.evaluate(node => { node.scrollTop = 0; });
        await pane.locator('#gdq').focus();
        const stops = await pane.locator('#fm :is(button, input, select, textarea, summary)').count();
        for (let index = 0; index < stops; index++) {
            const focus = await pane.evaluate(node => {
                const bar = node.querySelector('.level-action-bar');
                const field = document.activeElement;
                const bounds = field.getBoundingClientRect();
                return {
                    name: field.id || field.dataset.act || field.tagName,
                    inBar: bar.contains(field),
                    visible: node.contains(field) && bounds.top >= node.getBoundingClientRect().top - 1 &&
                        bounds.bottom <= bar.getBoundingClientRect().top + 1
                };
            });
            if (focus.inBar) {
                check(focus.name === actions.split(' ')[0], label + ': first action in Tab order');
                return;
            }
            check(focus.visible, label + ': focused control is obscured (' + focus.name + ')');
            await page.keyboard.press('Tab');
        }
        throw new Error(label + ': Tab never reached the actions');
    };

    const results = [];
    for (const [width, height] of [[1440, 900], [1100, 800], [390, 844], [1280, 600]]) {
        await page.setViewportSize({ width, height });
        for (const kind of ['classic', 'platform']) {
            await page.reload();
            const label = width + 'x' + height + ' ' + kind;
            await page.locator('.hcard-' + kind).click();
            await page.locator('#lst .lv').first().click();
            await checkPanel('.list-surface .rcol', 'lvclose edit', label + ' detail');
            await page.locator('.rcol [data-act=edit]').click();
            await checkPanel('.list-surface .rcol', 'del lvclose submit', label + ' edit');
            await page.locator('.rcol [data-act=lvclose]').click();
            await page.locator('.rcol [data-act=lvclose]').click();
            await page.locator('.list-add').click();
            await checkPanel('dialog[open] .box', 'close submit', label + ' add');
            await page.locator('dialog[open] .level-action-bar [data-act=close]').click();
            results.push(label);
        }
    }
    return results;
}
