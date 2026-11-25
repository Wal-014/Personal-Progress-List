/* global getComputedStyle */

/** Home's text links get link feedback on hover, never the button surface. Pass this to the browser runner. */
export default async function checkHomeTextLinks(page) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    await page.emulateMedia({ forcedColors: 'none' });
    for (const theme of ['nebula', 'porcelain']) {
        await page.evaluate(`profile.wishlists = [{ id: 'w', name: 'Goals', items: [] }]; ui.theme = '${theme}'; ui.tab = 'home'; render()`);
        for (const selector of ['.hwishes .htext', '.hstats .htext']) {
            const link = page.locator(selector);
            await link.hover();
            await page.waitForTimeout(300);
            const style = await link.evaluate(node => {
                const { backgroundColor, textDecorationLine } = getComputedStyle(node);
                return { backgroundColor, textDecorationLine };
            });
            check(style.backgroundColor == 'rgba(0, 0, 0, 0)', `${theme} ${selector}: hover paints a background`);
            check(style.textDecorationLine == 'underline', `${theme} ${selector}: hover has no underline`);
            await page.mouse.move(0, 0);
        }
    }
}
