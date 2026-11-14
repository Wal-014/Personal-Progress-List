/**
 * Wishlist progress, level statuses and transfers to the main lists.
 */

/** Wishlist progress as { n: total, d: completed, s: status }. */
const wishlistProgress = w => {
    const n = w.items.length, d = w.items.filter(i => i.status == 'done').length;
    return { n, d, s: n && d == n ? 'done' : w.items.some(i => i.status != 'todo') ? 'prog' : 'todo' };
};

/** IDs take precedence over names when both entries have one. */
const isInList = (i, k) => profile.levels.some(l => l.kind == k && (i.levelId && l.levelId ? String(l.levelId) == String(i.levelId) : l.name.toLowerCase() == i.name.toLowerCase()));

/** Transfer state follows the saved lists, including levels subsequently removed from them. */
const wishlistTransferred = i => i.kind ? isInList(i, i.kind) : isInList(i, 'classic') || isInList(i, 'platform');

const currentWishlist = () => profile.wishlists.find(w => w.id == ui.wl);

const wishlistIcon = status => ICONS[{ todo: 'lock', prog: 'play', done: 'check' }[status]];

/** Optional transient motion is used by the open wishlist, never its home card. */
const progressBar = (w, fx) => {
    const p = wishlistProgress(w);
    return `<div class="pb${fx ? ' wfill' : ''}" aria-hidden=true><i style="width:${p.n ? p.d / p.n * 100 : 0}%;${fx ? `--from:${fx.ratio}%` : ''}"></i></div>`;
};

/** Three labelled status buttons remain available in every state. */
function statusControl(i) {
    if (!canEdit())
        return `<span class=wseg>${wishlistIcon(i.status)} ${t('st_' + i.status)}</span>`;
    return `<div class=wseg role=group aria-label="${escapeHtml(t('status') + ' · ' + i.name)}">${['todo', 'prog', 'done'].map(s => `<button type=button data-act=wstatus data-id="${escapeHtml(i.id)}" data-v=${s} aria-pressed=${i.status == s}>${t('st_' + s)}</button>`).join('')}</div>`;
}

/** Completed cards offer the detected list, or a choice when the kind is unknown. */
function transferSlot(i) {
    if (wishlistTransferred(i)) {
        const kind = i.kind || (isInList(i, 'classic') ? 'classic' : 'platform');
        return `<span class=wadded>${ICONS.check} ${t('wIn_' + kind)}</span>`;
    }
    return `<button type=button class=xs-txt data-act=${i.kind ? 'wto' : 'wask'} data-id="${escapeHtml(i.id)}"${i.kind ? ` data-v=${i.kind}` : ''}>${t(i.kind ? 'wAddTo_' + i.kind : 'wAddAny')}</button>`;
}

/** A fixed-height progress row reserves the same space in every state. */
function progressRow(i) {
    if (i.status == 'todo')
        return `<div class=wprog><span class=by>${canEdit() ? t('wTodoHint') : '0%'}</span></div>`;
    const pct = i.status == 'done' ? 100 : i.pct ?? 0, fx = ui.wishFx?.id == i.id ? ui.wishFx : null;
    const slot = !canEdit() ? `${pct}%` : i.status == 'done' ? transferSlot(i) : `<label class=wpct><input type=number min=0 max=100 step=1 inputmode=numeric data-wp="${escapeHtml(i.id)}" value="${pct}" aria-label="${escapeHtml(t('wPct').replace('{name}', () => i.name))}"><span>%</span></label>`;
    return `<div class=wprog><div class="pb${fx ? ' wfill' : ''}" aria-hidden=true><i style="width:${pct}%;${fx ? `--from:${fx.from}%` : ''}"></i></div><div class=wslot>${slot}</div></div>`;
}

/** A wishlist card keeps the same grid areas across all statuses. */
function wishlistCard(i) {
    const u = thumbUrl(i), id = escapeHtml(i.id), celebrate = ui.wishFx?.id == i.id;
    return `<div class="obj wi s-${i.status}${celebrate ? ' celebrate' : ''}" data-id="${id}"${u ? ` style="--th:url('${u}')"` : ''}>${u ? '<i class=th aria-hidden=true></i>' : ''}${canEdit() ? `<span class=grip aria-hidden=true title="${t('dragHint')}">${ICONS.grip}</span>` : ''}<span class="tg s-${i.status}" aria-hidden=true>${wishlistIcon(i.status)}</span><div class=info><span class=nm>${escapeHtml(i.name)}</span>${i.creator ? `<span class=by>${t('by')} ${escapeHtml(i.creator)}</span>` : ''}</div>${difficultyFace(i)}${statusControl(i)}${canEdit() ? `<div class=wact><button class=xs data-act=wedit data-id="${id}" aria-label="${t('edit')}">${ICONS.edit}</button><button class="xs dg" data-act=wdel data-id="${id}" aria-label="${t('del')}">${ICONS.del}</button></div>` : ''}${progressRow(i)}${celebrate ? `<span class=wstamp aria-hidden=true>${ICONS.check} ${escapeHtml(t('st_done').toUpperCase())}</span>` : ''}</div>`;
}

function wishView() {
    const w = currentWishlist(), p = wishlistProgress(w);
    const summary = ['todo', 'prog', 'done'].map(s => `<span>${wishlistIcon(s)} ${t('st_' + s)}: ${w.items.filter(i => i.status == s).length}</span>`).join('');
    const line = p.s == 'done' ? t('wAllDone') : t('wDoneN').replace('{d}', () => p.d).replace('{n}', () => p.n);
    return `<div class="wh${p.s == 'done' ? ' done' : ''}"><div class=info><h2>${escapeHtml(w.name)}</h2><span class=by>${line}</span>${progressBar(w, ui.wishFx)}<div class=wsummary>${summary}</div></div>${canEdit() ? `<div class=wa><button class=pri data-act=wadd>${t('addLevel')}</button><button data-act=wren>${t('wren')}</button><button class=dg data-act=wdelL>${t('wdelL')}</button></div>` : ''}</div>${w.items.length ? `<div class=wl>${w.items.map(wishlistCard).join('')}</div>` : canEdit() ? emptyList({ icon: ICONS.wish, title: t('emptyWishTitle'), text: t('emptyWishText'), action: 'wadd' }) : `<p class=by>${t('publicNoLevels')}</p>`}`;
}

/** Form for adding or editing a wishlist level, including a non-drag position control. */
function wform(i) {
    const w = currentWishlist();
    const position = i ? `<div><label for=wf-pos>${t('wPos')}</label><input id=wf-pos type=number name=wpos min=1 max=${w.items.length} step=1 value="${w.items.indexOf(i) + 1}"></div>` : '';
    return `<div class="box sm"><h2>${i ? t('edit') : t('palAdd')}</h2><form id=wf data-id="${escapeHtml(i?.id)}">${levelSearchBox()}<div class=grid>${levelFields(i || {}, true)}${position}</div><p class=dgb><button class=pri>${t('save')}</button> <button type=button data-act=close>${t('close')}</button></p></form></div>`;
}

/** Saves selected level data and an optional new position without resetting progress. */
function saveWishlistItem(form) {
    const fields = Object.fromEntries(new FormData(form)), w = currentWishlist();
    let item = w.items.find(x => x.id == form.dataset.id);
    if (!item) {
        item = { id: newId('i'), status: 'todo' };
        w.items.push(item);
    }
    item.name = fields.name.trim();
    item.levelId = fields.lid || null;
    item.creator = fields.creator || null;
    item.diff = fields.diff || null;
    item.rating = fields.rating || null;
    if (['classic', 'platform'].includes(fields.kind))
        item.kind = fields.kind;
    else
        delete item.kind;
    if (fields.wpos) {
        const position = Math.max(0, Math.min(w.items.length - 1, Math.round(+fields.wpos) - 1));
        if (Number.isFinite(position) && position != w.items.indexOf(item)) {
            w.items.splice(w.items.indexOf(item), 1);
            w.items.splice(position, 0, item);
        }
    }
    item.chk = 0;
    save();
    closeModal();
    render();
    enrichWishlistItem(item);
}

/** A delayed offer is valid only while the original item and wishlist remain open. */
function canOfferWishlistTransfer(w, item) {
    return ui.tab == 'wish' && currentWishlist() == w && w.items.includes(item) && item.status == 'done' && !qs('#md dialog') && !wishlistTransferred(item);
}

/** Length of the completion stamp animation in css/styles.css: the transfer offer waits for it so a redraw cannot cut it short. */
const WISHLIST_STAMP_MS = 1200;

/** Saves a changed state and renders its one-time completion motion. */
function setWishlistStatus(id, status) {
    const w = currentWishlist(), item = w?.items.find(i => i.id == id);
    if (!item || !['todo', 'prog', 'done'].includes(status) || item.status == status)
        return;
    const p = wishlistProgress(w), from = item.status == 'prog' ? item.pct ?? 0 : 0;
    item.status = status;
    save();
    ui.wishFx = { id: status == 'done' ? id : null, from, ratio: p.n ? p.d / p.n * 100 : 0 };
    render();
    ui.wishFx = null;
    if (status == 'done') {
        if (wishlistProgress(w).s == 'done')
            showToast(t('wAllDone'));
        setTimeout(() => {
            if (canOfferWishlistTransfer(w, item))
                askTransfer(item, true);
        }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : WISHLIST_STAMP_MS);
    }
}

/** Saves manual progress and updates its bar without rebuilding the focused input. */
function setWishlistPercent(input) {
    const item = currentWishlist()?.items.find(i => i.id == input.dataset.wp);
    if (!item || item.status != 'prog')
        return;
    item.pct = Math.max(0, Math.min(100, Math.round(+input.value || 0)));
    input.value = item.pct;
    input.closest('.wi').querySelector('.wprog .pb i').style.width = item.pct + '%';
    save();
}

/** Completion congratulations and list choices for the modal dialog. */
function transferDialog(item, justCompleted) {
    const text = (justCompleted ? t('wCongrats').replace('{name}', () => item.name) + ' ' : '')
        + (item.kind ? t('wAskList').replace('{list}', () => t(item.kind)) : t('wAskKind'));
    const choices = (item.kind ? [item.kind] : ['classic', 'platform']).map((kind, index) => `<button class=pri data-act=wto data-id="${escapeHtml(item.id)}" data-v=${kind}${index == 0 ? ' autofocus' : ''}>${t('wAddTo_' + kind)}</button>`).join(' ');
    return `<div class="box sm"><h2>${t(justCompleted ? 'wDoneTitle' : 'wAddTitle')}</h2><p>${escapeHtml(text)}</p><p class=dgb>${choices} <button data-act=close>${t('notNow')}</button></p></div>`;
}

/** Resolves missing game mode from the sheet before offering a transfer. */
async function askTransfer(item, justCompleted) {
    const w = currentWishlist();
    await loadSheetLevels();
    // A kind found in the sheet changes the card's transfer button and can show the level is already in that list
    if (fillFromSheet(item)) {
        save();
        render();
    }
    if (canOfferWishlistTransfer(w, item))
        openModal(transferDialog(item, justCompleted));
}

/** Adds a level only once, preserving the wishlist item and all of its progress. */
function transferWishlistItem(id, kind) {
    const item = currentWishlist()?.items.find(i => i.id == id);
    if (!item || !['classic', 'platform'].includes(kind))
        return;
    item.kind ||= kind;
    const exists = isInList(item, kind);
    if (!exists) {
        const level = { id: newId('n'), name: item.name, kind, levelId: item.levelId || null, creator: item.creator || null, diff: item.diff || null, rating: item.rating || null, ar: { s: 'n' }, deaths: {}, tags: [], notes: '', date: todayLocal() };
        profile.levels.push(level);
        matchWithAredl([level]);
    }
    showToast(t(exists ? 'wExists' : 'wAdded').replace('{list}', () => t(kind)).replace('{name}', () => item.name));
    save();
    closeModal();
    render();
    // The transfer button is replaced by a plain indicator, so keyboard focus moves to the card's status control
    qs(`.wi[data-id="${CSS.escape(id)}"] [data-act=wstatus][data-v=done]`)?.focus();
}

/** Saves the card order only after a drop within the stack. */
function reorderWishlist(evt) {
    if (!dragWasCanceled(evt.originalEvent)) {
        const w = currentWishlist(), byId = new Map(w.items.map(i => [String(i.id), i]));
        w.items = [...qs('.wl').children].map(c => byId.get(c.dataset.id));
        save();
    }
    render();
}

function initWishlistSort() {
    if (canEdit() && qs('.wl'))
        new Sortable(qs('.wl'), { animation: 180, filter: evt => startsAwayFromGrip(evt) || !!evt.target.closest('button, input'), preventOnFilter: false, fallbackTolerance: 5, onUpdate: reorderWishlist });
}
