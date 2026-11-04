/**
 * Community sheet of every rated level: ID, name, creator, difficulty and rating tier.
 * The deploy rebuilds data/levels.json from the sheet every day (scripts/build-levels.js).
 */

/** Sheet levels by ID, and by kind ('d' classic, 'p' platformer) plus normalized name; null marks a name several levels share. */
let sheetById = new Map(), sheetByName = new Map();

/** Names normalized once for substring searches over the full sheet. */
let sheetNormalizedNames = new Map();

/** Successful download of the sheet copy, kept for the visit; the browser and service worker cache the file. */
let sheetLoad = null;

/** Indexes the slim levels [id, name, creator, difficulty index or -1, 1 for platformer, rating tier index or -1]. */
function useSheetLevels(levels) {
    sheetById = new Map();
    sheetByName = new Map();
    sheetNormalizedNames = new Map();
    levels.forEach(x => {
        sheetById.set(String(x[0]), x);
        const n = normalizeName(x[1]), k = (x[4] ? 'p' : 'd') + n;
        sheetNormalizedNames.set(String(x[0]), n);
        sheetByName.set(k, sheetByName.has(k) ? null : x);
    });
}

/** Loads the sheet copy and reports success; failed downloads are retried on the next call. */
function loadSheetLevels() {
    sheetLoad ||= fetch('data/levels.json').then(r => r.ok ? r.json() : null).catch(() => null).then(d => {
        if (!Array.isArray(d)) {
            sheetLoad = null;
            return false;
        }
        useSheetLevels(d);
        return true;
    });
    return sheetLoad;
}

/** Normalized sheet data; old cached entries may not have a rating tier, and the sheet has no downloads. */
function fromSheet(entry) {
    return {
        levelId: String(entry[0]),
        name: String(entry[1]),
        creator: entry[2] || null,
        diff: DIFFICULTIES[entry[3]] || null,
        rating: RATING_TIERS[entry[5]] || null,
        kind: entry[4] ? 'platform' : 'classic',
        downloads: null
    };
}

/** ID and normalized substring matches, without filters or ranking. */
function findSheetLevels(query) {
    const n = normalizeName(query), levels = [];
    if (!n)
        return levels;
    for (const [id, name] of sheetNormalizedNames)
        if (id == query || name.includes(n))
            levels.push(fromSheet(sheetById.get(id)));
    return levels;
}

/** Sheet entry of a level: by ID when it has one, otherwise by a name only one level of that kind has (any kind when none is given). */
function findSheetLevel(levelId, name, kind) {
    if (levelId)
        return sheetById.get(String(levelId)) || null;
    const n = normalizeName(name || '');
    return n && (kind ? [kind] : ['d', 'p']).map(k => sheetByName.get(k + n)).find(Boolean) || null;
}

/** Fills a level's missing ID, creator, difficulty and rating from the sheet. Returns the sheet entry, or null. */
function fillFromSheet(l, kind) {
    const x = findSheetLevel(l.levelId, l.name, kind);
    if (x) {
        l.levelId ||= String(x[0]);
        l.creator ||= x[2] || null;
        l.diff ||= DIFFICULTIES[x[3]] || null;
        l.rating ||= RATING_TIERS[x[5]] || null;
    }
    return x;
}
