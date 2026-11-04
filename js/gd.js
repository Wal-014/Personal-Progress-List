/** Coordinates local and external level search, shared filters, suggestions and saved rating enrichment. */

/** Difficulty shown by the game, including NA for unrated levels. */
const difficultyOf = l => l.rating == 'unrated' || !l.diff ? 'NA' : l.diff;

/** Applicable selections without changing the selections kept in the form. */
const effectiveFilters = f => ({ rates: f.rated == 'rated' ? f.rates : [], diffs: f.rated == 'unrated' ? [] : f.diffs.filter(d => f.rated != 'rated' || d != 'NA') });

function matchesSearchFilters(l, f) {
    const { rates, diffs } = effectiveFilters(f);
    return (f.rated == 'all' || (l.rating != 'unrated') == (f.rated == 'rated')) && (!rates.length || rates.includes(l.rating)) && (!diffs.length || diffs.includes(difficultyOf(l)));
}

/** Categories the effective filters can match, shared by coverage and the external provider. */
function searchScope(f) {
    const { diffs } = effectiveFilters(f);
    if (f.rated == 'unrated' || f.rated == 'all' && diffs.length == 1 && diffs[0] == 'NA')
        return 'unrated';
    return f.rated == 'rated' || diffs.length > 0 && !diffs.includes('NA') ? 'rated' : 'all';
}

/** Search text with spaces collapsed, or '' when it has no letters or digits to search for. */
const cleanQuery = q => {
    const s = String(q).trim().replace(/\s+/g, ' ');
    return /[\p{L}\p{N}]/u.test(s) ? s : '';
};

/** Normalized name order: exact, prefix, substring, then other names returned by the game. */
const searchMatchRank = (name, query) => name == query ? 0 : name.startsWith(query) ? 1 : name.includes(query) ? 2 : 3;

/** Loads and ranks the local matches once; null distinguishes a failed sheet from an empty match list. */
async function startLevelSearch(query, f) {
    const loaded = await loadSheetLevels(), n = normalizeName(query);
    const rank = l => searchMatchRank(normalizeName(l.name), n);
    const local = loaded ? findSheetLevels(query).filter(l => matchesSearchFilters(l, f))
        .sort((a, b) => (b.levelId == query) - (a.levelId == query) || rank(a) - rank(b) || a.name.length - b.name.length) : null;
    return { query, f, page: 0, local, gameMore: true, gameFailed: false };
}

/** The game's current values take precedence; the sheet fills a creator or difficulty GDBrowser does not know, except for a level that is now unrated. */
function mergeLevel(live, local) {
    return {
        levelId: live.levelId,
        name: live.name,
        creator: live.creator ?? local?.creator ?? null,
        diff: live.rating == 'unrated' ? null : live.diff ?? local?.diff ?? null,
        rating: live.rating,
        kind: live.kind,
        downloads: live.downloads
    };
}

/**
 * How much of the request a search could cover, cumulative over its pages:
 * - complete: GDBrowser answered every page asked for (without the sheet it only matches the start of names), or the scope is rated and the sheet lists every rated level;
 * - partial: GDBrowser failed, so an All search has rated levels from the sheet only;
 * - unavailable: GDBrowser failed and the search asks for unrated levels only;
 * - error: GDBrowser failed and the sheet did not load either.
 */
function searchCoverage(search) {
    if (!search.gameFailed)
        return 'complete';
    if (search.local == null)
        return 'error';
    const scope = searchScope(search.f);
    return scope == 'unrated' ? 'unavailable' : scope == 'rated' ? 'complete' : 'partial';
}

/** Merges the next local and game pages, then rechecks filters and ranks results; a failed game page ends that source for this search. */
async function nextLevelSearchPage(search) {
    const [local, remote] = await Promise.all([
        (search.local || []).slice(search.page * 10, (search.page + 1) * 10),
        search.gameMore ? searchGdb(search.query, search.f, search.page) : null
    ]);
    if (search.gameMore) {
        if (remote == null)
            search.gameFailed = true;
        search.gameMore = remote?.more || false;
    }
    const byId = new Map(local.map(l => [l.levelId, l]));
    if (remote)
        remote.levels.forEach(l => byId.set(l.levelId, mergeLevel(l, byId.get(l.levelId))));
    const n = normalizeName(search.query), rank = l => searchMatchRank(normalizeName(l.name), n);
    const levels = [...byId.values()].filter(l => matchesSearchFilters(l, search.f))
        .sort((a, b) => (b.levelId == search.query) - (a.levelId == search.query) || rank(a) - rank(b) || (a.downloads == null) - (b.downloads == null) || b.downloads - a.downloads || a.name.length - b.name.length);
    search.page++;
    return { levels, more: search.gameMore || (search.local?.length || 0) > search.page * 10, coverage: searchCoverage(search) };
}

/** Up to five known level names that look like the text, from the AREDL lists and the community sheet, to suggest when a search finds nothing. */
async function similarLevelNames(query) {
    await loadSheetLevels();
    const n = normalizeName(query).slice(0, 4), names = [...similarAredlNames(query, 'd'), ...similarAredlNames(query, 'p')];
    if (n)
        for (const x of sheetById.values()) {
            if (names.length >= 5)
                break;
            if (normalizeName(x[1]).includes(n))
                names.push(x[1]);
        }
    return [...new Set(names)].slice(0, 5);
}

/** Fills saved levels with a numeric ID and no rating, ten IDs per request; the first failed batch ends enrichment until the next sync. */
async function fillRatings(levels) {
    const todo = levels.filter(l => /^\d+$/.test(l.levelId || '') && !l.rating);
    for (let i = 0; i < todo.length; i += 10) {
        const batch = todo.slice(i, i + 10), fetched = await fetchGdbLevelsById(batch.map(l => l.levelId));
        if (fetched == null)
            break;
        const found = new Map(fetched.map(l => [l.levelId, l]));
        batch.forEach(l => {
            const g = found.get(String(l.levelId));
            if (g) {
                l.diff = g.diff;
                l.rating = g.rating;
            }
        });
    }
}
