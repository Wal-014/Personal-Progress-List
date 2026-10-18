/**
 * Home screen: the profile switcher, the profile's lists as blocks and wishlists as triggers.
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
    return `${profileSwitcher()}<h2 class=sec>${t('lists')}</h2>
<div class=blocks>${block('classic', listSub('classic'))}${block('platform', listSub('platform'))}${block('stats', t('statsSub'))}</div>
<h2 class=sec>${t('wish')}</h2>
<div class=trigs>${wishes}<div class=slot data-act=wnew role=button tabindex=0>${t('wnew')}</div></div>${profile.wishlists.length ? '' : `<p class=by>${t('noWL')}</p>`}`;
}

/** Active profile button and its menu: switch profile, manage the active one, add or import another. */
function profileSwitcher() {
    const ids = Object.keys(store.profs), cur = store.profs[store.cur], at = ids.indexOf(store.cur);
    const row = (id, i) => {
        const p = store.profs[id], on = id == store.cur;
        return `<button class="prow${on ? ' act' : ''}" data-act=psel data-id="${escapeHtml(id)}"${on ? ' aria-current=true' : ''}>${cubeIcon(i)}<span class=info><span class=nm>${escapeHtml(p.name)}</span><span class=by>${p.data.levels.length} ${t('lv')}</span></span>${on ? ICONS.check : ''}</button>`;
    };
    const act = (a, icon, label, cls = '') => `<button class="pma${cls}" data-act=${a} data-id="${escapeHtml(store.cur)}">${icon}<span>${label}</span></button>`;
    return `<div class=psw><button class="obj pbtn" popovertarget=pmenu aria-label="${t('profs')}: ${escapeHtml(cur.name)}">${cubeIcon(at)}<span class=info><span class=nm>${escapeHtml(cur.name)}</span><span class=by>${profile.levels.length} ${t('lv')}</span></span><svg class="i car" viewBox="0 0 24 24" aria-hidden=true><path d="M6 9l6 6 6-6" fill=none stroke="#fff" stroke-width=3 stroke-linecap=round stroke-linejoin=round /></svg></button>
<div id=pmenu class=pmenu popover><h3>${t('profs')}</h3><div class=prows>${ids.map(row).join('')}</div>
<div class=pmas>${act('pedit', ICONS.edit, t('wren'))}${act('exp', ICONS.exp, t('palExp'))}${act('pdelid', ICONS.del, t('del'), ' dg')}</div>
<div class=pmas>${act('pnew', ICONS.add, t('pnew'))}${act('imp', ICONS.imp, t('impP'))}</div></div></div>`;
}
