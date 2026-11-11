/** GDHistory provider: builds search requests from validated input and maps its records to the app's level shape. */

import { DIFFICULTIES } from './request.js';

const SEARCH_URL = 'https://history.geometrydash.eu/api/v1/search/level/advanced/';
const PAGE_SIZE = 10;
const PLATFORMER_LENGTH = 5;

// GDHistory's cache_filter_difficulty: 1-6 are Auto to Insane, 8-12 Easy to Extreme Demon (checked against the community sheet)
const DIFF_BY_CODE = new Map(DIFFICULTIES.map((d, i) => [i < 6 ? i + 1 : i + 2, d]));
const CODE_BY_DIFF = new Map([...DIFF_BY_CODE].map(([code, d]) => [d, code]));

const TIER_FILTERS = {
    rated: '(cache_featured <= 0 AND cache_epic = 0)',
    featured: '(cache_featured > 0 AND cache_epic = 0)',
    epic: 'cache_epic = 1',
    legendary: 'cache_epic = 2',
    mythic: 'cache_epic = 3'
};

/** A filter that returns a superset of the requested levels; the app rechecks every result. Built from validated values only. */
export function searchFilter({ scope, diffs, rates }) {
    const parts = ['is_deleted = false'];
    if (scope == 'unrated')
        return [...parts, 'cache_stars = 0'].join(' AND ');
    if (scope == 'rated')
        parts.push('cache_stars > 0');
    if (diffs.length && !diffs.includes('NA'))
        parts.push(`cache_filter_difficulty IN [${diffs.map(d => CODE_BY_DIFF.get(d)).join(', ')}]`);
    if (scope == 'rated' && rates.length)
        parts.push(`(${rates.map(r => TIER_FILTERS[r]).join(' OR ')})`);
    return parts.join(' AND ');
}

export function searchUrl(search) {
    const url = new URL(SEARCH_URL);
    url.searchParams.set('query', search.query);
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('offset', String(search.page * PAGE_SIZE));
    url.searchParams.set('filter', searchFilter(search));
    return url;
}

export function levelsUrl(ids) {
    const url = new URL(SEARCH_URL);
    url.searchParams.set('query', '');
    url.searchParams.set('limit', String(ids.length));
    url.searchParams.set('filter', `online_id IN [${ids.join(', ')}]`);
    return url;
}

const ratingOf = h => !(h.cache_stars > 0) ? 'unrated'
    : h.cache_epic == 3 ? 'mythic' : h.cache_epic == 2 ? 'legendary' : h.cache_epic == 1 ? 'epic' : h.cache_featured > 0 ? 'featured' : 'rated';

/** Level fields the app uses; unrated levels have no difficulty, as in the game. */
export function fromHistory(h) {
    const rating = ratingOf(h);
    return {
        levelId: String(h.online_id),
        name: String(h.cache_level_name),
        creator: h.cache_username ? String(h.cache_username) : null,
        diff: rating == 'unrated' ? null : DIFF_BY_CODE.get(h.cache_filter_difficulty) ?? null,
        rating,
        kind: h.cache_length == PLATFORMER_LENGTH ? 'platform' : 'classic',
        downloads: Number.isFinite(h.cache_downloads) ? h.cache_downloads : null
    };
}

const isLevelRecord = h => h && Number.isSafeInteger(h.online_id) && h.online_id > 0 && typeof h.cache_level_name == 'string' && h.cache_level_name != '';

/** Maps one GDHistory answer; `more` is true while full pages keep coming and hits remain. */
export function toResult(body, offset = 0) {
    const hits = Array.isArray(body?.hits) ? body.hits : [];
    const levels = hits.filter(isLevelRecord).map(fromHistory);
    return { levels, more: hits.length == PAGE_SIZE && offset + hits.length < (body.estimatedTotalHits || 0) };
}

export const pageOffset = page => page * PAGE_SIZE;
