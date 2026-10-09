/**
 * Dibuja la aplicación completa (cabecera, menú lateral, pantalla activa y pie de página).
 */

/** Dibuja toda la interfaz. Conserva el scroll de la lista cuando se redibuja la misma pantalla. */
function render() {
    const A = alerts().length, sy = ui._t == ui.tab ? qs('#lw')?.scrollTop : 0, isL = ['classic', 'platform'].includes(ui.tab), optionList = (a, v) => a.map(x => `<option value="${x}" ${x == v ? 'selected' : ''}>${x}</option>`).join(''), back = ti => `<div class=bar><button data-act=home class=ic>${ICONS.back} ${t('back2')}</button><h2>${ti}</h2></div>`;
    ui._t = ui.tab;
    qs('#app').innerHTML = `<header><button data-act=menu>☰</button><h1 data-act=home style="cursor:pointer">◆ Personal Ranked Progress <small class=by>· ${escapeHtml(store.profs[store.cur].name)}</small></h1><button data-act=bell class=ic title="${t('bell')}">${ICONS.bell}${A ? `<b class=bdg>${A}</b>` : ''}</button></header>
<div class="dr ${ui.menu ? 'open' : ''}"><div class=bk data-act=menu></div><aside><h3>${t('opt')}</h3><select id=th>${optionList(['dark', 'light', 'synth'], ui.theme)}</select><div class=lang>${[['es', 'Español'], ['en', 'English']].map(([k, n]) => `<button data-act=lang data-v=${k} class="${ui.lang == k ? 'on' : ''}">${FLAGS[k]}${n}</button>`).join('')}</div><button data-act=tags>🏷 Tags</button><button data-act=sync>⟳ ${t('syncL')}</button><small class=by style="margin-top:auto">Personal Ranked Progress · v1.0.0</small></aside></div><main class="${isL ? 'wide' : ''}">${ui.tab == 'wish' && currentWishlist() ? wishView() : isL ? back(t(ui.tab)) + `<div class=split><div class=lcol>${lcol()}</div><div class="rcol ${ui.sel ? 'has' : ''}">${panel()}</div></div>` : ui.tab == 'stats' ? back(t('stats')) + stats() : home()}</main>${footer()}`;
    document.documentElement.dataset.t = ui.theme;
    document.documentElement.lang = ui.lang;
    if (sy && qs('#lw'))
        qs('#lw').scrollTop = sy;
    initSort();
    renderTagSuggestions();
}
