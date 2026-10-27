/**
 * Draws the whole app (top bar, active screen and navigation).
 */

/** Selector that finds the same control again after the page is rebuilt, or null when there is none. */
function controlSelector(el) {
    if (!el || !qs('#app').contains(el))
        return null;
    if (el.id)
        return '#' + CSS.escape(el.id);
    const attrs = ['data-act', 'data-id', 'data-v', 'data-wi', 'name'].filter(a => el.hasAttribute(a));
    return attrs.length ? el.tagName.toLowerCase() + attrs.map(a => `[${a}="${CSS.escape(el.getAttribute(a))}"]`).join('') : null;
}

/** Preserves list scroll when redrawing the same screen. */
function render() {
    const focused = controlSelector(document.activeElement);
    const listScrollTop = ui._t == ui.tab ? qs('#lw')?.scrollTop : 0, isLevelList = isListTab();
    ui._t = ui.tab;
    const screen = ui.tab == 'wish' && currentWishlist() ? wishView() : isLevelList ? `<div class=split><div class=lcol>${lcol()}</div><div class="rcol ${ui.sel ? 'has' : ''}">${panel()}</div></div>` : ui.tab == 'stats' ? stats() : home();
    qs('#app').innerHTML = `${topBar()}<main class="${isLevelList ? 'wide' : ''}">${screen}</main>${navBars(isLevelList)}`;
    document.documentElement.dataset.t = ui.theme;
    document.documentElement.lang = ui.lang;
    if (listScrollTop && qs('#lw'))
        qs('#lw').scrollTop = listScrollTop;
    initSort();
    renderTagSuggestions();
    // Rebuilding #app drops keyboard focus to <body>; put it back on the same control when it still exists
    if (focused)
        qs(focused)?.focus({ preventScroll: true });
}
