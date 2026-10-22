/**
 * Home screen: the profile switcher, the profile's lists as blocks and wishlists as triggers.
 */

/** Chart line drawn on the statistics block; the list blocks show their #1 level's thumbnail instead. */
const STATS_ART = '<svg class=art width=90 height=46 viewBox="0 0 90 46" aria-hidden=true><polyline points="2,40 20,26 36,32 54,10 70,20 88,4" fill=none stroke="#000" stroke-width=7 stroke-linejoin=round /><polyline points="2,40 20,26 36,32 54,10 70,20 88,4" fill=none stroke="#3cff6c" stroke-width=3 stroke-linejoin=round /></svg>';

/** Home screen. */
function home() {
    const count = k => profile.levels.filter(l => l.kind == k).length;
    const attempts = k => profile.levels.filter(l => l.kind == k).reduce((s, l) => s + (totalAttempts(l) || 0), 0);
    const block = (k, sub) => {
        const lead = k == 'stats' ? null : findLevel(rankedIds(k)[0]), u = lead ? thumbUrl(lead) : '';
        return `<div class="block b-${k}" data-act=tab data-v=${k} role=button tabindex=0${u ? ` style="--th:url('${u}')"` : ''}>${lead ? `<span class=lead>#1 ${escapeHtml(lead.name)}</span>` : ''}${k == 'stats' ? STATS_ART : ''}<h3>${t(k)}</h3><small>${sub}</small></div>`;
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

/** Active profile button with export and import beside it, and its menu: switch, rename or delete any profile, or add a new one. */
function profileSwitcher() {
    const ids = Object.keys(store.profs), cur = store.profs[store.cur], at = ids.indexOf(store.cur);
    const row = (id, i) => {
        const p = store.profs[id], on = id == store.cur, eid = escapeHtml(id), name = escapeHtml(p.name);
        return `<div class="prow${on ? ' act' : ''}"><button class=psel data-act=psel data-id="${eid}"${on ? ' aria-current=true' : ''}>${cubeIcon(i)}<span class=info><span class=nm>${name}</span><span class=by>${p.data.levels.length} ${t('lv')}</span></span>${on ? ICONS.check : ''}</button><button class=xs data-act=pedit data-id="${eid}" aria-label="${t('wren')} · ${name}">${ICONS.edit}</button><button class="xs dg" data-act=pdelid data-id="${eid}" aria-label="${t('del')} · ${name}">${ICONS.del}</button></div>`;
    };
    const io = (a, icon, label, aria) => `<button class=pio data-act=${a} aria-label="${aria}">${icon}<span>${label}</span></button>`;
    return `<div class=psw><button class="obj pbtn" popovertarget=pmenu aria-label="${t('profs')}: ${escapeHtml(cur.name)}">${cubeIcon(at)}<span class=info><span class=nm>${escapeHtml(cur.name)}</span><span class=by>${profile.levels.length} ${t('lv')}</span></span><svg class="i car" viewBox="0 0 24 24" aria-hidden=true><path d="M6 9l6 6 6-6" fill=none stroke="#fff" stroke-width=3 stroke-linecap=round stroke-linejoin=round /></svg></button>${io('exp', ICONS.exp, t('palExp'), `${t('expP')} · ${escapeHtml(cur.name)}`)}${io('imp', ICONS.imp, t('imp'), t('impP'))}
<div id=pmenu class=pmenu popover><h3>${t('profs')}</h3><div class=prows>${ids.map(row).join('')}</div>
<button class=pma data-act=pnew>${ICONS.add}<span>${t('pnew')}</span></button></div></div>`;
}
