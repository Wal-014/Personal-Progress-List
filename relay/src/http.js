/** Response helpers: CORS for allowlisted origins only, and security headers on every answer. */

const SECURITY_HEADERS = {
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Strict-Transport-Security': 'max-age=31536000'
};

/** Exact origins from the ALLOWED_ORIGINS variable; a missing variable allows none. */
export const allowedOrigins = value => new Set(String(value || '').split(',').map(s => s.trim()).filter(Boolean));

/** The request's Origin when it is allowlisted, otherwise null. */
export function corsOrigin(request, origins) {
    const origin = request.headers.get('Origin');
    return origin && origins.has(origin) ? origin : null;
}

export function json(body, status, origin, extra = {}) {
    const headers = { 'Content-Type': 'application/json; charset=utf-8', Vary: 'Origin', ...SECURITY_HEADERS, ...extra };
    if (origin)
        headers['Access-Control-Allow-Origin'] = origin;
    return new Response(JSON.stringify(body), { status, headers });
}
