/**
 * Ventanas emergentes propias (confirmar, preguntar, avisar), avisos de la campana, gestor de tags y textos legales.
 */

/** Calcula los avisos pendientes (niveles sin colocar, sin ID o completados en wishlist). */
function alerts() {
    const A = [], lk = l => `<a class=lk data-act=edit data-id="${escapeHtml(l.id)}" role=button tabindex=0>${escapeHtml(l.name)}</a>`;
    ['classic', 'platform'].forEach(k => {
        const u = profile.levels.filter(l => l.kind == k && !isPre(l) && !profile.order[k].includes(l.id));
        if (u.length)
            A.push(`${escapeHtml(t('aUnp'))} (${escapeHtml(t(k))}): ${u.map(lk).join(', ')}`);
    });
    profile.wishlists.forEach(w => w.items.filter(i => i.status == 'done' && !i.added && !isInList(i, 'classic') && !isInList(i, 'platform')).forEach(i => A.push(`${escapeHtml(t('aWish'))}: ${escapeHtml(i.name)} (${escapeHtml(w.name)})`)));
    const ni = profile.levels.filter(l => !l.levelId);
    if (ni.length)
        A.push(`${escapeHtml(t('aNoId'))} (${ni.length}): ${ni.map(lk).join(', ')}`);
    return A;
}

/** Contenido de la campana de avisos. */
const bellUI = () => {
    const A = alerts();
    return `<div class=box><h2>${ICONS.bell} ${t('bell')}</h2>${A.length ? `<ul class=bl>${A.map(a => `<li>${a}</li>`).join('')}</ul>` : `<p>${t('nonot')}</p>`}<p class=dgb><button class=pri data-act=close>${t('close')}</button></p></div>`;
};

/** Ventana con términos, privacidad o créditos. */
const legalUI = k => `<div class="box sm"><h2>${t(k)}</h2><p style="white-space:pre-wrap">${escapeHtml(t(k + 'Txt'))}</p><p class=dgb><button class=pri data-act=close>${t('close')}</button></p></div>`;

/** Diálogo propio que devuelve una promesa (sustituye a alert, confirm y prompt). */
function showDialog({ title, msg, input, def, ok, cancel, danger, enhance }) {
    return new Promise(res => {
        const m = document.createElement('dialog');
        m.className = 'modal';
        m.setAttribute('aria-labelledby', 'dgt');
        m.innerHTML = `<div class="box sm"><h2 id=dgt>${escapeHtml(title || '')}</h2>${msg ? `<p style="white-space:pre-wrap">${escapeHtml(msg)}</p>` : ''}${input ? `<input id=dgi aria-labelledby=dgt value="${escapeHtml(def || '')}" style="width:100%">` : ''}<p class=dgb>${cancel === false ? '' : `<button data-r=0>${t('cancel')}</button>`}<button class="${danger ? 'dg' : 'pri'}" data-r=1>${ok || t('ok2')}</button></p></div>`;
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
        if (i)
            i.oninput = () => i.setCustomValidity('');
        if (i) {
            i.focus();
            i.select();
        }
        else
            m.querySelector('[data-r="1"]').focus();
        m.onclick = e => {
            e.stopPropagation();
            const r = e.target.dataset.r;
            if (r != null)
                r == '1' ? accept() : done(i ? null : false);
        };
        m.onkeydown = e => {
            e.stopPropagation();
            if (e.key == 'Enter') {
                e.preventDefault();
                accept();
            }
            if (e.key == 'Escape')
                done(i ? null : false);
        };
    });
}

/** Pide un texto al usuario. */
const askText = (title, def) => showDialog({ title, input: 1, def });

/** Asks for a profile name and colour, sharing the prompt's validation and keyboard handling. */
function askProfile(title, name, color) {
    let selected = isHexColor(color) ? color.toLowerCase() : PROFILE_COLORS[0];
    return showDialog({ title, input: 1, def: name, enhance: m => {
        const i = m.querySelector('#dgi'), row = document.createElement('div');
        row.className = 'profile-name';
        row.innerHTML = `<span class=profile-preview>${cubeIcon(selected)}</span><label for=dgi>${t('pname')}</label>`;
        i.before(row);
        row.appendChild(i);
        i.removeAttribute('aria-labelledby');
        const swatch = ([key, c]) => `<label class=profile-swatch style="--swatch:${c}"><input type=radio name=profile-color value="${c}" aria-label="${t(key)}"${c == selected ? ' checked' : ''}><span class=profile-color aria-hidden=true>${ICONS.check}</span></label>`;
        row.insertAdjacentHTML('afterend', `<fieldset class=profile-colors><legend>${t('color')}</legend><div class=profile-swatches>${Object.entries(PROFILE_PRESETS).map(swatch).join('')}<span class="profile-swatch profile-custom" data-selected=${!PROFILE_COLORS.includes(selected)}><input type=color value="${selected}" aria-label="${t('customColor')}"><span class=profile-color aria-hidden=true>${ICONS.check}</span></span></div></fieldset>`);
        const fieldset = m.querySelector('.profile-colors'), custom = fieldset.querySelector('[type=color]');
        fieldset.oninput = e => {
            selected = e.target.value;
            const isCustom = e.target == custom;
            fieldset.querySelectorAll('[type=radio]').forEach(radio => radio.checked = !isCustom && radio.value == selected);
            custom.parentNode.dataset.selected = isCustom;
            row.querySelector('.profile-preview').innerHTML = cubeIcon(selected);
        };
        return name => ({ name, color: selected });
    } });
}

/** Pide confirmación. */
const askConfirm = title => showDialog({ title, danger: 1 });

/** Muestra un aviso. */
const showAlert = msg => showDialog({ title: msg, cancel: false });

/** Abre una ventana modal. */
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

/** Cierra la ventana modal. */
const closeModal = () => {
    qs('#md dialog')?.close();
    qs('#md').innerHTML = '';
};

/** Gestor de tags: crear, renombrar, cambiar color y eliminar. */
function tagsUI() {
    return `<div class=box><h2>${ICONS.tag} ${t('tagsT')}</h2>${profile.tags.map((g, i) => `<p class=trow><input type=color data-tc=${i} value="${escapeHtml(g.color)}" aria-label="${t('color')} · ${escapeHtml(g.name)}"><input data-tn=${i} value="${escapeHtml(g.name)}" aria-label="${t('name')}"${g.name == PRE_TAG ? ' aria-describedby=tg-pre' : ''}><button class="xs dg" data-act=tdel data-i=${i} aria-label="${t('del')} · ${escapeHtml(g.name)}">${ICONS.del}</button></p>${g.name == PRE_TAG ? `<small id=tg-pre class=by style="display:block;margin:-4px 0 8px 54px">${t('preTagHint')}</small>` : ''}`).join('')}<p class=trow><input type=color id=nc value="#00e5ff" aria-label="${t('color')}"><input id=nn placeholder="${t('newTag')}" aria-label="${t('newTag')}"><button class=pri data-act=tadd>${t('add')}</button></p><p class=dgb><button data-act=close>${t('close')}</button></p></div>`;
}
