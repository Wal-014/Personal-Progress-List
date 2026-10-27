/**
 * Editor shell: top bar, bottom toolbar (desktop), tab bar (phones) and the pause menu.
 */

/** Title of the current screen for the top bar. */
const screenTitle = () => ui.tab == 'wish' ? t('wish') : t(ui.tab);

/** Top bar: logo and title on Home, back arrow and title elsewhere; bell and pause always. */
function topBar() {
    const A = alerts().length, onHome = ui.tab == 'home' || ui.tab == 'wish' && !currentWishlist();
    const left = onHome
        ? `<span class=logo data-act=tab data-v=home role=button tabindex=0 aria-label="${t('home')}">${ICONS.app}</span><h1>Personal Ranked Progress</h1>`
        : `<button class="sq pri" data-act=tab data-v=home aria-label="${t('back2')}">${ICONS.back}</button><h1>${escapeHtml(screenTitle())}</h1>`;
    return `<header class=top>${left}<span class=sp></span><span id=syncst class=syncst role=status>${syncStatus()}</span><button class=sq data-act=bell aria-label="${t('bell')}${A ? ` (${A})` : ''}">${ICONS.bell}${A ? `<b class=bdg aria-hidden=true>${A}</b>` : ''}</button><button class=sq data-act=pause aria-label="${t('pause')}">${ICONS.pause}</button></header>`;
}

/** Top bar chip shown while the AREDL lists are being updated. */
const syncStatus = () => ui.sync ? `${ICONS.sync}<span>${t('syncing')}</span>` : '';

/** Last AREDL update, how many levels are on the list, and the manual update button. */
function aredlLine() {
    const last = +localStorage.gas, on = profile.levels.filter(l => l.ar?.s == 'r').length;
    return `${last ? `${t('aredlUpd')} ${timeAgo(last)}` : t('aredlNever')} · ${t('aredlOn').replace('{n}', on).replace('{t}', profile.levels.length)} <button class=xs-txt data-act=sync ${ui.sync ? 'disabled' : ''}>${t(ui.sync ? 'syncing' : 'syncNow')}</button>`;
}

/** Updates the sync chip and the pause menu line without redrawing the screen. */
function renderSyncStatus() {
    if (qs('#syncst'))
        qs('#syncst').innerHTML = syncStatus();
    if (qs('#aredl'))
        qs('#aredl').innerHTML = aredlLine();
}

/** Quick actions shown in the toolbar palette (and in the pause menu on phones). */
function paletteButtons() {
    const pal = (act, icon, label, extra = '') => `<button class=pal data-act=${act} ${extra}>${icon}<span class=pl>${label}</span></button>`;
    return pal('add', ICONS.add, t('palAdd')) + pal('wnew', ICONS.wish, t('palWish')) + pal('tags', ICONS.tag, t('tags')) + pal('exp', ICONS.exp, t('palExp'));
}

/** Bottom navigation: the editor toolbar on wide screens, a tab bar and an add button on phones. CSS shows one of them. The lists and statistics open from their Home cards. */
function navBars(isList) {
    const cur = ui.tab == 'home', home = (cls, label) => `<button class="${cls}${cur ? ' pri' : ''}" data-act=tab data-v=home${cur ? ' aria-current=page' : ''}>${label}</button>`;
    return `<nav class=toolbar aria-label="${t('nav')}">${home('mode', t('home'))}<div class=palette>${paletteButtons()}</div></nav>`
        + `<nav class=tabbar aria-label="${t('nav')}">${home('tab', `${ICONS.home}<span>${t('home')}</span>`)}<button class=tab data-act=pause>${ICONS.more}<span>${t('more')}</span></button></nav>`
        + (isList ? `<button class=fab data-act=add aria-label="${t('palAdd')}">${ICONS.plus}</button>` : '');
}

/** Pause menu: theme, language, import, legal links (and the quick actions on phones). */
function pauseUI() {
    const sw = k => `<button class="swatch sw-${k}" data-act=theme data-v=${k} aria-pressed=${ui.theme == k}><i></i>${t(k)}</button>`;
    const lang = ([k, n]) => `<button class="${ui.lang == k ? 'pri' : ''}" data-act=lang data-v=${k} aria-pressed=${ui.lang == k}>${FLAGS[k]}${n}</button>`;
    return `<div class="box sm pause"><h2>${t('pause')}</h2>
<h3>${t('theme')}</h3><div class=swatches>${THEMES.map(sw).join('')}</div>
<h3>${t('lang')}</h3><div class=lang>${[['es', 'Español'], ['en', 'English']].map(lang).join('')}</div>
<div class=mob><h3>${t('more')}</h3><div class=palette>${paletteButtons()}</div></div>
<h3>AREDL</h3><p id=aredl class=by>${aredlLine()}</p>
<p><button data-act=imp>${ICONS.imp} ${t('impP')}</button></p>
<nav class=legal>${['terms', 'privacy', 'credits'].map(k => `<a class=lk data-act=legal data-v=${k} role=button tabindex=0>${t(k)}</a>`).join(' · ')}</nav>
<p class=by>© ${new Date().getFullYear()} Retlaw · ${t('rights')} · v1.0.0</p>
<p class=dgb><button class=pri data-act=close>${t('resume')}</button></p></div>`;
}
