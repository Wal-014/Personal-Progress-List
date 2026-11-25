/**
 * Classic and platformer level lists, details and editing forms.
 */

/** Enjoyment or appeal meter on a scale from 0 to 10. */
function meter(v, lab = '') {
    const hd = b => `<div class=mh>${lab ? `<span>${lab}</span>` : ''}${b}</div>`;
    const p = v * 10;
    return hd(`<b>${escapeHtml(formatRating(v))}</b>`) + `<div class="meter ${v >= 8 ? 'g' : ''}" data-pct="${escapeHtml(p)}"><i></i></div>`;
}

/** Escapes the detail tag and preserves literal "$" patterns in its accessible label. */
function tagFilterChip(name) {
    const label = t('filterTag').replace('{t}', () => name);
    return `<span class=chip data-tag="${escapeHtml(name)}" ${tagColorAttr(name)} role=button tabindex=0 aria-label="${escapeHtml(label)}">${escapeHtml(name)}</span>`;
}

function currentLevelSelection() {
    const selection = ui.levelSelection;
    return selection && canEdit() && selection.profile === profile && selection.kind === ui.tab ? selection : null;
}

function toggleLevelSelection() {
    if (!canEdit() || !isListTab())
        return;
    ui.levelSelection = currentLevelSelection() ? null : { profile, kind: ui.tab, ids: new Set() };
    renderList();
    qs('[data-act=list-select]')?.focus({ preventScroll: true });
}

function pickListLevel(row, id) {
    const selection = currentLevelSelection();
    if (!selection || findLevel(id)?.kind !== selection.kind)
        return;
    if (selection.ids.has(id))
        selection.ids.delete(id);
    else
        selection.ids.add(id);
    row.setAttribute('aria-pressed', String(selection.ids.has(id)));
    qs('.list-selection output').textContent = t('levelSelectionCount').replace('{n}', selection.ids.size);
    qs('[data-act=list-delete]').disabled = !selection.ids.size;
}

function listSelectionControls() {
    const selection = currentLevelSelection();
    if (!canEdit() || (!selection && !profile.levels.some(level => level.kind == ui.tab && matchesListFilters(level, ui.q, ui.tagFilter))))
        return '';
    return `<div class=list-selection><button type=button data-act=list-select aria-pressed=${!!selection}>${t(selection ? 'cancel' : 'selectLevels')}</button>${selection ? `<output>${t('levelSelectionCount').replace('{n}', selection.ids.size)}</output><button type=button class=dg data-act=list-delete${selection.ids.size ? '' : ' disabled'}>${t('del')}</button>` : ''}</div>`;
}

async function deleteSelectedLevels() {
    const selection = currentLevelSelection();
    if (!selection)
        return;
    const ids = new Set(profile.levels.filter(level => level.kind === selection.kind && selection.ids.has(level.id)).map(level => level.id));
    if (!ids.size || !await askConfirm(t('confirmDeleteSelected').replace('{n}', ids.size), t('del')) || currentLevelSelection() !== selection)
        return;
    profile.levels = profile.levels.filter(level => !ids.has(level.id));
    profile.order[selection.kind] = profile.order[selection.kind].filter(id => !ids.has(id));
    if (ids.has(ui.sel)) {
        ui.sel = null;
        ui.edit = 0;
    }
    ui.levelSelection = null;
    save();
    render();
    (qs('[data-act=list-select]') || qs('.list-add'))?.focus({ preventScroll: true });
}

/** A level row in the list, drawn as an editor object. */
function card(l, i, n, reorderable) {
    const selection = currentLevelSelection();
    const selectionAttrs = selection ? ` data-act=list-pick aria-pressed=${selection.ids.has(l.id)}` : '';
    const canMove = reorderable && canEdit();
    const u = thumbUrl(l), rank = i != null ? i + 1 : '—';
    const hasEmblem = Number.isInteger(i) && i >= 0 && i < 5;
    const rankContent = hasEmblem ? `<img src="assets/ranks/${l.kind === 'platform' ? 'platformer' : 'classic'}-${rank}.webp" width=68 height=80 alt="" decoding=async draggable=false>` : rank;
    const creator = l.creator ? `<span class=level-creator>${t('by')} ${escapeHtml(l.creator)}</span>` : '';
    const date = l.date ? `<time class=level-date datetime="${escapeHtml(l.date)}">${escapeHtml(formatDate(l.date))}</time>` : '';
    return `<div class="obj lv${hasEmblem ? ' rank-' + rank : ''}${l.id == ui.sel ? ' sel' : ''}" data-id="${escapeHtml(l.id)}" role=button tabindex=0${selectionAttrs}${canMove ? ' aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"' : ''}${u ? ` data-th="${escapeHtml(u)}"` : ''}>${u ? '<i class=th aria-hidden=true></i>' : ''}${canMove ? `<span class=grip aria-hidden=true title="${t('dragHint')}"></span>` : ''}<span class=rk aria-label="${i != null ? '#' + rank + ' / ' + n : t('unplaced')}">${rankContent}</span><div class=info><div class=level-title><span class=nm>${escapeHtml(l.name)}</span>${creator}</div>${date}</div>${difficultyFace(l)}${selection ? `<span class=selection-mark aria-hidden=true>${ICONS.actionCheck}</span>` : ''}</div>`;
}

/** Ids of the ranked levels of a list, in order: ids of deleted levels or of the other mode have no rank. */
const rankedIds = kind => profile.order[kind].filter(id => findLevel(id)?.kind === kind);

function matchesListFilters(level, query, selectedTags) {
    return level.name.toLowerCase().includes(query) && (!selectedTags.length || selectedTags.some(name => (level.tags || []).includes(name)));
}

/** Tags of a list for its dropdown. Selected tags stay listed after their last level loses them, so an active filter can always be unchecked. */
function listTagOptions(levels, selectedTags) {
    return [...new Set([...levels.flatMap(level => level.tags || []), ...selectedTags])].sort((a, b) => a.localeCompare(b));
}

const listFiltersActive = () => !!ui.q || !!ui.tagFilter.length;

/** Only the full list can be reordered: a filtered one hides levels, so its order cannot be saved. */
function canReorder() {
    return canEdit() && !currentLevelSelection() && !listFiltersActive();
}

/** List body grouped into ranked and unplaced levels. */
function list() {
    const orderedIds = rankedIds(ui.tab);
    const isShown = level => matchesListFilters(level, ui.q, ui.tagFilter);
    const listLevels = profile.levels.filter(level => level.kind == ui.tab);
    const rankedLevels = orderedIds.map(findLevel);
    const unplacedLevels = listLevels.filter(level => !orderedIds.includes(level.id) && isShown(level));
    const reorderable = canReorder();
    const hasMatches = listLevels.some(isShown);
    return `<div id=lst>${rankedLevels.map((level, index) => isShown(level) ? card(level, index, rankedLevels.length, reorderable) : '').join('')}</div>${unplacedLevels.length ? `<h2 class=grp>${t('unplaced')}</h2>` + unplacedLevels.map(level => card(level)).join('') : ''}${!listLevels.length ? canEdit() ? emptyList({ icon: ICONS.actionAdd, title: t('emptyListTitle'), text: t('emptyListText'), action: 'add' }) : `<p class=by>${t('publicNoLevels')}</p>` : !hasMatches ? `<p class=by>${t('noMatch')}</p>` : ''}`;
}

function youtubeId(url) {
    if (!/^https?:\/\/(?:(?:www\.|m\.)?youtube\.com|youtu\.be)\//i.test(url))
        return;
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
        barsHtml += `<b data-hp="${percent}" data-hn="${escapeHtml(deaths[percent] || 0)}"><i data-pct="${escapeHtml((deaths[percent] || 0) / maxDeaths * 100)}"></i></b>`;
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
    const section = (key, body) => body ? `<details class=level-section open><summary>${t(key)}</summary>${body}</details>` : '';
    const link = safeUrl(level.link);
    const videoId = youtubeId(link);
    const histogram = deathHistogram(deaths);
    const sections = [
        section('s3', grid(statCell('attN', values.attN) + statCell('attC', values.attC) + statCell('best', percentages.length ? `${bestPercent}% ×${deaths[bestPercent]}` : null) + statCell('tN', formatDuration(values.tN)) + statCell('tP', formatDuration(values.tP)) + statCell('tPC', formatDuration(values.tPC))) + grid(statCell('attT', totalAttempts(values), 'big') + statCell('tT', formatDuration(totalSeconds(values)), 'big'))),
        section('s4', grid(statCell('date', recorded(level.date) ? formatDate(level.date) : null)) + (videoId ? `<a class=yt target=_blank rel=noopener href="${escapeHtml(link)}"><img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" alt=""><span>${ICONS.actionPlay}</span></a>` : link ? `<p><a class=level-link target=_blank rel=noopener href="${escapeHtml(link)}">${ICONS.actionPlay} ${t('link')}</a></p>` : '')),
        section('s5', grid(['enj', 'lik'].map(key => recorded(level[key]) ? `<div class=st><small>${t(key)}</small>${meter(level[key])}</div>` : '').join(''))),
        section('sh', `${(level.tags || []).map(tagFilterChip).join('')}${recorded(level.notes) ? `<p class=level-notes>${escapeHtml(level.notes)}</p>` : ''}`),
        section('dh', histogram)
    ].join('');
    const fact = (label, value) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
    const identity = fact(t('creator'), orDash(level.creator)) + fact('ID', orDash(level.levelId)) + fact(t('diff'), difficultyLabel(level));
    const externalRank = level.ar?.s == 'n' ? t('listRankUnlisted') : level.ar?.s == 'r' && level.ar.p == null ? t('listRankListed') : aredlTopValue(level.ar);
    const ranks = fact(level.kind == 'platform' ? 'AREPL' : 'AREDL', externalRank) + (level.kind == 'platform' ? '' : fact('GDL', level.gdl == null ? '—' : '#' + level.gdl));
    return `<div class=box>${thumbnail ? `<div class=hero data-th="${escapeHtml(thumbnail)}" data-th-small="${escapeHtml(thumbUrl(level))}"></div>` : ''}<h2 id=level-panel-heading tabindex=-1>${escapeHtml(level.name)}</h2>
<div class=level-identity><dl>${identity}</dl></div><dl class=detail-ranks>${ranks}</dl>
<div${sections ? ' class=dgrid' : ''}>${sections || `<p class=by>${t('noAdditionalDetails')}</p>`}
</div><div class="dgb level-action-bar"><button type=button data-act=lvclose>${t('close')}</button> ${canEdit() ? `<button type=button class=blue data-act=edit data-id="${escapeHtml(level.id)}">${ICONS.actionEdit} ${t('edit')}</button>` : ''}</div></div>`;
}

const tagChip = n => `<button type=button class=chip data-act=tgrm data-v="${escapeHtml(n)}" aria-label="${escapeHtml(t('del') + ' · ' + n)}" ${tagColorAttr(n)}>${escapeHtml(n)} ${ICONS.listClear}<input type=hidden name=tg value="${escapeHtml(n)}"></button>`;

function updateTotals(f) {
    const q = k => f.elements[k], n = k => q(k).value === '' ? null : +q(k).value, a = n('attN'), c = n('attC');
    q('attT').value = a == null && c == null ? '' : (a || 0) + (c || 0);
    const s = ['tN', 'tP', 'tPC'].map(k => readDuration(f, k)).filter(x => x != null);
    q('tT').value = s.length && s.every(Number.isFinite) ? durationClock(s.reduce((x, y) => x + y)) : '';
}

/** Existing tags matching the search, then an option to create the typed name when no tag has it yet. */
function renderTagSuggestions() {
    const typed = (qs('#tgq')?.value || '').trim(), q = typed.toLowerCase(), sel = [...document.querySelectorAll('#tgs input')].map(i => i.value);
    if (!qs('#tgr'))
        return;
    const matches = profile.tags.filter(g => !sel.includes(g.name) && g.name.toLowerCase().includes(q)).map(g => `<button type=button class=chip data-act=tgadd data-v="${escapeHtml(g.name)}" ${tagColorAttr(g.name)}>+ ${escapeHtml(g.name)}</button>`).join('');
    const create = typed && !profile.tags.some(g => g.name === typed) ? `<button type=button class="chip tag-create" data-act=tgnew data-v="${escapeHtml(typed)}">+ ${escapeHtml(t('tagCreate').replace('{name}', typed))}</button>` : '';
    qs('#tgr').innerHTML = matches + create;
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
    const readout = (field, label, value) => `<label for=fm-${field}>${t(label)}</label><output id=fm-${field} name=${field}>${escapeHtml(value)}</output>`;
    const ranks = `<div class=level-ranks><div>${readout('ap', kind == 'platform' ? 'apPlatform' : 'ap', aredlTopValue(levelData.ar))}</div><div id=fm-gdl-field${kind == 'platform' ? ' hidden' : ''}>${readout('gdl', 'gdlTop', kind == 'platform' || levelData.gdl == null ? '—' : '#' + levelData.gdl)}</div></div>`;
    const attempts = ['attN', 'attC'].map(key => formField(key, levelData[key], 'number', 'min=0 step=1')).join('');
    const times = ['tN', 'tP', 'tPC'].map(key => durationInput(key, levelData[key])).join('');
    const totals = `<div class=level-totals><div>${readout('attT', 'attT', totalAttempts(levelData))}</div><div>${readout('tT', 'tT', durationClock(totalSeconds(levelData)))}</div></div>`;
    const section = (key, body) => `<fieldset><legend>${t(key)}</legend><div class=grid>${body}</div></fieldset>`;
    return `<div class=box><h2${level ? ' tabindex=-1' : ''}>${level ? t('edit') : t('palAdd')}</h2><form id=fm data-id="${escapeHtml(level?.id)}">
${levelSearchBox()}
${section('s1', levelFields(levelData, true))}
${section('s2', formField('pos', rankPosition, 'number', `min=1 max=${maximum} step=1 aria-describedby=fm-pos-hint`, rankPositionHint(maximum)) + ranks)}
${section('s3', `<div class=level-attempts>${attempts}</div><div class=level-times>${times}</div>${totals}`)}
${section('s4', formField('date', levelData.date, 'date') + formField('link', levelData.link))}
<fieldset><legend>${t('s5')}</legend><div class=grid>${formField('enj', levelData.enj, 'number', 'min=0 max=10 step=0.1 inputmode=decimal')}${formField('lik', levelData.lik, 'number', 'min=0 max=10 step=0.1 inputmode=decimal')}</div><label for=tgq>${t('tags')}</label><input id=tgq placeholder="${t('tgs')}" autocomplete=off maxlength=${TAG_NAME_LIMIT}><div id=tgr class=tgr></div><div id=tgs>${(levelData.tags || []).map(tagChip).join('')}</div></fieldset>
<fieldset><legend>${t('s6')}</legend><label for=fm-notes>${t('notes')}</label><textarea id=fm-notes name=notes rows=3 maxlength=${NOTES_LIMIT} aria-describedby=fm-notes-hint>${escapeHtml(levelData.notes)}</textarea><small id=fm-notes-hint class=by>${t('notesLimit').replace('{n}', NOTES_LIMIT.toLocaleString(ui.lang))}</small>${deathsInput(levelData.deaths)}</fieldset>
<div class="dgb level-action-bar">${level ? `<button type=button class=dg data-act=del data-id="${escapeHtml(level.id)}">${t('del')}</button>` : ''} <button type=button data-act=${level ? 'lvclose' : 'close'}>${t('close')}</button> <button type=submit class=pri>${t('save')}</button></div></form></div>`;
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

const listTagSummary = () => !ui.tagFilter.length ? t('listFilters') : t('listFilters') + ' · ' + (ui.tagFilter.length == 1 ? ui.tagFilter[0] : ui.tagFilter.length);

/** Updates the tag dropdown and its clear button in place, so an open dropdown keeps its state and focus. */
function renderListTagFilters() {
    const dropdown = qs('.lh .ms');
    if (!dropdown)
        return;
    dropdown.querySelectorAll('input').forEach(input => input.checked = ui.tagFilter.includes(input.value));
    dropdown.querySelector('.filter-label').textContent = listTagSummary();
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
    const modes = ['classic', 'platform'].map(kind => `<button type=button data-act=tab data-v=${kind} aria-pressed=${ui.tab == kind}${ui.tab == kind ? ' disabled' : ''}><img src="assets/modes/${kind}.svg" alt="" width=32 height=32> ${t(kind)}</button>`).join('');
    return `<div class=mode-switch role=group aria-label="${t('lists')}">${modes}</div><div class=lh><label class=list-search>${ICONS.listSearch}<input id=q type=search placeholder="${t('search')}" aria-label="${t('search')}" value="${escapeHtml(ui.q)}"></label><details class=ms><summary>${ICONS.listFilter}<span class=filter-label>${escapeHtml(listTagSummary())}</span>${ICONS.chevronDown}</summary><div class=msp>${options.length ? options.map(name => `<label><input type=checkbox name=tagf value="${escapeHtml(name)}"${ui.tagFilter.includes(name) ? ' checked' : ''}><i class=tag-dot aria-hidden=true ${tagColorAttr(name)}></i><span class=filter-label>${escapeHtml(name)}</span></label>`).join('') : `<span class=by>${t('noListTags')}</span>`}</div></details><button type=button class=list-clear data-act=ct aria-label="${t('clearTags')}" title="${t('clearTags')}"${ui.tagFilter.length ? '' : ' hidden'}>${ICONS.listClear}</button>${canEdit() ? `<button type=button class=list-add data-act=add>${ICONS.actionAdd} ${t('palAdd')}</button>` : ''}</div><div><p id=list-reorder-hint class=by role=status${canEdit() && listFiltersActive() ? '' : ' hidden'}>${t('listReorderHint')}</p><div id=list-actions>${listSelectionControls()}</div></div><div id=lw>${list()}</div>`;
}

function selectedListLevel() {
    const level = ui.sel == null ? null : findLevel(ui.sel);
    return level?.kind === ui.tab ? level : null;
}

/** Right column with level details, an editing form or an empty prompt. */
function panel() {
    const l = selectedListLevel();
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

function saveListOrder(order) {
    profile.order[ui.tab] = order;
    save();
    render();
}

function moveRankedLevel(id, direction) {
    if (!canReorder())
        return false;
    const ids = rankedIds(ui.tab), position = ids.findIndex(rankedId => String(rankedId) === id);
    if (position < 0)
        return false;
    const next = position + direction;
    if (next < 0 || next >= ids.length)
        return true;
    const order = [...profile.order[ui.tab]];
    const from = order.indexOf(ids[position]), to = order.indexOf(ids[next]);
    [order[from], order[to]] = [order[to], order[from]];
    saveListOrder(order);
    document.activeElement?.scrollIntoView({ block: 'nearest' });
    showToast(t('rankMoved').replace('{position}', next + 1).replace('{total}', ids.length));
    return true;
}

/** Saves the order Sortable left in the list. Sortable has already moved the card, so a cancelled drag redraws the saved order instead. */
function reorderList(evt) {
    if (dragWasCanceled(evt.originalEvent)) {
        render();
        return;
    }
    saveListOrder([...qs('#lst').children].map(c => c.dataset.id));
}

function configureDragScroll(sortable, pane) {
    const scrollPane = pane.scrollHeight > pane.clientHeight;
    sortable.option('scroll', scrollPane ? pane : true);
    sortable.option('bubbleScroll', !scrollPane);
}

function initSort() {
    const listNode = qs('#lst');
    if (!listNode || !canReorder())
        return;
    new Sortable(listNode, {
        animation: prefersReducedMotion() ? 0 : 180, filter: startsAwayFromGrip, preventOnFilter: false, fallbackTolerance: 5,
        // AutoScroll starts listening before Sortable dispatches onStart.
        onChoose() { configureDragScroll(this, listNode.parentElement); },
        forceAutoScrollFallback: true, scrollSensitivity: 80, scrollSpeed: 14, onUpdate: reorderList
    });
}

const scrollSel = () => qs('.lv.sel')?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'instant' : 'smooth' });

/** Redraws the list while preserving scroll and search text. */
function renderList() {
    qs('#lw').innerHTML = list();
    const hint = qs('#list-reorder-hint');
    if (hint)
        hint.hidden = !canEdit() || !listFiltersActive();
    const actions = qs('#list-actions');
    if (actions)
        actions.innerHTML = listSelectionControls();
    initSort();
    refreshScrollFades();
}

function renderPanel() {
    const r = qs('.rcol');
    r.innerHTML = panel();
    r.classList.toggle('has', !!selectedListLevel());
    r.dataset.level = ui.sel ?? '';
    renderTagSuggestions();
}

function focusLevelPanel() {
    qs('.rcol .box > h2')?.focus();
}

/** Selects a level without rebuilding the list. */
function selectLevel(id) {
    if (findLevel(id)?.kind !== ui.tab)
        return;
    ui.listReturnY = qs('#lw').scrollTop;
    ui.sel = id;
    ui.edit = 0;
    document.querySelectorAll('.lv.sel').forEach(c => c.classList.remove('sel'));
    qs(`.lv[data-id="${CSS.escape(id)}"]`)?.classList.add('sel');
    renderPanel();
    qs('.rcol').scrollTop = 0;
    if (innerWidth <= 900)
        focusLevelPanel();
}

/** Updates the automatic top field from the picked level. */
async function fillAredlPosition(f) {
    await loadAredlList();
    if (!f.isConnected)
        return;
    const q = k => f.elements[k];
    const level = { levelId: q('lid').value, name: q('name').value, kind: q('kind').value, rating: q('rating').value, diff: q('diff').value };
    qs('label[for=fm-ap]').textContent = t(level.kind == 'platform' ? 'apPlatform' : 'ap');
    // Without downloaded lists nothing is known, so the stored value stays on screen
    if (!aredlCache.length)
        return;
    q('ap').value = aredlTopValue(aredlStatus(level));
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
