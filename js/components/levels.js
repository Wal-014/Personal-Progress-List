/**
 * Classic and platformer level lists, details and editing forms.
 */

/** Enjoyment or appeal meter on a scale from 0 to 10. */
function meter(v, lab = '') {
    const hd = b => `<div class=mh>${lab ? `<span>${lab}</span>` : ''}${b}</div>`;
    const p = v * 10, c = `hsl(${v * 12} 100% 55%)`;
    return hd(`<b style="color:${c}">${escapeHtml(formatRating(v))}</b>`) + `<div class="meter ${v >= 8 ? 'g' : ''}" style="color:${c}"><i style="background:${c};left:0%;width:${p}%"></i></div>`;
}

/**
 * Chip that filters the list by its tag. Only chips outside a level card are focusable: the card is already a button, and a control nested in a button is lost to screen readers.
 * The replacer function keeps "$" patterns in a tag name literal.
 */
function tagFilterChip(name, focusable) {
    return `<span class=chip data-tag="${escapeHtml(name)}" style="${tagStyle(name)}"${focusable ? ` role=button tabindex=0 aria-label="${escapeHtml(t('filterTag').replace('{t}', () => name))}"` : ''}>${escapeHtml(name)}</span>`;
}

/** A level row in the list, drawn as an editor object. */
function card(l, i, n, reorderable) {
    const u = thumbUrl(l), rank = i == 'pre' ? ICONS.classic : i != null ? i + 1 : '—';
    const podium = i === 0 ? ' top1' : i === 1 ? ' top2' : i === 2 ? ' top3' : '';
    const meta = [l.creator ? t('by') + ' ' + escapeHtml(l.creator) : '', escapeHtml(formatDate(l.date)), l.ar?.s == 'p' || l.ar?.s == 'r' && l.ar.p != null ? aredlLabel(l) : ''].filter(Boolean).join(' · ');
    return `<div class="obj lv${podium}${l.id == ui.sel ? ' sel' : ''}" data-id="${escapeHtml(l.id)}" role=button tabindex=0${u ? ` style="--th:url('${u}')"` : ''}>${u ? '<i class=th aria-hidden=true></i>' : ''}${canEdit() && reorderable ? `<span class=grip aria-hidden=true title="${t('dragHint')}">${ICONS.grip}</span>` : ''}<span class=rk aria-label="${i == 'pre' ? t('first') : i != null ? '#' + (i + 1) + ' / ' + n : t('unplaced')}">${rank}</span><div class=info><span class=nm>${escapeHtml(l.name)}</span><span class=by>${meta}</span>${l.tags?.length ? `<div>${l.tags.map(name => tagFilterChip(name)).join('')}</div>` : ''}</div>${difficultyFace(l)}</div>`;
}

/** Ids of the ranked levels of a list, in order: Pre-Extremes levels and ids of deleted levels have no rank. */
const rankedIds = kind => profile.order[kind].filter(id => {
    const l = findLevel(id);
    return l && !isPre(l);
});

function matchesListFilters(level, query, selectedTags) {
    return level.name.toLowerCase().includes(query) && (!selectedTags.length || selectedTags.some(name => (level.tags || []).includes(name)));
}

/** Tags of a list for its dropdown. Selected tags stay listed after their last level loses them, so an active filter can always be unchecked. */
function listTagOptions(levels, selectedTags) {
    return [...new Set([...levels.flatMap(level => level.tags || []), ...selectedTags])].sort((a, b) => a.localeCompare(b));
}

/** Only the full list can be reordered: a filtered one hides levels, so its order cannot be saved. */
function canReorder() {
    return canEdit() && !ui.q && !ui.tagFilter.length;
}

/** List body grouped into ranked, unplaced and first-step levels. */
function list() {
    const orderedIds = profile.order[ui.tab];
    const isShown = level => matchesListFilters(level, ui.q, ui.tagFilter);
    const listLevels = profile.levels.filter(level => level.kind == ui.tab);
    const rankedLevels = rankedIds(ui.tab).map(findLevel);
    const unplacedLevels = listLevels.filter(level => !orderedIds.includes(level.id) && !isPre(level) && isShown(level));
    const firstStepLevels = listLevels.filter(level => isPre(level) && isShown(level));
    const reorderable = canReorder();
    return `<div id=lst>${rankedLevels.map((level, index) => isShown(level) ? card(level, index, rankedLevels.length, reorderable) : '').join('')}</div>${unplacedLevels.length ? `<h2 class=grp>${t('unplaced')}</h2>` + unplacedLevels.map(level => card(level)).join('') : ''}${firstStepLevels.length ? `<h2 class=grp>${t('first')}</h2>` + firstStepLevels.map(level => card(level, 'pre')).join('') : ''}${!listLevels.length ? canEdit() ? emptyList({ icon: ICONS.add, title: t('emptyListTitle'), text: t('emptyListText'), action: 'add' }) : `<p class=by>${t('publicNoLevels')}</p>` : !listLevels.some(isShown) ? `<p class=by>${t('noMatch')}</p>` : ''}`;
}

function youtubeId(url) {
    return (/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/.exec(url) || [])[1];
}

function deathHistogram(deaths) {
    const percentages = Object.keys(deaths).map(Number).sort((a, b) => a - b);
    const firstPercent = percentages[0];
    const lastPercent = percentages.at(-1);
    const maxDeaths = Math.max(1, ...Object.values(deaths));
    let barsHtml = '';
    let axisHtml = '';
    for (let percent = firstPercent; percent <= lastPercent; percent++) {
        barsHtml += `<b data-hp="${percent}" data-hn="${escapeHtml(deaths[percent] || 0)}"><i style="height:${(deaths[percent] || 0) / maxDeaths * 100}%"></i></b>`;
        axisHtml += `<span>${percent % 10 == 0 || lastPercent - firstPercent < 12 ? percent + '%' : ''}</span>`;
    }
    return barsHtml ? `<div class=hist>${barsHtml}</div><div class=ax>${axisHtml}</div>` : '';
}

function detail(level) {
    const recorded = value => value != null && (typeof value != 'string' || value.trim() !== '');
    const values = Object.fromEntries(['attN', 'attC', 'tN', 'tP', 'tPC'].map(key => [key, recorded(level[key]) ? level[key] : null]));
    const deaths = level.deaths || {};
    const percentages = Object.keys(deaths).map(Number).sort((a, b) => a - b);
    const bestPercent = percentages.at(-1);
    const statCell = (key, value, className = '') => recorded(value) ? `<div class="st ${className}"><small>${t(key)}</small><b>${escapeHtml(value)}</b></div>` : '';
    const thumbnail = fullThumbUrl(level);
    const grid = body => body ? `<div class=grid>${body}</div>` : '';
    const section = (key, body) => body ? `<fieldset><legend>${t(key)}</legend>${body}</fieldset>` : '';
    const link = safeUrl(level.link);
    const videoId = youtubeId(link);
    const histogram = deathHistogram(deaths);
    const sections = [
        section('sa', grid(statCell('attT', totalAttempts(values), 'big') + statCell('attN', values.attN) + statCell('attC', values.attC) + statCell('best', percentages.length ? `${bestPercent}% ×${deaths[bestPercent]}` : null))),
        section('sT', grid(statCell('tT', formatDuration(totalSeconds(values)), 'big') + statCell('tN', formatDuration(values.tN)) + statCell('tP', formatDuration(values.tP)) + statCell('tPC', formatDuration(values.tPC)))),
        section('s4', grid(statCell('date', recorded(level.date) ? formatDate(level.date) : null)) + (videoId ? `<a class=yt target=_blank rel=noopener href="${escapeHtml(link)}"><img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt=""><span>${ICONS.play}</span></a>` : link ? `<p><a style="color:var(--a)" target=_blank rel=noopener href="${escapeHtml(link)}">${ICONS.play} ${t('link')}</a></p>` : '')),
        section('s5', grid(['enj', 'lik'].map(key => recorded(level[key]) ? `<div class=st><small>${t(key)}</small>${meter(level[key])}</div>` : '').join(''))),
        section('sh', `${(level.tags || []).map(name => tagFilterChip(name, true)).join('')}${recorded(level.notes) ? `<p style="white-space:pre-wrap">${escapeHtml(level.notes)}</p>` : ''}`),
        section('dh', histogram)
    ].join('');
    return `<div class=box>${thumbnail ? `<div class=hero style="background-image:url('${thumbnail}')"></div>` : ''}<h2>${escapeHtml(level.name)}</h2><p class=by>${escapeHtml(orDash(level.creator))} · ID ${escapeHtml(orDash(level.levelId))} · ${escapeHtml(difficultyLabel(level))} · ${aredlLabel(level)}${level.kind == 'platform' ? '' : ` · GDL ${escapeHtml(level.gdl == null ? '—' : '#' + level.gdl)}`}</p>
<div${sections ? ' class=dgrid' : ''}>${sections || `<p class=by>${t('noAdditionalDetails')}</p>`}
</div><p class=dgb>${canEdit() ? `<button class=blue data-act=edit data-id="${escapeHtml(level.id)}">${ICONS.edit} ${t('edit')}</button>` : ''} <button data-act=lvclose>${t('close')}</button></p></div>`;
}

const tagChip = n => `<span class=chip data-act=tgrm data-v="${escapeHtml(n)}" style="${tagStyle(n)}">${escapeHtml(n)} ${ICONS.del}<input type=hidden name=tg value="${escapeHtml(n)}"></span>`;

function updateTotals(f) {
    const q = k => f.elements[k], n = k => q(k).value === '' ? null : +q(k).value, a = n('attN'), c = n('attC');
    q('attT').value = a == null && c == null ? '' : (a || 0) + (c || 0);
    const s = ['tN', 'tP', 'tPC'].map(k => readDuration(f, k)).filter(x => x != null);
    q('tT').value = s.length && s.every(Number.isFinite) ? durationClock(s.reduce((x, y) => x + y)) : '';
}

function renderTagSuggestions() {
    const q = (qs('#tgq')?.value || '').toLowerCase(), sel = [...document.querySelectorAll('#tgs input')].map(i => i.value);
    if (qs('#tgr'))
        qs('#tgr').innerHTML = profile.tags.filter(g => !sel.includes(g.name) && g.name.toLowerCase().includes(q)).map(g => `<span class=chip data-act=tgadd data-v="${escapeHtml(g.name)}" style="${tagStyle(g.name)}">+ ${escapeHtml(g.name)}</span>`).join('');
}

function formField(key, value, type = 'text', attrs = '', hint = '') {
    const step = attrs.match(/\bstep=([\d.]+)/)?.[1] || '1';
    return `<div><label for=fm-${key}>${t(key)}</label>${type == 'number' && !attrs.includes('readonly') ? `<div class=num><button type=button class=blue data-act=step data-d=-1 aria-label="−${escapeHtml(formatRating(+step))}">−</button><input id=fm-${key} name=${key} type=number ${attrs} value="${escapeHtml(value)}"><button type=button class=blue data-act=step data-d=1 aria-label="+${escapeHtml(formatRating(+step))}">+</button></div>` : `<input id=fm-${key} name=${key} type=${type} ${attrs} value="${escapeHtml(value)}"${attrs.includes('readonly') ? ' class=ro' : ''}>`}${hint ? `<small id=fm-${key}-hint class=by>${escapeHtml(hint)}</small>` : ''}</div>`;
}

const aredlTopValue = ar => ar?.s == 'r' && ar.p != null ? '#' + ar.p : ar?.s == 'p' ? t('pending') : '—';

function maxRankPosition(kind, id) {
    const ids = rankedIds(kind);
    return ids.length + (ids.includes(id) ? 0 : 1);
}

const rankPositionHint = maximum => t('availablePositions').replace('{min}', 1).replace('{max}', maximum);

function updateRankPositionRange(form) {
    const maximum = maxRankPosition(form.elements.kind.value, form.dataset.id);
    form.elements.pos.max = maximum;
    qs('#fm-pos-hint').textContent = rankPositionHint(maximum);
}

/** Form for adding a level or editing one. */
function levelForm(level) {
    const kind = level?.kind || (isListTab() ? ui.tab : 'classic');
    const levelData = level || { tags: [], ar: { s: 'n' }, kind };
    const rankPosition = rankedIds(kind).indexOf(level?.id) + 1 || '', maximum = maxRankPosition(kind, level?.id);
    const section = (key, body) => `<fieldset><legend>${t(key)}</legend><div class=grid>${body}</div></fieldset>`;
    return `<div class=box><h2>${level ? t('edit') : t('palAdd')}</h2><form id=fm data-id="${escapeHtml(level?.id)}"><div class=warn id=wn></div>
${levelSearchBox()}
${section('s1', levelFields(levelData, true))}
${section('s2', formField('pos', rankPosition, 'number', `min=1 max=${maximum} step=1 aria-describedby=fm-pos-hint`, rankPositionHint(maximum)) + `<div><label for=fm-ap>${t(kind == 'platform' ? 'apPlatform' : 'ap')}</label><input id=fm-ap name=ap type=text readonly tabindex=-1 value="${escapeHtml(aredlTopValue(levelData.ar))}" class=ro></div><div id=fm-gdl-field${kind == 'platform' ? ' hidden' : ''}><label for=fm-gdl>${t('gdlTop')}</label><input id=fm-gdl type=text readonly tabindex=-1 value="${escapeHtml(kind == 'platform' || levelData.gdl == null ? '—' : '#' + levelData.gdl)}" class=ro></div>`)}
${section('s3', formField('attC', levelData.attC, 'number', 'min=0 step=1') + formField('attN', levelData.attN, 'number', 'min=0 step=1') + durationInput('tN', levelData.tN) + durationInput('tP', levelData.tP) + durationInput('tPC', levelData.tPC) + formField('attT', totalAttempts(levelData), 'number', 'readonly tabindex=-1') + formField('tT', durationClock(totalSeconds(levelData)), 'text', 'readonly tabindex=-1'))}
${section('s4', formField('date', levelData.date, 'date') + formField('link', levelData.link))}
<fieldset><legend>${t('s5')}</legend><div class=grid>${formField('enj', levelData.enj, 'number', 'min=0 max=10 step=0.1 inputmode=decimal')}${formField('lik', levelData.lik, 'number', 'min=0 max=10 step=0.1 inputmode=decimal')}</div><label for=tgq style="margin-top:12px">${t('tags')}</label><input id=tgq placeholder="${t('tgs')}" autocomplete=off><div id=tgr class=tgr></div><div id=tgs>${(levelData.tags || []).map(tagChip).join('')}</div></fieldset>
<fieldset><legend>${t('s6')}</legend><label for=fm-notes>${t('notes')}</label><textarea id=fm-notes name=notes rows=3>${escapeHtml(levelData.notes)}</textarea>${deathsInput(levelData.deaths)}</fieldset>
<p class=dgb><button class=pri>${t('save')}</button> <button type=button data-act=${level ? 'lvclose' : 'close'}>${t('close')}</button> ${level ? `<button type=button class=dg data-act=del data-id="${escapeHtml(level.id)}">${t('del')}</button>` : ''}</p></form></div>`;
}

function levelFromForm(form) {
    const data = new FormData(form), fields = Object.fromEntries(data), number = key => fields[key] === '' ? null : +fields[key], clamp = key => {
        const value = number(key);
        return value == null ? value : Math.round(Math.max(0, Math.min(10, value)) * 10) / 10;
    };
    return {
        name: fields.name.trim(), kind: fields.kind, levelId: fields.lid || null, creator: fields.creator || null,
        diff: fields.diff || null, rating: fields.rating || null, attC: number('attC'), attN: number('attN'),
        date: fields.date || null, link: fields.link || null, enj: clamp('enj'), lik: clamp('lik'),
        tN: readDuration(form, 'tN'), tP: readDuration(form, 'tP'), tPC: readDuration(form, 'tPC'),
        notes: fields.notes, tags: data.getAll('tg'), deaths: deathsFromValues(data.getAll('dth'))
    };
}

const listTagSummary = () => t('tags') + ' · ' + (!ui.tagFilter.length ? t('f_all') : ui.tagFilter.length == 1 ? ui.tagFilter[0] : ui.tagFilter.length);

/** Updates the tag dropdown and its clear button in place, so an open dropdown keeps its state and focus. */
function renderListTagFilters() {
    const dropdown = qs('.lh .ms');
    if (!dropdown)
        return;
    dropdown.querySelectorAll('input').forEach(input => input.checked = ui.tagFilter.includes(input.value));
    dropdown.querySelector('summary').textContent = listTagSummary();
    qs('.lh [data-act=ct]').hidden = !ui.tagFilter.length;
}

function setListTagFilter() {
    ui.tagFilter = Array.from(document.querySelectorAll('.lh input[name=tagf]:checked'), checkbox => checkbox.value);
    renderListTagFilters();
    renderList();
}

/** Left column: name search, tag filters and the list. */
function lcol() {
    const options = listTagOptions(profile.levels.filter(level => level.kind == ui.tab), ui.tagFilter);
    return `<div class=lh><input id=q type=search placeholder="${t('search')}" aria-label="${t('search')}" value="${escapeHtml(ui.q)}">${options.length ? `<details class=ms><summary>${escapeHtml(listTagSummary())}</summary><div class=msp>${options.map(name => `<label><input type=checkbox name=tagf value="${escapeHtml(name)}"${ui.tagFilter.includes(name) ? ' checked' : ''}><span class=chip style="${tagStyle(name)}">${escapeHtml(name)}</span></label>`).join('')}</div></details><button type=button class="xs dg" data-act=ct aria-label="${t('clearTags')}" title="${t('clearTags')}"${ui.tagFilter.length ? '' : ' hidden'}>${ICONS.del}</button>` : ''}</div><div id=lw>${list()}</div>`;
}

/** Right column with level details, an editing form or an empty prompt. */
function panel() {
    const l = ui.sel ? findLevel(ui.sel) : null;
    return !l ? `<div class=ph>${t('pick')}</div>` : ui.edit && canEdit() ? levelForm(l) : detail(l);
}

/** Sortable filter: touch and pen drags start only from the grip, so a swipe anywhere else on a card scrolls the page. A mouse still drags the whole card. */
function startsAwayFromGrip(evt) {
    if (evt.pointerType == 'mouse' || evt.type == 'mousedown')
        return false;
    return !evt.target.closest('.grip');
}

/** A mouse drag that ends with only 'dragend' was not dropped on the list (Escape, or released outside it); touch and pen report interruptions as cancel events. */
function dragWasCanceled(originalEvent) {
    return ['dragend', 'touchcancel', 'pointercancel'].includes(originalEvent.type);
}

/** Saves the order Sortable left in the list. Sortable has already moved the card, so a cancelled drag redraws the saved order instead. */
function reorderList(evt) {
    if (dragWasCanceled(evt.originalEvent)) {
        render();
        return;
    }
    profile.order[ui.tab] = [...qs('#lst').children].map(c => c.dataset.id);
    save();
    render();
}

function initSort() {
    if (qs('#lst') && canReorder())
        new Sortable(qs('#lst'), { animation: 180, filter: startsAwayFromGrip, preventOnFilter: false, fallbackTolerance: 5, onUpdate: reorderList });
}

const scrollSel = () => qs('.lv.sel')?.scrollIntoView({ block: 'center', behavior: 'smooth' });

/** Redraws the list while preserving scroll and search text. */
function renderList() {
    qs('#lw').innerHTML = list();
    initSort();
}

function renderPanel() {
    const r = qs('.rcol');
    r.innerHTML = panel();
    r.classList.toggle('has', !!ui.sel);
    renderTagSuggestions();
}

/** Selects a level without rebuilding the list. */
function selectLevel(id) {
    ui.sel = id;
    ui.edit = 0;
    document.querySelectorAll('.lv.sel').forEach(c => c.classList.remove('sel'));
    qs(`.lv[data-id="${CSS.escape(id)}"]`)?.classList.add('sel');
    renderPanel();
    if (innerWidth <= 560)
        scrollTo({ top: 0 });
    else if (innerWidth < 900)
        qs('.rcol').scrollIntoView({ behavior: 'smooth' });
}

/** Updates the automatic top field and found note from the picked level. */
async function fillAredlPosition(f) {
    await loadAredlList();
    const q = k => f.elements[k], w = qs('#wn');
    if (!w)
        return;
    const level = { levelId: q('lid').value, name: q('name').value, kind: q('kind').value, rating: q('rating').value, diff: q('diff').value };
    qs('label[for=fm-ap]').textContent = t(level.kind == 'platform' ? 'apPlatform' : 'ap');
    // Without downloaded lists nothing is known, so the stored value stays on screen
    if (!aredlCache.length)
        return;
    const ar = aredlStatus(level);
    q('ap').value = aredlTopValue(ar);
    w.textContent = ar.s == 'r' ? `${t('found')} · #${ar.p}` : '';
}

async function fillDemonlistPosition(f) {
    const field = qs('#fm-gdl-field'), input = qs('#fm-gdl');
    if (!field || !input)
        return;
    field.hidden = f.elements.kind.value == 'platform';
    try {
        await loadDemonlist();
        const level = { kind: f.elements.kind.value, levelId: f.elements.lid.value };
        matchWithDemonlist([level]);
        input.value = level.gdl == null ? '—' : '#' + level.gdl;
    }
    catch {
    }
}
