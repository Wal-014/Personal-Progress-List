# Level relay

A Cloudflare Worker that lets the app search [GDHistory](https://history.geometrydash.eu/api/). GDHistory answers requests from servers, but sends no CORS headers, so a page on `wal-014.github.io` cannot read it directly. The relay adds those headers for the site's origin only and returns levels in the app's own shape. Why GDBrowser cannot be used any more is in [#159](https://github.com/Wal-014/Personal-Progress-List/issues/159).

## API

| Request | Answer |
|---|---|
| `GET /search?q=<text>&page=<0-99>&scope=all\|rated\|unrated&diff=<list>&rate=<list>` | `{ levels, more }`, 10 levels per page |
| `GET /levels?ids=<1-10 comma-separated IDs>` | `{ levels }` |

Each level is `{ levelId, name, creator, diff, rating, kind, downloads }`, as `js/relay.js` expects. `diff` takes the names in `DIFFICULTIES` plus `NA`; `rate` takes `RATING_TIERS`. Filters return a superset; the app rechecks every result.

| Status | When |
|---|---|
| 400 | A parameter is missing, unknown, repeated or out of range |
| 403 | The `Origin` header is missing or not in `ALLOWED_ORIGINS` (opening the URL in a browser tab gives this) |
| 404 / 405 | Another path, or a method other than GET |
| 429 | The client IP made more than 30 requests in 10 seconds (approximate, per Cloudflare location) |
| 502 | GDHistory failed or took more than 8 seconds |

GDHistory answers are cached for 10 minutes. The relay identifies itself to GDHistory with its own `User-Agent` that links to this repository.

## Deploy it

1. Log in to the Cloudflare account that will own the relay: `npx wrangler login`.
2. From this folder, deploy: `npx wrangler deploy`. Wrangler prints the URL, `https://ppl-level-relay.<subdomain>.workers.dev`.
3. Replace `SUBDOMAIN` with that subdomain in `js/config.js` (`LEVEL_RELAY_API`) and in the `connect-src` of the Content Security Policy in `index.html`. `npm test` fails if the two differ.
4. Check it from the site's origin: open `https://wal-014.github.io/Personal-Progress-List/favicon.png` and run `fetch('<relay URL>/levels?ids=128').then(r => r.json())` in the console.

To try it against a local copy of the site, run `npx wrangler dev --var ALLOWED_ORIGINS:http://127.0.0.1:8790` and serve the site on that port.

Before relying on it, tell GDHistory's owner about the relay: its API documentation calls it unfinished and says nothing about use by other sites.
