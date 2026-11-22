/**
 * Shared DOM, formatting, validation and calculation helpers, some using the active profile or interface state.
 */

/** Short form of document.querySelector. */
const qs = s => document.querySelector(s);

const SCROLL_PANES = '#lw, .shell-main > .legacy-surface, .legacy-surface > .wl';

function scrollEdges({ scrollTop, clientHeight, scrollHeight }) {
    const maxScroll = scrollHeight - clientHeight;
    return { top: maxScroll > 1 && scrollTop > 1, bottom: maxScroll > 1 && maxScroll - scrollTop > 1 };
}

function updateScrollFades(pane) {
    const { top, bottom } = scrollEdges(pane);
    pane.classList.toggle('fade-top', top);
    pane.classList.toggle('fade-bottom', bottom);
}

const scrollFadeObserver = typeof ResizeObserver === 'undefined' ? null
    : new ResizeObserver(() => document.querySelectorAll(SCROLL_PANES).forEach(updateScrollFades));

function refreshScrollFades() {
    scrollFadeObserver?.disconnect();
    for (const pane of document.querySelectorAll(SCROLL_PANES)) {
        updateScrollFades(pane);
        if (scrollFadeObserver) {
            scrollFadeObserver.observe(pane);
            // The content can grow while the scroll pane itself keeps the same height.
            for (const child of pane.children)
                scrollFadeObserver.observe(child);
        }
    }
}

const prefersReducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Level names are compared ignoring case, accents, spaces and symbols. */
const normalizeName = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

/** Returns the link only if it is http(s), so schemes like javascript: never reach an href. */
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';

/** Generates an id that stays unique even when several are created in the same millisecond. */
const newId = prefix => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

/** Shows a stored YYYY-MM-DD date as DD/MM/YYYY, the format used across the app. */
const formatDate = d => d ? d.split('-').reverse().join('/') : '';

/** Zero levels use the plural form in both supported languages. */
const levelLabel = count => t(count == 1 ? 'lv1' : 'lv');

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

/** Tag colour from the active profile, falling back to the text colour. */
const tagColor = n => {
    const c = profile.tags?.find(g => g.name == n)?.color;
    return isHexColor(c) ? c : 'var(--fg)';
};

const tagColorAttr = n => `data-tag-color="${escapeHtml(tagColor(n))}"`;

/** Levels tagged "Pre-Extremes" appear separately under "First steps". */
const TAG_NAME_LIMIT = 24;
const PRE_TAG = 'Pre-Extremes';
const isPre = l => (l.tags || []).includes(PRE_TAG);

/** Preserve the closest palette when loading preferences from earlier releases. */
const LEGACY_THEMES = { blue: 'nebula', night: 'graphite', synth: 'crimson', dark: 'graphite', light: 'porcelain' };
const themeOf = v => THEMES.includes(v) ? v : Object.hasOwn(LEGACY_THEMES, v) ? LEGACY_THEMES[v] : 'nebula';
const backgroundOf = v => BACKGROUNDS.includes(v) ? v : 'grid';
