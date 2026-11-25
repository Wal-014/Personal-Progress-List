/* global document */

/** The Statistics KPI cards carry content to their bottom edge, with no tall empty Levels card. Pass this to the browser runner. */
export default async function checkStatsKpis(page) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    for (const theme of ['nebula', 'porcelain']) {
        for (const lang of ['es', 'en']) {
            for (const [width, height] of [[390, 844], [768, 1024], [1440, 900], [1920, 1080]]) {
                const label = `${theme} ${lang} ${width}`;
                await page.setViewportSize({ width, height });
                await page.evaluate(`document.querySelector('dialog[open]')?.close(); ui.theme = '${theme}'; ui.lang = '${lang}'; ui.tab = 'stats'; render()`);
                const cards = await page.evaluate(() => [...document.querySelectorAll('.kpi')].map(card => {
                    const box = card.getBoundingClientRect();
                    return { height: box.height, empty: box.bottom - card.lastElementChild.getBoundingClientRect().bottom, overflow: card.scrollWidth > card.clientWidth };
                }));
                check(cards.length == 3, `${label}: expected three KPI cards`);
                for (const [index, card] of cards.entries()) {
                    check(card.empty < 24, `${label} card ${index + 1}: ${Math.round(card.empty)}px of empty space below its content`);
                    check(!card.overflow, `${label} card ${index + 1}: content overflows`);
                }
            }
        }
    }
}
