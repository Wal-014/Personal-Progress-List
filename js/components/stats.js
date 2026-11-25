/**
 * Statistics page composition, totals and distributions by difficulty and year.
 */

function statsSegments(action, selected, choices, label) {
    return `<div class=gdseg role=group aria-label="${escapeHtml(label)}">${choices.map(([value, text]) => `<button type=button class=xs-txt data-act=${action} data-v="${escapeHtml(value)}" aria-pressed=${selected == value}>${escapeHtml(text)}</button>`).join('')}</div>`;
}

/** Rebuilds one well while preserving its control focus and the page's position. */
function renderStatsWell(selector, draw) {
    const well = qs(selector);
    if (!well)
        return;
    const focused = controlSelector(document.activeElement);
    const pageX = window.scrollX, pageY = window.scrollY;
    well.innerHTML = draw();
    if (focused)
        qs(focused)?.focus({ preventScroll: true });
    window.scrollTo(pageX, pageY);
}

/** Horizontal bars (difficulty and year). */
const bars = o => {
    const m = Math.max(1, ...Object.values(o));
    return Object.entries(o).map(([k, v]) => `<div class=hb><span>${escapeHtml(k)}</span><span class=tr><i data-pct="${escapeHtml(v / m * 100)}"></i></span><b>${v}</b></div>`).join('');
};

/** Averages count only the levels with a recorded value, so missing attempts or time never read as zero. */
function statsSummary() {
    const levelsWithAttempts = profile.levels.filter(level => totalAttempts(level) != null);
    const levelsWithTime = profile.levels.filter(level => totalSeconds(level) != null);
    const attemptTotal = levelsWithAttempts.reduce((sum, level) => sum + totalAttempts(level), 0);
    const playSeconds = levelsWithTime.reduce((sum, level) => sum + totalSeconds(level), 0);
    return {
        levelCount: profile.levels.length,
        attemptTotal,
        playSeconds,
        playHours: Math.round(playSeconds / 3600),
        average: levelsWithAttempts.length ? Math.round(attemptTotal / levelsWithAttempts.length) : null,
        averageSeconds: levelsWithTime.length ? Math.round(playSeconds / levelsWithTime.length) : null
    };
}

/** Levels without a difficulty are told apart: an unrated level has none in the game, otherwise it is unknown. */
const difficultyBucket = level => DIFFICULTIES.includes(level.diff) ? level.diff : level.rating == 'unrated' ? 'unrated' : 'unknown';
const difficultyBucketLabel = bucket => bucket == 'unrated' ? t('diffUnrated') : bucket == 'unknown' ? t('diffUnknown') : bucket;

function stats() {
    if (!profile.levels.length)
        return canEdit() ? emptyList({ icon: ICONS.metricLevels, title: t('emptyListTitle'), text: t('statsEmptyText'), action: 'add' }) : `<p class=by>${t('publicNoLevels')}</p>`;
    const { levelCount, attemptTotal, playSeconds, average, averageSeconds } = statsSummary();
    const difficultyCounts = {};
    const yearCounts = {};
    profile.levels.forEach(level => {
        const bucket = difficultyBucket(level);
        difficultyCounts[bucket] = (difficultyCounts[bucket] || 0) + 1;
        if (level.date)
            yearCounts[level.date.slice(0, 4)] = (yearCounts[level.date.slice(0, 4)] || 0) + 1;
    });
    const statCell = (label, value, className = '', icon = '') => `<div class="kpi ${className}"><small>${icon}${label}</small><b>${escapeHtml(value)}</b></div>`;
    const statPair = (icon, className, [label, value], [averageLabel, averageValue]) => `<div class="kpi kpi-pair ${className}"><small>${icon}${label}</small><b>${escapeHtml(value)}</b><small class=kpi-sub>${averageLabel}</small><b class=kpi-sub-value>${escapeHtml(averageValue ?? '—')}</b></div>`;
    const hours = (playSeconds / 3600).toLocaleString(ui.lang, { maximumFractionDigits: 1 });
    return `<div class=kpis>${statCell(levelLabel(levelCount), levelCount, '', ICONS.metricLevels)}${statPair(ICONS.metricAttempts, 'y', [t('attT'), attemptTotal.toLocaleString(ui.lang)], [t('avg'), average?.toLocaleString(ui.lang)])}${statPair(ICONS.metricHours, '', [t('hrsT'), hours], [t('avgTime'), averageSeconds == null ? null : formatPlaytime(averageSeconds)])}</div>
<div class=stats2><div class=well id=timeline-well>${timelineHtml()}</div><div class=side><div class="well d"><h2>${t('byD')}</h2>${bars(Object.fromEntries([...DIFFICULTIES, 'unrated', 'unknown'].filter(bucket => difficultyCounts[bucket]).map(bucket => [difficultyBucketLabel(bucket), difficultyCounts[bucket]])))}</div><div class="well y"><h2>${t('byY')}</h2>${bars(yearCounts)}</div></div></div><section class=well id=rankings-well>${rankingsHtml()}</section>`;
}
