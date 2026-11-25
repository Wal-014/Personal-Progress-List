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
    document.documentElement.dataset[field == 'theme' ? 'theme' : 'bg'] = value;
    document.querySelectorAll('#md .pause [data-act=' + field + ']').forEach(option => {
        option.setAttribute('aria-pressed', String(option.dataset.v == value));
    });
}

/** Zooms the timeline by a factor, keeping the same date in the middle of the view. */
function zoomTimeline(factor) {
    const w = qs('#tlw'), r = (w.scrollLeft + w.clientWidth / 2) / w.scrollWidth;
    ui.z = Math.min(160, Math.max(6, ui.z * factor));
    renderTimeline();
    const n = qs('#tlw');
    n.scrollLeft = r * n.scrollWidth - n.clientWidth / 2;
}

function resizeOverlays() {
    syncDrawer();
    if (viewing?.identity?.bio)
        updatePublicBio();
    const menu = qs('.pmenu:popover-open');
    if (menu?.closest('[inert]'))
        menu.hidePopover();
    else if (menu)
        placePopover({ target: menu, newState: 'open' });
}

window.addEventListener('resize', resizeOverlays);

function refreshRankings() {
    if (!rankingSync.running)
        return syncRankings({ force: true });
}

function activateLocalProfile(id) {
    activateProfile(id);
    matchWithAredl(profile.levels);
    matchWithDemonlist(profile.levels);
    autoSyncRankings();
}

/** What each data-act value does when clicked. Handlers get the clicked element and its data-id. */
const ACTIONS = {
    drawer: () => setDrawer(!ui.drawer),
    drawerclose: () => setDrawer(false),
    pedit: () => editLocalProfile(),
    dthadd: a => addDeath(a),
    dthedit: a => editDeath(a),
    dthremove: a => removeDeath(a),
    dthcancel: a => cancelDeathEdit(a),
    dthresolve: a => resolveDeath(a),
    myprogress: () => backToMyProgress(),
    publicbio: a => togglePublicBio(a),
    ashare: () => shareDialog(),
    asharestate: a => setProfileVisibility(a),
    acopy: () => copyProfileLink(),
    localdata: () => openModal(localDataDialog()),
    rankrefresh: refreshRankings,
    localuse(a, id) {
        if (cloudUser || !store.profs[id] || store.cur == id)
            return;
        activateLocalProfile(id);
        ui.sel = ui.wl = null;
        localStorage.gdp = JSON.stringify(store);
        closeModal();
        render();
    },
    localimport() {
        qs('#fi').click();
    },
    localbackup: (a, id) => downloadLocalBackup(id),
    localbring: (a, id) => openLocalMigration(id),
    localdelete: (a, id) => deleteLocalProfile(id),
    migrationbackup: () => downloadMigrationBackup(),
    migrationconfirm: a => submitMigration(a),
    asignin: () => openAuthDialog(),
    amode: a => openAuthDialog(a.dataset.v),
    agoogle: a => continueWithGoogle(a),
    aresend: a => resendAccountEmail(a),
    apw: a => toggleAccountPassword(a),
    aprofile: () => openProfileOverview(),
    aprofileback: a => backToProfile(a),
    aedit: a => openProfileForm(a),
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
        if (a.closest?.('.mode-switch'))
            qs('#q')?.focus({ preventScroll: true });
    },
    pause: () => openModal(pauseUI()),
    theme: a => setAppearance('theme', themeOf(a.dataset.v)),
    background: a => setAppearance('background', backgroundOf(a.dataset.v)),
    bell: () => openModal(bellUI()),
    notifwish: button => transferFromNotification(button),
    notiflocal: () => openNotificationMigration(),
    notifdismiss: button => hideNotification(button),
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
    'list-select': () => toggleLevelSelection(),
    'list-pick': (row, id) => pickListLevel(row, id),
    'list-delete': () => deleteSelectedLevels(),
    listchoices: button => setListChoices(button, !ui.listsExpanded),
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
    edit: (a, id) => openLevelEditor(id, !!qs('#md .modal')),
    lvclose() {
        const wasEditing = ui.edit, returnId = ui.sel;
        if (!ui.edit)
            ui.sel = null;
        ui.edit = 0;
        render();
        if (wasEditing)
            qs('.rcol [data-act=edit]')?.focus();
        else if (returnId != null && innerWidth <= 900)
            (qs(`.lv[data-id="${CSS.escape(returnId)}"]`) || qs('#q'))?.focus({ preventScroll: true });
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
    async del(a, id) {
        const deletionProfile = profile;
        if (!canEdit() || !await askConfirm(t('confirm')) || profile !== deletionProfile || !canEdit())
            return;
        profile.levels = profile.levels.filter(l => l.id != id);
        removeFromOrder(id);
        const wasSelected = ui.sel == id;
        currentLevelSelection()?.ids.delete(id);
        if (wasSelected) {
            ui.sel = null;
            ui.edit = 0;
        }
        save();
        closeModal();
        render();
        if (wasSelected)
            qs('.list-add')?.focus({ preventScroll: true });
    },
    tags: () => openModal(tagsUI()),
    tdel(a) {
        const ix = +a.dataset.i;
        askConfirm(t('confirmTag')).then(ok => {
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
        const input = qs('#nn'), n = input.value.trim(), error = tagNameError(n);
        if (error) {
            setFieldError(input, error);
            input.focus();
            return;
        }
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
            save();
            render();
            qs('#screen-title')?.focus({ preventScroll: true });
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
    gdpick: a => chooseLevelResult(a.form, levelSearch.results[a.dataset.i], a.matches(':focus-visible')),
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

function transferFromNotification(button) {
    if (!canEdit())
        return;
    const { w, id, v: kind } = button.dataset;
    const wishlist = profile.wishlists.find(candidate => candidate.id == w);
    const item = wishlist?.items.find(candidate => candidate.id == id);
    if (!item || item.status != 'done' || kind != item.kind || wishlistTransferred(item))
        return closeModal();
    ui.wl = wishlist.id;
    if (kind)
        return transferWishlistItem(id, kind);
    // The chooser only opens while its source wishlist is active and no other dialog is open.
    closeModal();
    ui.tab = 'wish';
    render();
    return askTransfer(item, false);
}

function openLevelEditor(id, revealInList) {
    const level = findLevel(id);
    closeModal();
    if (level)
        ui.tab = level.kind;
    ui.sel = id;
    ui.edit = 1;
    if (revealInList)
        resetListFilters();
    render();
    if (revealInList)
        scrollSel();
    focusLevelPanel();
}

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
    // Older notes may exceed the limit; they are kept as they are until shortened, never cut on save.
    const notesError = fieldError('notes', fields.notes || '');
    if (notesError) {
        form.elements.notes.setCustomValidity(notesError);
        form.reportValidity();
        return;
    }
    Object.assign(level, fields);
    if (!old)
        profile.levels.push(level);
    matchWithAredl([level]);
    matchWithDemonlist([level]);
    removeFromOrder(level.id);
    if (position) {
        const order = profile.order[level.kind], before = rankedIds(level.kind)[Math.max(1, Math.min(maximum, +position)) - 1];
        order.splice(before ? order.indexOf(before) : order.length, 0, level.id);
    }
    save();
    closeModal();
    if (ui.tab !== level.kind)
        resetListFilters();
    ui.sel = level.id;
    ui.edit = 0;
    ui.tab = level.kind;
    render();
    scrollSel();
    focusLevelPanel();
}

function setTagColor(input) {
    profile.tags[input.dataset.tc].color = input.value;
    save();
    render();
}

function updateTagPreview(input) {
    const label = input.parentElement.querySelector('.tag-swatch');
    const name = input.value.trim();
    label.querySelector('span').textContent = name || t('newTag');
    label.title = name ? t('color') + ' \u00b7 ' + name : t('color');
    label.querySelector('input').setAttribute('aria-label', label.title);
}

function tagNameError(name, current) {
    if (!name) return t('tagEmpty');
    if (name.length > TAG_NAME_LIMIT) return t('tagNameLimit').replace('{n}', TAG_NAME_LIMIT);
    if (profile.tags.some(tag => tag !== current && tag.name === name)) return t('tagExists');
    return '';
}

function renameTag(input) {
    const tag = profile.tags[input.dataset.tn], name = input.value.trim();
    if (name === tag.name) return;
    const error = tagNameError(name, tag);
    if (error) {
        setFieldError(input, error);
        return;
    }
    profile.levels.forEach(level => level.tags = (level.tags || []).map(x => x == tag.name ? name : x));
    ui.tagFilter = ui.tagFilter.map(selectedTag => selectedTag == tag.name ? name : selectedTag);
    tag.name = name;
    save();
    render();
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
        activateLocalProfile(id);
        ui.sel = ui.wl = null;
    }
    localStorage.gdp = JSON.stringify(store);
    render();
    const localDataOpen = !!qs('#md .local-data');
    if (cloudUser || localDataOpen) {
        openModal(localDataDialog());
        if (localDataOpen) qs('#md [data-act=localimport]').focus();
    }
}

function filterByTagChip(chip) {
    ui.tagFilter = [chip.dataset.tag];
    if (!isListTab())
        ui.tab = 'classic';
    closeModal();
    if (chip.closest?.('.rcol') && innerWidth <= 900) {
        ACTIONS.lvclose();
        qs('.lh .ms summary')?.focus({ preventScroll: true });
    }
    else
        render();
}

function runAction(button) {
    const k = button.dataset.act;
    const menu = button.closest(':popover-open');
    if (menu) {
        const opener = overlayOpener(button);
        menu.hidePopover();
        opener.element?.focus({ preventScroll: true });
    }
    const fromDrawer = ui.drawer && button.closest('#shell-sidebar') && !['listchoices', 'publicbio'].includes(k);
    if (fromDrawer && ['tab', 'localuse', 'myprogress'].includes(k))
        setDrawer(false);
    ACTIONS[k]?.(button, button.dataset.id);
    if (fromDrawer && ui.drawer && !qs('dialog[open]') && k != 'localimport')
        setDrawer(false);
}

function openClickedLevel(event, clickedCard) {
    const l = clickedCard && !event.target.closest('form') && findLevel(clickedCard.dataset.id);
    if (l) {
        if (clickedCard.classList.contains('pt')) {
            ui.tab = l.kind;
            ui.sel = l.id;
            ui.edit = 0;
            resetListFilters();
            render();
            scrollSel();
        }
        else if (clickedCard.classList.contains('lv'))
            selectLevel(clickedCard.dataset.id);
    }
}

document.body.onclick = e => {
    document.querySelectorAll('.ms[open]').forEach(d => {
        if (!d.contains(e.target))
            d.open = false;
    });
    const g = e.target.closest('[data-tag]'), a = e.target.closest('[data-act]'), c = e.target.closest('[data-id]');
    if (g && a?.dataset.act !== 'list-pick')
        return filterByTagChip(g);
    if (a)
        return runAction(a);
    openClickedLevel(e, c);
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
function onPaneScroll({ target: pane }) {
    if (pane.matches?.(SCROLL_PANES))
        updateScrollFades(pane);
}

document.addEventListener('scroll', onPaneScroll, { capture: true, passive: true });

const invalidForms = new WeakSet();

function showInvalidField(event) {
    const field = event.target, form = field.form;
    if (!form?.closest('dialog.modal') || field.dataset.deathField != null)
        return;
    event.preventDefault();
    setFieldError(field, field.validationMessage);
    if (!invalidForms.has(form)) {
        invalidForms.add(form);
        queueMicrotask(() => {
            invalidForms.delete(form);
            if (form.isConnected)
                field.focus();
        });
    }
}

document.addEventListener('invalid', showInvalidField, true);

function setListQuery(input) {
    ui.q = input.value.toLowerCase();
    renderList();
    if (!ui.q)
        scrollSel();
}

document.body.oninput = e => {
    if (e.target.getAttribute?.('aria-invalid') == 'true' && e.target.closest('dialog.modal') && e.target.dataset.deathField == null)
        setFieldError(e.target, '');
    if (e.target.dataset.tn != null || e.target.id == 'nn')
        updateTagPreview(e.target);
    if (e.target.dataset.tc != null || e.target.id == 'nc')
        e.target.parentElement.style.setProperty('--tag-color', e.target.value);
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
    if (e.target.id == 'q')
        setListQuery(e.target);
};
document.body.onchange = e => {
    const input = e.target, ds = input.dataset;
    if (input.id == 'pcountry')
        return updateCountryPreview(input);
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
}

document.addEventListener('close', () => queueMicrotask(accountRendered), true);
/** Fits an open dropdown panel inside the viewport. */
document.addEventListener('toggle', e => {
    const disclosure = e.target;
    if (!disclosure.matches('.ms'))
        return;
    const summary = disclosure.querySelector('summary');
    if (!disclosure.open) {
        if (disclosure.contains(document.activeElement))
            summary.focus();
        return;
    }
    const optionsPanel = disclosure.querySelector('.msp');
    if (!disclosure.closest('dialog')) {
        const panelTop = optionsPanel.getBoundingClientRect().top;
        optionsPanel.style.setProperty('--ms-height', Math.max(0, innerHeight - panelTop - 12) + 'px');
    }
    if (document.activeElement == summary)
        optionsPanel.querySelector('label:not([hidden]) input')?.focus({ preventScroll: true });
}, true);
document.addEventListener('focusout', e => durationBlur(e));
document.addEventListener('focusin', e => {
    if (e.target.dataset?.compareSlot != null)
        setComparisonTarget(+e.target.dataset.compareSlot);
});

/** Arrow keys move through a comparison picker's options, wrapping around, and Escape returns to its search box; true when the key was handled. */
function comparePickerKeydown(e) {
    const picker = e.target.closest?.('.compare-picker');
    if (!picker || !['Escape', 'ArrowDown', 'ArrowUp'].includes(e.key))
        return false;
    const input = picker.querySelector('input'), menu = picker.querySelector('.compare-options'), options = [...picker.querySelectorAll('button')];
    e.preventDefault();
    if (e.key == 'Escape') {
        input.focus();
        menu.hidden = true;
    }
    else if (options.length) {
        menu.hidden = false;
        const index = options.indexOf(e.target);
        const next = e.key == 'ArrowDown' ? index + 1 : (index < 0 ? options.length : index) - 1;
        options[(next + options.length) % options.length].focus();
    }
    return true;
}

/** Escape closes the open dropdown, or the level panel on narrow screens; true when it did. */
function escapeKeydown(e) {
    if (e.key != 'Escape')
        return false;
    const dropdown = e.target.closest('.ms[open]');
    if (dropdown) {
        e.preventDefault();
        e.stopPropagation();
        dropdown.open = false;
        dropdown.querySelector('summary').focus();
        return true;
    }
    if (e.target.closest?.('.rcol.has') && innerWidth <= 900 && !qs('dialog[open]')) {
        e.preventDefault();
        ACTIONS.lvclose();
        return true;
    }
    return false;
}

document.onkeydown = e => {
    if (e.key == 'Escape' && !qs('dialog[open]')) {
        const chooser = e.target.closest?.('#hlists, [data-act=listchoices]');
        if (chooser && ui.listsExpanded) {
            e.preventDefault();
            setListChoices(qs('[data-act=listchoices]'), false);
            return;
        }
    }
    if (ui.drawer && !qs('dialog[open]') && drawerKeydown(e))
        return;
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.target.matches?.('.lv')) {
        if (moveRankedLevel(e.target.dataset.id, e.key === 'ArrowUp' ? -1 : 1))
            e.preventDefault();
        return;
    }
    if (comparePickerKeydown(e) || escapeKeydown(e))
        return;
    if (e.target.dataset.duration)
        return durationKeydown(e);
    if (e.key == 'Enter' && e.target.dataset.deathField != null)
        return deathInputKeydown(e);
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
    if (store.profs[cur])
        activateProfile(cur);
    else
        activateLocalProfile(store.cur);
    if (!qs('form, .modal'))
        render();
});

function openLocalMigration(id) {
    if (cloudUser && cloudSession?.pulled && store.profs[id] && !(migratedLocalProfiles()[cloudUser] || []).includes(id))
        openModal(migrationDialog(id));
}

function openNotificationMigration() {
    if (localDataNotification())
        openModal(migrationDialog());
}

function hideNotification(button) {
    const box = button.closest('.notification-box');
    if (!box || !dismissNotification(button.dataset.id))
        return;
    box.querySelector('.notification-sections').outerHTML = notificationBody();
    render();
    box.querySelector('.notification-row button, [data-act=close]').focus();
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
