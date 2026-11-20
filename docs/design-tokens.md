# Design tokens

`css/tokens.css` loads before component styles. Home and the shared sidebar, header and page titles use the tokens directly; legacy screens use aliases such as `--bg1`, `--obj` and `--meta` without a component redesign. Until those screens are migrated, Porcelain temporarily maps every legacy colour alias to the fixed Nebula palette. Each non-Home screen wraps its content in `.legacy-surface`, with its own Nebula colour tokens, text and background, panel radius and dark colour scheme. The page title row sits outside this panel; the surrounding page background, sidebar and header always follow the chosen theme. This surface override applies only to Porcelain; dark themes are unchanged. Lists, details, forms, settings-dialog legacy controls, wishlists and statistics therefore stay dark and legible; Home and the new appearance controls still use Porcelain. Dark themes continue mapping legacy aliases to their own palette. `--color-nebula-*` holds those fixed reference values once.

## Token groups

- Themed: `--color-bg`, `--color-surface`, `--color-surface-elevated`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-secondary-light`, `--color-focus`, `--color-success`, `--color-warning`, `--color-error`, `--color-info`, `--color-card-overlay`, `--color-card-text`, `--color-mode-classic`, `--color-mode-platform`, `--color-grid`, `--color-shadow` and `color-scheme`. Thumbnail captions retain a dark scrim and light text, even in Porcelain. Theme selectors also scope the same palette tokens to their preview elements; no preview hex values are duplicated. `--color-motif` colours the shared SVG masks independently of their geometry.
- Fixed spacing: `--space-4`, `--space-8`, `--space-12`, `--space-16`, `--space-24`, `--space-32`, `--space-48`.
- Fixed geometry: `--radius-control` (10px), `--radius-card` (12px), `--radius-panel` (16px), `--radius-pill` (999px); `--size-control` (44px minimum), `--size-border` (1px), `--size-focus` (2px, also the ring offset). `--shadow-panel` uses the themed shadow colour.
- Fixed motion: `--motion-hover` (120ms), `--motion-selection` (180ms), `--motion-panel` (200ms), `--motion-easing` (cubic-bezier(.2,.8,.2,1)). Reduced motion disables new transitions and spinner animation, retaining a static loading indicator.
- Fixed typography: `--font-ui` (Inter with system fallbacks), `--font-display` (Oxanium with system fallbacks); metrics use tabular numbers.
- Fixed rank accents: `--rank-1` through `--rank-5`; ranks 6+ use `--color-border`. Status meanings never change: success, warning, error and information must accompany a label or icon.

## Independent preferences

`ui.theme` / localStorage `gt` / `user_settings.theme` selects `nebula` (default), `graphite`, `ocean`, `amber`, `crimson` or `porcelain`. Old blue, night and synth values map to nebula, graphite and crimson; dark maps to graphite and light to porcelain. Unknown values fall back to nebula.

`ui.background` / localStorage `gbg` / `user_settings.background` selects `grid` (default), `aurora`, `celestial` or `orbital`. Unknown values fall back to grid. Updating either field preserves the other; null cloud fields preserve local preferences. The page applies `data-theme` and `data-bg`. `data-motif` changes only celestial artwork: Classic stars, Platformer moons, mixed elsewhere. Backgrounds are static, noninteractive and hidden in forced colours.

## Contrast and font candidates

Crimson uses a warmer orange-red error colour (#FFAD75) to distinguish errors from its pink accent, while exceeding 4.5:1 on its surface. All six palettes retain the specified base, surface, text, muted text and accent colours. Porcelain status colours are darker: success #18733D, warning #846000, error #B62D49, info #176A9E. Each exceeds 4.5:1 on its white surface. Classic and Platformer metric accents use #846000 and #087A98 in Porcelain. `tests/tokens.test.js` checks text on base and surface, muted text on surface, and every status on surface for all themes.

Inter 400-700 and Oxanium 600-800 are bundled with their OFL licences and Latin/Latin Extended subsets, using swap. The shared brand and page titles use Oxanium, as do Home headings and level names; Inter for controls and body text. These remain candidates: compare them with rank emblem numerals before selecting final fonts, and approve the final palettes on screen. Legacy screens retain Lilita One.

Controls preserve focus after appearance selection, distinguish current selection from focus, and keep disabled controls quiet. Loading retains the label and box size with a small indicator; invalid controls use a semantic border and an adjacent textual error without clearing their value. Unsupported backdrop filtering uses solid surfaces; forced colours use system colours.
