/**
 * Level search using the community sheet and GDBrowser, with rating and difficulty filters and data for the forms.
 */

/** Rating of a level: unrated (no stars), rated, then featured, epic, legendary and mythic. */
const ratingOf = x => !(x.stars > 0) ? 'unrated' : x.mythic ? 'mythic' : x.legendary ? 'legendary' : x.epic ? 'epic' : x.featured ? 'featured' : 'rated';

/** Difficulty shown by the game, including NA for unrated levels. */
const difficultyOf = l => l.rating == 'unrated' || !l.diff ? 'NA' : l.diff;

/** Applicable selections without changing the selections kept in the form. */
const effectiveFilters = f => ({ rates: f.rated == 'rated' ? f.rates : [], diffs: f.rated == 'unrated' ? [] : f.diffs.filter(d => f.rated != 'rated' || d != 'NA') });

function matchesSearchFilters(l, f) {
    const { rates, diffs } = effectiveFilters(f);
    return (f.rated == 'all' || (l.rating != 'unrated') == (f.rated == 'rated')) && (!rates.length || rates.includes(l.rating)) && (!diffs.length || diffs.includes(difficultyOf(l)));
}

/** Difficulties GDBrowser filters by number: Easy to Insane are diff=1-5, demons are diff=-2 with demonFilter=1-5. */
const DIFF_FILTER = DIFFICULTIES.slice(1, 6), DEMON_FILTER = DIFFICULTIES.slice(6);

/** Server filters that return a superset of the selected levels; mixed difficulties stay broad. */
function searchParams(f) {
    const { rates, diffs } = effectiveFilters(f);
    if (f.rated == 'unrated' || f.rated == 'all' && diffs.length == 1 && diffs[0] == 'NA')
        return '&noStar';
    // An official difficulty implies a rated level, since unrated levels show NA
    const officialDiffs = diffs.length > 0 && !diffs.includes('NA');
    let params = f.rated == 'rated' || officialDiffs ? '&' + (rates.length == 1 && ['featured', 'epic', 'legendary', 'mythic'].includes(rates[0]) ? rates[0] : 'starred') : '';
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
        downloads: +x.downloads || 0
    };
}

/** Sheet data used when GDBrowser is unavailable; a null rating leaves its tier for the next sync. */
function fromSheet(entry) {
    return {
        levelId: String(entry[0]),
        name: String(entry[1]),
        creator: entry[2] || null,
        diff: DIFFICULTIES[entry[3]] || null,
        rating: null,
        kind: entry[4] ? 'platform' : 'classic',
        downloads: 0
    };
}

/** Search text with spaces collapsed, or '' when it has no letters or digits to search for. */
const cleanQuery = q => {
    const s = String(q).trim().replace(/\s+/g, ' ');
    return /[\p{L}\p{N}]/u.test(s) ? s : '';
};

/** Normalized name order: exact, prefix, substring, then other names returned by the game. */
const searchMatchRank = (name, query) => name == query ? 0 : name.startsWith(query) ? 1 : name.includes(query) ? 2 : 3;

/** Sheet ID match first, then substring matches by name rank and length; known difficulties and Unrated still apply. */
function findSheetMatches(query, f) {
    const n = normalizeName(query), { diffs } = effectiveFilters(f);
    if (!n || f.rated == 'unrated')
        return [];
    const matches = [];
    for (const [id, name] of sheetNormalizedNames) {
        if (id != query && !name.includes(n))
            continue;
        const entry = sheetById.get(id);
        if (!diffs.length || diffs.includes(DIFFICULTIES[entry[3]] || 'NA'))
            matches.push({ id, name, length: entry[1].length });
    }
    return matches
        .sort((a, b) => (b.id == query) - (a.id == query) || searchMatchRank(a.name, n) - searchMatchRank(b.name, n) || a.length - b.length)
        .map(x => x.id);
}

/** Looks up at most ten IDs with current difficulty, rating and downloads; throws when GDBrowser does not answer. */
async function fetchLevelsById(ids) {
    if (!ids.length)
        return [];
    const r = await fetch(`${GDB_API}search/${ids.slice(0, 10).join(',')}?list`);
    if (!r.ok)
        throw Error('HTTP ' + r.status);
    const d = await r.json();
    return (Array.isArray(d) ? d : []).filter(x => x && /^\d+$/.test(x.id)).map(fromGdb);
}

/** One game search page, rechecked locally; failures return no matches, marked offline only if the known-level probe also fails. */
async function searchGdbLevels(query, f, page) {
    let d;
    try {
        const r = await fetch(`${GDB_API}search/${encodeURIComponent(query)}?page=${page}${searchParams(f)}`);
        if (!r.ok)
            throw Error('HTTP ' + r.status);
        d = await r.json();
    }
    catch {
        // GDBrowser answers "nothing matches" with an error status and no CORS header, which the browser reports
        // like a network failure; when a known level still loads, the search simply found nothing
        const online = (await fetch(GDB_API + 'level/128').catch(() => null))?.ok;
        return { levels: [], more: false, offline: !online };
    }
    if (!Array.isArray(d))
        return { levels: [], more: false, offline: false };
    const levels = d.filter(x => x && /^\d+$/.test(x.id)).map(fromGdb).filter(l => matchesSearchFilters(l, f));
    return { levels, more: d.length >= 10, offline: false };
}

/**
 * Merges the next ten cached sheet matches with the game's search page, requested in parallel until exhausted.
 * Failed ID lookups use sheet data; results are rechecked, deduplicated and sorted by match rank and downloads.
 * Another page may follow while either source has more; offline reports either lookup failing without rejecting the page.
 */
async function searchLevels(query, f, page, sheetMatches = [], gameMore = true) {
    const ids = sheetMatches.slice(page * 10, (page + 1) * 10);
    const [sheetPage, remote] = await Promise.all([
        fetchLevelsById(ids).then(levels => ({ levels, offline: false })).catch(() => ({ levels: ids.map(id => fromSheet(sheetById.get(id))), offline: true })),
        gameMore ? searchGdbLevels(query, f, page) : { levels: [], more: false, offline: false }
    ]);
    const levels = [...new Map([...sheetPage.levels.filter(l => matchesSearchFilters(l, f)), ...remote.levels].map(l => [l.levelId, l])).values()];
    const n = normalizeName(query), rank = l => l.levelId == query ? 0 : searchMatchRank(normalizeName(l.name), n);
    return { levels: levels.sort((a, b) => rank(a) - rank(b) || b.downloads - a.downloads), gameMore: remote.more, more: remote.more || sheetMatches.length > (page + 1) * 10, offline: sheetPage.offline || remote.offline };
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

/**
 * Looks up difficulty and rating of saved levels that have an ID but no rating yet, ten IDs per request (one page of the game).
 * A batch that fails is skipped and retried on the next sync; levels GDBrowser does not return keep no rating.
 */
async function fillRatings(levels) {
    const todo = levels.filter(l => /^\d+$/.test(l.levelId || '') && !l.rating);
    for (let i = 0; i < todo.length; i += 10) {
        const batch = todo.slice(i, i + 10);
        try {
            const found = new Map((await fetchLevelsById(batch.map(l => l.levelId))).map(l => [l.levelId, l]));
            batch.forEach(l => {
                const g = found.get(String(l.levelId));
                if (g)
                    Object.assign(l, { diff: g.diff, rating: g.rating });
            });
        }
        catch {
        }
    }
}
