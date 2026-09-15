# Olus asset research

## Supplied images

Original supplied files are copied without modification into `reference/supplied/`. These are authorized visual inputs for the redesign; no claim of a stock license is inferred from a clipboard filename.

| File | Original size / ratio | Placement | Crop guidance |
|---|---|---|---|
| [01-wing-aerial.png](reference/supplied/01-wing-aerial.png) | 1280×720, 16:9 | Primary immediate hero / video poster; journey background if useful | Preserve wing entering left and horizon; put dark overlay behind text without crushing water/sky detail. Desktop 1920px may benefit from a higher-resolution original. |
| [02-cabin-window.png](reference/supplied/02-cabin-window.png) | 612×409, 1.496:1 | Supporting passenger-experience / journey image | Keep face and lit window together. Portrait crop is possible but substantially lowers effective resolution. This is a passenger, not a dispatcher. |
| [03-airport-approach.png](reference/supplied/03-airport-approach.png) | 525×350, 3:2 | Gallery/supporting airport scene | Keep approaching aircraft and observers; avoid cropping away the operational setting. |
| [04-sunset-departure.png](reference/supplied/04-sunset-departure.png) | 500×281, 1.779:1 | Small thumbnail or transition accent | Keep silhouette and sunset band. Unsuitable for full-screen high-resolution background at native quality. |

Do not convert these into generated videos, enhance identities, or invent missing imagery during this research stage. Production media should be served from the app's typed manifest after the review gate. The MacBook remains the real existing HTML demo, independent of stock photography.

## Additional stock candidates found

These are candidates, not installed production assets. Inspect the downloadable original and retain its license/source record when selected; the search index does not prove the final downloaded file's dimensions.

| Candidate / source | Useful slot | Verified on source listing |
|---|---|---|
| [Airplane on Runway — Pexels](https://www.pexels.com/photo/airplane-on-runway-6716735/) | GALLERY night stand / aviation context | Listed as free stock photo; night/runway subject |
| [Close-Up Shot of an Airplane — Pexels](https://www.pexels.com/photo/close-up-shot-of-an-airplane-8949803/) | TECH_HERO or night gallery | Free stock listing, aircraft close-up; inspect crop suitability |
| [Airplane on Runway at Sunset with Cityscape — Pexels](https://www.pexels.com/photo/airplane-on-runway-at-sunset-with-cityscape-31075568/) | Hero video poster alternative / news | Free stock listing; runway and cityscape at dusk |
| [Aerial photography of airplane wing — Harman Sandhu, Unsplash](https://unsplash.com/photos/aerial-photography-of-airplane-wing-ziZmIE9lfCM) | Hero/aerial support | Source identifies photographer and Unsplash License |
| [Airplane wing seen through a window — Adrien Olichon, Unsplash](https://unsplash.com/photos/airplane-wing-seen-through-a-window-at-airport-aZd-_JKymXA) | Supporting airport/journey | Source identifies photographer and Unsplash License |

Still needed: credible OCC imagery, storm radar with appropriate provenance, departure board, crew jetbridge and licensed transparent top-down aircraft. The reference site's aircraft cutout is research material; do not ship it as Olus-owned imagery. Existing owned GLB and asset register should be reviewed before acquiring another plane model.

## Reference media manifests

- [Joby rendered media](reference/joby/media-manifest.json): 126 DOM elements, including repeated assets and lazy/unloaded entries.
- [United rendered media](reference/united/media-manifest.json): 169 DOM elements, including repeated assets and lazy/unloaded entries.

Each entry records source URL, poster/srcset where present, measured intrinsic size when available, displayed geometry, both aspect ratios and object-fit/object-position. Zero or unloaded intrinsic dimensions become null and an explicit unavailable status. CSS backgrounds are listed separately. The entire runtime frame-sequence asset graph was not enumerated; this is a rendered-media manifest, not a claim to every hidden/possible reference asset.

All reference media stays under docs/reference and is excluded from the application bundle. Do not use the reference brand's footage or logos in the rebuilt site.
