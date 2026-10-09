/**
 * Funciones auxiliares puras: escape de HTML, formato y lectura de duraciones, cálculos de intentos y tiempos.
 */

/** Atajo de document.querySelector. */
const qs = s => document.querySelector(s);

/** Escapa texto antes de insertarlo en HTML. */
const escapeHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Muestra «-» cuando no hay dato. */
const orDash = v => v == null || v === '' ? '-' : v;

/** Convierte segundos a «1h 30m 0s». */
const formatDuration = s => s == null ? '' : `${~~(s / 3600)}h ${~~(s % 3600 / 60)}m ${s % 60}s`;

/** Convierte «1h 30m 0s» a segundos (null si no es válido). */
const parseDuration = x => {
    const m = /^\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?\s*$/.exec(x || '');
    return m && (m[1] || m[2] || m[3]) ? +(m[1] || 0) * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0) : null;
};

/** Lee el texto «63% x4» (una línea por porcentaje) y devuelve {porcentaje: muertes}. */
const parseDeaths = x => {
    const d = {};
    for (const m of x.matchAll(/(\d+)\s*%\s*x\s*(\d+)/gi))
        d[m[1]] = (d[m[1]] || 0) + +m[2];
    return d;
};

/** Intentos totales = intentos en normal + intentos en copia. */
const totalAttempts = l => l.attN == null && l.attC == null ? null : (l.attN || 0) + (l.attC || 0);

/** Tiempo total = normal + práctica + práctica en copia. */
const totalSeconds = l => {
    const a = [l.tN, l.tP, l.tPC].filter(x => x != null);
    return a.length ? a.reduce((x, y) => x + y) : null;
};

/** URL de la miniatura del nivel en Level Thumbnails. */
const thumbUrl = l => l.levelId ? `https://levelthumbs.prevter.me/thumbnail/${l.levelId}` : '';

/** Texto del puesto en la AREDL / AREPL. */
const aredlLabel = l => {
    const L = l.kind == 'platform' ? 'AREPL' : 'AREDL';
    return l.ar?.s == 'r' ? `${L} #${l.ar.p}` : l.ar?.s == 'p' ? t('pending') : l.ar?.s == 'n' ? t('notin') : L + ' -';
};

/** Color asignado a un tag. */
const tagColor = n => profile.tags?.find(g => g.name == n)?.color || 'var(--b)';

/** Los niveles con el tag «Pre-Extremes» se muestran aparte, en «Primeros pasos». */
const isPre = l => (l.tags || []).includes('Pre-Extremes');
