/**
 * Lista de niveles (Clásicos y Plataforma), panel de información y formulario de edición.
 */

/** Barra de -10 a 10 para disfrutabilidad y nivel de agrado. */
function meter(v, lab = '') {
    const hd = b => `<div class=mh>${lab ? `<span>${lab}</span>` : ''}${b}</div>`;
    if (v == null)
        return hd('<b>-</b>') + '<div class="meter"></div>';
    const p = Math.abs(v) * 5, c = v >= 0 ? `hsl(${160 - v * 11} 100% 55%)` : `hsl(0 ${40 - v * 6}% ${52 + v * 2}%)`;
    return hd(`<b style="color:${c}">${v > 0 ? '+' : ''}${escapeHtml(v)}</b>`) + `<div class="meter ${v >= 8 ? 'g' : ''}" style="color:${c}"><i style="background:${c};left:${v >= 0 ? 50 : 50 - p}%;width:${p}%"></i></div>`;
}

/** A level row in the list, drawn as an editor object. */
function card(l, i, n) {
    const u = thumbUrl(l), rank = i == 'pre' ? ICONS.classic : i != null ? i + 1 : '—';
    const podium = i === 0 ? ' top1' : i === 1 ? ' top2' : i === 2 ? ' top3' : '';
    const meta = [l.creator ? t('by') + ' ' + escapeHtml(l.creator) : '', escapeHtml(formatDate(l.date)), aredlLabel(l)].filter(Boolean).join(' · ');
    const enj = l.enj == null ? '' : `<span class="badge${l.enj < 0 ? ' neg' : ''}" title="${t('enj')}" aria-label="${t('enj')} ${l.enj > 0 ? '+' : ''}${escapeHtml(l.enj)}">${l.enj > 0 ? '+' : ''}${escapeHtml(l.enj)}</span>`;
    return `<div class="obj lv${podium}${l.id == ui.sel ? ' sel' : ''}" data-id="${escapeHtml(l.id)}" role=button tabindex=0${u ? ` style="--th:url('${u}')"` : ''}><span class=rk aria-label="${i == 'pre' ? t('first') : i != null ? '#' + (i + 1) + ' / ' + n : t('unplaced')}">${rank}</span><div class=info><span class=nm>${escapeHtml(l.name)}</span><span class=by>${meta}</span>${l.tags?.length ? `<div>${l.tags.map(x => `<span class=chip data-tag="${escapeHtml(x)}" style="${tagStyle(x)}">${escapeHtml(x)}</span>`).join('')}</div>` : ''}</div>${enj}</div>`;
}

/** Ids of the ranked levels of a list, in order: Pre-Extremes levels and ids of deleted levels have no rank. */
const rankedIds = kind => profile.order[kind].filter(id => {
    const l = findLevel(id);
    return l && !isPre(l);
});

/** Cuerpo de la lista: niveles colocados, sin colocar y primeros pasos. */
function list() {
    const ids = profile.order[ui.tab], ok = l => (!ui.q || l.name.toLowerCase().includes(ui.q)) && (!ui.tag || (l.tags || []).includes(ui.tag)), all = profile.levels.filter(l => l.kind == ui.tab), pl = rankedIds(ui.tab).map(findLevel), un = all.filter(l => !ids.includes(l.id) && !isPre(l) && ok(l)), pre = all.filter(l => isPre(l) && ok(l));
    return `<div id=lst>${pl.map((l, i) => ok(l) ? card(l, i, pl.length) : '').join('')}</div>${un.length ? `<h2 class=grp>${t('unplaced')}</h2>` + un.map(l => card(l)).join('') : ''}${pre.length ? `<h2 class=grp>${t('first')}</h2>` + pre.map(l => card(l, 'pre')).join('') : ''}${all.length ? '' : `<p class=by>${t('empty')}</p>`}`;
}

/** Panel con la información completa de un nivel. */
function detail(l) {
    const d = l.deaths || {}, ks = Object.keys(d).map(Number).sort((a, b) => a - b), lo = ks[0], hi = ks.at(-1), mx = Math.max(1, ...Object.values(d)), st = (k, v, c = '') => `<div class="st ${c}"><small>${t(k)}</small><b>${escapeHtml(v)}</b></div>`, u = thumbUrl(l), sc = (k, b) => `<fieldset><legend>${t(k)}</legend>${b}</fieldset>`, link = safeUrl(l.link), y = (/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/.exec(link) || [])[1];
    let h = '', ax = '';
    for (let p = lo; p <= hi; p++) {
        h += `<b data-hp="${p}" data-hn="${escapeHtml(d[p] || 0)}"><i style="height:${(d[p] || 0) / mx * 100}%"></i></b>`;
        ax += `<span>${p % 10 == 0 || hi - lo < 12 ? p + '%' : ''}</span>`;
    }
    return `<div class=box>${u ? `<div class=hero style="background-image:url('${u}')"></div>` : ''}<h2>${escapeHtml(l.name)}</h2><p class=by>${escapeHtml(orDash(l.creator))} · ID ${escapeHtml(orDash(l.levelId))} · ${escapeHtml(orDash(l.diff))} · ${aredlLabel(l)}</p>
<div class=dgrid>${sc('sa', `<div class=grid>${st('attT', orDash(totalAttempts(l)), 'big')}${st('attN', orDash(l.attN))}${st('attC', orDash(l.attC))}${st('best', ks.length ? `${hi}% ×${d[hi]}` : '-')}</div>`)}
${sc('sT', `<div class=grid>${st('tT', orDash(formatDuration(totalSeconds(l))), 'big')}${st('tN', orDash(formatDuration(l.tN)))}${st('tP', orDash(formatDuration(l.tP)))}${st('tPC', orDash(formatDuration(l.tPC)))}</div>`)}
${sc('s4', `<div class=grid>${st('date', orDash(formatDate(l.date)))}</div>${y ? `<a class=yt target=_blank rel=noopener href="${escapeHtml(link)}"><img src="https://img.youtube.com/vi/${y}/hqdefault.jpg" alt=""><span>${ICONS.play}</span></a>` : link ? `<p><a style="color:var(--a)" target=_blank rel=noopener href="${escapeHtml(link)}">${ICONS.play} ${t('link')}</a></p>` : ''}`)}
${sc('s5', `<div class=grid><div class=st><small>${t('enj')}</small>${meter(l.enj)}</div><div class=st><small>${t('lik')}</small>${meter(l.lik)}</div></div>`)}
${(l.tags?.length || l.notes) ? sc('sh', `${(l.tags || []).map(x => `<span class=chip data-tag="${escapeHtml(x)}" style="${tagStyle(x)}">${escapeHtml(x)}</span>`).join('')}${l.notes ? `<p style="white-space:pre-wrap">${escapeHtml(l.notes)}</p>` : ''}`) : ''}
${h ? sc('dh', `<div class=hist>${h}</div><div class=ax>${ax}</div>`) : ''}
</div><p class=dgb><button class=blue data-act=edit data-id="${escapeHtml(l.id)}">${ICONS.edit} ${t('edit')}</button> <button data-act=lvclose>${t('close')}</button></p></div>`;
}

/** Etiqueta seleccionada dentro del formulario. */
const tagChip = n => `<span class=chip data-act=tgrm data-v="${escapeHtml(n)}" style="${tagStyle(n)}">${escapeHtml(n)} ${ICONS.del}<input type=hidden name=tg value="${escapeHtml(n)}"></span>`;

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
        qs('#tgr').innerHTML = profile.tags.filter(g => !sel.includes(g.name) && g.name.toLowerCase().includes(q)).map(g => `<span class=chip data-act=tgadd data-v="${escapeHtml(g.name)}" style="${tagStyle(g.name)}">+ ${escapeHtml(g.name)}</span>`).join('');
}

/** Formulario para añadir o editar un nivel. */
function form(l) {
    const f = (k, v, ty = 'text', x = '') => `<div><label for=fm-${k}>${t(k)}</label>${ty == 'number' && !x.includes('readonly') ? `<div class=num><button type=button class=blue data-act=step data-d=-1 aria-label="−1">−</button><input id=fm-${k} name=${k} type=number ${x} value="${escapeHtml(v)}"><button type=button class=blue data-act=step data-d=1 aria-label="+1">+</button></div>` : `<input id=fm-${k} name=${k} type=${ty} ${x} value="${escapeHtml(v)}"${x.includes('readonly') ? ' class=ro' : ''}>`}</div>`, kind = l?.kind || (isListTab() ? ui.tab : 'classic'), o = l || { tags: [], ar: { s: 'n' }, kind }, pos = rankedIds(kind).indexOf(l?.id) + 1 || '', sec = (k, b) => `<fieldset><legend>${t(k)}</legend><div class=grid>${b}</div></fieldset>`, sel = (lab, nm, opts) => `<div><label for=fm-${nm}>${lab}</label><select id=fm-${nm} name=${nm}>${opts}</select></div>`;
    return `<div class=box><h2>${l ? t('edit') : t('palAdd')}</h2><form id=fm data-id="${escapeHtml(l?.id)}"><div class=warn id=wn></div>
${levelSearchBox()}
${sec('s1', levelFields(o, true))}
${sec('s2', f('pos', pos, 'number', 'min=1 step=1') + sel('AREDL', 'as', [['r', t('onl')], ['n', t('notin')], ['p', t('pending')]].map(([k, v]) => `<option value=${k} ${o.ar?.s == k ? 'selected' : ''}>${v}</option>`).join('')) + f('ap', o.ar?.p, 'number', 'readonly tabindex=-1'))}
${sec('s3', f('attC', o.attC, 'number', 'min=0 step=1') + f('attN', o.attN, 'number', 'min=0 step=1') + f('tN', formatDuration(o.tN), 'text', 'placeholder="1h 30m 0s"') + f('tP', formatDuration(o.tP)) + f('tPC', formatDuration(o.tPC)) + f('attT', totalAttempts(o), 'number', 'readonly tabindex=-1') + f('tT', formatDuration(totalSeconds(o)), 'text', 'readonly tabindex=-1'))}
${sec('s4', f('date', o.date, 'date') + f('link', o.link))}
<fieldset><legend>${t('s5')}</legend><div class=grid>${f('enj', o.enj, 'number', 'min=-10 max=10')}${f('lik', o.lik, 'number', 'min=-10 max=10')}</div><label for=tgq style="margin-top:12px">${t('tags')}</label><input id=tgq placeholder="${t('tgs')}" autocomplete=off><div id=tgr class=tgr></div><div id=tgs>${(o.tags || []).map(tagChip).join('')}</div></fieldset>
<fieldset><legend>${t('s6')}</legend><label for=fm-notes>${t('notes')}</label><textarea id=fm-notes name=notes rows=3>${escapeHtml(o.notes)}</textarea><label for=fm-deaths style="margin-top:10px">${t('deaths')}</label><textarea id=fm-deaths name=deaths rows=5>${escapeHtml(Object.keys(o.deaths || {}).sort((a, b) => a - b).map(k => `${k}% x${o.deaths[k]}`).join('\n'))}</textarea></fieldset>
<p class=dgb><button class=pri>${t('save')}</button> <button type=button data-act=${l ? 'lvclose' : 'close'}>${t('close')}</button> ${l ? `<button type=button class=dg data-act=del data-id="${escapeHtml(l.id)}">${t('del')}</button>` : ''}</p></form></div>`;
}

/** Left column: search, active tag filter and the list. */
function lcol() {
    return `<div class=lh><input id=q type=search placeholder="${t('search')}" aria-label="${t('search')}" value="${escapeHtml(ui.q)}"></div>${ui.tag ? `<p><button class=xs data-act=ct aria-label="${t('del')} · ${escapeHtml(ui.tag)}">${ICONS.del}</button> <span class=chip style="${tagStyle(ui.tag)}">${escapeHtml(ui.tag)}</span></p>` : ''}<div id=lw>${list()}</div>`;
}

/** Columna derecha: información, formulario o mensaje vacío. */
function panel() {
    const l = ui.sel ? findLevel(ui.sel) : null;
    return !l ? `<div class=ph>${t('pick')}</div>` : ui.edit ? form(l) : detail(l);
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
const scrollSel = () => document.querySelector('.lv.sel')?.scrollIntoView({ block: 'center', behavior: 'smooth' });

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
    document.querySelectorAll('.lv.sel').forEach(c => c.classList.remove('sel'));
    document.querySelector(`.lv[data-id="${CSS.escape(id)}"]`)?.classList.add('sel');
    renderPanel();
    if (innerWidth <= 560)
        scrollTo({ top: 0 });
    else if (innerWidth < 900)
        qs('.rcol').scrollIntoView({ behavior: 'smooth' });
}

/** Sets the form's AREDL or AREPL position from the picked level's ID, and says when the level is on the list. */
async function fillAredlPosition(f) {
    await loadAredlList();
    const q = k => f.elements[k], w = qs('#wn');
    if (!w)
        return;
    const k = q('kind').value == 'platform' ? 'p' : 'd', m = aredlCache.find(x => x.k == k && String(x.i) == q('lid').value);
    q('as').value = m ? 'r' : 'n';
    q('ap').value = m ? m.p : '';
    w.textContent = m ? `${t('found')} · #${m.p}` : '';
}
