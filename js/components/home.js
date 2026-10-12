/**
 * Home screen: the profile's lists as blocks, wishlists as triggers and the profiles.
 */

/** Line drawings for the list blocks. */
const BLOCK_ART = {
    classic: '<svg class=art width=70 height=46 viewBox="0 0 70 46" aria-hidden=true><path d="M2 44 16 16l14 28zM30 44 44 16l14 28z" fill="#000" stroke="#fff" stroke-width=2 /></svg>',
    platform: '<svg class=art width=60 height=46 viewBox="0 0 60 46" aria-hidden=true><rect x=4 y=22 width=20 height=20 fill="#000" stroke="#fff" stroke-width=2 /><rect x=28 y=10 width=20 height=20 fill="#000" stroke="#fff" stroke-width=2 /><circle cx=52 cy=40 r=5 fill="#ffe84a" stroke="#000" stroke-width=2 /></svg>',
    stats: '<svg class=art width=90 height=46 viewBox="0 0 90 46" aria-hidden=true><polyline points="2,40 20,26 36,32 54,10 70,20 88,4" fill=none stroke="#000" stroke-width=7 stroke-linejoin=round /><polyline points="2,40 20,26 36,32 54,10 70,20 88,4" fill=none stroke="#3cff6c" stroke-width=3 stroke-linejoin=round /></svg>'
};

/** Home screen. */
function home() {
    const count = k => profile.levels.filter(l => l.kind == k).length;
    const attempts = k => profile.levels.filter(l => l.kind == k).reduce((s, l) => s + (totalAttempts(l) || 0), 0);
    const block = (k, sub) => {
        const lead = k == 'stats' ? null : findLevel(rankedIds(k)[0]);
        return `<div class=block data-act=tab data-v=${k} role=button tabindex=0>${lead ? `<span class=lead>#1 ${escapeHtml(lead.name)}</span>` : ''}${BLOCK_ART[k]}<h3>${t(k)}</h3><small>${sub}</small></div>`;
    };
    const listSub = k => `${count(k)} ${t('lv')}${attempts(k) ? ` · ${attempts(k).toLocaleString(ui.lang)} ${t('att')}` : ''}`;
    const order = { prog: 0, todo: 1, done: 2 };
    const wishes = [...profile.wishlists].sort((a, b) => order[wishlistProgress(a).s] - order[wishlistProgress(b).s]).map(w => {
        const p = wishlistProgress(w);
        return `<div class="obj trig" data-act=wopen data-id="${escapeHtml(w.id)}" role=button tabindex=0><span class="tg s-${p.s}">${ICONS.wish}</span><div class=info><span class=nm>${escapeHtml(w.name)}</span>${progressBar(w)}<span class=by>${p.d} / ${p.n} · ${t('st_' + p.s)}</span></div></div>`;
    }).join('');
    const prof = ([id, v], i) => `<div class="obj pf ${id == store.cur ? 'act' : ''}" data-act=psel data-id="${escapeHtml(id)}" role=button tabindex=0>${cubeIcon(i)}<div class=info><span class=nm>${escapeHtml(v.name)}</span><span class=by>${v.data.levels.length} ${t('lv')}${id == store.cur ? ' · ' + t('active') : ''}</span></div><div class=pact><button class=xs data-act=exp data-id="${escapeHtml(id)}" title="${t('expP')}" aria-label="${t('expP')}">${ICONS.exp}</button><button class=xs data-act=pedit data-id="${escapeHtml(id)}" title="${t('edit')}" aria-label="${t('edit')}">${ICONS.edit}</button><button class="xs dg" data-act=pdelid data-id="${escapeHtml(id)}" title="${t('del')}" aria-label="${t('del')}">${ICONS.del}</button></div></div>`;
    return `<h2 class=sec>${t('lists')} <small class=by>${escapeHtml(store.profs[store.cur].name)}</small></h2>
<div class=blocks>${block('classic', listSub('classic'))}${block('platform', listSub('platform'))}${block('stats', t('statsSub'))}</div>
<h2 class=sec>${t('wish')}</h2>
<div class=trigs>${wishes}<div class=slot data-act=wnew role=button tabindex=0>${t('wnew')}</div></div>${profile.wishlists.length ? '' : `<p class=by>${t('noWL')}</p>`}
<h2 class=sec>${t('profs')}</h2>
<div class=pfs>${Object.entries(store.profs).map(prof).join('')}<div class=slot data-act=pnew role=button tabindex=0>${ICONS.add} ${t('pnew')}</div><div class=slot data-act=imp role=button tabindex=0>${ICONS.imp} ${t('impP')}</div></div>`;
}
