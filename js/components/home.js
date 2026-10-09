/**
 * Pantalla de inicio: perfiles, listas del perfil activo y wishlists.
 */

/** Pantalla de inicio. */
function home() {
    const pcard = (id, v) => `<div class="card pc ${id == store.cur ? 'act' : ''}" data-act=psel data-id="${id}"><div class=nm>${escapeHtml(v.name)}<div class=by style="margin:4px 0 0">${v.data.levels.length} ${t('lv')}${id == store.cur ? ' · ' + t('active') : ''}</div></div><div class=pact><button data-act=exp data-id="${id}" title="${t('expP')}">⬇</button><button data-act=pedit data-id="${id}" title="${t('edit')}">✎</button><button data-act=pdelid data-id="${id}" title="${t('del')}">✕</button></div></div>`, n = k => profile.levels.filter(l => l.kind == k).length, top = k => {
        const l = findLevel(profile.order[k][0]);
        return l && thumbUrl(l) ? `background-image:url('${thumbUrl(l)}')` : '';
    }, hc = (k, s, sub) => `<div class="card hm" data-act=tab data-v=${k} style="${s}"><div class=nm>${t(k)}<div class=by style="margin:4px 0 0">${sub}</div></div></div>`;
    const WL = ['todo', 'prog', 'done'].map(s => {
        const L = profile.wishlists.filter(x => wishlistProgress(x).s == s);
        return L.length ? `<h4 class="sub s-${s}">${t('st_' + s)}</h4><div class=hg>` + L.map(x => {
            const p = wishlistProgress(x);
            return `<div class=card data-act=wopen data-id="${x.id}"><div class=nm style="width:100%">${escapeHtml(x.name)} <small class=by>${p.d} / ${p.n}</small>${progressBar(x)}</div></div>`;
        }).join('') + '</div>' : '';
    }).join('');
    return `<h3>${t('profs')}</h3><div class=hg>${Object.entries(store.profs).map(([k, v]) => pcard(k, v)).join('')}<div class="card pn" data-act=pnew>＋ ${t('pnew')}</div><div class="card pn" data-act=imp>⬆ ${t('impP')}</div></div><h3>${t('lists')} · ${escapeHtml(store.profs[store.cur].name)}</h3><div class=hg>${hc('classic', top('classic'), `${n('classic')} ${t('lv')}`)}${hc('platform', top('platform'), `${n('platform')} ${t('lv')}`)}${hc('stats', `background-image:url('${STATS_BACKGROUND}')`, t('statsSub'))}</div><h3>${t('wish')} <button data-act=wnew>${t('wnew')}</button></h3>${WL || `<p>${t('noWL')}</p>`}`;
}
