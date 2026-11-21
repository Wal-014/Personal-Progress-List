/**
 * Draws the whole app (shared shell and active screen).
 */

/** Selector that finds the same control again after the page is rebuilt, or null when there is none. */
function controlSelector(el) {
    if (!el || !qs('#app').contains(el))
        return null;
    if (el.id)
        return '#' + CSS.escape(el.id);
    if (el.closest?.('.lh .ms'))
        return '.lh .ms summary';
    const attrs = ['data-act', 'data-id', 'data-v', 'data-wp', 'popovertarget', 'name'].filter(a => el.hasAttribute(a));
    return attrs.length ? el.tagName.toLowerCase() + attrs.map(a => `[${a}="${CSS.escape(el.getAttribute(a))}"]`).join('') : null;
}

/** Preserves list scroll when redrawing the same screen. */
function render() {
    const active = document.activeElement;
    const focused = active?.closest?.('[popover]') ? overlayOpener(active).selector : controlSelector(active);
    const isLevelList = isListTab(), sameTab = ui.renderedTab == ui.tab;
    const oldList = sameTab ? qs('#lw') : null, oldPanel = sameTab ? qs('.rcol.has') : null;
    // The hidden mobile list reports a scroll position of zero while detail is open.
    const listScrollTop = oldList?.getClientRects().length ? oldList.scrollTop : sameTab ? ui.listReturnY : 0;
    ui.listReturnY = listScrollTop;
    if (isLevelList && !selectedListLevel()) {
        ui.sel = null;
        ui.edit = 0;
    }
    const detailScrollTop = oldPanel && oldPanel.dataset.level === String(ui.sel) && !oldPanel.querySelector('#fm') && !ui.edit ? oldPanel.scrollTop : 0;
    const contentSelector = ui.tab == 'wish' && ui.wl ? '.legacy-surface > .wl' : '.legacy-surface';
    const contentScroll = ui.renderedTab == ui.tab && (ui.tab == 'stats' || (ui.tab == 'wish' && ui.renderedWishlist == ui.wl))
        ? qs(contentSelector)?.scrollTop : 0;
    ui.renderedWishlist = ui.wl;
    const changedMode = isLevelList && ['classic', 'platform'].includes(ui.renderedTab) && ui.renderedTab != ui.tab;
    ui.renderedTab = ui.tab;
    const screen = !canEdit() && !viewing.identity ? publicViewScreen() : ui.tab == 'wish' ? currentWishlist() ? wishView() : wishlistsIndex() : isLevelList ? `<div class=split><div class=lcol>${lcol()}</div><div class="rcol ${ui.sel != null ? 'has' : ''}" data-level="${escapeHtml(ui.sel)}">${panel()}</div></div>` : ui.tab == 'stats' ? stats() : home();
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
    if (detailScrollTop && qs('.rcol.has'))
        qs('.rcol.has').scrollTop = detailScrollTop;
    if (contentScroll && qs(contentSelector))
        qs(contentSelector).scrollTop = contentScroll;
    initSort();
    initWishlistSort();
    renderTagSuggestions();
    // Rebuilding #app drops keyboard focus to <body>; put it back on the same control when it still exists
    if (focused)
        qs(focused)?.focus({ preventScroll: true });
    if (qs('[data-act=bell]'))
        syncNotificationCount(Number(qs('[data-act=bell] .bdg')?.textContent || 0));
    accountRendered();
}
