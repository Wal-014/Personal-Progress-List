/**
 * Pantalla de Estadísticas: totales, cronograma de intentos y distribución por dificultad y año.
 */

/** Barras horizontales simples (dificultad y año). */
const bars = o => {
    const m = Math.max(1, ...Object.values(o));
    return Object.entries(o).map(([k, v]) => `<div class=bar><span>${escapeHtml(k)}</span><i style="width:${v / m * 60}%;min-width:3px"></i>${v}</div>`).join('');
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
    return `<h3>${t('tl')} <button data-act=zo>−</button> <span>${Math.round(W / 28 * 100)}%</span> <button data-act=zi>+</button></h3><div style="display:flex"><svg width=58 height=370 style="flex:none">${gl.map(v => `<text x=54 y=${Y(v) + 4} font-size=10 text-anchor=end fill="var(--mut)">${v.toLocaleString()}</text>`).join('')}</svg><div id=tlw style="overflow-x:auto;flex:1"><svg width="${w}" height=370>${gl.map(v => `<line x1=0 x2=${w} y1=${Y(v)} y2=${Y(v)} stroke="var(--ln)" stroke-dasharray="${v == M ? '' : '4'}"/>`).join('')}<line x1=0 x2=${w} y1=290 y2=290 stroke="var(--mut)"/>
${W >= 24 ? ds.map((d, c) => `<text transform="rotate(-60 ${X(c)} 302)" x=${X(c)} y=302 font-size=10 text-anchor=end fill="var(--mut)" pointer-events="none">${d.split('-').reverse().join('/')}</text>`).join('') : ''}
${pts.map(([l, c, y]) => `<line x1=${X(c)} x2=${X(c)} y1=${y} y2=290 stroke="var(--a)" stroke-opacity=".35" stroke-dasharray="3 3" pointer-events="none"/>`).join('')}${pts.map(([l, c, y]) => `<circle class=pt data-id="${l.id}" cx=${X(c)} cy=${y} r=5 fill="var(--a)"/>${W >= 60 ? `<text x=${X(c) + 9} y=${y + 4} font-size=10 fill="var(--fg)" pointer-events="none">${totalAttempts(l)}</text>` : ''}`).join('')}</svg></div></div>`;
}

/** Pantalla de Estadísticas. */
function stats() {
    const L = profile.levels.filter(l => totalAttempts(l) != null), A = L.reduce((s, l) => s + totalAttempts(l), 0), H = profile.levels.reduce((s, l) => s + (totalSeconds(l) || 0), 0), mx = L.length ? L.reduce((a, b) => totalAttempts(b) > totalAttempts(a) ? b : a) : null, dd = {}, yy = {};
    profile.levels.forEach(l => {
        dd[l.diff || '-'] = (dd[l.diff || '-'] || 0) + 1;
        if (l.date)
            yy[l.date.slice(0, 4)] = (yy[l.date.slice(0, 4)] || 0) + 1;
    });
    const tl = profile.levels.filter(l => l.date && totalAttempts(l) != null).sort((a, b) => a.date < b.date ? -1 : 1), W = ui.z, M = Math.max(1, ...tl.map(totalAttempts)), st = (k, v) => `<div class=st><small>${k}</small><b>${v}</b></div>`;
    return `<div class=grid>${st(t('lv'), profile.levels.length)}${st(t('attT'), A.toLocaleString())}${st(t('hrs'), Math.round(H / 3600))}${st(t('avg'), L.length ? Math.round(A / L.length) : '-')}${mx ? st(t('most'), `${escapeHtml(mx.name)} · ${totalAttempts(mx)}`) : ''}</div>
${timelineHtml()}
<h3>${t('byD')}</h3>${bars(Object.fromEntries([...DIFFICULTIES, '-'].filter(k => dd[k]).map(k => [k, dd[k]])))}<h3>${t('byY')}</h3>${bars(yy)}`;
}
