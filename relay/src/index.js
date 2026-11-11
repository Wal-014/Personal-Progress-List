/** Relay that lets the app's origin read GDHistory level searches, which GDHistory serves without CORS headers. */

import { parseRequest } from './request.js';
import { levelsUrl, pageOffset, searchUrl, toResult } from './gdhistory.js';
import { allowedOrigins, corsOrigin, json } from './http.js';

const UPSTREAM_TIMEOUT_MS = 8000;
const CACHE_SECONDS = 600;
// Identifies the relay honestly to GDHistory, so its owner can see and contact the project
const USER_AGENT = 'PersonalProgressList-relay/0.1 (+https://github.com/Wal-014/Personal-Progress-List)';

async function fetchUpstream(url, fetchImpl) {
    const r = await fetchImpl(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true }
    });
    if (!r.ok)
        throw Error('upstream HTTP ' + r.status);
    return r.json();
}

export async function handle(request, env, fetchImpl = fetch) {
    const origin = corsOrigin(request, allowedOrigins(env.ALLOWED_ORIGINS));
    // CORS is not authorization, but refusing other origins keeps this from serving as an open relay for other sites
    if (!origin)
        return json({ error: 'origin not allowed' }, 403, null);
    if (request.method != 'GET')
        return json({ error: 'method not allowed' }, 405, origin, { Allow: 'GET' });
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    // The app has no accounts, so the client IP is the only key available
    if (!(await env.LIMITER.limit({ key: ip })).success)
        return json({ error: 'too many requests' }, 429, origin, { 'Retry-After': '60' });

    const parsed = parseRequest(new URL(request.url));
    if (parsed.error)
        return json({ error: parsed.error }, parsed.status, origin);
    try {
        const result = parsed.kind == 'search'
            ? toResult(await fetchUpstream(searchUrl(parsed), fetchImpl), pageOffset(parsed.page))
            : { levels: toResult(await fetchUpstream(levelsUrl(parsed.ids), fetchImpl)).levels };
        return json(result, 200, origin, { 'Cache-Control': `public, max-age=${CACHE_SECONDS}` });
    }
    catch (e) {
        console.error('upstream failure', String(e));
        return json({ error: 'upstream unavailable' }, 502, origin);
    }
}

export default { fetch: (request, env) => handle(request, env) };
