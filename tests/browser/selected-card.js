/* global document, getComputedStyle, innerWidth */

/** A selected top-rank card shows the selection colour on its whole left edge, and the rank glow has room inside the list. */
export default async function checkSelectedCard(page) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    for (const [width, theme] of [[1280, 'nebula'], [1280, 'porcelain'], [390, 'crimson']]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(`profile = emptyProfile();
            profile.levels = Array.from({ length: 6 }, (_, i) => ({ id: 'l' + i, name: 'Level ' + i, kind: 'classic' }));
            profile.order.classic = profile.levels.map(level => level.id);
            ui.theme = '${theme}'; ui.tab = 'classic'; ui.sel = ${width > 900 ? "'l0'" : 'null'}; ui.edit = 0; render()`);
        const state = await page.evaluate(() => {
            const list = document.querySelector('#lw'), card = document.querySelector('.lv.rank-1'), style = getComputedStyle(card);
            const glow = parseFloat(style.boxShadow.match(/(\d+(?:\.\d+)?)px 0px$/)?.[1] || 0);
            return {
                selected: card.classList.contains('sel'), left: style.borderLeftColor, top: style.borderTopColor,
                accent: getComputedStyle(card, '::before').backgroundImage, glow,
                room: card.getBoundingClientRect().top - list.getBoundingClientRect().top - parseFloat(getComputedStyle(list).borderTopWidth),
                overflow: document.documentElement.scrollWidth > innerWidth
            };
        });
        const label = `${theme} at ${width}`;
        check(!state.overflow, `${label}: page overflows`);
        check(state.room >= state.glow, `${label}: the first card's glow (${state.glow}px) is clipped (${state.room}px of room)`);
        if (state.selected) {
            check(state.left != state.top, `${label}: the rank colour shows on the selected card's left edge`);
            check(state.accent.includes('gradient'), `${label}: the selection bar is missing`);
        }
    }
}
