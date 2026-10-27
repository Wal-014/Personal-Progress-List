/**
 * Wishlist progress, level statuses and transfers to the main lists.
 */

/** Wishlist progress as { n: total, d: completed, s: status }. */
const wishlistProgress = w => {
    const n = w.items.length, d = w.items.filter(i => i.status == 'done').length;
    return { n, d, s: n && d == n ? 'done' : w.items.some(i => i.status != 'todo') ? 'prog' : 'todo' };
};

/** True when a wishlist item is already in one of the profile's lists (same level ID or same name). */
const isInList = (i, k) => profile.levels.some(l => l.kind == k && (i.levelId && String(l.levelId) == String(i.levelId) || l.name.toLowerCase() == i.name.toLowerCase()));

const currentWishlist = () => profile.wishlists.find(w => w.id == ui.wl);

const progressBar = w => {
    const p = wishlistProgress(w);
    return `<div class=pb><i style="width:${p.n ? p.d / p.n * 100 : 0}%"></i></div>`;
};

function wishView() {
    const w = currentWishlist(), p = wishlistProgress(w);
    const item = i => {
        const u = thumbUrl(i), id = escapeHtml(i.id), to = (k, label) => `<button class=xs-txt data-act=wto data-v=${k} data-id="${id}">${isInList(i, k) ? ICONS.check : ''}${t(label)}</button>`;
        return `<div class="obj wi" data-id="${id}"${u ? ` style="--th:url('${u}')"` : ''}><span class="tg s-${i.status}">${ICONS.wish}</span><div class=info><span class=nm>${escapeHtml(i.name)}</span>${i.creator ? `<span class=by>${t('by')} ${escapeHtml(i.creator)}</span>` : ''}</div><div class=wsel><select data-wi="${id}" aria-label="${t('status')}">${['todo', 'prog', 'done'].map(s => `<option value=${s} ${i.status == s ? 'selected' : ''}>${t('st_' + s)}</option>`).join('')}</select>${difficultyFace(i)}</div><div class=wact>${i.status == 'done' ? to('classic', 'toC') + to('platform', 'toP') : ''}<button class=xs data-act=wedit data-id="${id}" aria-label="${t('edit')}">${ICONS.edit}</button><button class="xs dg" data-act=wdel data-id="${id}" aria-label="${t('del')}">${ICONS.del}</button></div></div>`;
    };
    return `<div class=wh><div class=info><h2>${escapeHtml(w.name)}</h2><span class=by>${p.d} / ${p.n} · ${t('st_' + p.s)}</span>${progressBar(w)}</div><div class=wa><button class=pri data-act=wadd>${t('witem')}</button><button data-act=wren>${t('wren')}</button><button class=dg data-act=wdelL>${t('wdelL')}</button></div></div><div class=wl>${w.items.map(item).join('') || `<p class=by>${t('empty')}</p>`}</div>`;
}

/** Form for adding or editing a wishlist level. */
function wform(i) {
    return `<div class="box sm"><h2>${i ? t('edit') : t('palAdd')}</h2><form id=wf data-id="${escapeHtml(i?.id)}">${levelSearchBox()}<div class=grid>${levelFields(i || {}, false)}</div><p class=dgb><button class=pri>${t('save')}</button> <button type=button data-act=close>${t('close')}</button></p></form></div>`;
}
