/**
 * AREDL and AREPL lists (positions and IDs), and the sync that also fills creators and difficulties from the community sheet.
 */

/** The stored AREDL and AREPL lists, or none when the stored copy cannot be read: a failed parse here would leave aredlCache unusable and break every AREDL lookup until storage is cleared. */
function readAredlCache() {
    try {
        const lists = JSON.parse(localStorage.gar || '[]');
        return Array.isArray(lists) ? lists : [];
    }
    catch {
        return [];
    }
}

/** Locally stored AREDL and AREPL lists, refreshed after AREDL_MAX_AGE. */
let aredlCache = readAredlCache();

/** Normalized names per cached array: keyed by the array, so replacing aredlCache drops them without extra code. */
const aredlNameIndexes = new WeakMap();

/** After this long the lists are downloaded again on their own. */
const AREDL_MAX_AGE = 12 * 3600 * 1000;

/** Display name of an API user, or null when none is available. */
const publisherName = x => typeof x == 'string' ? x : x && (x.global_name || x.username || x.name || x.display_name || x.discord_username || Object.values(x).find(v => typeof v == 'string' && v.length < 32 && !/^[0-9a-f-]{20,}$/i.test(v))) || null;

/** Cached levels of one list with their normalized names, built once per cached array; entries of an unknown list are left out. */
function indexedAredlNames(kind) {
    let index = aredlNameIndexes.get(aredlCache);
    if (!index) {
        index = { d: [], p: [] };
        for (const level of aredlCache)
            index[level.k]?.push({ level, name: normalizeName(level.n) });
        aredlNameIndexes.set(aredlCache, index);
    }
    return index[kind];
}

/**
 * Searches cached AREDL names (kind: 'd' classic, 'p' platformer).
 * First an exact normalized match; otherwise the single official name that contains what was typed.
 * The reverse (typed text containing an official name) is not accepted: "Kenos Remake" is not "Kenos".
 */
function findAredlByName(name, kind) {
    const n = normalizeName(name);
    if (!n)
        return null;
    const pool = indexedAredlNames(kind);
    const exact = pool.find(x => x.name == n);
    if (exact)
        return exact.level;
    const partial = n.length < 4 ? [] : pool.filter(x => x.name.includes(n));
    return partial.length == 1 ? partial[0].level : null;
}

/** Up to three similar AREDL names for suggestions. */
function similarAredlNames(name, kind) {
    const n = normalizeName(name).slice(0, 4);
    return n ? indexedAredlNames(kind).filter(x => x.name.includes(n)).slice(0, 3).map(x => x.level.n) : [];
}

/** Downloads uncached AREDL and AREPL lists (always with force); returns true when fresh lists arrive. */
async function loadAredlList(force) {
    if (aredlCache.length && !force)
        return false;
    const get = async (q) => {
        try {
            const r = await (await fetch(AREDL_API + q)).json();
            return Array.isArray(r) ? r : r.data || [];
        }
        catch {
            return [];
        }
    }, [d, q] = await Promise.all([get('aredl/levels'), get('arepl/levels')]);
    const fresh = [...d.map(x => ({ k: 'd', i: x.level_id, n: String(x.name), p: x.position, u: publisherName(x.publisher) })), ...q.map(x => ({ k: 'p', i: x.level_id, n: String(x.name), p: x.position, u: publisherName(x.publisher) }))];
    if (fresh.length)
        aredlCache = fresh;
    if (aredlCache.length)
        localStorage.gar = JSON.stringify(aredlCache);
    return fresh.length > 0;
}

/** The lists are downloaded again at most once per visit to look for levels missing from the cache. */
let aredlReloadedForMissing = false;

/** Fills a wishlist level's ID from the AREDL (which also matches partial names), then its creator and difficulty from the community sheet. */
async function enrichWishlistItem(it) {
    try {
        await loadAredlList();
        const find = () => it.levelId ? aredlCache.find(x => String(x.i) == String(it.levelId)) : findAredlByName(it.name, 'd') || findAredlByName(it.name, 'p');
        let m = find();
        if (!m && !aredlReloadedForMissing) {
            aredlReloadedForMissing = true;
            await loadAredlList(true);
            m = find();
        }
        if (m)
            it.levelId = it.levelId || String(m.i);
        await loadSheetLevels();
        fillFromSheet(it);
    }
    catch {
    }
    it.chk = 1;
    save();
    render();
}

async function enrichWishlist(w) {
    for (const i of w.items)
        if (!i.chk && (!i.creator || !i.levelId || !i.diff)) {
            await enrichWishlistItem(i);
            await new Promise(s => setTimeout(s, 300));
        }
}

function findAredlLevel(level) {
    const kind = level.kind == 'platform' ? 'p' : 'd';
    return (level.levelId && aredlCache.findLast(x => x.k == kind && String(x.i) == String(level.levelId)))
        || aredlCache.findLast(x => x.k == kind && x.n.toLowerCase() == level.name.toLowerCase())
        || findAredlByName(level.name, kind);
}

function aredlStatus(level) {
    const match = findAredlLevel(level);
    return match ? { s: 'r', p: match.p } : { s: RATING_TIERS.includes(level.rating) && level.diff == 'Extreme Demon' ? 'p' : 'n', p: null };
}

function fillAredlMetadata(level) {
    const match = findAredlLevel(level);
    if (match) {
        level.levelId = level.levelId || String(match.i);
        level.creator = level.creator || match.u;
    }
    return match;
}

/** Fills IDs, publishers and automatic statuses from the cached lists. Returns the levels that matched. */
function matchWithAredl(levels) {
    if (!aredlCache.length)
        return [];
    return levels.filter(level => {
        const match = fillAredlMetadata(level);
        level.ar = aredlStatus(level);
        return !!match;
    });
}

/** Downloads AREDL positions, loads the sheet when saved levels or wishlist items still need metadata, then asks GDHistory for ratings still missing. */
async function syncWithAredl() {
    if (ui.sync)
        return;
    ui.sync = 1;
    const [aredl, gdl] = await Promise.allSettled([loadAredlList(true), loadDemonlist(true)]);
    try {
        if (aredl.status == 'rejected' || !aredl.value)
            throw Error('no response');
        const levels = profile.levels;
        levels.forEach(fillAredlMetadata);
        if (levels.some(needsSheetFields) || profile.wishlists.some(w => w.items.some(needsSheetFields))) {
            await loadSheetLevels();
            // A profile change during the download can introduce levels that still need AREDL metadata first.
            if (profile.levels !== levels)
                profile.levels.forEach(fillAredlMetadata);
            profile.levels.forEach(l => fillFromSheet(l, l.kind == 'platform' ? 'p' : 'd'));
            profile.wishlists.flatMap(w => w.items).forEach(l => fillFromSheet(l));
        }
        await fillRatings([...profile.levels, ...profile.wishlists.flatMap(w => w.items)]);
        matchWithAredl(profile.levels);
        localStorage.gas = Date.now();
    }
    catch {
        // Keep cached positions and leave the timestamp stale for the next retry.
    }
    if (gdl.status == 'fulfilled')
        matchWithDemonlist(profile.levels);
    if (gdl.status == 'fulfilled' || (aredl.status == 'fulfilled' && aredl.value))
        save();
    ui.sync = 0;
    // Replacing a dragged row interrupts sorting. Show refreshed metadata on the next render.
    if (!qs('form, dialog[open], .ms[open], .sortable-chosen'))
        render();
}

function autoSyncIfStale() {
    if (navigator.onLine && Date.now() - (+localStorage.gas || 0) > AREDL_MAX_AGE)
        syncWithAredl();
}
