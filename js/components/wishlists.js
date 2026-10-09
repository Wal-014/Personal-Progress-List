/**
 * Pantalla de una wishlist: progreso, estados de cada nivel y envío a las listas principales.
 */

/** Progreso de una wishlist: niveles completados, total y estado. */
const wishlistProgress = w => {
    const n = w.items.length, d = w.items.filter(i => i.status == 'done').length;
    return { n, d, s: n && d == n ? 'done' : w.items.some(i => i.status != 'todo') ? 'prog' : 'todo' };
};

/** Wishlist abierta actualmente. */
const currentWishlist = () => profile.wishlists.find(w => w.id == ui.wl);

/** Barra de progreso de una wishlist. */
const progressBar = w => {
    const p = wishlistProgress(w);
    return `<div class=pb><i style="width:${p.n ? p.d / p.n * 100 : 0}%"></i></div>`;
};

/** Pantalla de una wishlist. */
function wishView() {
    const w = currentWishlist(), p = wishlistProgress(w), inL = (i, k) => profile.levels.some(l => l.kind == k && (i.levelId && String(l.levelId) == String(i.levelId) || l.name.toLowerCase() == i.name.toLowerCase()));
    return `<div class=bar><button data-act=home class=ic>${ICONS.back} ${t('back2')}</button><h2>${escapeHtml(w.name)} <small class=by>${p.d} / ${p.n} · <span class="s-${p.s}">${t('st_' + p.s)}</span></small></h2><span style="flex:1"></span><button class=pri data-act=wadd>${t('witem')}</button><button data-act=wren>${t('wren')}</button><button class=dg data-act=wdelL>${t('wdelL')}</button></div>${progressBar(w)}` + w.items.map(i => {
        const u = thumbUrl(i);
        return `<div class=card data-id="${i.id}" style="${u ? `background-image:url('${u}')` : ''}"><div class=nm>${escapeHtml(i.name)}${i.creator ? ` <small class=by>${t('by')} ${escapeHtml(i.creator)}</small>` : ''}</div><div class="mt wa"><div class=r1><select data-wi="${i.id}">${['todo', 'prog', 'done'].map(s => `<option value=${s} ${i.status == s ? 'selected' : ''}>${t('st_' + s)}</option>`).join('')}</select><select data-wd="${i.id}"><option value="">${t('diff')}</option>${DIFFICULTIES.map(d => `<option ${i.diff == d ? 'selected' : ''}>${d}</option>`).join('')}</select></div><div class=r2>${i.status == 'done' ? `<button data-act=wto data-v=classic data-id="${i.id}">${inL(i, 'classic') ? '✓ ' : ''}${t('toC')}</button><button data-act=wto data-v=platform data-id="${i.id}">${inL(i, 'platform') ? '✓ ' : ''}${t('toP')}</button>` : ''}<button data-act=wedit data-id="${i.id}">✎</button><button data-act=wdel data-id="${i.id}">✕</button></div></div></div>`;
    }).join('');
}

/** Formulario para añadir o editar un nivel de wishlist. */
function wform(i) {
    const f = (k, l, v) => `<div><label>${t(l)}</label><input name=${k} value="${escapeHtml(v)}"></div>`;
    return `<div class="box sm"><div><form id=wf data-id="${i?.id || ''}"><div class=grid>${f('name', 'name', i?.name)}${f('lid', 'lid', i?.levelId)}${f('creator', 'creator', i?.creator)}<div><label>${t('diff')}</label><select name=diff><option value="">-</option>${DIFFICULTIES.map(d => `<option ${i?.diff == d ? 'selected' : ''}>${d}</option>`).join('')}</select></div></div><p><button>${t('save')}</button> <button type=button data-act=close>${t('close')}</button></p></form></div></div>`;
}
