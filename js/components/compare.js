/** Same-mode comparison selection, calculations and panel. */
const comparisonModeLevels = () => profile.levels.filter(level => level.kind == ui.rankingMode);
const comparisonLevels = () => ui.comparison.slots.map(id => comparisonModeLevels().find(level => level.id == id) || null);
const comparisonOption = level => level.name + (level.levelId != null ? ` · ID ${level.levelId}` : '');

function toggleComparison() {
    ui.comparison.open = !ui.comparison.open;
    renderRankings();
}

function closeComparison() {
    ui.comparison.open = false;
    renderRankings();
    qs('[data-act=compare-toggle]')?.focus({ preventScroll: true });
}

function pickComparisonLevel(id) {
    if (!comparisonModeLevels().some(level => level.id == id))
        return;
    const slots = comparisonLevels().map(level => level?.id ?? null);
    const chosenIndex = slots.indexOf(id);
    if (chosenIndex != -1)
        slots[chosenIndex] = null;
    else
        slots[slots[0] == null ? 0 : 1] = id;
    ui.comparison.slots = slots;
    renderRankings();
}

function setComparisonSearch(input) {
    const selected = comparisonModeLevels().find(level => comparisonOption(level) === input.value);
    if (!selected)
        return;
    const slotIndex = +input.dataset.compareSlot;
    ui.comparison.slots[slotIndex] = selected.id;
    if (ui.comparison.slots[1 - slotIndex] == selected.id)
        ui.comparison.slots[1 - slotIndex] = null;
    renderRankings();
}

function clearComparisonSlot(slotIndex) {
    ui.comparison.slots[slotIndex] = null;
    renderRankings();
    qs('#compare-search-' + slotIndex)?.focus({ preventScroll: true });
}

function comparisonMetric(metric, firstLevel, secondLevel) {
    const values = [metric.read(firstLevel), metric.read(secondLevel)];
    const maximum = Math.max(1, ...values.filter(value => value != null));
    const shares = values.map(value => value == null ? null : metric.range
        ? (value - metric.range[0]) / (metric.range[1] - metric.range[0]) * 100
        : value / maximum * 100);
    const complete = values.every(value => value != null);
    return {
        values, shares,
        difference: !complete ? null : values[0] == values[1] ? '' : (metric.formatGap || metric.format)(Math.abs(values[0] - values[1])),
        arrow: !complete ? null : values[0] == values[1] ? '=' : values[0] > values[1] ? '←' : '→'
    };
}

function comparisonSlotHtml(level, slotIndex) {
    const label = t(slotIndex == 0 ? 'compareLevelOne' : 'compareLevelTwo');
    return `<div class="compare-slot compare-${slotIndex + 1}"><label for=compare-search-${slotIndex}>${comparisonBadge(slotIndex)} ${label}</label><input id=compare-search-${slotIndex} type=search list=compare-options data-compare-slot=${slotIndex} placeholder="${t('compareSearch')}">${level ? `<div class=compare-selection>${difficultyFace(level)}${statLevelIdentity(level)}<button type=button class=xs data-act=compare-clear data-v=${slotIndex} aria-label="${escapeHtml(t('compareClear').replace('{level}', label))}">×</button></div>` : ''}</div>`;
}

function comparisonMetricHtml(metric, firstLevel, secondLevel) {
    const result = comparisonMetric(metric, firstLevel, secondLevel);
    const difference = result.difference == null ? '' : `<small class=compare-gap>${result.arrow}${result.difference ? ' ' + escapeHtml(result.difference) : ''}</small>`;
    return `<div class=compare-row><div class=compare-numbers><span class=compare-value>${escapeHtml(levelMetricText(metric, result.values[0]))}</span><span>${t(metric.label)}${difference}</span><span class=compare-value>${escapeHtml(levelMetricText(metric, result.values[1]))}</span></div><div class=compare-bars>${result.shares.map((share, slotIndex) => `<span class="compare-track compare-${slotIndex + 1}">${share == null ? '' : `<i style="width:${share}%"></i>`}</span>`).join('')}</div></div>`;
}

function comparisonHtml() {
    const selected = comparisonLevels();
    const selectedCount = selected.filter(Boolean).length;
    return `<aside class=compare-panel aria-labelledby=compare-title><div class=compare-heading><h3 id=compare-title>${t('compare')} · ${t(ui.rankingMode)}</h3><button type=button class=xs data-act=compare-close aria-label="${t('compareClose')}">×</button></div><div class=compare-slots>${selected.map(comparisonSlotHtml).join('')}</div><datalist id=compare-options>${comparisonModeLevels().map(level => `<option value="${escapeHtml(comparisonOption(level))}"></option>`).join('')}</datalist>${selectedCount < 2 ? `<p class=by role=status>${t(selectedCount ? 'compareWaiting' : 'compareHint')}</p>` : `<div class=compare-results>${Object.values(LEVEL_METRICS).map(metric => comparisonMetricHtml(metric, ...selected)).join('')}<div class=compare-difficulty>${selected.map(level => `<div>${difficultyFace(level)}<span>${escapeHtml(difficultyLabel(level))}</span></div>`).join(`<span>${t('diff')}</span>`)}</div></div>`}</aside>`;
}
