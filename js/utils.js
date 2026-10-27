/**
 * Shared DOM, formatting, validation and calculation helpers, some using the active profile or interface state.
 */

/** Short form of document.querySelector. */
const qs = s => document.querySelector(s);

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Returns the link only if it is http(s), so schemes like javascript: never reach an href. */
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';

/** Generates an id that stays unique even when several are created in the same millisecond. */
const newId = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/** Shows a stored YYYY-MM-DD date as DD/MM/YYYY, the format used across the app. */
const formatDate = d => d ? d.split('-').reverse().join('/') : '';

const orDash = v => v == null || v === '' ? '-' : v;

/** Formats seconds as "1h 30m 0s". */
const formatDuration = s => s == null ? '' : `${~~(s / 3600)}h ${~~(s % 3600 / 60)}m ${s % 60}s`;

/** Parses "1h 30m 0s" into seconds, or null when invalid. */
const parseDuration = x => {
    const m = /^\s*(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?\s*$/.exec(x || '');
    return m && (m[1] || m[2] || m[3]) ? +(m[1] || 0) * 3600 + +(m[2] || 0) * 60 + +(m[3] || 0) : null;
};

/** Parses "63% x4" lines into { percent: deaths }, summing repeated percentages. */
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

/** Attempts in normal mode (attN) plus in a copy of the level (attC), or null when neither is known. */
const totalAttempts = l => l.attN == null && l.attC == null ? null : (l.attN || 0) + (l.attC || 0);

/** Play time in normal mode (tN), practice (tP) and practice in a copy (tPC), in seconds, or null when none is known. */
const totalSeconds = l => {
    const a = [l.tN, l.tP, l.tPC].filter(x => x != null);
    return a.length ? a.reduce((x, y) => x + y) : null;
};

const thumbUrl = l => /^\d+$/.test(l.levelId) ? `https://levelthumbs.prevter.me/thumbnail/${l.levelId}` : '';

const aredlLabel = l => {
    const L = l.kind == 'platform' ? 'AREPL' : 'AREDL';
    return l.ar?.s == 'r' ? (l.ar.p != null ? `${L} #${escapeHtml(l.ar.p)}` : `${L} · ${t('onl')}`) : l.ar?.s == 'p' ? t('pending') : l.ar?.s == 'n' ? t('notin') : L + ' -';
};

/** Tag colour from the active profile, falling back to the theme colour. */
const tagColor = n => {
    const c = profile.tags?.find(g => g.name == n)?.color;
    return /^#[0-9a-f]{6}$/i.test(c) ? c : 'var(--b)';
};

const tagStyle = n => {
    const c = tagColor(n);
    return `color:${c};border-color:${c}`;
};

/** Levels tagged "Pre-Extremes" appear separately under "First steps". */
const PRE_TAG = 'Pre-Extremes';
const isPre = l => (l.tags || []).includes(PRE_TAG);

/** Relative time of a past moment, such as "3 hours ago", using ui.lang. */
const timeAgo = ms => {
    const s = (Date.now() - ms) / 1000, f = new Intl.RelativeTimeFormat(ui.lang, { numeric: 'auto' });
    return s < 3600 ? f.format(-Math.round(s / 60), 'minute') : s < 86400 ? f.format(-Math.round(s / 3600), 'hour') : f.format(-Math.round(s / 86400), 'day');
};

/** Theme to use for a saved preference: the removed dark and light themes map to their closest new theme. */
const themeOf = v => ({ dark: 'night', light: 'blue' })[v] || (THEMES.includes(v) ? v : 'blue');
