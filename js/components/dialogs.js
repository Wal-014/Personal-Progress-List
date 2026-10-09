/**
 * Ventanas emergentes propias (confirmar, preguntar, avisar), avisos de la campana, gestor de tags y textos legales.
 */

/** Calcula los avisos pendientes (niveles sin colocar, sin ID o completados en wishlist). */
function alerts() {
    const A = [], lk = l => `<a class=lk data-act=edit data-id="${l.id}">${escapeHtml(l.name)}</a>`;
    ['classic', 'platform'].forEach(k => {
        const u = profile.levels.filter(l => l.kind == k && !isPre(l) && !profile.order[k].includes(l.id));
        if (u.length)
            A.push(`${escapeHtml(t('aUnp'))} (${escapeHtml(t(k))}): ${u.map(lk).join(', ')}`);
    });
    profile.wishlists.forEach(w => w.items.filter(i => i.status == 'done' && !i.added).forEach(i => A.push(`${escapeHtml(t('aWish'))}: ${escapeHtml(i.name)} (${escapeHtml(w.name)})`)));
    const ni = profile.levels.filter(l => !l.levelId);
    if (ni.length)
        A.push(`${escapeHtml(t('aNoId'))} (${ni.length}): ${ni.map(lk).join(', ')}`);
    return A;
}

/** Contenido de la campana de avisos. */
const bellUI = () => {
    const A = alerts();
    return `<div class=box><div><h2 class=ic>${ICONS.bell} ${t('bell')}</h2>${A.length ? A.map(a => `<p>• ${a}</p>`).join('') : `<p>${t('nonot')}</p>`}<p><button data-act=close>${t('close')}</button></p></div></div>`;
};

/** Pie de página con derechos de autor y enlaces legales. */
const footer = () => `<footer class=ft><span>© ${new Date().getFullYear()} Retlaw · ${t('rights')}</span><nav>${['terms', 'privacy', 'credits'].map(k => `<a class=lk data-act=legal data-v=${k}>${t(k)}</a>`).join(' · ')}</nav></footer>`;

/** Ventana con términos, privacidad o créditos. */
const legalUI = k => `<div class="box sm"><div><h3>${t(k)}</h3><p style="white-space:pre-wrap">${escapeHtml(t(k + 'Txt'))}</p><p class=dgb><button data-act=close>${t('close')}</button></p></div></div>`;

/** Diálogo propio que devuelve una promesa (sustituye a alert, confirm y prompt). */
function showDialog({ title, msg, input, def, ok, cancel, danger }) {
    return new Promise(res => {
        const m = document.createElement('div');
        m.className = 'modal';
        m.style.zIndex = 30;
        m.innerHTML = `<div class="box sm"><div><h3>${escapeHtml(title || '')}</h3>${msg ? `<p style="white-space:pre-wrap">${escapeHtml(msg)}</p>` : ''}${input ? `<input id=dgi value="${escapeHtml(def || '')}" style="width:100%">` : ''}<p class=dgb>${cancel === false ? '' : `<button data-r=0>${t('cancel')}</button>`}<button class="${danger ? 'dg' : 'pri'}" data-r=1>${ok || t('ok2')}</button></p></div></div>`;
        document.body.appendChild(m);
        const i = m.querySelector('#dgi'), done = v => {
            m.remove();
            res(v);
        };
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
                done(r == '1' ? (i ? i.value.trim() : true) : (i ? null : false));
        };
        m.onkeydown = e => {
            e.stopPropagation();
            if (e.key == 'Enter') {
                e.preventDefault();
                done(i ? i.value.trim() : true);
            }
            if (e.key == 'Escape')
                done(i ? null : false);
        };
    });
}

/** Pide un texto al usuario. */
const askText = (title, def) => showDialog({ title, input: 1, def });

/** Pide confirmación. */
const askConfirm = title => showDialog({ title, danger: 1 });

/** Muestra un aviso. */
const showAlert = msg => showDialog({ title: msg, cancel: false });

/** Abre una ventana modal. */
const openModal = h => {
    qs('#md').innerHTML = `<div class=modal>${h}</div>`;
};

/** Cierra la ventana modal. */
const closeModal = () => qs('#md').innerHTML = '';

/** Gestor de tags: crear, renombrar, cambiar color y eliminar. */
function tagsUI() {
    return `<div class=box><div><h2>${t('tagsT')}</h2>${profile.tags.map((g, i) => `<p class=trow><input type=color data-tc=${i} value="${g.color}"><input data-tn=${i} value="${escapeHtml(g.name)}"><button data-act=tdel data-i=${i}>✕</button></p>`).join('')}<p class=trow><input type=color id=nc value="#00e5ff"><input id=nn placeholder="${t('newTag')}"><button data-act=tadd>${t('add')}</button></p><p><button data-act=close>${t('close')}</button></p></div></div>`;
}
