/**
 * Global Demonlist classic positions by Geometry Dash level ID, downloaded whole once per sync.
 */

function validDemonlistPair(pair) {
    return Array.isArray(pair) && pair.length == 2 && Number.isSafeInteger(pair[0]) && pair[0] > 0
        && Number.isInteger(pair[1]) && pair[1] >= 1 && pair[1] <= 100000;
}

function readDemonlistCache() {
    try {
        const pairs = JSON.parse(localStorage.ggdl || 'null');
        return Array.isArray(pairs) && pairs.every(validDemonlistPair) ? pairs : null;
    }
    catch {
        return null;
    }
}

let demonlistCache = readDemonlistCache();

async function loadDemonlist(force) {
    if (demonlistCache && !force)
        return;
    const response = await fetch(DEMONLIST_API + 'level/classic/list');
    if (!response.ok)
        throw Error('no response');
    const result = await response.json();
    if (result.message != 'success' || !Array.isArray(result.data?.levels))
        throw Error('invalid response');
    const pairs = result.data.levels.map(level => [level.ingame_id, level.placement]);
    if (!pairs.every(validDemonlistPair))
        throw Error('invalid positions');
    demonlistCache = pairs;
    localStorage.ggdl = JSON.stringify(pairs);
}

function matchWithDemonlist(levels) {
    for (const level of levels) {
        if (level.kind == 'platform')
            level.gdl = null;
        else if (demonlistCache && level.levelId)
            level.gdl = demonlistCache.find(pair => String(pair[0]) == String(level.levelId))?.[1] ?? null;
    }
}
