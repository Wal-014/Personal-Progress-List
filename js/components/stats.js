/**
 * Statistics totals, attempts timeline and distributions by difficulty and year.
 */

/** Horizontal bars (difficulty and year). */
const bars = o => {
    const m = Math.max(1, ...Object.values(o));
    return Object.entries(o).map(([k, v]) => `<div class=hb><span>${escapeHtml(k)}</span><span class=tr><i style="width:${v / m * 100}%"></i></span><b>${v}</b></div>`).join('');
};

/** SVG timeline of attempts per level, ordered by date, with zoom. */
function timelineHtml() {
    const datedLevels = profile.levels.filter(level => level.date && totalAttempts(level) != null);
    const dates = [...new Set(datedLevels.map(level => level.date))].sort();
    const dateSpacing = ui.z;
    const maxAttempts = Math.max(1, ...datedLevels.map(totalAttempts));
    const attemptY = attempts => 290 - attempts / maxAttempts * 265;
    const dateX = index => 34 + index * dateSpacing;
    const gridLines = [];
    const chartWidth = dates.length * dateSpacing + 50;
    for (let attempts = 10000; attempts < maxAttempts; attempts += 10000)
        if (maxAttempts - attempts > maxAttempts * .04)
            gridLines.push(attempts);
    gridLines.push(maxAttempts);
    const points = [];
    dates.forEach((date, dateIndex) => {
        let previousY = 999;
        datedLevels.filter(level => level.date == date).sort((a, b) => totalAttempts(a) - totalAttempts(b)).forEach(level => {
            // Keep points on the same date 13px apart so their markers never overlap.
            const pointY = Math.min(attemptY(totalAttempts(level)), previousY - 13);
            previousY = pointY;
            points.push([level, dateIndex, pointY]);
        });
    });
    const line = [...points].sort((a, b) => a[1] - b[1]).map(([, dateIndex, pointY]) => `${dateX(dateIndex)},${pointY}`).join(' ');
    return `<h2 class=tlh>${t('tl')} <span class=zoom><button class=xs data-act=zo aria-label="${t('tl')} −">−</button><span class=by>${Math.round(dateSpacing / 28 * 100)}%</span><button class=xs data-act=zi aria-label="${t('tl')} +">+</button></span></h2><div style="display:flex"><svg width=58 height=370 style="flex:none">${gridLines.map(attempts => `<text x=54 y=${attemptY(attempts) + 4} font-size=10 text-anchor=end fill="var(--mut)">${attempts.toLocaleString(ui.lang)}</text>`).join('')}</svg><div id=tlw style="overflow-x:auto;flex:1"><svg width="${chartWidth}" height=370>${gridLines.map(attempts => `<line x1=0 x2=${chartWidth} y1=${attemptY(attempts)} y2=${attemptY(attempts)} stroke="var(--ln)" stroke-dasharray="${attempts == maxAttempts ? '' : '4'}"/>`).join('')}<line x1=0 x2=${chartWidth} y1=290 y2=290 stroke="#fff" stroke-width=2 />
${dateSpacing >= 24 ? dates.map((date, dateIndex) => `<text transform="rotate(-60 ${dateX(dateIndex)} 302)" x=${dateX(dateIndex)} y=302 font-size=10 text-anchor=end fill="var(--mut)" pointer-events="none">${escapeHtml(formatDate(date))}</text>`).join('') : ''}
<polyline points="${line}" fill=none stroke="#000" stroke-width=7 stroke-linejoin=round pointer-events=none /><polyline points="${line}" fill=none stroke="var(--a)" stroke-width=3 stroke-linejoin=round pointer-events=none />${points.map(([level, dateIndex, pointY]) => `<rect class=pt data-id="${escapeHtml(level.id)}" x=${dateX(dateIndex) - 6} y=${pointY - 6} width=12 height=12 fill="#fff" stroke="#000" stroke-width=2.5 />${dateSpacing >= 60 ? `<text x=${dateX(dateIndex) + 10} y=${pointY + 4} font-size=11 font-weight=bold fill="#fff" pointer-events="none">${escapeHtml(totalAttempts(level))}</text>` : ''}`).join('')}</svg></div></div>`;
}

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
<div class=stats2><div class=well>${timelineHtml()}</div><div class=side><div class="well d"><h2>${t('byD')}</h2>${bars(Object.fromEntries([...DIFFICULTIES, '-'].filter(difficulty => difficultyCounts[difficulty]).map(difficulty => [difficulty, difficultyCounts[difficulty]])))}</div><div class="well y"><h2>${t('byY')}</h2>${bars(yearCounts)}</div></div></div>`;
}
