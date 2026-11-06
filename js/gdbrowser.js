/** GDBrowser provider: current game data, with timeouts and a shared cooldown after failures. */

const GDB_COOLDOWN_MS = 5 * 60 * 1000, GDB_TIMEOUT_MS = 8000;
let gdbDownUntil = 0;
const gdbAvailable = () => Date.now() >= gdbDownUntil;

/** Rating of a level: unrated (no stars), rated, then featured, epic, legendary and mythic. */
const ratingOf = x => !(x.stars > 0) ? 'unrated' : x.mythic ? 'mythic' : x.legendary ? 'legendary' : x.epic ? 'epic' : x.featured ? 'featured' : 'rated';

/** Difficulties GDBrowser filters by number: Easy to Insane are diff=1-5, demons are diff=-2 with demonFilter=1-5. */
const DIFF_FILTER = DIFFICULTIES.slice(1, 6), DEMON_FILTER = DIFFICULTIES.slice(6);

/** Server filters that return a superset of the selected levels; mixed difficulties stay broad. */
function searchParams(f) {
    const { rates, diffs } = effectiveFilters(f);
    const scope = searchScope(f);
    if (scope == 'unrated')
        return '&noStar';
    const officialDiffs = diffs.length > 0 && !diffs.includes('NA');
    let params = scope == 'rated' ? '&' + (rates.length == 1 && RATING_TIERS.slice(1).includes(rates[0]) ? rates[0] : 'starred') : '';
    if (officialDiffs) {
        if (diffs.every(d => DIFF_FILTER.includes(d)))
            params += '&diff=' + DIFF_FILTER.flatMap((d, i) => diffs.includes(d) ? [i + 1] : []).join(',');
        else if (diffs.length == 1 && diffs[0] == 'Auto')
            params += '&diff=-3';
        else if (diffs.every(d => DEMON_FILTER.includes(d)))
            params += '&diff=-2' + (diffs.length == 1 ? '&demonFilter=' + (DEMON_FILTER.indexOf(diffs[0]) + 1) : '');
    }
    return params;
}

/** Level data kept from a GDBrowser result. Unrated levels have no difficulty: the game shows them as NA. */
function fromGdb(x) {
    const rating = ratingOf(x);
    return {
        levelId: String(x.id),
        name: String(x.name),
        // GDBrowser shows "-" for creators it cannot name
        creator: x.author && x.author != '-' ? String(x.author) : null,
        diff: rating != 'unrated' && DIFFICULTIES.includes(x.difficulty) ? x.difficulty : null,
        rating,
        kind: x.platformer ? 'platform' : 'classic',
        downloads: Number.isFinite(x.downloads) ? x.downloads : null
    };
}

const gdbRequest = path => fetch(GDB_API + path, { signal: AbortSignal.timeout(GDB_TIMEOUT_MS) });

/** Fetches JSON with a timeout; provider entry points handle failures and cooldown. */
async function fetchGdbJson(path) {
    const r = await gdbRequest(path);
    if (!r.ok)
        throw Error('HTTP ' + r.status);
    return r.json();
}

/** One game search page; non-array JSON is a successful empty page, null means unavailable. */
async function searchGdb(query, f, page) {
    if (!gdbAvailable())
        return null;
    try {
        let r;
        try {
            r = await gdbRequest(`search/${encodeURIComponent(query)}?page=${page}${searchParams(f)}`);
        }
        catch {
            // Empty searches can fail without CORS headers; only a working known-level probe distinguishes them from an outage
            await fetchGdbJson('level/128');
            return { levels: [], more: false };
        }
        if (!r.ok)
            throw Error('HTTP ' + r.status);
        const d = await r.json();
        return { levels: (Array.isArray(d) ? d : []).filter(x => x && /^\d+$/.test(x.id)).map(fromGdb), more: Array.isArray(d) && d.length == 10 };
    }
    catch {
        gdbDownUntil = Date.now() + GDB_COOLDOWN_MS;
        return null;
    }
}

/** Current game data for at most ten IDs; null means unavailable. */
async function fetchGdbLevelsById(ids) {
    if (!gdbAvailable())
        return null;
    if (!ids.length)
        return [];
    try {
        const d = await fetchGdbJson(`search/${ids.slice(0, 10).join(',')}?list`);
        return (Array.isArray(d) ? d : []).filter(x => x && /^\d+$/.test(x.id)).map(fromGdb);
    }
    catch {
        gdbDownUntil = Date.now() + GDB_COOLDOWN_MS;
        return null;
    }
}
