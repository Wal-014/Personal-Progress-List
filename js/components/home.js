/** Home content uses the same ranked lists, wishlist progress and totals as the detail screens. */

function homeListCard(kind) {
    const levels = profile.levels.filter(level => level.kind == kind);
    const attempts = levels.reduce((sum, level) => sum + (totalAttempts(level) || 0), 0);
    const lead = findLevel(rankedIds(kind)[0]), url = lead ? thumbUrl(lead) : '';
    return `<div class="hcard hcard-${kind}" data-act=tab data-v=${kind} role=button tabindex=0${url ? ` style="--th:url('${url}')"` : ''}>
<div class=hcard-top>${lead ? `<span class=hbadge>#1</span><span class=hlead>${escapeHtml(lead.name)}</span>${difficultyFace(lead)}` : `<span class=hlead>${t(levels.length ? 'unplaced' : 'listEmpty')}</span>`}</div>
<div class=hcard-body>${url ? '' : `<span class=hghost aria-hidden=true>${ICONS[kind]}</span>`}<div class=hcard-copy><h3>${t(kind)}</h3><div class=hcard-rule></div><p>${ICONS.metricLevels}<span>${levels.length.toLocaleString(ui.lang)} ${t('lv')}${attempts > 0 ? ` · ${attempts.toLocaleString(ui.lang)} ${t('att')}` : ''}</span></p></div></div></div>`;
}

function homeWishlists() {
    const wishes = orderedWishlists(), shown = wishes.slice(0, 3);
    return `<section class=hwishes><div class=hsection-head><h2>${ICONS.navWish}${t('wish')}</h2><button class=htext data-act=tab data-v=wish>${t('viewWishlists')}${wishes.length > shown.length ? ` (${wishes.length.toLocaleString(ui.lang)})` : ''}<span aria-hidden=true>›</span></button></div>
<div class=hwish-rows>${shown.map(wishlistTrigger).join('')}${wishes.length ? '' : `<p class=by>${t('noWL')}</p>`}${canEdit() && wishes.length < 3 ? wishlistSlot() : ''}</div></section>`;
}

function homeStats() {
    const summary = statsSummary();
    const metric = (icon, value, key) => `<div class=hmetric>${icon}<div><b>${value.toLocaleString(ui.lang)}</b><span>${t(key)}</span></div></div>`;
    return `<section class=hstats><div class=hsection-head><h2>${ICONS.navStats}${t('stats')}</h2></div><div class=hstats-surface>${metric(ICONS.metricLevels, summary.levelCount, 'lv')}${metric(ICONS.metricAttempts, summary.attemptTotal, 'attT')}${metric(ICONS.metricHours, summary.playHours, 'hrs')}<button class=htext data-act=tab data-v=stats>${t('viewStats')}<span aria-hidden=true>→</span></button></div></section>`;
}

function home() {
    return `<div class=hcontent><section class=hlists><div class=hsection-head><h2>${ICONS.navLists}${t(canEdit() ? 'lists' : 'publicLists')}</h2>${canEdit() ? `<button class=hadd data-act=add>${ICONS.actionAdd}${t('palAdd')}</button>` : ''}</div><div class=hcards>${homeListCard('classic')}${homeListCard('platform')}</div></section><div class=hpreviews>${homeWishlists()}${homeStats()}</div></div>`;
}

function profileSwitcher() {
    if (!canEdit())
        return viewing.identity ? publicIdentityCard() : '';
    const signedIn = account.status == 'signed-in' && account.profile, own = signedIn ? account.profile : store.profs[store.cur];
    const menuId = signedIn ? 'amenu' : 'pmenu';
    const pill = `<button id=profile-pill class=profile-pill popovertarget=${menuId}>${cubeIcon(own.color, signedIn ? own.secondary_color : own.secondaryColor)}<span>${escapeHtml(signedIn ? own.display_name : own.name)}</span>${ICONS.chevronDown}</button>`;
    if (signedIn)
        return pill + accountMenu();
    const row = (act, key, extra = '') => `<button class=pma data-act=${act} ${extra}>${t(key)}</button>`;
    const choices = Object.entries(store.profs).map(([id, p]) => `<div class=profile-choice><button class=pma data-act=localuse data-id="${escapeHtml(id)}"${id == store.cur ? ' aria-pressed=true' : ''}>${cubeIcon(p.color, p.secondaryColor)}<span>${escapeHtml(p.name)}</span></button><button class=pma data-act=localdelete data-id="${escapeHtml(id)}" aria-label="${t('localDelete')}: ${escapeHtml(p.name)}"${id == store.cur ? ' disabled' : ''}>${ICONS.del}</button></div>`).join('');
    return `${pill}<div id=pmenu class=pmenu popover>${choices}${row('pnew', 'newProfile')}${row('pedit', 'pedit')}${row('localbackup', 'localBackup', `data-id="${escapeHtml(store.cur)}"`)}${row('localimport', 'localImport')}${row('localdata', 'localData')}${row('asignin', account.status == 'loading' ? 'accountLoading' : 'accountSignIn', account.status == 'loading' ? 'disabled aria-busy=true' : '')}${row('tags', 'tagsT')}<p class=by>${t('localGuestHint')}</p></div>`;
}
