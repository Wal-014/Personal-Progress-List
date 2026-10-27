/**
 * Level search on GDBrowser: name or ID, rating and difficulty filters, and the data the forms fill from the chosen level.
 */

/** Rating of a level: unrated (no stars), rated, then featured, epic, legendary and mythic. */
const ratingOf = x => !(x.stars > 0) ? 'unrated' : x.mythic ? 'mythic' : x.legendary ? 'legendary' : x.epic ? 'epic' : x.featured ? 'featured' : 'rated';

/** Difficulty shown by the game, including NA for unrated levels. */
const difficultyOf = l => l.rating == 'unrated' || !l.diff ? 'NA' : l.diff;

/** Applicable selections without changing the selections kept in the form. */
const effectiveFilters = f => ({ rates: f.rated == 'rated' ? f.rates : [], diffs: f.rated == 'unrated' ? [] : f.diffs.filter(d => f.rated != 'rated' || d != 'NA') });

/** Whether a level matches the rating mode and the applicable tier and difficulty selections. */
function matchesFilters(l, f) {
    const { rates, diffs } = effectiveFilters(f);
    return (f.rated == 'all' || (l.rating != 'unrated') == (f.rated == 'rated')) && (!rates.length || rates.includes(l.rating)) && (!diffs.length || diffs.includes(difficultyOf(l)));
}

/** Server filters that return a superset of the selected levels; mixed difficulties stay broad. */
function searchParams(f) {
    const { rates, diffs } = effectiveFilters(f);
    if (f.rated == 'unrated' || f.rated == 'all' && diffs.length == 1 && diffs[0] == 'NA')
        return '&noStar';
    const known = diffs.length && !diffs.includes('NA');
    let params = f.rated == 'rated' || known ? '&' + (rates.length == 1 && ['featured', 'epic', 'legendary', 'mythic'].includes(rates[0]) ? rates[0] : 'starred') : '';
    if (known) {
        const ids = DIFFICULTIES.map((d, i) => diffs.includes(d) ? i : -1).filter(i => i >= 0);
        if (diffs.every(d => DIFFICULTIES.indexOf(d) >= 1 && DIFFICULTIES.indexOf(d) <= 5))
            params += '&diff=' + ids.join(',');
        else if (diffs.length == 1 && diffs[0] == 'Auto')
            params += '&diff=-3';
        else if (diffs.every(d => DIFFICULTIES.indexOf(d) >= 6))
            params += '&diff=-2' + (diffs.length == 1 ? '&demonFilter=' + (ids[0] - 5) : '');
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

/** Search text with spaces collapsed, or '' when it has no letters or digits to search for. */
const cleanQuery = q => {
    const s = String(q).trim().replace(/\s+/g, ' ');
    return /[\p{L}\p{N}]/u.test(s) ? s : '';
};

/**
 * Levels matching a name fragment or an ID and the filters, most downloaded first, and whether another page may follow.
 * The API filters are approximate, so every result is checked locally as well.
 * Each page holds the game's 10 levels. With a search text the API ignores its download order, so each page is sorted here.
 * Throws when the service does not answer.
 */
async function searchLevels(query, f, page) {
    let d;
    try {
        const r = await fetch(`${GDB_API}search/${encodeURIComponent(query)}?page=${page}${searchParams(f)}`);
        if (!r.ok)
            throw Error('HTTP ' + r.status);
        d = await r.json();
    }
    catch (e) {
        // GDBrowser answers "nothing matches" with an error status and no CORS header, which the browser reports
        // like a network failure; when a known level still loads, the search simply found nothing
        if ((await fetch(GDB_API + 'level/128').catch(() => null))?.ok)
            return { levels: [], more: false };
        throw e;
    }
    if (!Array.isArray(d))
        return { levels: [], more: false };
    const levels = d.filter(x => x && /^\d+$/.test(x.id)).map(fromGdb).filter(l => matchesFilters(l, f));
    return { levels: levels.sort((a, b) => b.downloads - a.downloads), more: d.length >= 10 };
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
            const d = await (await fetch(`${GDB_API}search/${batch.map(l => l.levelId).join(',')}?list`)).json();
            const found = new Map((Array.isArray(d) ? d : []).filter(x => x && /^\d+$/.test(x.id)).map(x => [String(x.id), fromGdb(x)]));
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
