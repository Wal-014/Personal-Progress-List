/**
 * AREDL and AREPL lists (positions and IDs).
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

let aredlCache = readAredlCache();

/** Normalized names per cached array: keyed by the array, so replacing aredlCache drops them without extra code. */
const aredlNameIndexes = new WeakMap();

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

function validAredlEntry(entry) {
    return entry != null && Number.isSafeInteger(entry.level_id) && entry.level_id > 0 && typeof entry.name == 'string'
        && Number.isInteger(entry.position) && entry.position >= 1 && entry.position <= 100000;
}

async function loadAredlList(force) {
    if (aredlCache.length && !force)
        return { d: false, p: false };
    const get = async (endpoint, kind) => {
        try {
            const response = await fetch(AREDL_API + endpoint + '/levels');
            if (!response.ok)
                return null;
            const body = await response.json(), entries = Array.isArray(body) ? body : body?.data;
            if (!Array.isArray(entries) || !entries.length || !entries.every(validAredlEntry))
                return null;
            return entries.map(x => ({ k: kind, i: x.level_id, n: x.name, p: x.position, u: publisherName(x.publisher) }));
        }
        catch {
            return null;
        }
    };
    const [classic, platform] = await Promise.all([get('aredl', 'd'), get('arepl', 'p')]);
    const refreshed = { d: classic != null, p: platform != null };
    if (classic || platform) {
        aredlCache = [...aredlCache.filter(x => !refreshed[x.k]), ...(classic || []), ...(platform || [])];
        try {
            localStorage.gar = JSON.stringify(aredlCache);
        }
        catch {
        }
    }
    return refreshed;
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

const aredlKind = level => level.kind == 'platform' ? 'p' : 'd';

function findAredlLevel(level) {
    const kind = aredlKind(level);
    if (level.levelId)
        return aredlCache.findLast(x => x.k == kind && String(x.i) == String(level.levelId)) ?? null;
    return aredlCache.findLast(x => x.k == kind && x.n.toLowerCase() == level.name.toLowerCase())
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
function matchWithAredl(levels, refreshed = { d: true, p: true }) {
    const available = new Set(aredlCache.map(x => x.k));
    return levels.filter(level => {
        const kind = aredlKind(level);
        if (!refreshed[kind] || !available.has(kind))
            return false;
        const match = fillAredlMetadata(level);
        const rank = aredlStatus(level);
        if (level.ar?.s !== rank.s || level.ar.p !== rank.p)
            level.ar = rank;
        return !!match;
    });
}
