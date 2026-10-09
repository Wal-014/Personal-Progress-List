/**
 * Lista de niveles (Clásicos y Plataforma), panel de información y formulario de edición.
 */

/** Barra de -10 a 10 para disfrutabilidad y nivel de agrado. */
function meter(v, lab = '') {
    const hd = b => `<div class=mh>${lab ? `<span>${lab}</span>` : ''}${b}</div>`;
    if (v == null)
        return hd('<b>-</b>') + '<div class="meter"></div>';
    const p = Math.abs(v) * 5, c = v >= 0 ? `hsl(${160 - v * 11} 100% 55%)` : `hsl(0 ${40 - v * 6}% ${52 + v * 2}%)`;
    return hd(`<b style="color:${c}">${v > 0 ? '+' : ''}${v}</b>`) + `<div class="meter ${v >= 8 ? 'g' : ''}" style="color:${c}"><i style="background:${c};left:${v >= 0 ? 50 : 50 - p}%;width:${p}%"></i></div>`;
}

/** Tarjeta de un nivel en la lista. */
function card(l, i, n) {
    const u = thumbUrl(l);
    return `<div class="card ${i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''}${l.id == ui.sel ? ' sel' : ''}" data-id="${l.id}" style="${u ? `background-image:url('${u}');` : ''}animation-delay:${Math.min(+i || 0, 14) * 30}ms"><div class=rk>${i == 'pre' ? `<b style="font-size:15px">${t('first')}</b>` : i != null ? `<b>#${i + 1}</b> / ${n}` : '<b>—</b>'}<small>${aredlLabel(l)}</small></div><div class=nm>${escapeHtml(l.name)}${l.creator || l.date ? ` <small class=by>${[l.creator ? t('by') + ' ' + escapeHtml(l.creator) : '', l.date ? l.date.split('-').reverse().join('/') : ''].filter(Boolean).join(' · ')}</small>` : ''}<div>${(l.tags || []).map(x => `<span class=chip data-tag="${escapeHtml(x)}" style="color:${tagColor(x)};border-color:${tagColor(x)}">${escapeHtml(x)}</span>`).join('')}</div></div><div class=mt>${meter(l.enj, t('enj'))}<div style="height:8px"></div>${meter(l.lik, t('lik'))}</div></div>`;
}

/** Cuerpo de la lista: niveles colocados, sin colocar y primeros pasos. */
function list() {
    const ids = profile.order[ui.tab], ok = l => (!ui.q || l.name.toLowerCase().includes(ui.q)) && (!ui.tag || (l.tags || []).includes(ui.tag)), all = profile.levels.filter(l => l.kind == ui.tab), pl = ids.map(findLevel).filter(l => l && !isPre(l)), un = all.filter(l => !ids.includes(l.id) && !isPre(l) && ok(l)), pre = all.filter(l => isPre(l) && ok(l));
    return `<div id=lst>${pl.map((l, i) => ok(l) ? card(l, i, pl.length) : '').join('')}</div>${un.length ? `<h3>${t('unplaced')}</h3>` + un.map(l => card(l)).join('') : ''}${pre.length ? `<h3>${t('first')}</h3>` + pre.map(l => card(l, 'pre')).join('') : ''}${all.length ? '' : `<p>${t('empty')}</p>`}`;
}

/** Panel con la información completa de un nivel. */
function detail(l) {
    const d = l.deaths || {}, ks = Object.keys(d).map(Number).sort((a, b) => a - b), lo = ks[0], hi = ks.at(-1), mx = Math.max(1, ...Object.values(d)), st = (k, v, c = '') => `<div class="st ${c}"><small>${t(k)}</small><b>${v}</b></div>`, u = thumbUrl(l), sc = (k, b) => `<fieldset><legend>${t(k)}</legend>${b}</fieldset>`, y = (/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/.exec(l.link || '') || [])[1];
    let h = '', ax = '';
    for (let p = lo; p <= hi; p++) {
        h += `<b data-hp="${p}" data-hn="${d[p] || 0}"><i style="height:${(d[p] || 0) / mx * 100}%"></i></b>`;
        ax += `<span>${p % 10 == 0 || hi - lo < 12 ? p + '%' : ''}</span>`;
    }
    return `<div class=box><div class=hero style="${u ? `background-image:linear-gradient(transparent 40%,var(--card)),url('${u}')` : ''}"></div><div><h2>${escapeHtml(l.name)}</h2><p style="color:var(--mut)">${escapeHtml(orDash(l.creator))} · ID ${orDash(l.levelId)} · ${escapeHtml(orDash(l.diff))} · ${aredlLabel(l)}</p>
<div class=dgrid>${sc('sa', `<div class=grid>${st('attT', orDash(totalAttempts(l)), 'big')}${st('attN', orDash(l.attN))}${st('attC', orDash(l.attC))}${st('best', ks.length ? `${hi}% ×${d[hi]}` : '-')}</div>`)}
${sc('sT', `<div class=grid>${st('tT', orDash(formatDuration(totalSeconds(l))), 'big')}${st('tN', orDash(formatDuration(l.tN)))}${st('tP', orDash(formatDuration(l.tP)))}${st('tPC', orDash(formatDuration(l.tPC)))}</div>`)}
${sc('s4', `<div class=grid>${st('date', orDash(l.date))}</div>${y ? `<a class=yt target=_blank rel=noopener href="${escapeHtml(l.link)}"><img src="https://img.youtube.com/vi/${y}/hqdefault.jpg" alt=""><span>▶</span></a>` : l.link ? `<p><a style="color:var(--a)" target=_blank rel=noopener href="${escapeHtml(l.link)}">▶ ${t('link')}</a></p>` : ''}`)}
${sc('s5', `<div class=grid><div class=st><small>${t('enj')}</small>${meter(l.enj)}</div><div class=st><small>${t('lik')}</small>${meter(l.lik)}</div></div>`)}
${(l.tags?.length || l.notes) ? sc('sh', `${(l.tags || []).map(x => `<span class=chip data-tag="${escapeHtml(x)}" style="color:${tagColor(x)};border-color:${tagColor(x)}">${escapeHtml(x)}</span>`).join('')}${l.notes ? `<p style="white-space:pre-wrap">${escapeHtml(l.notes)}</p>` : ''}`) : ''}
${h ? sc('dh', `<div class=hist>${h}</div><div class=ax>${ax}</div>`) : ''}
</div><p><button data-act=edit data-id="${l.id}">${t('edit')}</button> <button data-act=lvclose>${t('close')}</button></p></div></div>`;
}

/** Etiqueta seleccionada dentro del formulario. */
const tagChip = n => `<span class=chip data-act=tgrm data-v="${escapeHtml(n)}" style="color:${tagColor(n)};border-color:${tagColor(n)}">${escapeHtml(n)} ✕<input type=hidden name=tg value="${escapeHtml(n)}"></span>`;

/** Recalcula intentos y tiempo totales mientras se edita. */
function updateTotals(f) {
    const q = k => f.elements[k], n = k => q(k).value === '' ? null : +q(k).value, a = n('attN'), c = n('attC');
    q('attT').value = a == null && c == null ? '' : (a || 0) + (c || 0);
    const s = ['tN', 'tP', 'tPC'].map(k => parseDuration(q(k).value)).filter(x => x != null);
    q('tT').value = s.length ? formatDuration(s.reduce((x, y) => x + y)) : '';
}

/** Muestra los tags que coinciden con lo escrito en el buscador del formulario. */
function renderTagSuggestions() {
    const q = (qs('#tgq')?.value || '').toLowerCase(), sel = [...document.querySelectorAll('#tgs input')].map(i => i.value);
    if (qs('#tgr'))
        qs('#tgr').innerHTML = profile.tags.filter(g => !sel.includes(g.name) && g.name.toLowerCase().includes(q)).map(g => `<span class=chip data-act=tgadd data-v="${escapeHtml(g.name)}" style="color:${g.color};border-color:${g.color}">+ ${escapeHtml(g.name)}</span>`).join('');
}

/** Formulario para añadir o editar un nivel. */
function form(l) {
    const f = (k, v, ty = 'text', x = '') => `<div><label>${t(k)}</label>${ty == 'number' && !x.includes('readonly') ? `<div class=num><button type=button data-act=step data-d=-1>−</button><input name=${k} type=number ${x} value="${escapeHtml(v)}"><button type=button data-act=step data-d=1>+</button></div>` : `<input name=${k} type=${ty} ${x} value="${escapeHtml(v)}"${x.includes('readonly') ? ' class=ro' : ''}>`}</div>`, kind = l?.kind || (['classic', 'platform'].includes(ui.tab) ? ui.tab : 'classic'), o = l || { tags: [], ar: { s: 'n' } }, pos = profile.order[kind].indexOf(l?.id) + 1 || '', sec = (k, b) => `<fieldset><legend>${t(k)}</legend><div class=grid>${b}</div></fieldset>`, sel = (lab, nm, opts) => `<div><label>${lab}</label><select name=${nm}>${opts}</select></div>`;
    return `<div class=box><div><form id=fm data-id="${l?.id || ''}"><div class=warn id=wn></div>
${sec('s1', f('name', o.name) + f('lid', o.levelId) + f('creator', o.creator) + sel(t('diff'), 'diff', '<option value="">-</option>' + DIFFICULTIES.map(d => `<option ${o.diff == d ? 'selected' : ''}>${d}</option>`).join('')) + sel(t('kind'), 'kind', ['classic', 'platform'].map(k => `<option value=${k} ${k == kind ? 'selected' : ''}>${t(k)}</option>`).join('')))}
${sec('s2', f('pos', pos, 'number', 'min=1') + sel('AREDL', 'as', [['r', t('onl')], ['n', t('notin')], ['p', t('pending')]].map(([k, v]) => `<option value=${k} ${o.ar?.s == k ? 'selected' : ''}>${v}</option>`).join('')) + f('ap', o.ar?.p, 'number', 'readonly tabindex=-1'))}
${sec('s3', f('attC', o.attC, 'number') + f('attN', o.attN, 'number') + f('tN', formatDuration(o.tN), 'text', 'placeholder="1h 30m 0s"') + f('tP', formatDuration(o.tP)) + f('tPC', formatDuration(o.tPC)) + f('attT', totalAttempts(o), 'number', 'readonly tabindex=-1') + f('tT', formatDuration(totalSeconds(o)), 'text', 'readonly tabindex=-1'))}
${sec('s4', f('date', o.date, 'date') + f('link', o.link))}
<fieldset><legend>${t('s5')}</legend><div class=grid>${f('enj', o.enj, 'number', 'min=-10 max=10')}${f('lik', o.lik, 'number', 'min=-10 max=10')}</div><label style="margin-top:12px">${t('tags')}</label><input id=tgq placeholder="${t('tgs')}" autocomplete=off><div id=tgr class=tgr></div><div id=tgs>${(o.tags || []).map(tagChip).join('')}</div></fieldset>
<fieldset><legend>${t('s6')}</legend><label>${t('notes')}</label><textarea name=notes rows=3>${escapeHtml(o.notes)}</textarea><label style="margin-top:10px">${t('deaths')}</label><textarea name=deaths rows=5>${escapeHtml(Object.keys(o.deaths || {}).sort((a, b) => a - b).map(k => `${k}% x${o.deaths[k]}`).join('\n'))}</textarea></fieldset>
<p><button>${t('save')}</button> <button type=button data-act=lvclose>${t('close')}</button> ${l ? `<button type=button data-act=del data-id="${l.id}">${t('del')}</button>` : ''}</p></form></div></div>`;
}

/** Columna izquierda: buscador, botón de añadir y lista. */
function lcol() {
    return `<div class=lh><input id=q placeholder="${t('search')}" value="${escapeHtml(ui.q)}"><button class=pri data-act=add>${t('add')}</button></div>${ui.tag ? `<p><button data-act=ct>✕ ${escapeHtml(ui.tag)}</button></p>` : ''}<div id=lw>${list()}</div>`;
}

/** Columna derecha: información, formulario o mensaje vacío. */
function panel() {
    const l = ui.sel && ui.sel != 'new' ? findLevel(ui.sel) : null;
    return ui.edit ? form(ui.sel == 'new' ? null : l) : l ? detail(l) : `<div class=ph>${t('pick')}</div>`;
}

/** Activa el arrastre para reordenar el top. */
function initSort() {
    if (qs('#lst') && !ui.q && !ui.tag)
        new Sortable(qs('#lst'), { animation: 180, onEnd: () => {
                profile.order[ui.tab] = [...qs('#lst').children].map(c => c.dataset.id);
                save();
                render();
            } });
}

/** Desplaza la lista hasta el nivel seleccionado. */
const scrollSel = () => document.querySelector('.card.sel')?.scrollIntoView({ block: 'center', behavior: 'smooth' });

/** Redibuja solo la lista (conserva el scroll y el texto de búsqueda). */
function renderList() {
    qs('#lw').innerHTML = list();
    initSort();
}

/** Redibuja solo el panel derecho. */
function renderPanel() {
    const r = qs('.rcol');
    r.innerHTML = panel();
    r.classList.toggle('has', !!ui.sel);
    renderTagSuggestions();
}

/** Selecciona un nivel y muestra su información sin recargar la lista. */
function selectLevel(id) {
    ui.sel = id;
    ui.edit = 0;
    document.querySelectorAll('.card.sel').forEach(c => c.classList.remove('sel'));
    document.querySelector(`.card[data-id="${id}"]`)?.classList.add('sel');
    renderPanel();
    if (innerWidth < 900)
        qs('.rcol').scrollIntoView({ behavior: 'smooth' });
}

/** Comprueba nombre e ID del formulario contra la lista de la AREDL y avisa si no coinciden. */
function validateAgainstAredl(f) {
    const q = k => f.elements[k], w = qs('#wn');
    const name = q('name').value.trim(), id = q('lid').value.trim(), kind = q('kind').value == 'platform' ? 'p' : 'd';
    const m = id ? aredlCache.find(x => String(x.i) == id) : findAredlByName(name, kind);
    if (m) {
        if (!id)
            q('lid').value = m.i;
        q('as').value = 'r';
        q('ap').value = m.p;
        if (m.u && !q('creator').value)
            q('creator').value = m.u;
        w.textContent = `${t('found')} · #${m.p}${normalizeName(m.n) == normalizeName(name) ? '' : ' · ' + m.n}`;
    }
    else {
        const similar = !id && name ? similarAredlNames(name, kind) : [];
        w.textContent = !aredlCache.length ? t('nocache') : id ? t('nolist') : name ? t('nf') + (similar.length ? ` ${t('didYouMean')} ${similar.join(', ')}` : '') : '';
    }
    if (id) {
        const im = new Image();
        im.onerror = () => w.textContent += ' · ' + t('nothumb');
        im.src = `https://levelthumbs.prevter.me/thumbnail/${id}`;
    }
}
