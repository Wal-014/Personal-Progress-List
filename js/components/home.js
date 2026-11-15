/** Home content uses the same ranked lists, wishlist progress and totals as the detail screens. */

function homeListCard(kind) {
    const levels = profile.levels.filter(level => level.kind == kind);
    const attempts = levels.reduce((sum, level) => sum + (totalAttempts(level) || 0), 0);
    const lead = findLevel(rankedIds(kind)[0]), url = lead ? thumbUrl(lead) : '';
    return `<div class="hcard hcard-${kind}" data-act=tab data-v=${kind} role=button tabindex=0${url ? ` style="--th:url('${url}')"` : ''}>
<div class=hcard-top>${lead ? `<span class=hbadge>#1</span><span class=hlead>${escapeHtml(lead.name)}</span>${difficultyFace(lead)}` : `<span class=hlead>${t(levels.length ? 'unplaced' : 'listEmpty')}</span>`}</div>
<div class=hcard-body>${url ? '' : `<span class=hghost aria-hidden=true>${ICONS[kind]}</span>`}<div class=hcard-copy><h3>${t(kind)}</h3><div class=hcard-rule></div><p>${ICONS.levels}<span>${levels.length.toLocaleString(ui.lang)} ${t('lv')}${attempts > 0 ? ` · ${attempts.toLocaleString(ui.lang)} ${t('att')}` : ''}</span></p></div></div></div>`;
}

function homeWishlists() {
    const wishes = orderedWishlists(), shown = wishes.slice(0, 3);
    return `<section class=hwishes><div class=hsection-head><h2>${t('wish')}</h2><button class=htext data-act=tab data-v=wish>${t('viewWishlists')}${wishes.length > shown.length ? ` (${wishes.length.toLocaleString(ui.lang)})` : ''}<span aria-hidden=true>›</span></button></div>
<div class=hwish-rows>${shown.map(wishlistTrigger).join('')}${wishes.length ? '' : `<p class=by>${t('noWL')}</p>`}${canEdit() && wishes.length < 3 ? wishlistSlot() : ''}</div></section>`;
}

function homeStats() {
    const summary = statsSummary();
    const metric = (icon, value, key) => `<div class=hmetric>${icon}<div><b>${value.toLocaleString(ui.lang)}</b><span>${t(key)}</span></div></div>`;
    return `<section class=hstats><div class=hsection-head><h2>${ICONS.stats}${t('stats')}</h2></div><div class=hstats-surface>${metric(ICONS.levels, summary.levelCount, 'lv')}${metric(ICONS.retry, summary.attemptTotal, 'attT')}${metric(ICONS.sync, summary.playHours, 'hrs')}<button class=htext data-act=tab data-v=stats>${t('viewStats')}<span aria-hidden=true>→</span></button></div></section>`;
}

function home() {
    return `${canEdit() ? '' : publicIdentityCard()}<div class=hcontent><section class=hlists><div class=hsection-head><h2>${t(canEdit() ? 'lists' : 'publicLists')}</h2>${canEdit() ? `<button class=hadd data-act=add><span aria-hidden=true>+</span>${t('palAdd')}</button>` : ''}</div><div class=hcards>${homeListCard('classic')}${homeListCard('platform')}</div></section><div class=hpreviews>${homeWishlists()}${homeStats()}</div></div>`;
}

function profileSwitcher() {
    if (!canEdit())
        return publicIdentityCard();
    const localButton = `<button data-act=localdata>${t('localData')}</button>`;
    if (account.status == 'signed-in') {
        const own = account.profile;
        return `<div class="psw cloud-account"><button class="obj pbtn" popovertarget=amenu>${cubeIcon(own.color, own.secondary_color)}<span class=info><span class=nm>${escapeHtml(own.display_name)}</span>${own.username ? `<span class=by>@${escapeHtml(own.username)}</span>` : ''}<span class=by data-cloud-status>${escapeHtml(cloudStatusSentence())}</span></span></button>${accountMenu()}<span data-cloud-retry>${cloudRetryButton()}</span>${Object.values(store.profs).some(hasRealLocalData) ? localButton : ''}</div>`;
    }
    return `<div class=guest-account><div class=guest-row><div class="obj pbtn">${localProfileSummary(store.cur, false)}</div><button class=pri data-act=asignin>${t('accountSignIn')}</button>${localButton}</div><p class=by>${t('localGuestHint')}</p></div>`;
}
