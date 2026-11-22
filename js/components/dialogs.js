/**
 * Custom dialogs, notifications, tag management and legal text.
 */

function notificationRow({ id, icon, title, text, action, dismiss }) {
    const attributes = Object.entries(action.data).map(([key, value]) => ` data-${key}="${escapeHtml(value)}"`).join('');
    const primary = `<button type=button class=xs-txt aria-label="${escapeHtml(action.label + ' · ' + title)}" data-act="${escapeHtml(action.act)}"${attributes}>${escapeHtml(action.label)}</button>`;
    const secondary = dismiss ? `<button type=button class="xs-txt notification-dismiss" aria-label="${escapeHtml(dismiss.label + ' · ' + title)}" data-act="${escapeHtml(dismiss.act)}" data-id="${escapeHtml(id)}">${escapeHtml(dismiss.label)}</button>` : '';
    return `<li class=notification-row><span class=notification-icon aria-hidden=true>${icon}</span><div class=notification-copy><strong>${escapeHtml(title)}</strong><p>${escapeHtml(text)}</p></div><div class=notification-actions>${primary}${secondary}</div></li>`;
}

function notificationBody() {
    const entries = notifications();
    const sections = [['notice', 'notificationNotices'], ['pending', 'notificationPending']].map(([section, heading]) => {
        const rows = entries.filter(entry => entry.section == section).map(notificationRow).join('');
        return rows ? `<section><h3>${t(heading)}</h3><ul class=notification-list role=list>${rows}</ul></section>` : '';
    }).join('');
    return sections ? `<div class=notification-sections>${sections}</div>` : `<div class=notification-empty>${ICONS.bell}<p>${t('nonot')}</p></div>`;
}

function bellUI() {
    return `<div class="box notification-box"><h2>${ICONS.bell} ${t('bell')}</h2>${notificationBody()}<p class=dgb><button class=pri data-act=close>${t('close')}</button></p></div>`;
}

const legalUI = k => `<div class="box sm"><h2>${t(k)}</h2><p class=dialog-message>${escapeHtml(t(k + 'Txt'))}</p><p class=dgb><button class=pri data-act=close>${t('close')}</button></p></div>`;

const dialogOpeners = new WeakMap();
let dialogTitleId = 0;
const dialogAnnouncements = '<div class=toast role=status></div><span class=visually-hidden data-bell-status role=status></span>';
const activeModal = () => [...document.querySelectorAll('dialog.modal[open]')].at(-1);

function overlayOpener(control = document.activeElement) {
    const popover = control?.closest?.('[popover]');
    const element = popover ? qs('[popovertarget="' + CSS.escape(popover.id) + '"]') : control;
    return { element, selector: element && qs('#app') ? controlSelector(element) : null };
}

function restoreOverlayFocus(opener) {
    const active = document.activeElement;
    if (active && active != document.body && (qs('#app')?.contains(active) || active.closest?.('dialog[open]')))
        return;
    const target = opener.selector ? qs(opener.selector) : opener.element;
    target?.focus({ preventScroll: true });
}

function keepModalTab(event) {
    if (event.key != 'Tab' || event.defaultPrevented)
        return;
    const controls = [...event.currentTarget.querySelectorAll('button, input, select, textarea, summary, a[href], [tabindex]')]
        .filter(control => control.tabIndex >= 0 && !control.matches(':disabled') && control.getClientRects().length);
    const first = controls[0], last = controls.at(-1), active = document.activeElement;
    const edge = event.shiftKey ? first : last, opposite = event.shiftKey ? last : first;
    const beyond = event.shiftKey ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING;
    if (!edge || active == edge || (active.tabIndex < 0 && (active.compareDocumentPosition(edge) & beyond))) {
        event.preventDefault();
        opposite?.focus();
    }
}

function setFieldError(input, message, feedback) {
    const id = input.id || 'tag-name-' + input.dataset.tn;
    const errorId = id + '-error';
    const describedBy = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter(value => value && value != errorId);
    const error = feedback || qs('#' + CSS.escape(errorId));
    if (message) {
        const hint = error || document.createElement('p');
        if (!error) {
            hint.id = errorId;
            hint.className = 'field-error';
            hint.setAttribute('role', 'alert');
            (input.closest('.trow, .password-field, .username-field, .gdq, .duration') || input).after(hint);
        }
        hint.textContent = message;
        input.setAttribute('aria-invalid', 'true');
        describedBy.push(errorId);
    }
    else {
        if (error) error.textContent = '';
        input.removeAttribute('aria-invalid');
    }
    if (describedBy.length) input.setAttribute('aria-describedby', describedBy.join(' '));
    else input.removeAttribute('aria-describedby');
}

/** Promise-based replacement for alert, confirm and prompt. */
function showDialog({ title, msg, input, def, ok, cancel, danger, label, extra = '', enhance, validate }) {
    return new Promise(res => {
        const opener = overlayOpener(), m = document.createElement('dialog');
        const titleId = 'dgt-' + ++dialogTitleId;
        m.className = 'modal';
        m.setAttribute('aria-labelledby', titleId);
        m.innerHTML = `<div class="box sm"><h2 class=prompt-title id=${titleId}>${escapeHtml(title || '')}</h2>${msg ? `<p class=dialog-message>${escapeHtml(msg)}</p>` : ''}${input ? `${label ? `<label for=dgi>${escapeHtml(label)}</label>` : ''}<input id=dgi${label ? '' : ' aria-labelledby=' + titleId} value="${escapeHtml(def || '')}"><p id=dgi-error class=field-error role=alert></p>` : ''}${extra}<p class=dgb>${cancel === false ? '' : `<button data-r=0>${t('cancel')}</button>`}<button class="${danger ? ok ? 'dg bulk-delete' : 'dg' : 'pri'}" data-r=1>${ok || t('ok2')}</button></p></div>${dialogAnnouncements}`;
        const read = enhance?.(m);
        document.body.appendChild(m);
        m.showModal();

        const i = m.querySelector('#dgi'), error = m.querySelector('#dgi-error'), canceled = i ? null : false;
        const done = value => {
            m.close();
            m.remove();
            restoreOverlayFocus(opener);
            res(value);
        };
        const accept = () => {
            const value = i?.value.trim();
            const message = i ? !value ? t('errName') : validate?.(value) : '';
            if (message) {
                setFieldError(i, message, error);
                i.focus();
                return;
            }
            done(read ? read(value) : i ? value : true);
        };
        m.addEventListener('keydown', keepModalTab);
        m.addEventListener('cancel', event => {
            event.preventDefault();
            done(canceled);
        });
        m.addEventListener('close', () => {
            m.remove();
            restoreOverlayFocus(opener);
            res(canceled);
        });
        if (i) i.oninput = () => setFieldError(i, '', error);
        if (danger && cancel !== false)
            m.querySelector('[data-r="0"]').focus();
        else if (i) {
            i.focus();
            i.select();
        }
        else
            m.querySelector('[data-r="1"]').focus();
        m.onclick = e => {
            e.stopPropagation();
            const r = e.target.dataset.r;
            if (r != null)
                r == '1' ? accept() : done(canceled);
        };
        m.onkeydown = e => {
            e.stopPropagation();
            if (e.defaultPrevented) return;
            if (e.key == 'Enter' && !e.target.closest('button, summary, .cube-catalog')) {
                e.preventDefault();
                accept();
            }
        };
    });
}

const askText = (title, def) => showDialog({ title, input: 1, def });

const profilePreview = selected => selected.cubeId ? catalogCube(selected.cubeId, selected.color, selected.secondaryColor) + `<small>${t('cube')} ${selected.cubeId}</small>` : cubeIcon(selected.color, selected.secondaryColor);

function bindCubeCatalog(dialog, selected) {
    const catalog = dialog.querySelector('.cube-catalog');
    let page = Math.floor((selected.cubeId - 1) / CUBES_PER_PAGE);
    const draw = () => {
        const start = page * CUBES_PER_PAGE + 1, end = Math.min(start + CUBES_PER_PAGE - 1, CUBE_COUNT);
        const tiles = Array.from({ length: end - start + 1 }, (_, offset) => {
            const id = start + offset;
            return `<button type=button data-cube=${id} aria-pressed=${id == selected.cubeId} aria-label="${t('cube')} ${id}">${catalogCube(id, selected.color, selected.secondaryColor)}<span>${id}</span></button>`;
        }).join('');
        const focusedCube = document.activeElement?.dataset?.cube;
        const grid = catalog.querySelector('.cube-grid');
        grid.innerHTML = tiles;
        if (focusedCube) grid.querySelector('[data-cube="' + focusedCube + '"]')?.focus({ preventScroll: true });
        catalog.querySelector('output').textContent = start + '–' + end + ' / ' + CUBE_COUNT;
        catalog.querySelector('[data-page="-1"]').disabled = page == 0;
        catalog.querySelector('[data-page="1"]').disabled = end == CUBE_COUNT;
    };
    const toggle = catalog.querySelector('[aria-controls]'), optionsPanel = catalog.querySelector('#cube-options');
    function setCatalogOpen(open) {
        optionsPanel.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        if (open) {
            draw();
            (optionsPanel.querySelector('[aria-pressed=true]') || optionsPanel.querySelector('[data-cube]')).focus();
        }
        else toggle.focus();
    }
    catalog.onkeydown = event => {
        if (event.key == 'Escape' && !optionsPanel.hidden) {
            event.preventDefault();
            setCatalogOpen(false);
        }
    };
    catalog.onclick = event => {
        const button = event.target.closest('button');
        if (!button) return;
        if (button == toggle)
            setCatalogOpen(optionsPanel.hidden);
        else if (button.dataset.page) {
            page += Number(button.dataset.page);
            draw();
            if (button.disabled) catalog.querySelector('.cube-grid button').focus();
        }
        else {
            selected.cubeId = Number(button.dataset.cube);
            catalog.querySelectorAll('[data-cube]').forEach(tile => tile.setAttribute('aria-pressed', String(tile == button)));
            dialog.querySelector('.profile-preview').innerHTML = profilePreview(selected);
        }
    };
    return () => { if (!optionsPanel.hidden) draw(); };
}

function profileColorFields(selected) {
    const colorGroup = (key, labelKey) => {
        const current = selected[key].toLowerCase(), labelId = 'profile-' + key;
        const swatch = ([presetKey, c]) => `<label class=profile-swatch data-swatch="${escapeHtml(c)}"><input type=radio name="profile-${key}" value="${c}" aria-label="${t(presetKey)}"${c == current ? ' checked' : ''}><span class=profile-color aria-hidden=true>${ICONS.check}</span></label>`;
        return `<div><span class=lab id="${labelId}">${t(labelKey)}</span><div class=profile-swatches role=radiogroup aria-labelledby="${labelId}" data-color=${key}>${Object.entries(PROFILE_PRESETS).map(swatch).join('')}<span class="profile-swatch profile-custom" data-selected=${!PROFILE_COLORS.includes(current)}><input type=color value="${current}" aria-label="${t('customColor')}"><span class=profile-color aria-hidden=true>${ICONS.check}</span></span></div></div>`;
    };
    return `<fieldset class=profile-colors><legend>${t('color')}</legend><div class=profile-colors-row><span class=profile-preview>${profilePreview(selected)}</span><div class=profile-color-groups>${colorGroup('color', 'primaryColor')}${colorGroup('secondaryColor', 'secondaryColor')}</div></div></fieldset>`;
}

function bindProfileColors(root, selected, onChange) {
    const fieldset = root.querySelector('.profile-colors');
    fieldset.oninput = e => {
        const group = e.target.closest('.profile-swatches'), custom = group.querySelector('[type=color]'), isCustom = e.target == custom;
        selected[group.dataset.color] = e.target.value;
        group.querySelectorAll('[type=radio]').forEach(radio => radio.checked = !isCustom && radio.value == e.target.value);
        custom.parentNode.dataset.selected = isCustom;
        fieldset.querySelector('.profile-preview').innerHTML = profilePreview(selected);
        onChange?.();
    };
}

/** Asks for a profile name and colours, sharing the prompt's validation and keyboard handling. */
function askProfile(title, { name, color, secondaryColor, cubeId }) {
    const selected = { cubeId: validCubeId(cubeId) ? cubeId : 2, color: isHexColor(color) ? color : PROFILE_COLORS[0], secondaryColor: isHexColor(secondaryColor) ? secondaryColor : DEFAULT_SECONDARY_COLOR };
    return showDialog({ title, ok: t('save'), input: 1, def: name, label: t('pname'), extra: profileColorFields(selected) + `<div class=cube-catalog><button type=button id=cube-toggle aria-controls=cube-options aria-expanded=false>${t('selectIcon')}${ICONS.chevronDown}</button><div id=cube-options role=group aria-labelledby=cube-toggle hidden><div class=cube-pager><button type=button data-page="-1" aria-label="${t('previousPage')}">&lsaquo;</button><output></output><button type=button data-page="1" aria-label="${t('nextPage')}">&rsaquo;</button></div><div class=cube-grid></div></div></div>`, enhance: m => {
        bindProfileColors(m, selected, bindCubeCatalog(m, selected));
        return name => ({ name, ...selected });
    } });
}

const askConfirm = (title, ok) => showDialog({ title, ok, danger: 1 });

const showAlert = msg => showDialog({ title: msg, cancel: false });

const openModal = h => {
    const host = qs('#md'), previous = qs('#md dialog');
    const opener = previous?.open ? dialogOpeners.get(previous) : overlayOpener();
    host.innerHTML = '<dialog class=modal>' + h + dialogAnnouncements + '</dialog>';
    const dialog = qs('#md dialog'), title = dialog.querySelector('h2, h3');
    if (title) {
        title.id = 'mdt';
        dialog.setAttribute('aria-labelledby', 'mdt');
    }
    dialogOpeners.set(dialog, opener);
    dialog.addEventListener('keydown', keepModalTab);
    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        closeModal();
    });
    dialog.addEventListener('close', () => {
        dialog.remove();
        restoreOverlayFocus(opener);
    });
    dialog.showModal();
    // The add-level dialog lists the tags under its tag search, like the edit panel does after render()
    renderTagSuggestions();
};

const closeModal = () => {
    const dialog = qs('#md dialog'), opener = dialog && dialogOpeners.get(dialog);
    dialog?.close();
    qs('#md').innerHTML = '';
    if (opener) restoreOverlayFocus(opener);
};

function tagsUI() {
    const row = (tag, index) => {
        const existing = index != null, name = escapeHtml(tag.name), color = isHexColor(tag.color) ? tag.color : '#947bd2';
        const colorLabel = t('color') + (existing ? ' &middot; ' + name : '');
        const reserved = existing && tag.name == PRE_TAG;
        return `<div class=trow><label class="tag-swatch chip" data-tag-color="${escapeHtml(color)}" title="${colorLabel}"><span>${name || t('newTag')}</span><input type=color ${existing ? 'data-tc=' + index : 'id=nc'} value="${color}" aria-label="${colorLabel}"></label>
<input ${existing ? 'data-tn=' + index : 'id=nn autofocus'} value="${name}" maxlength="${TAG_NAME_LIMIT}" placeholder="${t('newTag')}" aria-label="${t(existing ? 'name' : 'newTag')}" aria-describedby="tag-limit${reserved ? ' tg-pre' : ''}">
${existing ? `<button class="xs dg" data-act=tdel data-i=${index} aria-label="${t('del')} &middot; ${name}">${ICONS.listClear}</button>` : `<button class=pri data-act=tadd>${t('add')}</button>`}</div>${reserved ? `<small id=tg-pre class=by>${t('preTagHint')}</small>` : ''}`;
    };
    return `<div class="box tag-manager"><h2>${ICONS.navTags} ${t('tagsT')}</h2><p id=tag-limit class=by>${t('tagNameLimit').replace('{n}', TAG_NAME_LIMIT)}</p>${profile.tags.map(row).join('')}${row({ name: '' })}<p class=dgb><button data-act=close>${t('close')}</button></p></div>`;
}

let toastTimer = null, activeToast = null;

/** Announces brief feedback outside the app so redraws preserve it. */
function showToast(text) {
    // A follow-up dialog opened in the same turn needs to own the announcement.
    queueMicrotask(() => displayToast(text));
}

function displayToast(text) {
    const toast = activeModal()?.querySelector('.toast') || qs('#toast');
    if (!toast)
        return;
    clearTimeout(toastTimer);

    if (activeToast && activeToast != toast) {
        activeToast.textContent = '';
        activeToast.classList.remove('show');
    }
    activeToast = toast;
    if (toast.textContent != text) toast.textContent = text;
    toast.classList.add('show');
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
        toast.textContent = '';
        activeToast = null;
    }, 4000);
}
