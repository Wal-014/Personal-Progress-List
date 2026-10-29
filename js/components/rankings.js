/** Shared level metrics and the per-mode rankings. */
const LEVEL_METRICS = {
    att: {
        label: 'sa', read: totalAttempts, format: value => value.toLocaleString(ui.lang),
        timelineLabel: 'timelineAttempts', step: 10000, short: value => value.toLocaleString(ui.lang),
        tooltip: value => `${value.toLocaleString(ui.lang)} ${t('att')}`
    },
    time: {
        label: 'sT', read: totalSeconds, format: formatDuration,
        timelineLabel: 'timelinePlaytime', step: 36000, short: value => `${Math.round(value / 360) / 10}h`,
        tooltip: formatDuration
    },
    enj: {
        label: 'enj', read: level => level.enj ?? null,
        format: value => `${value > 0 ? '+' : ''}${value}`, formatGap: String, range: [-10, 10]
    }
};

const levelMetricText = (metric, value) => value == null ? '-' : metric.format(value);

function rankingData() {
    const modeLevels = profile.levels.filter(level => level.kind == ui.rankingMode);
    const metric = LEVEL_METRICS[ui.rankingMetric];
    const ranked = modeLevels.filter(level => metric.read(level) != null).sort((a, b) =>
        (metric.read(a) - metric.read(b)) * (ui.rankingDirection == 'asc' ? 1 : -1) || a.name.localeCompare(b.name));
    const missing = ui.rankingAll ? modeLevels.filter(level => metric.read(level) == null).sort((a, b) => a.name.localeCompare(b.name)) : [];
    return { modeLevels, ranked: ui.rankingAll ? ranked : ranked.slice(0, 10), missing };
}

function statLevelIdentity(level) {
    return `<span class=stat-identity><span class=nm title="${escapeHtml(level.name)}">${escapeHtml(level.name)}</span>${level.levelId != null ? `<span class=by>ID ${escapeHtml(level.levelId)}</span>` : ''}</span>`;
}

const comparisonBadge = slotIndex => `<span class="compare-badge compare-${slotIndex + 1}">${slotIndex + 1}</span>`;

function statCard(level, position, selectedLevels) {
    const thumbnail = thumbUrl(level);
    const slots = selectedLevels.flatMap((chosen, slotIndex) => chosen?.id == level.id ? [slotIndex] : []);
    const cardBody = `<span class=stat-position>${position == null ? '—' : '#' + position}${slots.length ? `<span class=stat-badges>${slots.map(comparisonBadge).join('')}</span>` : ''}</span>${statLevelIdentity(level)}<span class=stat-values>${Object.entries(LEVEL_METRICS).map(([key, metric]) => `<span${key == ui.rankingMetric ? ' class=ranked-metric' : ''}><small>${t(metric.label)}</small><b>${escapeHtml(levelMetricText(metric, metric.read(level)))}</b></span>`).join('')}</span>${difficultyFace(level)}`;
    const attrs = `class="obj stat-card${slots.map(slotIndex => ' chosen-' + (slotIndex + 1)).join('')}"${thumbnail ? ` style="--th:url('${escapeHtml(thumbnail)}')"` : ''}`;
    return `<li>${ui.comparison.open ? `<button type=button ${attrs} data-act=compare-pick data-id="${escapeHtml(level.id)}" aria-pressed=${!!slots.length}>${cardBody}</button>` : `<div ${attrs}>${cardBody}</div>`}</li>`;
}

function rankingControls(modeCount) {
    return `<div class=ranking-controls>${statsSegments('ranking-mode', ui.rankingMode, ['classic', 'platform'].map(kind => [kind, t(kind)]), t('kind'))}${statsSegments('ranking-metric', ui.rankingMetric, Object.entries(LEVEL_METRICS).map(([key, metric]) => [key, t(metric.label)]), t('rankingMetric'))}<button type=button class=xs-txt data-act=ranking-order>${t(ui.rankingDirection == 'asc' ? 'lowestFirst' : 'highestFirst')}</button><button type=button class=xs-txt data-act=ranking-all>${ui.rankingAll ? t('topTen') : t('viewAll').replace('{n}', modeCount)}</button><button type=button class=xs-txt data-act=compare-toggle aria-pressed=${ui.comparison.open}>${t('compare')}</button></div>`;
}

function rankingsHtml() {
    const data = rankingData();
    const selectedLevels = ui.comparison.open ? comparisonLevels() : [];
    const emptyMessage = !data.modeLevels.length ? t('rankingEmptyMode') : !data.ranked.length ? t('rankingEmptyMetric') : '';
    return `<h2>${t('rankings')}</h2>${rankingControls(data.modeLevels.length)}<div class="ranking-layout${ui.comparison.open ? ' comparing' : ''}">${ui.comparison.open ? comparisonHtml() : ''}<div class=ranking-list>${emptyMessage ? `<p class=by>${emptyMessage}</p>` : ''}<ol class=stat-cards>${data.ranked.map((level, index) => statCard(level, index + 1, selectedLevels)).join('')}</ol>${data.missing.length ? `<h3 class=grp>${escapeHtml(t('metricNotRecorded').replace('{metric}', t(LEVEL_METRICS[ui.rankingMetric].label)))}</h3><ol class=stat-cards>${data.missing.map(level => statCard(level, null, selectedLevels)).join('')}</ol>` : ''}</div></div>`;
}

function renderRankings() {
    renderStatsWell('#rankings-well', rankingsHtml);
}

function setRankingMode(kind) {
    if (kind != ui.rankingMode) {
        ui.rankingMode = kind;
        ui.comparison.slots = [null, null];
    }
    renderRankings();
}

function setRankingMetric(key) {
    ui.rankingMetric = key;
    renderRankings();
}

function setRankingOrder() {
    ui.rankingDirection = ui.rankingDirection == 'desc' ? 'asc' : 'desc';
    renderRankings();
}

function setRankingAll() {
    ui.rankingAll = !ui.rankingAll;
    renderRankings();
}
