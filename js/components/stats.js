/**
 * Pantalla de Estadísticas: totales, cronograma de intentos y distribución por dificultad y año.
 */

/** Horizontal bars (difficulty and year). */
const bars = o => {
    const m = Math.max(1, ...Object.values(o));
    return Object.entries(o).map(([k, v]) => `<div class=hb><span>${escapeHtml(k)}</span><span class=tr><i style="width:${v / m * 100}%"></i></span><b>${v}</b></div>`).join('');
};

/** Cronograma SVG: intentos por nivel, ordenado por fecha, con zoom. */
function timelineHtml() {
    const L = profile.levels.filter(l => l.date && totalAttempts(l) != null), ds = [...new Set(L.map(l => l.date))].sort(), W = ui.z, M = Math.max(1, ...L.map(totalAttempts)), Y = v => 290 - v / M * 265, X = c => 34 + c * W, gl = [], w = ds.length * W + 50;
    for (let v = 10000; v < M; v += 10000)
        if (M - v > M * .04)
            gl.push(v);
    gl.push(M);
    const pts = [];
    ds.forEach((d, c) => {
        let pv = 999;
        L.filter(l => l.date == d).sort((a, b) => totalAttempts(a) - totalAttempts(b)).forEach(l => {
            const y = Math.min(Y(totalAttempts(l)), pv - 13);
            pv = y;
            pts.push([l, c, y]);
        });
    });
    const line = [...pts].sort((a, b) => a[1] - b[1]).map(([, c, y]) => `${X(c)},${y}`).join(' ');
    return `<h2 class=tlh>${t('tl')} <span class=zoom><button class=xs data-act=zo aria-label="${t('tl')} −">−</button><span class=by>${Math.round(W / 28 * 100)}%</span><button class=xs data-act=zi aria-label="${t('tl')} +">+</button></span></h2><div style="display:flex"><svg width=58 height=370 style="flex:none">${gl.map(v => `<text x=54 y=${Y(v) + 4} font-size=10 text-anchor=end fill="var(--mut)">${v.toLocaleString(ui.lang)}</text>`).join('')}</svg><div id=tlw style="overflow-x:auto;flex:1"><svg width="${w}" height=370>${gl.map(v => `<line x1=0 x2=${w} y1=${Y(v)} y2=${Y(v)} stroke="var(--ln)" stroke-dasharray="${v == M ? '' : '4'}"/>`).join('')}<line x1=0 x2=${w} y1=290 y2=290 stroke="#fff" stroke-width=2 />
${W >= 24 ? ds.map((d, c) => `<text transform="rotate(-60 ${X(c)} 302)" x=${X(c)} y=302 font-size=10 text-anchor=end fill="var(--mut)" pointer-events="none">${escapeHtml(formatDate(d))}</text>`).join('') : ''}
<polyline points="${line}" fill=none stroke="#000" stroke-width=7 stroke-linejoin=round pointer-events=none /><polyline points="${line}" fill=none stroke="var(--a)" stroke-width=3 stroke-linejoin=round pointer-events=none />${pts.map(([l, c, y]) => `<rect class=pt data-id="${escapeHtml(l.id)}" x=${X(c) - 6} y=${y - 6} width=12 height=12 fill="#fff" stroke="#000" stroke-width=2.5 />${W >= 60 ? `<text x=${X(c) + 10} y=${y + 4} font-size=11 font-weight=bold fill="#fff" pointer-events="none">${escapeHtml(totalAttempts(l))}</text>` : ''}`).join('')}</svg></div></div>`;
}

/** Pantalla de Estadísticas. */
function stats() {
    const L = profile.levels.filter(l => totalAttempts(l) != null), A = L.reduce((s, l) => s + totalAttempts(l), 0), H = profile.levels.reduce((s, l) => s + (totalSeconds(l) || 0), 0), mx = L.length ? L.reduce((a, b) => totalAttempts(b) > totalAttempts(a) ? b : a) : null, dd = {}, yy = {};
    profile.levels.forEach(l => {
        dd[l.diff || '-'] = (dd[l.diff || '-'] || 0) + 1;
        if (l.date)
            yy[l.date.slice(0, 4)] = (yy[l.date.slice(0, 4)] || 0) + 1;
    });
    const st = (k, v, c = '') => `<div class="kpi ${c}"><small>${k}</small><b>${escapeHtml(v)}</b></div>`;
    return `<div class=kpis>${st(t('lv'), profile.levels.length)}${st(t('attT'), A.toLocaleString(ui.lang), 'y')}${st(t('hrs'), Math.round(H / 3600))}${st(t('avg'), L.length ? Math.round(A / L.length).toLocaleString(ui.lang) : '-')}${mx ? st(t('most'), `${mx.name} · ${totalAttempts(mx).toLocaleString(ui.lang)}`, 'sm') : ''}</div>
<div class=stats2><div class=well>${timelineHtml()}</div><div class=side><div class="well d"><h2>${t('byD')}</h2>${bars(Object.fromEntries([...DIFFICULTIES, '-'].filter(k => dd[k]).map(k => [k, dd[k]])))}</div><div class="well y"><h2>${t('byY')}</h2>${bars(yy)}</div></div></div>`;
}
