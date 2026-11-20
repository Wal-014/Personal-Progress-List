/**
 * Draws the whole app (shared shell and active screen).
 */

/** Selector that finds the same control again after the page is rebuilt, or null when there is none. */
function controlSelector(el) {
    if (!el || !qs('#app').contains(el))
        return null;
    if (el.id)
        return '#' + CSS.escape(el.id);
    const attrs = ['data-act', 'data-id', 'data-v', 'data-wp', 'popovertarget', 'name'].filter(a => el.hasAttribute(a));
    return attrs.length ? el.tagName.toLowerCase() + attrs.map(a => `[${a}="${CSS.escape(el.getAttribute(a))}"]`).join('') : null;
}

/** Preserves list scroll when redrawing the same screen. */
function render() {
    const focused = controlSelector(document.activeElement);
    const listScrollTop = ui.renderedTab == ui.tab ? qs('#lw')?.scrollTop : 0, isLevelList = isListTab();
    const contentSelector = ui.tab == 'wish' && ui.wl ? '.legacy-surface > .wl' : '.legacy-surface';
    const contentScroll = ui.renderedTab == ui.tab && (ui.tab == 'stats' || (ui.tab == 'wish' && ui.renderedWishlist == ui.wl))
        ? qs(contentSelector)?.scrollTop : 0;
    ui.renderedWishlist = ui.wl;
    const changedMode = isLevelList && ['classic', 'platform'].includes(ui.renderedTab) && ui.renderedTab != ui.tab;
    ui.renderedTab = ui.tab;
    const screen = !canEdit() && !viewing.identity ? publicViewScreen() : ui.tab == 'wish' ? currentWishlist() ? wishView() : wishlistsIndex() : isLevelList ? `<div class=split><div class=lcol>${lcol()}</div><div class="rcol ${ui.sel ? 'has' : ''}">${panel()}</div></div>` : ui.tab == 'stats' ? stats() : home();
    qs('#app').innerHTML = sharedShell(screen);
    if (changedMode)
        qs('.list-surface')?.classList.add('mode-enter');
    syncDrawer();
    document.documentElement.dataset.theme = ui.theme;
    document.documentElement.dataset.bg = ui.background;
    document.documentElement.dataset.motif = ui.tab == 'classic' ? 'stars' : ui.tab == 'platform' ? 'moons' : 'mixed';
    document.documentElement.lang = ui.lang;
    if (listScrollTop && qs('#lw'))
        qs('#lw').scrollTop = listScrollTop;
    if (contentScroll && qs(contentSelector))
        qs(contentSelector).scrollTop = contentScroll;
    initSort();
    initWishlistSort();
    renderTagSuggestions();
    // Rebuilding #app drops keyboard focus to <body>; put it back on the same control when it still exists
    if (focused)
        qs(focused)?.focus({ preventScroll: true });
    accountRendered();
}
