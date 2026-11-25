/** Home content uses the same ranked lists, wishlist progress and totals as the detail screens. */

function homeListCard(kind) {
    const levels = profile.levels.filter(level => level.kind == kind);
    const lead = findLevel(rankedIds(kind)[0]), url = lead ? thumbUrl(lead) : '';
    return `<div class="hcard hcard-${kind}" data-act=tab data-v=${kind} role=button tabindex=0${url ? ` data-th="${escapeHtml(url)}"` : ''}>
<div class=hcard-top>${lead ? `<span class=hbadge>#1</span><span class=hlead>${escapeHtml(lead.name)}</span>${difficultyFace(lead)}` : `<span class=hlead>${t(levels.length ? 'unplaced' : 'listEmpty')}</span>`}</div>
<div class=hcard-body><span class=hghost aria-hidden=true>${ICONS[kind]}</span>${url ? '<i class=hcover aria-hidden=true></i>' : ''}<div class=hcard-copy><h3>${t(kind)}</h3><div class=hcard-rule></div><p>${ICONS.metricLevels}<span>${levels.length.toLocaleString(ui.lang)} ${levelLabel(levels.length)}</span></p></div></div></div>`;
}

/** A text link to another screen; only its label is underlined on hover, never the arrow. */
const homeLink = (tab, label, arrow) => `<button class=htext data-act=tab data-v=${tab}><span class=htext-label>${label}</span><span aria-hidden=true>${arrow}</span></button>`;

function homeWishlists() {
    const wishes = orderedWishlists(), shown = wishes.slice(0, 3);
    return `<section class=hwishes><div class=hsection-head><h2>${ICONS.navWish}${t('wish')}</h2>${homeLink('wish', t('viewWishlists') + (wishes.length > shown.length ? ` (${wishes.length.toLocaleString(ui.lang)})` : ''), '›')}</div>
<div class=hwish-rows>${shown.map(wishlistTrigger).join('')}${wishes.length ? '' : `<p class=by>${t('noWL')}</p>`}${canEdit() && wishes.length < 3 ? wishlistSlot() : ''}</div></section>`;
}

function homeStats() {
    const summary = statsSummary();
    const metric = (icon, value, label) => `<div class=hmetric>${icon}<div><b>${value.toLocaleString(ui.lang)}</b><span>${label}</span></div></div>`;
    return `<section class=hstats><div class=hsection-head><h2>${ICONS.navStats}${t('stats')}</h2></div><div class=hstats-surface>${metric(ICONS.metricLevels, summary.levelCount, levelLabel(summary.levelCount))}${metric(ICONS.metricAttempts, summary.attemptTotal, t('attT'))}${metric(ICONS.metricHours, summary.playHours, t('hrs'))}${homeLink('stats', t('viewStats'), '→')}</div></section>`;
}

const introKey = () => cloudUser ? 'u:' + cloudUser : 'p:' + store.cur;

function introDismissals() {
    try {
        const saved = JSON.parse(localStorage.gintro || '[]');
        return Array.isArray(saved) ? saved : [];
    }
    catch {
        return [];
    }
}

/** A new, empty profile sees the guide until it is hidden or anything is recorded; an account waits for its first download first. */
const showsIntro = () => canEdit() && !profile.levels.length && !profile.wishlists.length
    && !(cloudUser && !cloudSession?.pulled) && !introDismissals().includes(introKey());

function hideIntro() {
    try {
        localStorage.gintro = JSON.stringify([...new Set([...introDismissals(), introKey()])]);
    }
    catch {
    }
    render();
    qs('.hadd')?.focus({ preventScroll: true });
}

/** What the app is for and how its parts fit together, shared by Home and the Quick guide in Settings. */
function introGuide() {
    const item = (icon, key) => `<li>${icon}<span>${t(key)}</span></li>`;
    return `<p>${t('introText')}</p><ul class=intro-points>${item(ICONS.navLists, 'introLists')}${item(ICONS.navWish, 'introWish')}${item(ICONS.navStats, 'introStats')}${item(ICONS.actionDevice, ACCOUNTS ? 'introSaveAccount' : 'introSaveLocal')}</ul>`;
}

function homeIntro() {
    return `<section class=hintro aria-labelledby=intro-title><div class=hintro-head><h2 id=intro-title>${t('introTitle')}</h2><button type=button class=xs data-act=introhide aria-label="${t('introHide')}" title="${t('introHide')}">${ICONS.listClear}</button></div>${introGuide()}<div class=hintro-actions><button type=button class=hadd data-act=add>${ICONS.actionAdd}${t('introAdd')}</button><button type=button data-act=wnew>${ICONS.navWish}${t('introWishlist')}</button></div></section>`;
}

const introDialog = () => `<div class="box sm hintro-dialog"><h2>${t('introTitle')}</h2>${introGuide()}<p class=dgb><button class=pri data-act=close>${t('close')}</button></p></div>`;

function home() {
    return `<div class=hcontent>${showsIntro() ? homeIntro() : ''}<section class=hlists><div class=hsection-head><h2>${ICONS.navLists}${t(canEdit() ? 'lists' : 'publicLists')}</h2>${canEdit() ? `<button class=hadd data-act=add>${ICONS.actionAdd}${t('palAdd')}</button>` : ''}</div><div class=hcards>${homeListCard('classic')}${homeListCard('platform')}</div></section><div class=hpreviews>${homeWishlists()}${homeStats()}</div></div>`;
}

function profileSwitcher() {
    if (!canEdit())
        return viewing.identity ? publicIdentityCard() : '';
    const signedIn = account.status == 'signed-in' && account.profile, own = signedIn ? account.profile : store.profs[store.cur];
    const menuId = signedIn ? 'amenu' : 'pmenu';
    const pill = `<button id=profile-pill class=profile-pill popovertarget=${menuId}>${signedIn ? profileCube(own.cube_id, own.color, own.secondary_color) : catalogCube(own.cubeId, own.color, own.secondaryColor)}<span>${escapeHtml(signedIn ? own.display_name : own.name)}</span>${ICONS.chevronDown}</button>`;
    if (signedIn)
        return pill + accountMenu();
    const row = (act, icon, key, extra = '') => `<button class=pma data-act=${act}${extra ? ` ${extra}` : ''}>${icon}<span>${t(key)}</span></button>`;
    const choices = Object.entries(store.profs).map(([id, p]) => `<div class=profile-choice><button class=pma data-act=localuse data-id="${escapeHtml(id)}"${id == store.cur ? ' aria-pressed=true autofocus' : ''}>${catalogCube(p.cubeId, p.color, p.secondaryColor)}<span>${escapeHtml(p.name)}</span></button></div>`).join('');
    return `${pill}<div id=pmenu class=pmenu popover role=group aria-labelledby=profile-pill>${choices}${row('pedit', ICONS.actionEdit, 'pedit')}${row('localbackup', ICONS.actionDownload, 'localBackup', `data-id="${escapeHtml(store.cur)}"`)}${row('localimport', ICONS.actionUpload, 'localImport')}${row('localdata', ICONS.actionDevice, 'localData')}${row('asignin', ICONS.actionSignIn, account.status == 'loading' ? 'accountLoading' : 'accountSignIn', account.status == 'loading' ? 'disabled aria-busy=true' : '')}<p class=by>${t('localGuestHint')}</p></div>`;
}
