/** Validates relay requests; anything outside the allowlist is rejected, never coerced. */

export const DIFFICULTIES = ['Auto', 'Easy', 'Normal', 'Hard', 'Harder', 'Insane', 'Easy Demon', 'Medium Demon', 'Hard Demon', 'Insane Demon', 'Extreme Demon'];
export const RATING_TIERS = ['rated', 'featured', 'epic', 'legendary', 'mythic'];
const SCOPES = ['all', 'rated', 'unrated'];
const MAX_QUERY_LENGTH = 100, MAX_PAGE = 99, MAX_IDS = 10;

const PARAMS = { '/search': ['q', 'page', 'scope', 'diff', 'rate'], '/levels': ['ids'] };

class InvalidRequest extends Error {}

const fail = message => { throw new InvalidRequest(message); };

/** Comma-separated values that must all belong to `allowed`; an absent parameter is an empty list. */
function listParam(params, name, allowed) {
    const raw = params.get(name);
    if (raw == null)
        return [];
    const values = raw.split(',');
    if (values.some(v => !allowed.includes(v)) || new Set(values).size != values.length)
        fail(`invalid ${name}`);
    return values;
}

function parseSearch(params) {
    const query = (params.get('q') || '').trim();
    if (!query || query.length > MAX_QUERY_LENGTH)
        fail('invalid q');
    const page = params.get('page') ?? '0';
    if (!/^\d{1,2}$/.test(page) || Number(page) > MAX_PAGE)
        fail('invalid page');
    const scope = params.get('scope') ?? 'all';
    if (!SCOPES.includes(scope))
        fail('invalid scope');
    return { kind: 'search', query, page: Number(page), scope, diffs: listParam(params, 'diff', [...DIFFICULTIES, 'NA']), rates: listParam(params, 'rate', RATING_TIERS) };
}

function parseLevels(params) {
    const ids = (params.get('ids') || '').split(',');
    if (ids.length > MAX_IDS || ids.some(id => !/^[1-9]\d{0,11}$/.test(id)))
        fail('invalid ids');
    return { kind: 'levels', ids: [...new Set(ids)] };
}

/** The validated request, or `{ error }` describing the first problem found. */
export function parseRequest(url) {
    const allowed = PARAMS[url.pathname];
    if (!allowed)
        return { error: 'not found', status: 404 };
    try {
        const names = [...url.searchParams.keys()];
        if (names.some(n => !allowed.includes(n)) || new Set(names).size != names.length)
            fail('unexpected parameter');
        return url.pathname == '/search' ? parseSearch(url.searchParams) : parseLevels(url.searchParams);
    }
    catch (e) {
        if (e instanceof InvalidRequest)
            return { error: e.message, status: 400 };
        throw e;
    }
}
