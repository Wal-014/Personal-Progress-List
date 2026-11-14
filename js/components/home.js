/**
 * Home screen: the account card, the profile's lists as blocks and wishlists as triggers.
 */

/** Chart line drawn on the statistics block; the list blocks show their #1 level's thumbnail instead. */
const STATS_ART = '<svg class=art width=90 height=46 viewBox="0 0 90 46" aria-hidden=true><polyline points="2,40 20,26 36,32 54,10 70,20 88,4" fill=none stroke="#000" stroke-width=7 stroke-linejoin=round /><polyline points="2,40 20,26 36,32 54,10 70,20 88,4" fill=none stroke="#3cff6c" stroke-width=3 stroke-linejoin=round /></svg>';

function home() {
    const block = (k, sub) => {
        const lead = k == 'stats' ? null : findLevel(rankedIds(k)[0]), u = lead ? thumbUrl(lead) : '';
        return `<div class="block b-${k}" data-act=tab data-v=${k} role=button tabindex=0${u ? ` style="--th:url('${u}')"` : ''}>${lead ? `<span class=lead>#1 ${escapeHtml(lead.name)}</span>` : ''}${k == 'stats' ? STATS_ART : ''}<h3>${t(k)}</h3><small>${sub}</small></div>`;
    };
    const listSub = k => {
        const levels = profile.levels.filter(l => l.kind == k), attempts = levels.reduce((s, l) => s + (totalAttempts(l) || 0), 0);
        return `${levels.length} ${t('lv')}${attempts ? ` · ${attempts.toLocaleString(ui.lang)} ${t('att')}` : ''}`;
    };
    const order = { prog: 0, todo: 1, done: 2 };
    const wishes = [...profile.wishlists].sort((a, b) => order[wishlistProgress(a).s] - order[wishlistProgress(b).s]).map(w => {
        const p = wishlistProgress(w);
        return `<div class="obj trig" data-act=wopen data-id="${escapeHtml(w.id)}" role=button tabindex=0><span class="tg s-${p.s}">${ICONS.wish}</span><div class=info><span class=nm>${escapeHtml(w.name)}</span>${progressBar(w)}<span class=by>${p.d} / ${p.n} · ${t('st_' + p.s)}</span></div></div>`;
    }).join('');
    return `${profileSwitcher()}<h2 class=sec>${t(canEdit() ? 'lists' : 'publicLists')}</h2>
<div class=blocks>${block('classic', listSub('classic'))}${block('platform', listSub('platform'))}${block('stats', t('statsSub'))}</div>
<h2 class=sec>${t('wish')}</h2>
<div class=trigs>${wishes}${canEdit() ? `<div class=slot data-act=wnew role=button tabindex=0>${t('wnew')}</div>` : ''}</div>${profile.wishlists.length ? '' : `<p class=by>${t('noWL')}</p>`}`;
}

function profileSwitcher() {
    if (!canEdit())
        return publicIdentityCard();
    const localButton = `<button data-act=localdata>${t('localData')}</button>`;
    if (account.status == 'signed-in') {
        const own = account.profile;
        return `<div class="psw cloud-account"><button class="obj pbtn" data-act=aprofile>${cubeIcon(own.color, own.secondary_color)}<span class=info><span class=nm>${escapeHtml(own.display_name)}</span>${own.username ? `<span class=by>@${escapeHtml(own.username)}</span>` : ''}<span class=by data-cloud-status>${escapeHtml(cloudStatusSentence())}</span></span></button><span data-cloud-retry>${cloudRetryButton()}</span>${Object.values(store.profs).some(hasRealLocalData) ? localButton : ''}</div>`;
    }
    return `<div class=guest-account><div class=guest-row><div class="obj pbtn">${localProfileSummary(store.cur, false)}</div><button class=pri data-act=asignin>${t('accountSignIn')}</button>${localButton}</div><p class=by>${t('localGuestHint')}</p></div>`;
}
