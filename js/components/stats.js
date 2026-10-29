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
    return Object.entries(o).map(([k, v]) => `<div class=hb><span>${escapeHtml(k)}</span><span class=tr><i style="width:${v / m * 100}%"></i></span><b>${v}</b></div>`).join('');
};

function stats() {
    const levelsWithAttempts = profile.levels.filter(level => totalAttempts(level) != null);
    const attemptTotal = levelsWithAttempts.reduce((sum, level) => sum + totalAttempts(level), 0);
    const playSeconds = profile.levels.reduce((sum, level) => sum + (totalSeconds(level) || 0), 0);
    const mostAttemptsLevel = levelsWithAttempts.length ? levelsWithAttempts.reduce((current, level) => totalAttempts(level) > totalAttempts(current) ? level : current) : null;
    const difficultyCounts = {};
    const yearCounts = {};
    profile.levels.forEach(level => {
        difficultyCounts[level.diff || '-'] = (difficultyCounts[level.diff || '-'] || 0) + 1;
        if (level.date)
            yearCounts[level.date.slice(0, 4)] = (yearCounts[level.date.slice(0, 4)] || 0) + 1;
    });
    const statCell = (label, value, className = '') => `<div class="kpi ${className}"><small>${label}</small><b>${escapeHtml(value)}</b></div>`;
    return `<div class=kpis>${statCell(t('lv'), profile.levels.length)}${statCell(t('attT'), attemptTotal.toLocaleString(ui.lang), 'y')}${statCell(t('hrs'), Math.round(playSeconds / 3600))}${statCell(t('avg'), levelsWithAttempts.length ? Math.round(attemptTotal / levelsWithAttempts.length).toLocaleString(ui.lang) : '-')}${mostAttemptsLevel ? statCell(t('most'), `${mostAttemptsLevel.name} · ${totalAttempts(mostAttemptsLevel).toLocaleString(ui.lang)}`, 'sm') : ''}</div>
<div class=stats2><div class=well id=timeline-well>${timelineHtml()}</div><div class=side><div class="well d"><h2>${t('byD')}</h2>${bars(Object.fromEntries([...DIFFICULTIES, '-'].filter(difficulty => difficultyCounts[difficulty]).map(difficulty => [difficulty, difficultyCounts[difficulty]])))}</div><div class="well y"><h2>${t('byY')}</h2>${bars(yearCounts)}</div></div></div><section class=well id=rankings-well>${rankingsHtml()}</section>`;
}
