/**
 * Global click, form, keyboard and tooltip handlers identified by data-act.
 */

/** Re-renders behind the pause menu and reopens it, keeping focus on the control that was used. */
function reopenPause(selector) {
    render();
    openModal(pauseUI());
    qs('#md ' + selector)?.focus();
}

/** Zooms the timeline by a factor, keeping the same date in the middle of the view. */
function zoomTimeline(factor) {
    const w = qs('#tlw'), r = (w.scrollLeft + w.clientWidth / 2) / w.scrollWidth;
    ui.z = Math.min(160, Math.max(6, ui.z * factor));
    render();
    const n = qs('#tlw');
    n.scrollLeft = r * n.scrollWidth - n.clientWidth / 2;
}

/** What each data-act value does when clicked. Handlers get the clicked element and its data-id. */
const ACTIONS = {
    tab(a) {
        ui.tab = a.dataset.v;
        ui.tagFilter = [];
        ui.q = '';
        ui.wl = null;
        ui.sel = null;
        ui.edit = 0;
        render();
    },
    pause: () => openModal(pauseUI()),
    theme(a) {
        ui.theme = localStorage.gt = a.dataset.v;
        reopenPause(`[data-act=theme][data-v=${a.dataset.v}]`);
    },
    bell: () => openModal(bellUI()),
    legal: a => openModal(legalUI(a.dataset.v)),
    ct() {
        ui.tagFilter = [];
        renderListTagFilters();
        renderList();
        qs('.lh .ms summary')?.focus();
    },
    step(a) {
        const i = a.parentNode.querySelector('input'), mn = i.min === '' ? -1e9 : +i.min, mx = i.max === '' ? 1e9 : +i.max;
        i.value = Math.max(mn, Math.min(mx, (+i.value || 0) + +a.dataset.d));
        i.dispatchEvent(new Event('input', { bubbles: true }));
    },
    lang(a) {
        ui.lang = localStorage.gl = a.dataset.v;
        if (a.closest('.pause'))
            reopenPause(`[data-act=lang][data-v=${a.dataset.v}]`);
        else
            render();
    },
    zi: () => zoomTimeline(1.5),
    zo: () => zoomTimeline(1 / 1.5),
    add() {
        // The edit form in the panel and the new-level form use the same ids, so only one can be open
        if (ui.edit) {
            ui.edit = 0;
            renderPanel();
        }
        openModal(form());
        qs('#gdq').focus();
    },
    edit(a, id) {
        const openedFromDialog = !!qs('#md .modal'), l = findLevel(id);
        closeModal();
        if (l)
            ui.tab = l.kind;
        ui.sel = id;
        ui.edit = 1;
        if (openedFromDialog) {
            ui.q = '';
            ui.tagFilter = [];
        }
        render();
        if (openedFromDialog)
            scrollSel();
    },
    lvclose() {
        if (!ui.edit)
            ui.sel = null;
        ui.edit = 0;
        render();
    },
    tgadd(a) {
        // tagChip escapes the tag name and tagColor only returns #rrggbb, so the HTML is safe
        // nosemgrep: typescript.react.security.audit.react-unsanitized-method.react-unsanitized-method
        qs('#tgs').insertAdjacentHTML('beforeend', tagChip(a.dataset.v));
        qs('#tgq').value = '';
        renderTagSuggestions();
    },
    tgrm(a) {
        a.remove();
        renderTagSuggestions();
    },
    close: () => closeModal(),
    del(a, id) {
        askConfirm(t('confirm')).then(ok => {
            if (!ok)
                return;
            profile.levels = profile.levels.filter(l => l.id != id);
            removeFromOrder(id);
            save();
            closeModal();
            ui.sel = null;
            ui.edit = 0;
            render();
        });
    },
    tags: () => openModal(tagsUI()),
    tdel(a) {
        const ix = +a.dataset.i;
        askConfirm(t(profile.tags[ix].name == PRE_TAG ? 'preTagConfirm' : 'confirmTag')).then(ok => {
            if (!ok)
                return;
            const n = profile.tags.splice(ix, 1)[0].name;
            profile.levels.forEach(l => l.tags = (l.tags || []).filter(x => x != n));
            ui.tagFilter = ui.tagFilter.filter(name => name != n);
            save();
            render();
            openModal(tagsUI());
        });
    },
    tadd() {
        const n = qs('#nn').value.trim();
        if (!n || profile.tags.some(g => g.name == n))
            return showAlert(t(n ? 'tagExists' : 'tagEmpty'));
        profile.tags.push({ name: n, color: qs('#nc').value });
        save();
        render();
        openModal(tagsUI());
    },
    sync: () => syncWithAredl(true),
    pnew() {
        askProfile(t('pnew'), '', nextProfileColor()).then(p => {
            if (!p)
                return;
            const i = newId('p');
            store.profs[i] = { name: p.name, color: p.color, data: emptyProfile() };
            activateProfile(i);
            ui.tab = 'home';
            save();
            render();
        });
    },
    psel(a, id) {
        activateProfile(id);
        matchWithAredl(profile.levels);
        ui.wl = null;
        save();
        render();
    },
    pedit(a, id) {
        askProfile(t('pedit'), store.profs[id].name, store.profs[id].color).then(p => {
            if (!p)
                return;
            store.profs[id].name = p.name;
            store.profs[id].color = p.color;
            save();
            render();
        });
    },
    pdelid(a, id) {
        if (Object.keys(store.profs).length < 2)
            return showAlert(t('lastP'));
        // The menu can delete any profile, not just the active one, so the dialog names it
        showDialog({ title: t('pdel'), msg: store.profs[id].name, danger: 1 }).then(ok => {
            if (!ok)
                return;
            delete store.profs[id];
            if (store.cur == id)
                activateProfile(Object.keys(store.profs)[0]);
            save();
            render();
        });
    },
    wnew() {
        askText(t('wname'), '').then(n => {
            if (!n)
                return;
            const w = { id: newId('w'), name: n, items: [] };
            profile.wishlists.push(w);
            ui.tab = 'wish';
            ui.wl = w.id;
            save();
            render();
        });
    },
    wopen(a, id) {
        ui.tab = 'wish';
        ui.wl = id;
        enrichWishlist(profile.wishlists.find(w => w.id == id));
        render();
    },
    wren() {
        askText(t('wname'), currentWishlist().name).then(n => {
            if (!n)
                return;
            currentWishlist().name = n;
            save();
            render();
        });
    },
    wdelL() {
        askConfirm(t('wconf')).then(ok => {
            if (!ok)
                return;
            profile.wishlists = profile.wishlists.filter(w => w.id != ui.wl);
            ui.wl = null;
            ui.tab = 'home';
            save();
            render();
        });
    },
    wadd() {
        openModal(wform());
        qs('#gdq').focus();
    },
    wedit: (a, id) => openModal(wform(currentWishlist().items.find(i => i.id == id))),
    gdgo: () => runLevelSearch(),
    gdmore: () => runLevelSearch(true),
    gdtry(a) {
        qs('#gdq').value = a.dataset.v;
        runLevelSearch();
    },
    gdrated(a) {
        levelSearch.f.rated = a.dataset.v;
        changeLevelFilters();
    },
    gdclear() {
        levelSearch.f = { rated: 'all', rates: [], diffs: [] };
        changeLevelFilters();
    },
    gdpick: a => pickLevel(a.form, levelSearch.results[a.dataset.i]),
    wdel(a, id) {
        askConfirm(t('wconf')).then(ok => {
            if (!ok)
                return;
            currentWishlist().items = currentWishlist().items.filter(i => i.id != id);
            save();
            render();
        });
    },
    wto(a, id) {
        const i = currentWishlist().items.find(x => x.id == id), kd = a.dataset.v;
        if (isInList(i, kd))
            return showAlert(t('exists'));
        profile.levels.push({ id: newId('n'), name: i.name, kind: kd, levelId: i.levelId || null, creator: i.creator || null, diff: i.diff || null, rating: i.rating || null, ar: { s: 'n' }, deaths: {}, tags: [], notes: '', date: todayLocal() });
        i.added = true;
        save();
        showAlert(t('addedOk'));
        render();
    },
    imp: () => qs('#fi').click(),
    exp(a, id) {
        const pr = store.profs[id || store.cur], u = URL.createObjectURL(new Blob([JSON.stringify({ ...pr.data, profileName: pr.name, profileColor: pr.color })], { type: 'application/json' })), x = document.createElement('a');
        x.href = u;
        // Only characters that file systems reject are replaced, so accents and non-Latin names survive
        x.download = (pr.name.trim().replace(/[/:*?"<>|\s]+/g, '-') || 'profile') + '.json';
        x.click();
        setTimeout(() => URL.revokeObjectURL(u), 1000);
    }
};

function saveWishlistItem(form) {
    const fields = Object.fromEntries(new FormData(form)), w = currentWishlist();
    let item = w.items.find(x => x.id == form.dataset.id);
    if (!item) {
        item = { id: newId('i'), status: 'todo' };
        w.items.push(item);
    }
    Object.assign(item, { name: fields.name.trim(), levelId: fields.lid || null, creator: fields.creator || null, diff: fields.diff || null, rating: fields.rating || null });
    item.chk = 0;
    save();
    closeModal();
    render();
    enrichWishlistItem(item);
}

function saveLevel(form) {
    const position = form.elements.pos.value, old = findLevel(form.dataset.id), level = old || { id: newId('n') };
    Object.assign(level, levelFromForm(form));
    if (!old)
        profile.levels.push(level);
    matchWithAredl([level]);
    removeFromOrder(level.id);
    if (position && !isPre(level)) {
        const order = profile.order[level.kind], before = rankedIds(level.kind)[Math.max(0, +position - 1)];
        order.splice(before ? order.indexOf(before) : order.length, 0, level.id);
    }
    save();
    closeModal();
    ui.sel = level.id;
    ui.edit = 0;
    ui.tab = level.kind;
    render();
    scrollSel();
}

function setWishlistStatus(input) {
    currentWishlist().items.find(item => item.id == input.dataset.wi).status = input.value;
    save();
    render();
}

function setTagColor(input) {
    profile.tags[input.dataset.tc].color = input.value;
    save();
    render();
}

function renameTag(input) {
    const tag = profile.tags[input.dataset.tn], name = input.value.trim();
    if (!name || profile.tags.some(x => x != tag && x.name == name)) {
        input.value = tag.name;
        return showAlert(t(name ? 'tagExists' : 'tagEmpty'));
    }
    const rename = () => {
        const wasPre = tag.name == PRE_TAG;
        profile.levels.forEach(level => level.tags = (level.tags || []).map(x => x == tag.name ? name : x));
        ui.tagFilter = ui.tagFilter.map(selectedTag => selectedTag == tag.name ? name : selectedTag);
        tag.name = name;
        save();
        render();
        if (wasPre || name == PRE_TAG)
            openModal(tagsUI());
    };
    if (tag.name != PRE_TAG || name == tag.name)
        return rename();
    askConfirm(t('preTagConfirm')).then(ok => {
        if (ok)
            rename();
        else
            input.value = tag.name;
    });
}

function clearAredlPosition(form) {
    form.elements.ap.value = '';
}

async function importProfile(file) {
    const text = await file.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        return showAlert(t('badFile'));
    }
    if (!isValidProfileData(data))
        return showAlert(t('badFile'));
    const selected = await askProfile(t('impP'), data.profileName || file.name.replace(/\.json$/, ''), isHexColor(data.profileColor) ? data.profileColor : nextProfileColor());
    if (!selected)
        return;
    const id = newId('p');
    delete data.profileName;
    delete data.profileColor;
    store.profs[id] = { name: selected.name, color: selected.color, data };
    activateProfile(id);
    matchWithAredl(profile.levels);
    save();
    render();
}

document.body.onclick = e => {
    document.querySelectorAll('.ms[open]').forEach(d => {
        if (!d.contains(e.target))
            d.open = false;
    });
    const g = e.target.closest('[data-tag]'), a = e.target.closest('[data-act]'), c = e.target.closest('[data-id]');
    if (e.target.classList.contains('modal'))
        return closeModal();
    if (g) {
        ui.tagFilter = [g.dataset.tag];
        if (!isListTab())
            ui.tab = 'classic';
        closeModal();
        return render();
    }
    if (a) {
        const k = a.dataset.act;
        if (a.closest('.pause') && ['wnew', 'tags', 'exp', 'imp', 'legal'].includes(k))
            closeModal();
        a.closest(':popover-open')?.hidePopover();
        ACTIONS[k]?.(a, a.dataset.id);
        return;
    }
    if (c && !e.target.closest('form') && findLevel(c.dataset.id)) {
        if (c.classList.contains('pt')) {
            const l = findLevel(c.dataset.id);
            ui.tab = l.kind;
            ui.sel = l.id;
            ui.edit = 0;
            ui.q = '';
            ui.tagFilter = [];
            render();
            scrollSel();
        }
        else if (c.classList.contains('lv'))
            selectLevel(c.dataset.id);
    }
};
document.body.onsubmit = e => {
    e.preventDefault();
    // The level fields are read-only, so the browser does not check them: a level must be picked from the search
    if (!e.target.elements.name.value) {
        qs('#gdq').setCustomValidity(t('gdPick'));
        return qs('#gdq').reportValidity();
    }
    if (e.target.id == 'wf')
        saveWishlistItem(e.target);
    else
        saveLevel(e.target);
};
document.body.oninput = e => {
    if (['fm', 'wf'].includes(e.target.form?.id))
        e.target.setCustomValidity(fieldError(e.target.name, e.target.value));
    if (e.target.form?.id == 'fm' && ['attC', 'attN', 'tN', 'tP', 'tPC'].includes(e.target.name))
        updateTotals(e.target.form);
    if (e.target.id == 'tgq')
        renderTagSuggestions();
    if (e.target.id == 'gdq')
        e.target.setCustomValidity('');
    if (e.target.id == 'q') {
        ui.q = e.target.value.toLowerCase();
        renderList();
        if (!ui.q)
            scrollSel();
    }
};
document.body.onchange = e => {
    const input = e.target, ds = input.dataset;
    if (input.name == 'tagf')
        return setListTagFilter();
    if (['gdrate', 'gddiff'].includes(input.name))
        return setLevelFilter(input);
    if (ds.wi != null)
        return setWishlistStatus(input);
    if (ds.tc != null)
        return setTagColor(input);
    if (ds.tn != null)
        return renameTag(input);
    // Only a level on the list has a position
    if (input.form?.id == 'fm' && input.name == 'as' && input.value != 'r')
        return clearAredlPosition(input.form);
    if (input.id == 'fi') {
        if (input.files[0])
            importProfile(input.files[0]);
        input.value = '';
    }
};
// Popovers open in the top layer, away from their button; place the profile menu under it, inside the viewport
document.addEventListener('beforetoggle', e => {
    if (e.target.id != 'pmenu' || e.newState != 'open')
        return;
    const r = qs('[popovertarget=pmenu]').getBoundingClientRect(), w = Math.min(360, innerWidth - 24);
    // Only the profile rows scroll, so the menu never runs past the bottom of the screen
    Object.assign(e.target.style, { width: w + 'px', top: r.bottom + 6 + 'px', left: Math.max(12, Math.min(r.left, innerWidth - w - 12)) + 'px', maxHeight: Math.max(200, innerHeight - r.bottom - 18) + 'px' });
}, true);
/** Fits an open dropdown panel inside the viewport. */
document.addEventListener('toggle', e => {
    if (e.target.matches('.ms[open]')) {
        const optionsPanel = e.target.querySelector('.msp'), panelTop = optionsPanel.getBoundingClientRect().top;
        optionsPanel.style.setProperty('--ms-height', Math.max(0, innerHeight - panelTop - 12) + 'px');
    }
}, true);
document.onkeydown = e => {
    if (e.key == 'Escape') {
        const dropdown = e.target.closest('.ms[open]');
        if (dropdown) {
            e.preventDefault();
            e.stopPropagation();
            dropdown.open = false;
            dropdown.querySelector('summary').focus();
            return;
        }
        closeModal();
    }
    if ((e.key == 'Enter' || e.key == ' ') && e.target.matches('[role=button]')) {
        e.preventDefault();
        e.target.click();
    }
    if (e.key == 'Enter' && e.target.id == 'tgq') {
        e.preventDefault();
        qs('#tgr [data-act=tgadd]')?.click();
    }
    // Enter searches instead of submitting the form around the search box
    if (e.key == 'Enter' && e.target.id == 'gdq') {
        e.preventDefault();
        runLevelSearch();
    }
};
document.body.onmousemove = e => {
    const tp = qs('#tip'), h = e.target.closest('[data-hp]'), p = e.target.closest('.pt'), k = h ? 'h' + h.dataset.hp : p ? 'p' + p.dataset.id : '';
    if (!k) {
        tp.style.display = 'none';
        tp.dataset.k = '';
        return;
    }
    if (tp.dataset.k != k) {
        tp.dataset.k = k;
        if (h)
            // dataset returns attribute values decoded, so they are escaped again before going into innerHTML
            tp.innerHTML = `<b>${escapeHtml(h.dataset.hp)}%</b> · ${escapeHtml(h.dataset.hn)} ${t('dU')}`;
        else {
            const l = findLevel(p.dataset.id), u = thumbUrl(l);
            tp.innerHTML = `${u ? `<img src="${u}" alt="">` : ''}<b>${escapeHtml(l.name)}</b><br>${escapeHtml(totalAttempts(l))} ${t('att')} · ${escapeHtml(formatDate(l.date))}`;
            tp.querySelector('img')?.addEventListener('error', e => e.target.remove());
        }
    }
    tp.style.display = 'block';
    tp.style.left = Math.max(4, Math.min(e.clientX + 14, innerWidth - 250)) + 'px';
    tp.style.top = Math.max(4, Math.min(e.clientY + 14, innerHeight - tp.offsetHeight - 10)) + 'px';
};
/** Another tab saved: load its data so this tab's next save does not overwrite it. Open forms are left alone. */
window.addEventListener('storage', e => {
    if (e.key != 'gdp' || !e.newValue)
        return;
    const cur = store.cur;
    try {
        store = JSON.parse(e.newValue);
    }
    catch {
        return;
    }
    activateProfile(store.profs[cur] ? cur : store.cur);
    if (!qs('form, .modal'))
        render();
});
