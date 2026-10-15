# Lutra Hug — Visual design handoff

## Source and scope

Visual source: `Lutra_Hug.pen`. Product behavior and original category names remain governed by `../docs/SCREEN_DESIGN.md`. This document records the visual choices inspected in the canvas; it does not claim that app navigation or asset packaging has been implemented.

## Typography

| Family | Canvas use | Observed weights |
| --- | --- | --- |
| Inter | Everything: brand, headings, body copy, controls, labels, amounts, chart annotations | normal, 500, 600 (headings 600) |

Inter is the only typeface. Funnel Sans was dropped because it has no Vietnamese glyphs, so diacritics (ă, ơ, ư, ạ, ồ…) would fall back to another font mid-word. Both `lh-display` and `lh-body` variables now resolve to Inter; keep `lh-display` as the heading role token. Preserve Vietnamese diacritics when packaging fonts. Font binaries and licenses have not been bundled by this design task; verify them when adding the actual assets to the app. Respect system text scaling and allow labels to wrap.

The walkthrough uses Inter 600 at 32 for headings and Inter at 16 for descriptions. Report category labels use Inter at 14. These are canvas sizes, not a requirement to disable native text scaling. Existing compact chart legends contain smaller text; enlarge them in accessible layouts rather than shrinking the full screen to fit.

## Icons

Use the canvas library `lucide`. Preserve named icon identifiers rather than substituting emoji or a different icon family.

| Purpose | Icon identifiers |
| --- | --- |
| Main navigation | `house`, `wallet`, `users`, `messages-square` |
| Report analysis | `chart-pie`, `chart-bar` |
| Report categories | `heart-pulse`, `pill`, `graduation-cap`, `bus`, `ellipsis` |
| Resources and walkthrough | `book-open`, `wallet`, `users` |
| Navigation actions | `arrow-left`, `chevron-left`, `chevron-right`, `plus`, `search` |

Report category icons use a 20-square canvas box; walkthrough feature icons use a 40-square box. Icon size is separate from the interactive hit area. Keep visible action labels or accessible names in the implementation. Use the platform status bar instead of shipping the mock status icons as app controls.

## Color tokens

| Canvas variable | Value | Role |
| --- | --- | --- |
| `lh-primary` | `#296474` | Primary actions and emphasis |
| `lh-ink` | `#183B45` | Main text |
| `lh-bg` | `#F4F8F9` | Screen background |
| `lh-muted` | `#5D7379` | Supporting text |

Report categories retain the existing blue, lavender, ochre, green and gray palette. Keep labels and amounts alongside colors. The report summary now uses the primary background with white text.

## Charts and images

- Category bar widths are calculated from the existing amounts against the displayed common scale. The added insight is calculated from those same amounts. Values remain illustrative, as identified by the canvas handoff board.
- The report adds a distribution overview using the existing home donut and legend. Keep the warning about comparing an incomplete current month with the full preceding month.
- Added photos are Unsplash image fills. Source metadata is retained on the canvas nodes. Family reading imagery is reused across the home resource highlight, resource listing, welcome screen and information walkthrough.
- Photos are illustrative, not portraits of actual mentors or evidence of a treatment outcome. Package the chosen images and retain source attribution during implementation; the canvas currently references remote image URLs.

## Walkthrough handoff

Canvas frames: `mnfw3`, `i8n4h`, `P0vli`. Their order introduces expenses, community and information resources. Each includes a skip label, progress indicator and primary action. These are visual screens; implement and test the actual transitions separately.

## Verification

After reopening the document, screenshots rendered the new chart icons, photos and walkthrough content. The canvas bounds check reported no clipping for the modified report, home, resource list, welcome screen or walkthrough frames. Earlier blank screenshots were resolved by reopening the document.
