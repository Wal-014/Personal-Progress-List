/**
 * Level search on GDBrowser: name or ID, featured filter, and the data the forms fill from the chosen level.
 */

/** Rating of a level: unrated (no stars), rated, then featured, epic, legendary and mythic. */
const ratingOf = x => !(x.stars > 0) ? 'unrated' : x.mythic ? 'mythic' : x.legendary ? 'legendary' : x.epic ? 'epic' : x.featured ? 'featured' : 'rated';

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
 * Levels matching a name fragment or an ID, most downloaded first, and whether another page may follow. featured is 'all', 'yes' or 'no'.
 * The API filters featured levels itself but has no filter for the rest, so 'no' drops featured levels from each page.
 * Each page holds the game's 10 levels. With a search text the API ignores its download order, so each page is sorted here.
 * Throws when the service does not answer.
 */
async function searchLevels(query, featured, page) {
    let d;
    try {
        const r = await fetch(`${GDB_API}search/${encodeURIComponent(query)}?page=${page}${featured == 'yes' ? '&featured' : ''}`);
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
    const levels = d.filter(x => x && /^\d+$/.test(x.id)).map(fromGdb).filter(l => featured != 'no' || ['unrated', 'rated'].includes(l.rating));
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
