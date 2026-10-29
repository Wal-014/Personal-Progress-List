/** Metric-aware completion timeline, with independent redraw and zoom. */
function timelineData() {
    const metric = LEVEL_METRICS[ui.timelineMetric];
    const levels = profile.levels.filter(level => level.date && metric.read(level) != null);
    const dates = [...new Set(levels.map(level => level.date))].sort();
    const maximum = Math.max(1, ...levels.map(metric.read));
    const grid = [];
    for (let value = metric.step; value < maximum; value += metric.step)
        if (maximum - value > maximum * .04)
            grid.push(value);
    grid.push(maximum);
    return { levels, dates, maximum, grid };
}

function timelinePoints(data, metric) {
    const points = [];
    data.dates.forEach((date, dateIndex) => {
        let previousY = 999;
        data.levels.filter(level => level.date == date).sort((a, b) => metric.read(a) - metric.read(b)).forEach(level => {
            // Keep points on the same date 13px apart so their markers never overlap.
            const pointY = Math.min(290 - metric.read(level) / data.maximum * 265, previousY - 13);
            previousY = pointY;
            points.push([level, dateIndex, pointY]);
        });
    });
    return points;
}

function timelineHtml() {
    const metric = LEVEL_METRICS[ui.timelineMetric];
    const data = timelineData();
    const dateSpacing = ui.z;
    const valueY = value => 290 - value / data.maximum * 265;
    const dateX = index => 34 + index * dateSpacing;
    const chartWidth = data.dates.length * dateSpacing + 50;
    const points = timelinePoints(data, metric);
    const line = [...points].sort((a, b) => a[1] - b[1]).map(([, dateIndex, pointY]) => `${dateX(dateIndex)},${pointY}`).join(' ');
    return `<div class=timeline-controls><h2>${t('tl')}</h2>${statsSegments('timeline-metric', ui.timelineMetric, Object.entries(LEVEL_METRICS).filter(([, entry]) => entry.timelineLabel).map(([key, entry]) => [key, t(entry.timelineLabel)]), t('timelineMetric'))}<span class=zoom><button class=xs data-act=zo aria-label="${t('tl')} −">−</button><span class=by>${Math.round(dateSpacing / 28 * 100)}%</span><button class=xs data-act=zi aria-label="${t('tl')} +">+</button></span></div><div class=timeline-chart><svg width=58 height=370 style="flex:none">${data.grid.map(value => `<text x=54 y=${valueY(value) + 4} font-size=10 text-anchor=end fill="var(--mut)">${escapeHtml(metric.short(value))}</text>`).join('')}</svg><div id=tlw><svg width="${chartWidth}" height=370>${data.grid.map(value => `<line x1=0 x2=${chartWidth} y1=${valueY(value)} y2=${valueY(value)} stroke="var(--ln)" stroke-dasharray="${value == data.maximum ? '' : '4'}"/>`).join('')}<line x1=0 x2=${chartWidth} y1=290 y2=290 stroke="#fff" stroke-width=2 />
${dateSpacing >= 24 ? data.dates.map((date, dateIndex) => `<text transform="rotate(-60 ${dateX(dateIndex)} 302)" x=${dateX(dateIndex)} y=302 font-size=10 text-anchor=end fill="var(--mut)" pointer-events="none">${escapeHtml(formatDate(date))}</text>`).join('') : ''}
<polyline points="${line}" fill=none stroke="#000" stroke-width=7 stroke-linejoin=round pointer-events=none /><polyline points="${line}" fill=none stroke="var(--a)" stroke-width=3 stroke-linejoin=round pointer-events=none />${points.map(([level, dateIndex, pointY]) => `<rect class=pt data-id="${escapeHtml(level.id)}" x=${dateX(dateIndex) - 6} y=${pointY - 6} width=12 height=12 fill="#fff" stroke="#000" stroke-width=2.5 />${dateSpacing >= 60 ? `<text x=${dateX(dateIndex) + 10} y=${pointY + 4} font-size=11 font-weight=bold fill="#fff" pointer-events="none">${escapeHtml(metric.short(metric.read(level)))}</text>` : ''}`).join('')}</svg></div></div>`;
}

function renderTimeline() {
    const scrollLeft = qs('#tlw')?.scrollLeft || 0;
    renderStatsWell('#timeline-well', timelineHtml);
    if (qs('#tlw'))
        qs('#tlw').scrollLeft = scrollLeft;
}

function setTimelineMetric(key) {
    ui.timelineMetric = key;
    renderTimeline();
}

function timelineTooltip(level) {
    const thumbnail = thumbUrl(level);
    return `${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="">` : ''}<b>${escapeHtml(level.name)}</b><br>${escapeHtml(LEVEL_METRICS[ui.timelineMetric].tooltip(LEVEL_METRICS[ui.timelineMetric].read(level)))} · ${escapeHtml(formatDate(level.date))}`;
}
