/* global document, getComputedStyle, innerHeight */

/** The level search filters open over the form: nothing below them moves and the menu stays visible. Pass this to the browser runner. */
export default async function checkSearchFilters(page) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const layout = scope => page.evaluate(selector => {
        const root = document.querySelector(selector);
        const search = root.querySelector('.gdf').closest('fieldset');
        const below = [...root.querySelectorAll('fieldset, .level-action-bar')].filter(node => node !== search && !search.contains(node));
        return { tops: below.map(node => Math.round(node.getBoundingClientRect().top)), height: root.scrollHeight };
    }, scope);
    const menu = (scope, filter) => page.evaluate(([selector, name]) => {
        const disclosure = document.querySelector(`${selector} .gdf .ms[data-filter=${name}]`);
        const panel = disclosure.querySelector('.msp'), box = panel.getBoundingClientRect();
        const clip = disclosure.closest('dialog .box')?.getBoundingClientRect().bottom ?? innerHeight;
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + Math.min(box.height, 60) / 2);
        return { open: disclosure.open, position: getComputedStyle(panel).position, bottom: box.bottom, clip: Math.min(clip, innerHeight),
            onTop: panel.contains(hit), scrolls: panel.scrollHeight <= panel.clientHeight || getComputedStyle(panel).overflowY == 'auto' };
    }, [scope, filter]);
    const verify = async (scope, label) => {
        await page.locator(`${scope} .gdf`).waitFor();
        await page.locator(`${scope} .gdseg [data-v=rated]`).click();
        const before = await layout(scope);
        for (const filter of ['rates', 'diffs']) {
            await page.locator(`${scope} .ms[data-filter=${filter}] > summary`).click();
            await page.waitForTimeout(250);
            const opened = await menu(scope, filter), after = await layout(scope);
            check(opened.open && opened.position == 'absolute', `${label} ${filter}: the menu is not a floating panel`);
            check(JSON.stringify(after) == JSON.stringify(before), `${label} ${filter}: the form moved from ${JSON.stringify(before)} to ${JSON.stringify(after)}`);
            check(opened.onTop, `${label} ${filter}: the menu is covered`);
            check(opened.bottom <= opened.clip + 0.5 && opened.scrolls, `${label} ${filter}: the menu ends at ${opened.bottom}, past ${opened.clip}`);
        }
        const other = page.locator(`${scope} .ms[data-filter=rates]`);
        check(!await other.evaluate(node => node.open), `${label}: opening Difficulty left Rate type open`);
        await page.keyboard.press('Escape');
        check(!await page.locator(`${scope} .ms[data-filter=diffs]`).evaluate(node => node.open), `${label}: Escape left the menu open`);
    };
    for (const theme of ['nebula', 'porcelain']) {
        for (const [width, height] of [[390, 844], [768, 1024], [1366, 600], [1440, 900]]) {
            const label = `${theme} ${width}x${height}`;
            await page.setViewportSize({ width, height });
            await page.evaluate(`document.querySelector('dialog[open]')?.close(); ui.theme = '${theme}'; ui.tab = 'home'; ui.sel = null; ui.edit = 0; render()`);
            await page.locator('.hlists .hadd').click();
            await verify('.modal', `${label} Add`);
            await page.evaluate(`document.querySelector('dialog[open]')?.close(); ui.tab = 'classic'; ui.sel = profile.levels.find(level => level.kind == 'classic').id; ui.edit = 1; render()`);
            await verify('.rcol', `${label} Edit`);
        }
    }
}
