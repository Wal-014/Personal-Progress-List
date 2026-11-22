# Design tokens

The shared shell, list details, wishlists, statistics and dialogs use the active theme's tokens. Older component names such as `--bg1`, `--obj` and `--meta` resolve to those same tokens. Porcelain uses light surfaces, dark text and satin edges. `--color-nebula-*` provides the default dark palette.

## Token groups

- Themed: `--color-bg`, `--color-surface`, `--color-surface-elevated`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-secondary-light`, `--color-focus`, `--color-success`, `--color-warning`, `--color-error`, `--color-info`, `--color-card-overlay`, `--color-card-text`, `--color-mode-classic`, `--color-mode-platform`, `--color-grid`, `--color-shadow` and `color-scheme`. Thumbnail captions retain a dark scrim and light text, even in Porcelain. Theme selectors also scope the same palette tokens to their preview elements; no preview hex values are duplicated. Orbital arcs and Celestial silhouettes pick up the accent and secondary light from the ambient gradients. The Celestial masks define the outlines and translucent moon fill. `--metal-edge`, `--metal-shade` and `--metal-glint` define the one-pixel reflective edge shared by framed controls and surfaces; heading highlights mix the edge with the active text color.
- Fixed spacing: `--space-4`, `--space-8`, `--space-12`, `--space-16`, `--space-24`, `--space-32`, `--space-48`.
- Fixed geometry: `--radius-control` (10px), `--radius-card` (12px), `--radius-panel` (16px), `--radius-pill` (999px); `--size-control` (44px minimum), `--size-border` (1px), `--size-focus` (2px, also the ring offset). `--shadow-panel` uses the themed shadow colour.
- Fixed motion uses `--motion-hover` (120ms), `--motion-selection` (180ms), `--motion-panel` (200ms), `--motion-background` (400ms) and `--motion-easing` (cubic-bezier(.2,.8,.2,1)). Reduced motion disables transitions and spinner animation, retaining a static loading indicator.
- Fixed typography: `--font-ui` (Inter with system fallbacks), `--font-display` (Oxanium with system fallbacks); metrics use tabular numbers.
- Fixed rank accents: `--rank-1` through `--rank-5`; ranks 6+ use `--color-border`. Status meanings never change: success, warning, error and information must accompany a label or icon.

## Independent preferences

`ui.theme` / localStorage `gt` / `user_settings.theme` selects `nebula` (default), `graphite`, `ocean`, `amber`, `crimson` or `porcelain`. Old blue, night and synth values map to nebula, graphite and crimson; dark maps to graphite and light to porcelain. Unknown values fall back to nebula.

`ui.background` / localStorage `gbg` / `user_settings.background` selects `grid` (default), `aurora`, `celestial` or `orbital`. Unknown values fall back to grid. Updating either field preserves the other and null cloud fields preserve local preferences. The page applies `data-theme` and `data-bg`. Celestial uses `data-motif` to crossfade two fixed masks, emphasizing stars in Classic, moons in Platformer and keeping both subdued elsewhere. Backgrounds are noninteractive and hidden in forced colours.

## Contrast and font candidates

Crimson uses a warmer orange-red error colour (#FFAD75) to distinguish errors from its pink accent, while exceeding 4.5:1 on its surface. All six palettes retain the specified base, surface, text, muted text and accent colours. Porcelain status colours are darker: success #18733D, warning #846000, error #B62D49, info #176A9E. Each exceeds 4.5:1 on its white surface. Classic and Platformer metric accents use #846000 and #087A98 in Porcelain. `tests/tokens.test.js` checks text on base and surface, muted text on surface, and every status on surface for all themes.

Inter 400-700 and Oxanium 600-800 are bundled with their OFL licences and Latin/Latin Extended subsets, using swap. The shared brand and page titles use Oxanium, as do Home headings and level names; Inter for controls and body text. These remain candidates: compare them with rank emblem numerals before selecting final fonts, and approve the final palettes on screen.

Controls preserve focus after appearance selection, distinguish current selection from focus, and keep disabled controls quiet. Loading retains the label and box size with a small indicator; invalid controls use a semantic border and an adjacent textual error without clearing their value. Unsupported backdrop filtering uses solid surfaces; forced colours use system colours.

## Hover

| Control family | Previous hover | Shared feedback |
| --- | --- | --- |
| Default and secondary buttons, including icon actions, Home links, account, profile and notification actions | Global brightness, with separate Home and shell overrides | Raised surface and a subtle edge. Text links tint their ink. |
| Primary and semantic actions | Global brightness over the fill, text and icons | Primary fills brighten gently. Metallic semantic actions keep their existing fill hue. |
| Home list cards and wishlist previews | Larger glow on Home cards, accent border on wishlist previews | Inner edge emphasis, with a rotating reflection on metallic cards. |
| Level list cards | Raised surface and thumbnail flash, including the open card's thumbnail | Inner edge emphasis. The open card and picked cards retain their selection paint. |
| Wishlist items and drag grips | Accent border on the whole item and bright grip | The grip changes ink and the row's buttons use their respective control feedback. The item's status edge stays visible. |
| Ranking cards and level search results | Ranking border tint even on static cards, green search result border and title | Inner edge emphasis on clickable cards. Read-only ranking cards stay static. |
| Sidebar navigation, list choices, profile menus, comparison options, radio choices and multi-select options | Mixed fills, accent borders or green text | Low-intensity surface and ink tint. Current, checked and keyboard-focused options keep their own paint. |
| Filter triggers, segmented controls, chips and colour swatches | Global brightness, a stronger chip fill or no custom hover | Compact surface and edge cues. Chips and swatches preserve the original tag or profile colour. |
| Native fields and disclosures, chart bars and scrollbars | Browser feedback on fields, yellow histogram tooltip marker, accent scrollbar thumb | Native field feedback and chart tooltip colours are deliberate exceptions. Disclosures use the shared cue and scrollbar thumbs change colour without resizing. |

Hover paint applies on hover-capable devices with normal colours. Entry and exit use `--motion-hover` and `--motion-easing`, while selection keeps `--motion-selection`. Reduced motion applies hover paint immediately. The registered `--rim-angle` is inherited by the inner reflection and interpolates in both directions. Button feedback uses colour and edge paint without brightness filters.
