/**
 * Community sheet of every rated level: ID, name, creator and difficulty.
 * The deploy rebuilds data/levels.json from the sheet every day (scripts/build-levels.js).
 */

/** Sheet levels by ID, and by kind ('d' classic, 'p' platformer) plus normalized name; null marks a name several levels share. */
let sheetById = new Map(), sheetByName = new Map();

/** Download of the sheet copy, made at most once per visit; the browser and the service worker cache the file. */
let sheetLoad = null;

/** Indexes the slim levels [id, name, creator, difficulty index or -1, 1 for platformer]. */
function useSheetLevels(levels) {
    sheetById = new Map();
    sheetByName = new Map();
    levels.forEach(x => {
        sheetById.set(String(x[0]), x);
        const k = (x[4] ? 'p' : 'd') + normalizeName(x[1]);
        sheetByName.set(k, sheetByName.has(k) ? null : x);
    });
}

/** Loads the sheet copy. A missing file (a local copy that never ran `npm run levels`) leaves the sheet empty. */
function loadSheetLevels() {
    sheetLoad ||= fetch('data/levels.json').then(r => r.ok ? r.json() : []).catch(() => []).then(d => useSheetLevels(Array.isArray(d) ? d : []));
    return sheetLoad;
}

/** Sheet entry of a level: by ID when it has one, otherwise by a name only one level of that kind has (any kind when none is given). */
function findSheetLevel(levelId, name, kind) {
    if (levelId)
        return sheetById.get(String(levelId)) || null;
    const n = normalizeName(name || '');
    return n && (kind ? [kind] : ['d', 'p']).map(k => sheetByName.get(k + n)).find(Boolean) || null;
}

/** Fills a level's missing ID, creator and difficulty from the sheet. Returns the sheet entry, or null. */
function fillFromSheet(l, kind) {
    const x = findSheetLevel(l.levelId, l.name, kind);
    if (x) {
        l.levelId ||= String(x[0]);
        l.creator ||= x[2] || null;
        l.diff ||= DIFFICULTIES[x[3]] || null;
    }
    return x;
}
