# Level data providers

Research for [#151](https://github.com/Wal-014/Personal-Progress-List/issues/151), done on 2026-11-03 to guide the search work in [#150](https://github.com/Wal-014/Personal-Progress-List/issues/150) and [#152](https://github.com/Wal-014/Personal-Progress-List/issues/152). It compares the services that could give the app Geometry Dash level data, records what each one returned, and recommends which ones to use.

**Recommendation in short:** add no new API. Make the community sheet the main source for searches: it already lists every rated level **with its rating tier**, which `scripts/build-levels.js` was dropping. Keep GDBrowser as an optional extra for unrated levels, levels rated after the last sheet update and download counts, and stop asking it for data the sheet already has.

## What the app needs

| Field | Used for | Sheet copy before this research | Needed from elsewhere |
|---|---|---|---|
| Level ID | Picking a level, thumbnails, AREDL positions | Yes | No |
| Name | Search and display | Yes | No |
| Creator | Level details | Yes | No |
| Difficulty | Faces and the difficulty filter | Yes | No |
| Rated or unrated | The Rated / Unrated filter | Only rated levels are listed | Unrated levels |
| Rating tier (Star, Featured, Epic, Legendary, Mythic) | Face halos and the rate type filter | No, although the sheet has it | No: keep the sheet's column |
| Classic or Platformer | Which list a level goes to | Yes | No |
| Downloads | Ordering results that match the text equally well | No | Optional |
| Thumbnail | Result and level cards | No | Level Thumbnails, already used |

The search itself must find a level by its exact ID, by its full name, and by any part of its name, ignoring case. It must filter by difficulty, by rated status and by tier, and page through long result lists. Since #134 the search matches any part of the name from the sheet. GDBrowser's own search only matches the start of names.

## How the providers were tested

1. Request headers from the command line with `curl` and an `Origin: https://wal-014.github.io` header, keeping curl's default user agent. Recorded: status, content type, `Access-Control-Allow-Origin` and Cloudflare's `cf-mitigated`.
2. `fetch()` from a real browser on the app's own origin. Playwright's Chromium opened `https://wal-014.github.io/Personal-Progress-List/manifest.json`, a page without the app's Content Security Policy, so only CORS could block a request. Each candidate got one request. A `TypeError: Failed to fetch` means the browser refused to hand the response to the page.
3. Content check: one level of each tier, compared between the sheet and GDHistory, the only provider with tiers that answered the command line. One request per level, a second apart.

Nothing was done to get past a block: no browser user agent spoofed on the command line, no proxy, no other host.

## Results

| Provider | Command line | Browser on the app's origin | Coverage | Verdict |
|---|---|---|---|---|
| [GDBrowser](https://gdbrowser.com/api) | 403 with `cf-mitigated: challenge` on every path | Blocked (`TypeError`) | Every level, rated and unrated, with tier and downloads; name search matches only the start of names | Unavailable now. Keep as optional |
| [GDHistory](https://history.geometrydash.eu/api/) | 200 JSON, no `Access-Control-Allow-Origin` | Blocked (`TypeError`) | Every level it has archived, with tier, downloads and history; full-text search | Not usable from a static site |
| Official game servers (`boomlings.com`) | 403 from Cloudflare | Blocked (`TypeError`) | Everything | Not a public API. Excluded |
| [AREDL / AREPL](https://api.aredl.net/v2/api/) | 200 JSON, `Access-Control-Allow-Origin` echoes the app's origin | 200 | About 1,650 classic Extreme Demons, plus the platformer list; positions, tags, no tier | Already used for positions. Too narrow for search |
| [Pointercrate](https://pointercrate.com) | 200 JSON, `Access-Control-Allow-Origin: *` | 200 | The Demonlist only (the top Extreme Demons and the legacy list) | Too narrow |
| [GD Demon Ladder](https://gdladder.com) | `Access-Control-Allow-Origin: https://gdladder.com` | Blocked (`TypeError`) | Rated demons with community tiers | Only allows its own site |
| [Level Thumbnails](https://levelthumbs.prevter.me) | 200 WebP, `Access-Control-Allow-Origin: *` | 200 | Thumbnails by ID | Already used |
| Community sheet (`data/levels.json`) | Served by the app itself | 200 | Every rated level (58,558 rows): ID, name, creator, difficulty, Classic/Platformer, **rating tier** | Main source |

### GDBrowser

Since #146, gdbrowser.com puts its whole site, API included, behind a Cloudflare managed challenge. The browser receives a 403 page without CORS headers and reports a network error. The API itself has not changed. Nothing in the app's request can fix that, and getting around the check would defeat its purpose. GDBrowser may lift the challenge again, so the app keeps it as an optional source: when it answers, it adds what the sheet cannot have.

It also has two old quirks:
- a search with no matches answers HTTP 500 without CORS headers, which looks like an outage to the browser; the app tells the two apart with one request for a level that always exists;
- a search returns 10 levels per page, and `?list` looks up at most 10 IDs.

#### Why the browser reports a CORS error

Re-checked on 2026-11-04 for [#159](https://github.com/Wal-014/Personal-Progress-List/issues/159), with the methods above. The requests reach gdbrowser.com, but Cloudflare answers them instead of GDBrowser:

| Request | Answer |
|---|---|
| `fetch()` from `https://wal-014.github.io` to `/api/search/char?page=0` and `/api/level/128` | 403, `content-type: text/html`, `cf-mitigated: challenge`, no `Access-Control-Allow-Origin`. Chromium blocks it for that missing header, the console error quoted in #159, and `fetch()` rejects with `TypeError: Failed to fetch` |
| `fetch()` from the same page to the AREDL API | 200 |
| curl with an `Origin` header to `/api/search/char?page=0`, `/api/level/128`, `/api` and the home page, and without one to `/api/level/128` | 403, `cf-mitigated: challenge`, `server: cloudflare`. The body is Cloudflare's "Just a moment..." challenge page |
| curl, CORS preflight (`OPTIONS`) | 403, `cf-mitigated: challenge` |

A challenge page is meant for a person: it runs a script that checks the browser, then sets a cookie for gdbrowser.com. A `fetch()` from another site cannot run that page, and the page carries no CORS headers, so the browser can only report the missing `Access-Control-Allow-Origin`. The CORS message is the symptom; the challenge is the cause.

Ruled out:
- **Rate limiting.** A rate limit acts after a number of requests from the same client. Here the first request from a machine that had sent none that day is challenged too, and no answer is a 429 or carries `Retry-After`.
- **Redirects.** No 3xx and no `Location` header.
- **Server errors.** No 5xx. The answer comes from Cloudflare, not from GDBrowser's server, so GDBrowser's own CORS settings are never reached.
- **The app's requests.** The home page, which the app never requests, and requests without an `Origin` header get the same 403. No order or structure of the app's requests can change that answer.
- **Passing the challenge in another tab.** The cookie it sets belongs to gdbrowser.com, and the app's `fetch()` sends no cookies to other sites. Sending them would also need CORS headers that the challenge page does not have.

**Is it intentional?** The challenge is a security setting of the site's Cloudflare account: a firewall rule, Bot Fight Mode, "I'm Under Attack" mode, or Cloudflare's DDoS protection acting for the site. Which one, and whether someone switched it on by hand, cannot be seen from outside. It has happened before and was lifted: the [Internet Archive's captures](https://web.archive.org/cdx/search/cdx?url=gdbrowser.com/&from=20260901&fl=timestamp,statuscode) of the home page got a 403 from 17 to 19 September 2026, then a 200 in every capture with a status from 22 September until 29 October 2026 at 02:40 UTC. The challenge was found on 29 October ([#146](https://github.com/Wal-014/Personal-Progress-List/issues/146)), 3 November (#151) and 4 November (this check).

GDBrowser's source repository, `GDColon/GDBrowser`, is no longer on GitHub either; copies exist under other accounts. Nothing public explains either change.

**What would restore it.** Only GDBrowser's side can: lifting the challenge, as in September, or exempting `/api/*` from it with a rule that skips the challenge for the API. Asking GDBrowser's developer, Colon, for the second is the only step open to this project. A proxy, or a server of our own that fetches GDBrowser for the app, would be getting around the check; it stays excluded, as decided in #146.

**What the app does meanwhile.** Nothing has to change. GDBrowser is optional; after a failure the app sends it no request for five minutes, and the next search, or the next sync that needs a rating tier, tries it again, so the app uses it as soon as it answers. Each attempt still logs one or two CORS errors in the console (the search, then the request for a level that always exists). The browser prints those itself, and a page cannot silence them.

**How to re-check:**

```bash
curl -s -o /dev/null -D - -H "Origin: https://wal-014.github.io" https://gdbrowser.com/api/level/128 | grep -iE '^(HTTP|cf-mitigated|access-control-allow-origin)'
```

GDBrowser is back when this prints a 200 and an `access-control-allow-origin` header, without `cf-mitigated`. Then confirm it in the browser on the app's origin, as in "How the providers were tested".

### GDHistory

GDHistory has the most complete data: unrated levels, the exact tier (`cache_featured`, and `cache_epic` with 1 Epic, 2 Legendary, 3 Mythic), downloads, and a full-text search with filters (`/api/v1/search/level/advanced/`). Its responses carry no CORS headers, so a page on another origin cannot read them. Using it would need a server of our own that relays requests, which the app does not have and would have to host, secure and pay for. Its documentation also warns: "Keep in mind that this is very unfinished and that breaking changes are bound to happen". It does not say whether other sites may build on it. It also refuses some clients: Python's default user agent got a 403 from Cloudflare.

Its data was still useful to check the sheet. The sheet's tiers matched GDHistory on all six levels compared:

| ID | Level | Sheet | GDHistory |
|---|---|---|---|
| 146 | chill out | ✔ rated | featured 0, epic 0 |
| 10565740 | Bloodbath | ✨ featured | featured > 0, epic 0 |
| 20029588 | Tech Run | 🔥 epic | epic 1 |
| 97493518 | And Ever | 🌸 legendary | epic 2 |
| 102814497 | The Towerverse | 💎 mythic | epic 3 |
| 106517747 | Astralith | 💎 mythic | epic 3 |

### The community sheet

The sheet that the deploy job copies every day has a **Rating** column with one emoji per level: ✔ rated (star only), ✨ featured, 🔥 epic, 🌸 legendary, 💎 mythic. Its **CP** column (creator points, 1 to 5) agrees with it on every row. All 58,558 level rows have one: 10,174 rated, 42,231 featured, 5,844 epic, 255 legendary and 54 mythic. Keeping that column costs about 120 KB before compression and gives rated searches every field the result cards and filters need. Rated searches then make no external request at all.

What the sheet cannot give:
- **Unrated levels.** The sheet only lists rated levels, and no static file could hold the millions of unrated ones.
- **Levels rated after the last update.** The sheet is maintained by volunteers, and the app's copy is rebuilt once a day.
- **Download counts.** Results that match the text equally well are ordered by downloads only when GDBrowser has supplied them, otherwise by the shorter name.

## Recommendation

1. **Keep the sheet's rating tier** in `data/levels.json` and treat the sheet as the source for rated levels: search, filters, faces, and filling the tier of saved levels during sync.
2. **Keep GDBrowser as an optional provider** for unrated levels, freshly rated levels and downloads. When both sources return the same level, GDBrowser's fields take precedence, because they describe the game's current state, and the sheet fills the fields GDBrowser leaves unknown.
3. **Ask GDBrowser only when it can add something,** and stop after a failure: a short cooldown avoids sending every search to a service that is known to be blocked, and recovery is automatic once the cooldown ends.
4. **Say what could not be searched** instead of reporting "no levels". With GDBrowser down:
   - a Rated search is complete;
   - an All search covers rated levels only;
   - an Unrated search cannot run.
5. **Add no new API and no backend.** No candidate is both reachable from the browser and broad enough. The only one with full coverage, GDHistory, would need a relay server for an API that calls itself unfinished.

Reconsider when one of these changes:
- GDBrowser or GDHistory starts sending CORS headers to other sites;
- a documented API with unrated levels and CORS appears;
- the sheet changes its columns: `build-levels.js` then leaves tiers unknown instead of failing.

## What stays limited

- With GDBrowser blocked, unrated levels cannot be searched, and levels rated after the last sheet update do not appear until the sheet lists them.
- Saved levels that are not in the sheet (unrated ones) keep an unknown tier until GDBrowser answers again.
- Without GDBrowser, results that match equally well are ordered by name length rather than by downloads.
