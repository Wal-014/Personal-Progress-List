/**
 * Custom dialogs, notifications, tag management and legal text.
 */

function alerts() {
    if (!canEdit())
        return [];
    const A = [], lk = l => `<a class=lk data-act=edit data-id="${escapeHtml(l.id)}" role=button tabindex=0>${escapeHtml(l.name)}</a>`;
    ['classic', 'platform'].forEach(k => {
        const u = profile.levels.filter(l => l.kind == k && !isPre(l) && !profile.order[k].includes(l.id));
        if (u.length)
            A.push(`${escapeHtml(t('aUnp'))} (${escapeHtml(t(k))}): ${u.map(lk).join(', ')}`);
    });
    profile.wishlists.forEach(w => w.items.filter(i => i.status == 'done' && !wishlistTransferred(i)).forEach(i => A.push(`${escapeHtml(t('aWish'))}: ${escapeHtml(i.name)} (${escapeHtml(w.name)})`)));
    const ni = profile.levels.filter(l => !l.levelId);
    if (ni.length)
        A.push(`${escapeHtml(t('aNoId'))} (${ni.length}): ${ni.map(lk).join(', ')}`);
    return A;
}

const bellUI = () => {
    const A = alerts();
    return `<div class=box><h2>${ICONS.bell} ${t('bell')}</h2>${A.length ? `<ul class=bl>${A.map(a => `<li>${a}</li>`).join('')}</ul>` : `<p>${t('nonot')}</p>`}<p class=dgb><button class=pri data-act=close>${t('close')}</button></p></div>`;
};

const legalUI = k => `<div class="box sm"><h2>${t(k)}</h2><p style="white-space:pre-wrap">${escapeHtml(t(k + 'Txt'))}</p><p class=dgb><button class=pri data-act=close>${t('close')}</button></p></div>`;

/** Promise-based replacement for alert, confirm and prompt. */
function showDialog({ title, msg, input, def, ok, cancel, danger, label, extra = '', enhance }) {
    return new Promise(res => {
        const m = document.createElement('dialog');
        m.className = 'modal';
        m.setAttribute('aria-labelledby', 'dgt');
        m.innerHTML = `<div class="box sm"><h2 id=dgt>${escapeHtml(title || '')}</h2>${msg ? `<p style="white-space:pre-wrap">${escapeHtml(msg)}</p>` : ''}${input ? `${label ? `<label for=dgi>${escapeHtml(label)}</label>` : ''}<input id=dgi${label ? '' : ' aria-labelledby=dgt'} value="${escapeHtml(def || '')}" style="width:100%">` : ''}${extra}<p class=dgb>${cancel === false ? '' : `<button data-r=0>${t('cancel')}</button>`}<button class="${danger ? ok ? 'dg bulk-delete' : 'dg' : 'pri'}" data-r=1>${ok || t('ok2')}</button></p></div>`;
        const read = enhance?.(m);
        document.body.appendChild(m);
        m.showModal();
        const i = m.querySelector('#dgi'), done = v => {
            m.close();
            m.remove();
            res(v);
        }, accept = () => {
            if (i && !i.value.trim()) {
                i.setCustomValidity(t('errName'));
                return i.reportValidity();
            }
            done(read ? read(i.value.trim()) : i ? i.value.trim() : true);
        };
        if (i) {
            i.oninput = () => i.setCustomValidity('');
            i.focus();
            i.select();
        }
        else
            m.querySelector(danger && ok ? '[data-r="0"]' : '[data-r="1"]').focus();
        m.onclick = e => {
            e.stopPropagation();
            const r = e.target.dataset.r;
            if (r != null)
                r == '1' ? accept() : done(i ? null : false);
        };
        m.onkeydown = e => {
            e.stopPropagation();
            if (e.key == 'Enter' && !e.target.closest('button, summary, .cube-catalog')) {
                e.preventDefault();
                accept();
            }
            if (e.key == 'Escape')
                done(i ? null : false);
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
        catalog.querySelector('.cube-grid').innerHTML = tiles;
        catalog.querySelector('output').textContent = start + '–' + end + ' / ' + CUBE_COUNT;
        catalog.querySelector('[data-page="-1"]').disabled = page == 0;
        catalog.querySelector('[data-page="1"]').disabled = end == CUBE_COUNT;
    };
    const toggle = catalog.querySelector('[aria-controls]'), optionsPanel = catalog.querySelector('#cube-options');
    catalog.onclick = event => {
        const button = event.target.closest('button');
        if (!button) return;
        if (button == toggle) {
            optionsPanel.hidden = !optionsPanel.hidden;
            toggle.setAttribute('aria-expanded', String(!optionsPanel.hidden));
            if (!optionsPanel.hidden) draw();
        }
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
        const swatch = ([presetKey, c]) => `<label class=profile-swatch style="--swatch:${c}"><input type=radio name="profile-${key}" value="${c}" aria-label="${t(presetKey)}"${c == current ? ' checked' : ''}><span class=profile-color aria-hidden=true>${ICONS.check}</span></label>`;
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
    return showDialog({ title, ok: t('save'), input: 1, def: name, label: t('pname'), extra: profileColorFields(selected) + `<div class=cube-catalog><button type=button aria-controls=cube-options aria-expanded=false>${t('selectIcon')}${ICONS.chevronDown}</button><div id=cube-options hidden><div class=cube-pager><button type=button data-page="-1" aria-label="${t('previousPage')}">&lsaquo;</button><output></output><button type=button data-page="1" aria-label="${t('nextPage')}">&rsaquo;</button></div><div class=cube-grid></div></div></div>`, enhance: m => {
        bindProfileColors(m, selected, bindCubeCatalog(m, selected));
        return name => ({ name, ...selected });
    } });
}

const askConfirm = (title, ok) => showDialog({ title, ok, danger: 1 });

const showAlert = msg => showDialog({ title: msg, cancel: false });

const openModal = h => {
    qs('#md').innerHTML = `<dialog class=modal>${h}</dialog>`;
    const d = qs('#md dialog'), title = d.querySelector('h2, h3');
    if (title) {
        title.id = 'mdt';
        d.setAttribute('aria-labelledby', 'mdt');
    }
    d.addEventListener('close', () => d.remove());
    d.showModal();
    // The add-level dialog lists the tags under its tag search, like the edit panel does after render()
    renderTagSuggestions();
};

const closeModal = () => {
    qs('#md dialog')?.close();
    qs('#md').innerHTML = '';
};

function tagsUI() {
    const row = (tag, index) => {
        const existing = index != null, name = escapeHtml(tag.name), color = isHexColor(tag.color) ? tag.color : '#947bd2';
        const colorLabel = t('color') + (existing ? ' &middot; ' + name : '');
        const reserved = existing && tag.name == PRE_TAG;
        return `<div class=trow><label class="tag-swatch chip" style="--tag-color:${color}" title="${colorLabel}"><span>${name || t('newTag')}</span><input type=color ${existing ? 'data-tc=' + index : 'id=nc'} value="${color}" aria-label="${colorLabel}"></label>
<input ${existing ? 'data-tn=' + index : 'id=nn'} value="${name}" maxlength="${TAG_NAME_LIMIT}" placeholder="${t('newTag')}" aria-label="${t(existing ? 'name' : 'newTag')}" aria-describedby="tag-limit${reserved ? ' tg-pre' : ''}">
${existing ? `<button class="xs dg" data-act=tdel data-i=${index} aria-label="${t('del')} &middot; ${name}">${ICONS.listClear}</button>` : `<button class=pri data-act=tadd>${t('add')}</button>`}</div>${reserved ? `<small id=tg-pre class=by>${t('preTagHint')}</small>` : ''}`;
    };
    return `<div class="box tag-manager"><h2>${ICONS.navTags} ${t('tagsT')}</h2><p id=tag-limit class=by>${t('tagNameLimit').replace('{n}', TAG_NAME_LIMIT)}</p>${profile.tags.map(row).join('')}${row({ name: '' })}<p class=dgb><button data-act=close>${t('close')}</button></p></div>`;
}

let toastTimer = null;

/** Announces brief feedback outside the app so redraws preserve it. */
function showToast(text) {
    const toast = qs('#toast');
    if (!toast)
        return;
    clearTimeout(toastTimer);
    toast.textContent = text;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}
