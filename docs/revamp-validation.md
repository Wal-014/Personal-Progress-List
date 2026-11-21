# Visual revamp validation

- **Date** November 20, 2026
- **Validation base** `8a6aa40baa3c998ebc6831b6ec171b835a357f1f`
- **Pre-revamp baseline** `main` at `611a9a1d1d3f4e061dcaf4778cd273ae9e56d6ff`

## How it was run

Playwright Chromium opened the running worktree at `http://localhost:8829/`. An init script cleared local storage and stubbed service worker registration. The checks used the built-in Demo profile, disposable fixtures for edge cases, and intercepted responses for search and thumbnail failures. Account-only dialogs used local fixture data. Profile backup and import used the actual JSON downloaded from the Demo profile.

The viewport sweep covered 360, 390, 768, 1024, 1280 and 1440 CSS px at 900 px high, 1366 × 600, and 720 × 450 as the reflow equivalent of 200% zoom on a 1440 × 900 viewport at device scale factor 1. It covered Home, both My Lists modes with detail and edit, the Wishlists index and detail, Statistics, the navigation drawer, profile menu, notifications, Settings, and auxiliary dialogs. No document or active content overflow was observed. The long-data sweep repeated the ten page layouts in all eight viewports. The account and migration fixture covered ten dialog variants in all eight viewports.

The [reusable browser check](../tests/browser/acceptance.js) passed at 360, 390, 1024 and 1440 px. It checks layout, both sets of rank markers, selection and keyboard focus on ranks 1 and 6, dialog bounds, and Escape focus restoration. Pass the exported function an already-open local app page. The existing appearance check also passed for previews, loading and forced colors.

All 818 Node tests passed across 42 files run directly with `node`, one file per process. `npx eslint .` and `git diff --check` passed. The same Demo data was loaded into a temporary Chromium page running the Statistics scripts read from `main` with `git show`.

## Global acceptance matrix

**12 Pass · 4 Fixed · 0 Exception**

| Area | Result | Evidence | Notes |
| --- | --- | --- | --- |
| Identity | Pass | The header reads “Personal Progress List”. The brand group was centered to 0 CSS px deviation in 36 Home and My Lists appearance checks. | The two prior names were absent from the visible shell. |
| Navigation | Pass | Sidebar order, two-tone profile cube, route indication, Settings placement, and mobile drawer were checked. Tab reached the mobile drawer and profile trigger with a solid outline. Escape returned to the drawer opener. | Profile dropdown bounds and focus return were checked on desktop and mobile. |
| States | Fixed | Idle, hover, selected, keyboard focus, disabled, loading and error states were exercised. The disabled bulk Delete used 0.65 opacity. Search announced loading and then the provider failure at 390 and 1280 px. | The pressed Settings option now has a distinct border. Sampled border contrast after the fix was 3.93:1, 4.03:1 and 4.45:1 in Nebula, Crimson and Porcelain. |
| Themes | Pass | All six palettes rendered on Home, Classic and Platformer at 390 and 1280 px. Grid, Aurora, Celestial and Orbital rendered. Changes to each preference preserved the other and survived reload. | Celestial showed mixed, star-emphasized and moon-emphasized variants. |
| Colors | Pass | Rank imagery retained the same assets across palettes. On Crimson, the search failure message measured 9.01:1 against its surface. Crimson rank 1 used the gold and ruby R5 asset with its own border. | The error was communicated in text and via a warning rule. |
| Rows | Pass | Ranks 1–6 were 96 px high at 360 and 390 and 104 px high at 1024 and 1440 in both modes. The 64-row fixtures kept equal heights with long text and mixed thumbnail availability. | Accented names and long authors fit in detail. Missing and HTTP 404 thumbnails kept the row geometry. |
| Emblems | Pass | Compared all ten rendered emblems with the supplied R5 sheet at desktop and mobile card sizes. Classic kept the wings and gold stars. Platformer retained the cyan moons, green diamond, blue triangle and ruby. | Each ranked row had one marker. Rank 6 displayed its number. Every emblem fit inside its row. Chromium announced both tested ranks once. |
| Selection | Fixed | The inset bar and outer keyboard outline were visible on ranks 1 and 6. On a solid-white thumbnail in Porcelain, the selection bar went from 2.51:1 to 4.61:1 at rest and from 2.15:1 to 3.94:1 on hover. | The rank border stays visible when a row is selected. |
| Lists | Pass | Browser added a level at rank 1, edited its attempts, confirmed deletion, searched by name, applied and cleared a tag, switched modes, dragged to reorder and used Alt+Up and Alt+Down. | Filtering suppressed reorder, and keyboard reorder retained row focus and the level's identity. |
| Mobile drag | Pass | At 390 px with Chromium touch emulation, a card-body swipe scrolled 404 px with order and selection unchanged. Dragging the 44 px grip moved rank 1 to rank 3. | Alt+Arrow keyboard ordering exercised the equivalent operation. |
| Detail | Pass | Both modes opened the record by ID and displayed existing difficulty, ranking, attempts/time and optional metadata. Long name and author remained accessible in detail. | Empty optional data and missing thumbnails used existing fallback presentation. |
| Home | Pass | Both mode links were present with Demo and empty data, plus links to full Wishlists and Statistics. Home showed summaries from the active profile. | The mobile layout stacked the sections and preserved the header. |
| Forms | Fixed | Level search selection was required to submit. The browser saved and reopened changes, retained an unsaved note through Settings, downloaded and re-imported a local backup, and moved a completed wishlist item to Classic. Dialogs fit and focus returned after closing. | The edit form's tag suggestions and removal controls now accept keyboard activation. Tab reached the suggestion, Enter added it, and Space removed it. |
| Statistics | Pass | Stats matched `main` for the same Demo data. Totals were 11 levels, 101,653 attempts, 101 hours and 9,241 average attempts. Thinking Space II remained the highest at 16,641 attempts. | Difficulty and year distributions, ranking order for both modes and attempts/time/enjoyment, and timeline points for attempts and play time matched. |
| Accessibility | Fixed | Text and control samples met the thresholds below. Keyboard Tab stayed inside the modal across 54 steps and Escape restored the opener. Forced colors hid both decorative layers. Reflow passed at 720 × 450. | Stronger Porcelain control edges and a thumbnail selection token preserve contrast. Reduced motion now also covers list scrolling and drag reorder. |
| Performance | Pass | Each synthetic ranked list contained 64 rows per mode. Classic retained its scroll position and total scroll height after redraw at 390 and 1280 px. The last ranked row remained reachable, and a thumbnail failure left the row at 104 px. | The CSS background layers had no animation. With reduced motion, the loading indicator retained its static form. |

## Contrast measurements

Ratios use Chromium-rendered sRGB colors. Background samples came from the painted surface with text and decorative icons hidden during measurement. For gradients, the values use the lowest sampled contrast. Text thresholds were 4.5:1 for normal text and 3:1 for large text. Functional outlines, fills and markers were compared with the adjacent surface at a 3:1 target. The modal primary button used its filled surface as the visual boundary.

| Sample | Nebula | Crimson | Porcelain |
| --- | ---: | ---: | ---: |
| Large header text | 13.24:1 | 12.52:1 | 7.83:1 |
| Home summary text | 9.54:1 | 8.91:1 | 6.86:1 |
| Home Add label / edge | 12.95:1 / 3.61:1 | 12.04:1 / 3.75:1 | 13.41:1 / 3.67:1 |
| My Lists search text / edge | 15.82:1 / 3.90:1 | 14.98:1 / 3.73:1 | 14.21:1 / 3.59:1 |
| My Lists filter label / edge | 15.82:1 / 4.45:1 | 14.98:1 / 4.25:1 | 14.12:1 / 3.75:1 |
| My Lists Add label / edge | 12.82:1 / 3.77:1 | 11.96:1 / 3.88:1 | 13.41:1 / 3.68:1 |
| Demo thumbnail card title | 16.88:1 | 16.88:1 | 16.88:1 |
| Detail tag chip text / edge | 12.19:1 / 7.77:1 | 11.45:1 / 7.36:1 | 14.02:1 / 4.00:1 |
| Rank 1 / rank 6 selection bar | 8.37:1 / 8.40:1 | 9.40:1 / 9.44:1 | 5.56:1 / 5.59:1 |
| Keyboard outline on rank 6 | 7.75:1 | 8.48:1 | 6.07:1 |
| Pressed Settings option text / edge | 5.70:1 / 3.93:1 | 4.85:1 / 4.03:1 | 5.07:1 / 4.45:1 |
| Modal primary label / fill boundary | 8.14:1 / 7.25:1 | 8.89:1 / 7.76:1 | 6.07:1 / 6.62:1 |
| Edit rank input text / edge | 15.82:1 / 3.55:1 | 14.98:1 / 3.29:1 | 14.67:1 / 4.11:1 |
| Search failure text | 9.72:1 | 9.01:1 | 4.86:1 |
| Wishlist metadata | 9.54:1 | 8.91:1 | 6.46:1 |
| Wishlist pressed status text / edge | 11.41:1 / 5.23:1 | 10.40:1 / 5.39:1 | 12.23:1 / 5.03:1 |
| Statistics total / label | 15.82:1 / 9.54:1 | 14.98:1 / 8.91:1 | 15.01:1 / 6.46:1 |
| Profile menu and notification text | 15.82:1 | 14.98:1 | 16.10:1 |

## Minimum cases

| Case | Result | Evidence |
| --- | --- | --- |
| Empty lists | Pass | Classic, Platformer, the Wishlists index and an empty wishlist detail showed their respective empty states. |
| One row | Pass | Each mode showed one ranked row with its emblem at 96 px on mobile. |
| More than five | Pass | Verified ranks 1–6 in each mode and scrolled 64 ranked rows per mode. |
| Long names with accents | Pass | A long unbroken name with accented text stayed within the card and was readable in detail. |
| Long authors | Pass | Long accented author text truncated in cards and reflowed in detail and edit. |
| Missing images | Pass | Checked missing level IDs and an intercepted thumbnail 404 with stable row height. |
| API error | Pass | Intercepted the community sheet and search relay with HTTP 503. The dialog stayed open and announced the combined failure at 390 and 1280 px. |
| Loading | Pass | A delayed search response announced loading before the failure appeared. Static loading feedback remained available with reduced motion. |
| Profile without data | Pass | Home retained both list entries. Statistics and notifications showed their no-data states. |
| Open modal | Pass | Settings, notifications, forms, prompts and account dialogs fit, including short and zoom-equivalent layouts. Escape and focus return were checked through the live openers. |
| Light and dark | Pass | Porcelain and the five dark themes rendered on both modes and Home. |
| Top 1 selected | Fixed | The inset bar remained visible over the Demo thumbnail and the solid-white fixture, including hover. |
| Rank 6 selected | Fixed | The plain rank marker, inset selection bar and keyboard outline remained visible together. |

## Fixes in this branch

- Strengthened Porcelain control rims and chip edges through appearance tokens. The Porcelain search edge rose from 1.03:1 to 3.59:1 and the chip edge from 2.63:1 to 4.00:1.
- Used the focus token for the pressed Settings rim and a lighter Porcelain selection marker over darkened thumbnails.
- Made form tag suggestions and removals native buttons while preserving form values and existing actions.
- Honored reduced motion for scrolling to a selected level and for Sortable animations in both levels and wishlists. Added Node coverage for the changed behavior.

## Open exceptions

None. The layout audit used Chromium touch emulation and a 720 px reflow-equivalent viewport. Account-only dialogs were rendered with fixture data.

## Approved deviations

- The manual “Refresh rankings” action was removed by design. Rank refresh runs in the background. [#253](https://github.com/Wal-014/Personal-Progress-List/pull/253)
- Celestial shows both motifs and emphasizes the one associated with the current list. [#257](https://github.com/Wal-014/Personal-Progress-List/pull/257)

## Screenshots

The eight JPEGs use the built-in Demo profile and quality 80.

| View | Desktop | Mobile or reflow equivalent |
| --- | --- | --- |
| Home, Nebula · Grid | [1366 × 900](https://github.com/Wal-014/Personal-Progress-List/releases/download/pr-media/260-home-nebula-desktop.jpg) | [390 × 844](https://github.com/Wal-014/Personal-Progress-List/releases/download/pr-media/260-home-nebula-mobile.jpg) |
| Home, Porcelain · Aurora | [1366 × 900](https://github.com/Wal-014/Personal-Progress-List/releases/download/pr-media/260-home-porcelain-desktop.jpg) | [390 × 844](https://github.com/Wal-014/Personal-Progress-List/releases/download/pr-media/260-home-porcelain-mobile.jpg) |
| Classic, Nebula | [Selected rank 1 · Celestial · 1366 × 900](https://github.com/Wal-014/Personal-Progress-List/releases/download/pr-media/260-classic-nebula-selected.jpg) | [Grid · 720 × 450 reflow equivalent](https://github.com/Wal-014/Personal-Progress-List/releases/download/pr-media/260-classic-equivalent-200-percent.jpg) |
| My Lists, Porcelain | [Platformer detail · Celestial · 1366 × 900](https://github.com/Wal-014/Personal-Progress-List/releases/download/pr-media/260-platformer-porcelain-desktop.jpg) | [Classic · Orbital · 390 × 844](https://github.com/Wal-014/Personal-Progress-List/releases/download/pr-media/260-classic-porcelain-mobile.jpg) |
