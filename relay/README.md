# Level relay

A Cloudflare Worker that lets the app search [GDHistory](https://history.geometrydash.eu/api/). GDHistory answers requests from servers, but sends no CORS headers, so a page on `wal-014.github.io` cannot read it directly. The relay adds those headers for the site's origin only and returns levels in the app's own shape. Why the app uses this instead of GDBrowser is in [#159](https://github.com/Wal-014/Personal-Progress-List/issues/159).

It runs on the site owner's Cloudflare account, on the free plan, at `https://ppl-level-relay.waquermaster.workers.dev`.

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

## Deploy a change

A change deploys itself: when a pull request that touches `relay/` is merged, the `Relay` workflow (`.github/workflows/relay.yml`) runs the tests and `wrangler deploy` with the Wrangler version pinned in `package.json`. **Actions → Relay → Run workflow** deploys `main` again without a change.

The workflow needs one repository secret, `CLOUDFLARE_API_TOKEN`. To set it up or replace it:

1. A member of the owner's Cloudflare account creates a token: **My Profile → API Tokens → Create Token → Custom token**, with the permission **Account · Workers Scripts · Edit** and, under account resources, only the owner's account.
2. The repository owner adds it in GitHub: **Settings → Secrets and variables → Actions → New repository secret**, named `CLOUDFLARE_API_TOKEN`. Only the owner of a personal repository can add secrets.

The account ID is in `wrangler.jsonc`. The token is tied to its creator's Cloudflare membership; if that person leaves the account, create a new one.

To deploy by hand, a member of the account runs `npm ci` and `npx wrangler login`, then `npx wrangler deploy`, in this folder. To check the relay from the site's origin, open `https://wal-014.github.io/Personal-Progress-List/favicon.png` and run `fetch('https://ppl-level-relay.waquermaster.workers.dev/levels?ids=128').then(r => r.json())` in the console.

If the relay ever moves to another account or name, its URL changes: update `LEVEL_RELAY_API` in `js/config.js` and the `connect-src` of the Content Security Policy in `index.html`. `npm test` fails if the two differ.

To try it against a local copy of the site, run `npm install` here (it allows workerd's install script, which `wrangler dev` needs), then `npx wrangler dev --var ALLOWED_ORIGINS:http://127.0.0.1:8790`, and serve the site on that port.

Before relying on it, tell GDHistory's owner about the relay: its API documentation calls it unfinished and says nothing about use by other sites.
