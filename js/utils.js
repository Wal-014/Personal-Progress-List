/**
 * Shared DOM, formatting, validation and calculation helpers, some using the active profile or interface state.
 */

/** Short form of document.querySelector. */
const qs = s => document.querySelector(s);

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Level names are compared ignoring case, accents, spaces and symbols. */
const normalizeName = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

/** Returns the link only if it is http(s), so schemes like javascript: never reach an href. */
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';

/** Generates an id that stays unique even when several are created in the same millisecond. */
const newId = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/** Shows a stored YYYY-MM-DD date as DD/MM/YYYY, the format used across the app. */
const formatDate = d => d ? d.split('-').reverse().join('/') : '';

const formatRating = value => value.toLocaleString(ui.lang, { maximumFractionDigits: 1 });

const orDash = v => v == null || v === '' ? '-' : v;

/** Formats seconds as "1h 30m 0s". */
const formatDuration = s => s == null ? '' : `${~~(s / 3600)}h ${~~(s % 3600 / 60)}m ${s % 60}s`;

/** Error checks for form fields that the browser cannot validate on its own. */
const FIELD_CHECKS = {
    name: v => v.trim() ? '' : t('errName'),
    lid: v => !v.trim() || /^\d+$/.test(v.trim()) ? '' : t('errLid')
};

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

/** Returns the 1920x1080 thumbnail for the level detail header. */
const fullThumbUrl = l => /^\d+$/.test(l.levelId) ? `https://levelthumbs.prevter.me/thumbnail/${l.levelId}` : '';

/** Returns the 640x360 thumbnail for cards and other small previews. */
const thumbUrl = l => {
    const url = fullThumbUrl(l);
    return url ? url + '/small' : '';
};

const aredlLabel = l => {
    const listName = l.kind == 'platform' ? 'AREPL' : 'AREDL';
    if (l.ar?.s == 'r' && l.ar.p != null)
        return `${listName} #${escapeHtml(l.ar.p)}`;
    if (l.ar?.s == 'p')
        return `${listName} · ${t('pending')}`;
    return listName + ' —';
};

/** Tag colour from the active profile, falling back to the text colour. */
const tagColor = n => {
    const c = profile.tags?.find(g => g.name == n)?.color;
    return isHexColor(c) ? c : 'var(--fg)';
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

/** Preserve the closest palette when loading preferences from earlier releases. */
const LEGACY_THEMES = { blue: 'nebula', night: 'graphite', synth: 'crimson', dark: 'graphite', light: 'porcelain' };
const themeOf = v => THEMES.includes(v) ? v : Object.hasOwn(LEGACY_THEMES, v) ? LEGACY_THEMES[v] : 'nebula';
const backgroundOf = v => BACKGROUNDS.includes(v) ? v : 'grid';
