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

/** After this long the lists are downloaded again on their own. */
const AREDL_MAX_AGE = 12 * 3600 * 1000;

/** Display name of an API user, or null when none is available. */
const publisherName = x => typeof x == 'string' ? x : x && (x.global_name || x.username || x.name || x.display_name || x.discord_username || Object.values(x).find(v => typeof v == 'string' && v.length < 32 && !/^[0-9a-f-]{20,}$/i.test(v))) || null;

/** Name comparison ignores case, accents, spaces and symbols. */
const normalizeName = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

/** Cached levels of one list, skipping entries whose name has no letters or digits (they would match any name). */
const namedAredlLevels = kind => aredlCache.filter(x => x.k == kind && normalizeName(x.n));

/**
 * Searches cached AREDL names (kind: 'd' classic, 'p' platformer).
 * First an exact normalized match; otherwise the single official name that contains what was typed.
 * The reverse (typed text containing an official name) is not accepted: "Kenos Remake" is not "Kenos".
 */
function findAredlByName(name, kind) {
    const n = normalizeName(name);
    if (!n)
        return null;
    const pool = namedAredlLevels(kind);
    const exact = pool.find(x => normalizeName(x.n) == n);
    if (exact)
        return exact;
    const partial = n.length < 4 ? [] : pool.filter(x => normalizeName(x.n).includes(n));
    return partial.length == 1 ? partial[0] : null;
}

/** Up to three similar AREDL names for suggestions. */
function similarAredlNames(name, kind) {
    const n = normalizeName(name).slice(0, 4);
    return n ? namedAredlLevels(kind).filter(x => normalizeName(x.n).includes(n)).slice(0, 3).map(x => x.n) : [];
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

/** Fills id, publisher and AREDL position of the given levels from the cached lists. Returns the levels that matched. */
function matchWithAredl(levels) {
    const by = new Map();
    aredlCache.forEach(x => {
        by.set(x.k + x.i, x);
        by.set(x.k + x.n.toLowerCase(), x);
    });
    return levels.filter(l => {
        const k = l.kind == 'platform' ? 'p' : 'd', x = (l.levelId && by.get(k + l.levelId)) || by.get(k + l.name.toLowerCase()) || findAredlByName(l.name, k);
        if (x) {
            l.levelId = l.levelId || String(x.i);
            l.creator = l.creator || x.u;
            l.ar = { s: 'r', p: x.p };
        }
        return !!x;
    });
}

/** Downloads the lists and updates the active profile's levels: AREDL positions, creator and difficulty from the sheet, then the ratings still missing from GDBrowser. Only a manual update reports a failure. */
async function syncWithAredl(manual) {
    if (ui.sync)
        return;
    ui.sync = 1;
    renderSyncStatus();
    try {
        if (!await loadAredlList(true))
            throw Error('no response');
        await loadSheetLevels();
        matchWithAredl(profile.levels);
        profile.levels.forEach(l => fillFromSheet(l, l.kind == 'platform' ? 'p' : 'd'));
        await fillRatings([...profile.levels, ...profile.wishlists.flatMap(w => w.items)]);
        localStorage.gas = Date.now();
        save();
    }
    catch (e) {
        if (manual)
            showAlert('AREDL: ' + e.message);
    }
    ui.sync = 0;
    // Redrawing would wipe a form, dialog or dropdown the user has open; the new data shows on the next render
    if (!qs('form, dialog[open], .ms[open]'))
        render();
    renderSyncStatus();
}

function autoSyncIfStale() {
    if (navigator.onLine && Date.now() - (+localStorage.gas || 0) > AREDL_MAX_AGE)
        syncWithAredl();
}
