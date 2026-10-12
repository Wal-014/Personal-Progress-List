/**
 * Funciones auxiliares puras: escape de HTML, formato y lectura de duraciones, cálculos de intentos y tiempos.
 */

/** Atajo de document.querySelector. */
const qs = s => document.querySelector(s);

/** Escapa texto antes de insertarlo en HTML. */
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Returns the link only if it is http(s), so schemes like javascript: never reach an href. */
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';

/** Generates an id that stays unique even when several are created in the same millisecond. */
const newId = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

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

/** Valid death line: «63% x4», with a percentage from 0 to 100. */
const isDeathLine = x => {
    const m = /^\s*(\d+)\s*%\s*x\s*(\d+)\s*$/i.exec(x);
    return !!m && +m[1] <= 100;
};

/** Error checks for form fields that the browser cannot validate on its own. */
const FIELD_CHECKS = {
    name: v => v.trim() ? '' : t('errName'),
    lid: v => !v.trim() || /^\d+$/.test(v.trim()) ? '' : t('errLid'),
    tN: v => !v.trim() || parseDuration(v) != null ? '' : t('errTime'),
    deaths: v => {
        const bad = v.split('\n').filter(x => x.trim() && !isDeathLine(x));
        return bad.length ? `${t('errDeaths')} ${bad.join(', ')}` : '';
    }
};
FIELD_CHECKS.tP = FIELD_CHECKS.tPC = FIELD_CHECKS.tN;

/** Error message for a form field, or '' when its value is valid. */
const fieldError = (name, value) => FIELD_CHECKS[name]?.(value) || '';

/** Today's date in the user's time zone as YYYY-MM-DD (toISOString() would give the UTC date). */
const todayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Intentos totales = intentos en normal + intentos en copia. */
const totalAttempts = l => l.attN == null && l.attC == null ? null : (l.attN || 0) + (l.attC || 0);

/** Tiempo total = normal + práctica + práctica en copia. */
const totalSeconds = l => {
    const a = [l.tN, l.tP, l.tPC].filter(x => x != null);
    return a.length ? a.reduce((x, y) => x + y) : null;
};

/** URL de la miniatura del nivel en Level Thumbnails. */
const thumbUrl = l => /^\d+$/.test(l.levelId) ? `https://levelthumbs.prevter.me/thumbnail/${l.levelId}` : '';

/** Texto del puesto en la AREDL / AREPL. */
const aredlLabel = l => {
    const L = l.kind == 'platform' ? 'AREPL' : 'AREDL';
    return l.ar?.s == 'r' ? (l.ar.p != null ? `${L} #${escapeHtml(l.ar.p)}` : `${L} · ${t('onl')}`) : l.ar?.s == 'p' ? t('pending') : l.ar?.s == 'n' ? t('notin') : L + ' -';
};

/** Color asignado a un tag. */
const tagColor = n => {
    const c = profile.tags?.find(g => g.name == n)?.color;
    return /^#[0-9a-f]{6}$/i.test(c) ? c : 'var(--b)';
};

/** Los niveles con el tag «Pre-Extremes» se muestran aparte, en «Primeros pasos». */
const isPre = l => (l.tags || []).includes('Pre-Extremes');
