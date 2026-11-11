/** Level relay provider: current game data from GDHistory through the project's relay, with timeouts and a shared cooldown after failures. */

const RELAY_COOLDOWN_MS = 5 * 60 * 1000, RELAY_TIMEOUT_MS = 8000;
const RELAY_RATINGS = ['unrated', ...RATING_TIERS];
let relayDownUntil = 0;
const relayAvailable = () => Date.now() >= relayDownUntil;

/** Filters the relay narrows by; they return a superset of the selected levels, which the coordinator rechecks. */
function relaySearchParams(query, f, page) {
    const { rates, diffs } = effectiveFilters(f);
    const params = new URLSearchParams({ q: query, page, scope: searchScope(f) });
    if (diffs.length)
        params.set('diff', diffs.join(','));
    if (rates.length)
        params.set('rate', rates.join(','));
    return params;
}

/** Level data kept from a relay answer, with every field checked. Unrated levels have no difficulty: the game shows them as NA. */
function fromRelay(x) {
    const rating = RELAY_RATINGS.includes(x.rating) ? x.rating : 'unrated';
    return {
        levelId: x.levelId,
        name: x.name,
        creator: typeof x.creator == 'string' && x.creator ? x.creator : null,
        diff: rating != 'unrated' && DIFFICULTIES.includes(x.diff) ? x.diff : null,
        rating,
        kind: x.kind == 'platform' ? 'platform' : 'classic',
        downloads: Number.isFinite(x.downloads) ? x.downloads : null
    };
}

const relayLevels = d => (Array.isArray(d?.levels) ? d.levels : [])
    .filter(x => x && typeof x.levelId == 'string' && /^\d+$/.test(x.levelId) && typeof x.name == 'string' && x.name)
    .map(fromRelay);

/** Fetches JSON with a timeout; provider entry points handle failures and cooldown. */
async function fetchRelayJson(path) {
    const r = await fetch(LEVEL_RELAY_API + path, { signal: AbortSignal.timeout(RELAY_TIMEOUT_MS) });
    if (!r.ok)
        throw Error('HTTP ' + r.status);
    return r.json();
}

/** One game search page; null means unavailable. */
async function searchRelay(query, f, page) {
    if (!relayAvailable())
        return null;
    try {
        const d = await fetchRelayJson('search?' + relaySearchParams(query, f, page));
        return { levels: relayLevels(d), more: d?.more === true };
    }
    catch {
        relayDownUntil = Date.now() + RELAY_COOLDOWN_MS;
        return null;
    }
}

/** Current game data for at most ten IDs; null means unavailable. */
async function fetchRelayLevelsById(ids) {
    if (!relayAvailable())
        return null;
    if (!ids.length)
        return [];
    try {
        return relayLevels(await fetchRelayJson('levels?ids=' + ids.slice(0, 10).join(',')));
    }
    catch {
        relayDownUntil = Date.now() + RELAY_COOLDOWN_MS;
        return null;
    }
}
