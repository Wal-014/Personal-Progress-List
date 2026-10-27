/**
 * Stored profiles, interface state and access helpers.
 */

/** True when the saved data could not be read at startup and was moved to localStorage.gdpBroken. */
let storeWasUnreadable = false;

/** Reads the saved profiles. If they cannot be read, keeps a copy aside so the app can still start. */
function loadStore() {
    const raw = localStorage.gdp;
    if (!raw)
        return null;
    try {
        const s = JSON.parse(raw), ids = Object.keys(s.profs || {}).filter(id => s.profs[id]?.data);
        if (ids.length) {
            if (!ids.includes(s.cur))
                s.cur = ids[0];
            return s;
        }
    }
    catch {
    }
    localStorage.gdpBroken = raw;
    storeWasUnreadable = true;
    return null;
}

/** Profile store: { cur: active profile id, profs: { id: { name, color, secondaryColor, data } } }. */
let store = loadStore();

/** Active profile data: levels, order, wishlists and tags. */
let profile = store && store.profs[store.cur].data;

/** Interface state: screen, selection, search, theme and language. */
let ui = { tab: 'home', wl: null, q: '', tagFilter: [], z: 28, lang: localStorage.gl || 'es', theme: themeOf(localStorage.gt) };

const isListTab = () => ['classic', 'platform'].includes(ui.tab);

const emptyProfile = () => ({ levels: [], order: { classic: [], platform: [] }, wishlists: [], tags: [] });

const save = () => localStorage.gdp = JSON.stringify(store);

/** Migrates profile colours by their original position, saving only when needed. */
function ensureProfileColors() {
    let changed = false;
    Object.keys(store.profs).forEach((id, i) => {
        if (!isHexColor(store.profs[id].color)) {
            store.profs[id].color = PROFILE_COLORS[i % PROFILE_COLORS.length];
            changed = true;
        }
        if (!isHexColor(store.profs[id].secondaryColor)) {
            store.profs[id].secondaryColor = DEFAULT_SECONDARY_COLOR;
            changed = true;
        }
    });
    if (changed)
        save();
}

/** First unused preset, or the next position colour when every preset is used. */
function nextProfileColor() {
    const profiles = Object.values(store.profs), used = new Set(profiles.map(p => isHexColor(p.color) ? p.color.toLowerCase() : ''));
    return PROFILE_COLORS.find(color => !used.has(color)) || PROFILE_COLORS[profiles.length % PROFILE_COLORS.length];
}

const findLevel = id => profile.levels.find(l => l.id == id);

function activateProfile(id) {
    store.cur = id;
    profile = store.profs[id].data;
    ensureProfileDefaults();
}

function removeFromOrder(id) {
    for (const kind in profile.order)
        profile.order[kind] = profile.order[kind].filter(x => x != id);
}

function isValidProfileData(d) {
    const isObj = v => v != null && typeof v == 'object', isList = (a, check = isObj) => Array.isArray(a) && a.every(check);
    return isObj(d)
        && isList(d.levels)
        && isObj(d.order) && Array.isArray(d.order.classic) && Array.isArray(d.order.platform)
        && (d.wishlists == null || isList(d.wishlists, w => isObj(w) && isList(w.items)))
        && (d.tags == null || isList(d.tags));
}

/** Deaths per percent kept from saved or imported data: whole percentages from 0 to 100 with a count of zero or more. */
const cleanDeaths = d => Object.fromEntries(Object.entries(d && typeof d == 'object' ? d : {}).filter(([k, v]) => /^(100|[1-9]?\d)$/.test(k) && Number.isInteger(v) && v >= 0));

/**
 * Fills missing fields in older or imported profiles.
 * Imported files are only checked for their shape, so statuses and deaths are cleaned here before any template renders them.
 */
function ensureProfileDefaults() {
    profile.wishlists = profile.wishlists || [];
    fixIds(profile.levels, 'n');
    profile.levels.forEach(l => l.deaths = cleanDeaths(l.deaths));
    fixIds(profile.wishlists, 'w');
    profile.wishlists.forEach(w => {
        fixIds(w.items, 'i');
        w.items.forEach(i => i.status = ['todo', 'prog', 'done'].includes(i.status) ? i.status : i.done ? 'done' : 'todo');
    });
    if (!profile.tags) {
        const pal = ['#ff2bd6', '#00e5ff', '#ffd400', '#7cff6b', '#ff7a3d', '#9d7bff'];
        profile.tags = [...new Set(profile.levels.flatMap(l => l.tags || []))].map((n, i) => ({ name: n, color: pal[i % pal.length] }));
        save();
    }
}

/** Gives a new id to every entry that has none or repeats an earlier one. */
function fixIds(entries, prefix) {
    const seen = new Set();
    entries.forEach(x => {
        if (!x.id || seen.has(x.id))
            x.id = newId(prefix);
        seen.add(x.id);
    });
}
