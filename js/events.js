/**
 * Global click, form, keyboard and tooltip handlers identified by data-act.
 */

/** Re-renders behind the pause menu and reopens it, keeping focus on the control that was used. */
function reopenPause(selector) {
    render();
    openModal(pauseUI());
    qs('#md ' + selector)?.focus();
}

function setAppearance(field, value) {
    if (cloudUser) {
        applyCloudSettings({ [field]: value });
        save();
    }
    else {
        ui[field] = value;
        localStorage[field == 'theme' ? 'gt' : 'gbg'] = value;
    }
    reopenPause(`[data-act=${field}][data-v=${value}]`);
}

/** Zooms the timeline by a factor, keeping the same date in the middle of the view. */
function zoomTimeline(factor) {
    const w = qs('#tlw'), r = (w.scrollLeft + w.clientWidth / 2) / w.scrollWidth;
    ui.z = Math.min(160, Math.max(6, ui.z * factor));
    renderTimeline();
    const n = qs('#tlw');
    n.scrollLeft = r * n.scrollWidth - n.clientWidth / 2;
}

window.addEventListener('resize', () => syncDrawer());

/** What each data-act value does when clicked. Handlers get the clicked element and its data-id. */
const ACTIONS = {
    drawer: () => setDrawer(!ui.drawer),
    drawerclose: () => setDrawer(false),
    pnew: () => editLocalProfile(true),
    pedit: () => editLocalProfile(false),
    dthadd: a => addDeath(a),
    dthedit: a => editDeath(a),
    dthremove: a => removeDeath(a),
    dthcancel: a => cancelDeathEdit(a),
    dthresolve: a => resolveDeath(a),
    myprogress: () => backToMyProgress(),
    ashare: () => shareDialog(),
    asharestate: a => setProfileVisibility(a),
    acopy: () => copyProfileLink(),
    localdata: () => openModal(localDataDialog()),
    localuse(a, id) {
        if (cloudUser || !store.profs[id] || store.cur == id)
            return;
        activateProfile(id);
        matchWithAredl(profile.levels);
        ui.sel = ui.wl = null;
        localStorage.gdp = JSON.stringify(store);
        closeModal();
        render();
    },
    localimport() {
        closeModal();
        qs('#fi').click();
    },
    localbackup: (a, id) => downloadLocalBackup(id),
    localbring: (a, id) => openLocalMigration(id),
    localdelete: (a, id) => deleteLocalProfile(id),
    migrationbackup: () => downloadMigrationBackup(),
    migrationlater: () => deferMigration(),
    migrationconfirm: a => submitMigration(a),
    asignin: () => openAuthDialog(),
    amode: a => openAuthDialog(a.dataset.v),
    agoogle: a => continueWithGoogle(a),
    aresend: a => resendAccountEmail(a),
    apw: a => toggleAccountPassword(a),
    aprofile: () => openModal(profileCard()),
    aedit: () => openProfileForm(),
    asettings: () => settingsDialog(),
    apassword: () => passwordDialog(),
    adelete: a => confirmAccountDeletion(a),
    asignout: a => signOutFromMenu(a),
    csync: () => retryCloudSync(),
    tab(a) {
        ui.tab = a.dataset.v;
        resetListFilters();
        ui.wl = null;
        ui.sel = null;
        ui.edit = 0;
        render();
    },
    pause: () => openModal(pauseUI()),
    theme: a => setAppearance('theme', themeOf(a.dataset.v)),
    background: a => setAppearance('background', backgroundOf(a.dataset.v)),
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
        const step = Number(i.step) || 1, precision = (String(step).split('.')[1] || '').length;
        i.value = Number(Math.max(mn, Math.min(mx, Math.round(((+i.value || 0) + +a.dataset.d * step) / step) * step)).toFixed(precision));
        i.dispatchEvent(new Event('input', { bubbles: true }));
    },
    lang(a) {
        if (cloudUser) {
            applyCloudSettings({ lang: a.dataset.v });
            save();
        }
        else
            ui.lang = localStorage.gl = a.dataset.v;
        if (a.closest('.pause'))
            reopenPause(`[data-act=lang][data-v=${a.dataset.v}]`);
        else
            render();
    },
    listchoices(button) {
        ui.listsExpanded = button.getAttribute('aria-expanded') != 'true';
        button.setAttribute('aria-expanded', String(ui.listsExpanded));
        qs('#hlists').inert = !ui.listsExpanded;
    },
    zi: () => zoomTimeline(1.5),
    zo: () => zoomTimeline(1 / 1.5),
    'ranking-mode': a => setRankingMode(a.dataset.v),
    'ranking-metric': a => setRankingMetric(a.dataset.v),
    'ranking-order': () => setRankingOrder(),
    'ranking-all': () => setRankingAll(),
    'compare-toggle': () => toggleComparison(),
    'compare-close': () => closeComparison(),
    'compare-pick': (a, id) => pickComparisonLevel(id),
    'compare-option': (button, id) => {
        selectComparisonSlot(+button.dataset.v, id);
        qs('[data-act=compare-clear][data-v="' + button.dataset.v + '"]')?.focus({ preventScroll: true });
    },
    'compare-clear': a => clearComparisonSlot(+a.dataset.v),
    'timeline-metric': a => setTimelineMetric(a.dataset.v),
    add() {
        // The edit form in the panel and the new-level form use the same ids, so only one can be open
        if (ui.edit) {
            ui.edit = 0;
            renderPanel();
        }
        openModal(levelForm());
        qs('#gdq').focus();
    },
    edit(a, id) {
        const openedFromDialog = !!qs('#md .modal'), l = findLevel(id);
        closeModal();
        if (l)
            ui.tab = l.kind;
        ui.sel = id;
        ui.edit = 1;
        if (openedFromDialog)
            resetListFilters();
        render();
        if (openedFromDialog)
            scrollSel();
    },
    lvclose() {
        const returnId = !ui.edit && ui.sel;
        if (!ui.edit)
            ui.sel = null;
        ui.edit = 0;
        render();
        if (returnId && innerWidth <= 900) {
            qs(`.lv[data-id="${CSS.escape(returnId)}"]`)?.focus({ preventScroll: true });
            scrollTo({ top: ui.listReturnY || 0 });
        }
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
        if (canEdit())
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
        qs('#gdq').focus();
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
    wstatus: (a, id) => setWishlistStatus(id, a.dataset.v),
    wask: (a, id) => askTransfer(currentWishlist().items.find(i => i.id == id), false),
    wto: (a, id) => transferWishlistItem(id, a.dataset.v)
};

function downloadLocalBackup(id) {
    const pr = store.profs[id], u = URL.createObjectURL(new Blob([JSON.stringify({ ...pr.data, profileName: pr.name, profileCubeId: pr.cubeId, profileColor: pr.color, profileSecondaryColor: pr.secondaryColor })], { type: 'application/json' })), x = document.createElement('a');
    x.href = u;
    // Only characters that file systems reject are replaced, so accents and non-Latin names survive
    x.download = (pr.name.trim().replace(/[/:*?"<>|\s]+/g, '-') || 'profile') + '.json';
    x.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
}

function saveLevel(form) {
    const durations = ['tN', 'tP', 'tPC'].map(field => readDuration(form, field));
    if (durations.some(Number.isNaN)) {
        form.reportValidity();
        return;
    }
    const position = form.elements.pos.value, old = findLevel(form.dataset.id), level = old || { id: newId('n') };
    const fields = levelFromForm(form), maximum = maxRankPosition(fields.kind, level.id);
    Object.assign(level, fields);
    if (!old)
        profile.levels.push(level);
    matchWithAredl([level]);
    matchWithDemonlist([level]);
    removeFromOrder(level.id);
    if (position && !isPre(level)) {
        const order = profile.order[level.kind], before = rankedIds(level.kind)[Math.max(1, Math.min(maximum, +position)) - 1];
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
    const selected = await askProfile(t('impP'), { ...(validCubeId(data.profileCubeId) ? { cubeId: data.profileCubeId } : {}), name: data.profileName || file.name.replace(/\.json$/, ''), color: isHexColor(data.profileColor) ? data.profileColor : nextProfileColor(), secondaryColor: isHexColor(data.profileSecondaryColor) ? data.profileSecondaryColor : DEFAULT_SECONDARY_COLOR });
    if (!selected)
        return;
    const id = newId('p');
    delete data.profileCubeId;
    delete data.profileName;
    delete data.profileColor;
    delete data.profileSecondaryColor;
    store.profs[id] = { ...selected, data };
    if (!cloudUser) {
        activateProfile(id);
        ui.sel = ui.wl = null;
        matchWithAredl(profile.levels);
    }
    localStorage.gdp = JSON.stringify(store);
    render();
    if (cloudUser)
        openModal(localDataDialog());
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
        if (ui.drawer && k != 'listchoices' && a.closest('#shell-sidebar'))
            setDrawer(false);
        if (a.closest('.pause') && ['wnew', 'tags', 'legal'].includes(k))
            closeModal();
        a.closest(':popover-open')?.hidePopover();
        ACTIONS[k]?.(a, a.dataset.id);
        return;
    }
    const l = c && !e.target.closest('form') && findLevel(c.dataset.id);
    if (l) {
        if (c.classList.contains('pt')) {
            ui.tab = l.kind;
            ui.sel = l.id;
            ui.edit = 0;
            resetListFilters();
            render();
            scrollSel();
        }
        else if (c.classList.contains('lv'))
            selectLevel(c.dataset.id);
    }
};
document.body.onsubmit = e => {
    e.preventDefault();
    if (e.target.id == 'af')
        return submitAuth(e.target);
    if (e.target.id == 'pf')
        return submitAccountProfile(e.target);
    if (e.target.id == 'pwf')
        return submitAccountPassword(e.target);
    if (e.target.id == 'ef')
        return submitAccountEmail(e.target);
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
    if (e.target.dataset.deathField != null)
        return deathInputChanged(e.target);
    if (['pf', 'pwf'].includes(e.target.form?.id))
        return accountFormInput(e.target);
    if (e.target.dataset.compareSlot != null) {
        e.target.nextElementSibling.hidden = false;
        return setComparisonSearch(e.target);
    }
    if (['fm', 'wf'].includes(e.target.form?.id))
        e.target.setCustomValidity(fieldError(e.target.name, e.target.value));
    if (e.target.form?.id == 'fm' && (/^(?:attC|attN|t(?:N|P|PC)_[hms])$/.test(e.target.name)))
        updateTotals(e.target.form);
    if (e.target.id == 'tgq')
        renderTagSuggestions();
    if (e.target.id == 'gdq')
        scheduleLevelSearch();
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
    if (ds.wp != null)
        return setWishlistPercent(input);
    if (ds.tc != null)
        return setTagColor(input);
    if (ds.tn != null)
        return renameTag(input);
    if (input.id == 'fi') {
        if (input.files[0])
            importProfile(input.files[0]);
        input.value = '';
    }
};
function popoverPlacement(rect, viewport, menuHeight) {
    const width = Math.min(360, viewport.width - 24);
    const below = Math.max(0, viewport.height - rect.bottom - 18), above = Math.max(0, rect.top - 18);
    const useBelow = menuHeight <= below || below >= above, maxHeight = useBelow ? below : above;
    const top = useBelow ? rect.bottom + 6 : rect.top - 6 - Math.min(menuHeight, maxHeight);
    return { width: width + 'px', left: Math.max(12, Math.min(rect.left, viewport.width - width - 12)) + 'px',
        top: Math.max(12, Math.min(top, viewport.height - Math.min(menuHeight, maxHeight) - 12)) + 'px', maxHeight: maxHeight + 'px' };
}

// Popovers open in the top layer, away from their buttons, so place each menu next to its own button inside the viewport.
function placePopover(event) {
    const menu = event.target;
    if (!menu.matches('.pmenu') || event.newState != 'open')
        return;
    const button = event.source || qs(`[popovertarget="${CSS.escape(menu.id)}"]`);
    if (!button)
        return;
    const rect = button.getBoundingClientRect(), viewport = { width: innerWidth, height: innerHeight };
    // Hidden popovers have no dimensions; measure at the final width before choosing a side.
    Object.assign(menu.style, { width: popoverPlacement(rect, viewport, 0).width, maxHeight: 'none', display: 'flex' });
    const height = menu.offsetHeight;
    menu.style.display = '';
    Object.assign(menu.style, popoverPlacement(rect, viewport, height));
}

document.addEventListener('beforetoggle', placePopover, true);

let recoveryDialogOpened = false;

function accountRendered() {
    finishAccountSignIn();
    if (!account.recovering)
        recoveryDialogOpened = false;
    if (account.status == 'signed-in' && account.recovering && !recoveryDialogOpened && !qs('dialog[open]')) {
        recoveryDialogOpened = true;
        passwordDialog();
    }
    if (canEdit() && cloudUser)
        queueMicrotask(maybeOfferMigration);
}

document.addEventListener('close', () => queueMicrotask(accountRendered), true);
/** Fits an open dropdown panel inside the viewport. */
document.addEventListener('toggle', e => {
    if (e.target.matches('.ms[open]')) {
        const optionsPanel = e.target.querySelector('.msp'), panelTop = optionsPanel.getBoundingClientRect().top;
        optionsPanel.style.setProperty('--ms-height', Math.max(0, innerHeight - panelTop - 12) + 'px');
    }
}, true);
document.addEventListener('focusout', e => durationBlur(e));
document.onkeydown = e => {
    if (ui.drawer && drawerKeydown(e))
        return;
    const picker = e.target.closest?.('.compare-picker');
    if (picker && ['Escape', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        const input = picker.querySelector('input'), options = [...picker.querySelectorAll('button')];
        e.preventDefault();
        if (e.key == 'Escape') {
            input.focus();
            picker.querySelector('.compare-options').hidden = true;
        }
        else if (options.length) {
            picker.querySelector('.compare-options').hidden = false;
            const index = options.indexOf(e.target);
            const next = e.key == 'ArrowDown' ? index + 1 : (index < 0 ? options.length : index) - 1;
            options[(next + options.length) % options.length].focus();
        }
        return;
    }
    if (e.target.dataset.duration)
        return durationKeydown(e);
    if (e.key == 'Enter' && e.target.dataset.deathField != null)
        return deathInputKeydown(e);
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
    const tp = qs('#tip'), h = e.target.closest('[data-hp]'), p = e.target.closest('.pt'), k = h ? 'h' + h.dataset.hp : p ? 'p' + p.dataset.id + ui.timelineMetric : '';
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
            tp.innerHTML = timelineTooltip(findLevel(p.dataset.id));
            tp.querySelector('img')?.addEventListener('error', ({ target }) => target.remove());
        }
    }
    tp.style.display = 'block';
    tp.style.left = Math.max(4, Math.min(e.clientX + 14, innerWidth - 250)) + 'px';
    tp.style.top = Math.max(4, Math.min(e.clientY + 14, innerHeight - tp.offsetHeight - 10)) + 'px';
};
/** Another tab saved: load its data so this tab's next save does not overwrite it. Open forms are left alone. */
window.addEventListener('storage', e => {
    if (!canEdit())
        return;
    if (cloudUser) {
        if (e.key == 'gcloud:' + cloudUser && e.newValue)
            reloadCloudCache();
        return;
    }
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

function openLocalMigration(id) {
    if (cloudUser && cloudSession?.pulled && store.profs[id] && !(migratedLocalProfiles()[cloudUser] || []).includes(id))
        openModal(migrationDialog(id));
}

function downloadMigrationBackup() {
    const selected = qs('#migration [name=local-profile]:checked');
    if (selected)
        downloadLocalBackup(selected.value);
}

async function submitMigration(button) {
    const selected = qs('#migration [name=local-profile]:checked');
    if (!selected || button.disabled)
        return;
    button.disabled = true;
    try {
        await bringLocalProfile(selected.value, qs('#migration-identity').checked);
    }
    finally {
        button.disabled = false;
    }
}

function canDeleteLocalProfile(id) {
    return !!store.profs[id] && Object.keys(store.profs).length > 1 && (!!cloudUser || store.cur != id);
}

async function deleteLocalProfile(id) {
    if (!canDeleteLocalProfile(id))
        return;
    const ok = await showDialog({ title: t('localDeleteConfirm'), msg: store.profs[id].name, danger: 1 });
    if (!ok || !canDeleteLocalProfile(id))
        return;
    const next = { ...store, profs: { ...store.profs } };
    delete next.profs[id];
    if (next.cur == id)
        next.cur = Object.keys(next.profs)[0];
    try {
        localStorage.gdp = JSON.stringify(next);
    }
    catch {
        return showAlert(t('cloudStorage'));
    }
    store = next;
    render();
    openModal(localDataDialog());
    showToast(t('localDeleted'));
}
