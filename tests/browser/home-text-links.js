/* global getComputedStyle */

/** Home's text links underline their label on hover, never the arrow or the button surface. Pass this to the browser runner. */
export default async function checkHomeTextLinks(page) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    await page.emulateMedia({ forcedColors: 'none' });
    for (const theme of ['nebula', 'porcelain']) {
        await page.evaluate(`profile.wishlists = [{ id: 'w', name: 'Goals', items: [] }]; ui.theme = '${theme}'; ui.tab = 'home'; render()`);
        for (const selector of ['.hwishes .htext', '.hstats .htext']) {
            const link = page.locator(selector);
            await link.hover();
            await page.waitForTimeout(300);
            const style = await link.evaluate(node => ({
                background: getComputedStyle(node).backgroundColor,
                button: getComputedStyle(node).textDecorationLine,
                label: getComputedStyle(node.querySelector('.htext-label')).textDecorationLine,
                arrow: getComputedStyle(node.querySelector('[aria-hidden]')).textDecorationLine
            }));
            check(style.background == 'rgba(0, 0, 0, 0)', `${theme} ${selector}: hover paints a background`);
            check(style.label == 'underline', `${theme} ${selector}: hover does not underline the label`);
            check(style.button == 'none' && style.arrow == 'none', `${theme} ${selector}: hover underlines the arrow`);
            await page.mouse.move(0, 0);
        }
    }
}
