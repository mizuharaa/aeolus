# Olus reference teardown

Research date: 2026-09-14. Stage A deliverable; no product components changed.

## Sources and limits

Primary references: [Joby Aviation](https://www.jobyaviation.com/) and [United Carriers](https://unitedcarriers.com/). Live captures use Edge/Playwright, 1440×900, DPR 1, desktop default motion. Capture timestamps, script URLs and raw computed styles live in each `facts.json`. Measurements are viewport-specific, not mobile values.

Mobbin `search_flows` on web returned unrelated products for both names. Those results were rejected. `search_sections` returned **27 exact Joby sections** across three result pages and **17 exact United Carriers sections** across two pages; all matching images were downloaded. Metadata: [Joby index](reference/joby-mobbin/index.json), [United index](reference/united-mobbin/index.json). These are every exact-site result exposed by these searches, not a claim to every historical Mobbin screen. The API supplies neither chronology nor page identity. Local numbering is search-result order; the storyboard below uses the live homepage order.

Visual sheets: [Joby 1](reference/joby-mobbin/sheet-0.jpg), [Joby 2](reference/joby-mobbin/sheet-1.jpg), [Joby 3](reference/joby-mobbin/sheet-2.jpg), [United 1](reference/united-mobbin/sheet-0.jpg), [United 2](reference/united-mobbin/sheet-1.jpg).

Live scroll sheets: [Joby](reference/joby/scroll-sheet.jpg), [United](reference/united/scroll-sheet.jpg). Eleven screenshots per homepage cover 0–100% document scroll at 10% intervals. Additional menu and testimonial captures fill important missing states. Global increments do not sample every animation at 10% of its own timeline. Intro capture is opportunistic; a frame-accurate logo-node morph and all mobile states remain unverified.

## Measured design grammar

| Property | Joby | United Carriers |
|---|---|---|
| Declared display family | `jobyDisplay` | `BT Steinhart`, Arial fallback |
| Hero heading | 80px, weight 550, 80px line height, -2.4px tracking | 80px, weight 700 |
| Supporting large type | News 64px/64px, weight 550; technology 48px/48px, weight 500 | Intro 60px, weight 700; stats 133.333px, weight 700 |
| Color facts | CSS cream `#f5f4df`, ink `#0e1620`, blue `#007ae5` | Sampled heading ink `rgb(17,17,17)`, white `rgb(255,255,255)`; black globe field with orange/blue light |
| Grid / rhythm | 16 declared columns; 40px base side padding; 16px grid gutter; six mobile columns declared | Strong asymmetrical columns and center transport axis; exact sampled node geometry in facts/details JSON |
| Media treatment | Large rounded media, isolated portraits, tiny adjacent previews, asymmetric news images | Immersive globe/vehicle layers; hairline-separated evidence; white copy fields and dark scene strips |
| Main layout hold | CSS sticky wrappers; no `.pin-spacer` nodes observed | CSS sticky wrappers; no `.pin-spacer` nodes observed |

Parent H2 computed font sizes can be misleading: some Joby display lettering lives in independently sized descendants. For example the gallery parent computes to 10px while its visible title is enormous. Do not copy the parent value as the visual type scale. Heading document coordinates captured after scrolling may reflect transformed/sticky state; use `details.json` and original wrapper sizes for geometry.

## Joby homepage storyboard

`Jxx` identifies `reference/joby-mobbin/xx.png`. Dimensions are measured live where stated; “hypothesis” describes an Olus construction, not proven reference source code.

| Order / section | Capture evidence | Layout, type, spacing, crop | Pinned vs scrolling; transition | motion_hypothesis |
|---|---|---|---|---|
| 0 Loading | J09, J19; live loading.png | Solid blue cover, tiny centered mark; later centered nav lockup | Session-preloader service found; exact draw/fill/Flip chain not recovered | Original Olus path draw + shared-node Flip is requested adaptation |
| 1 Navigation | live menu.png | Left toggle, centered brand, right investor link; open state is a large blue text panel with secondary links left and large primary links right | Page dims below open panel; no media-card boxes in captured menu state | Panel reveal and focus management; Olus media cards require explicit new behavior |
| 2 Hero | J22/J11; live 0/10/20/30% | Full-width aviation sequence, rounded bottom at rest; 80px two-line heading low center, smaller rule-led captions | Hero section 10,800px = 12 viewport heights at 900px; content is held while aviation changes | CSS sticky + normalized ScrollTrigger timelines; shorter Olus scene must be labeled adaptation |
| 3 Experience gallery | J20; live 40/50% | Bone field; huge heading, dominant central portrait, small offset previews and side copy | Section 5,683px; measured sticky wrapper 5,175px, child 850px at top 25px | Scrub normalized slide phase variables and transform origins; not proven to be a simple horizontal x-track |
| 4 App/journey | J18; #app | Wide left media and glass journey overlay; smaller right portrait with copy; heading below | Section about 893px; reveal as it enters | One GSAP entrance sequence plus independent route overlay; reuse real MacBook demo earlier |
| 5 Technology | J13; live 60% | Full-bleed metallic aircraft macro; 48px headline left and compact rule-separated facts right | Section 1,090px; entry/out translation and radius variables | Media parallax and inset mask; no new layout animation |
| 6 News | J06; #news | Three columns, 64px heading, vertical rules, dates, staggered media heights | Section about 883px; entry-triggered card reveals | Stagger .15 per card with line/text reveals |
| 7 Partners | live 70% | Category list left, paired media center, factual partner marks right | Section 3,545px; sticky child 900px in 3,240px wrapper | Scroll selects category/media; not an Olus customer section without real evidence |
| 8 Story | live 80% | Full-width aircraft scene, heading/copy across lower area | Section 1,090px hands into illustration field | Reuse simple entry and exit parallax if Olus narrative needs it |
| 9 Illustrated sky | J14; live 90% | Blue sky, oversized display, clouds and aircraft on separate visual layers | Section 4,372px; several layer-specific scroll ranges | Layer transforms with restrained rates and readable text beats |
| 10 Footer | live 100% | Large color field, columns, low brand and underlined email; illustration continues below | Footer element 900px, wrapper 1,798px | Content-sized mobile footer; near-static links with ambient handoff |

The extra partners/story beats are present in the live reference but not additional mandatory Olus customer claims. The Olus sequence in the revised brief preserves the user's requested content order and introduces the MacBook within the opening.

## United Carriers homepage storyboard

`Uxx` identifies `reference/united-mobbin/xx.png`. Mobbin also includes secondary pages; the live homepage supplies missing globe/testimonial evidence.

| Order / section | Capture evidence | Layout, type, spacing, crop | Pinned vs scrolling; transition | motion_hypothesis |
|---|---|---|---|---|
| 0 Loader | U10/U13; live loading.png | Black field, rings/brand or blank transient capture | Exact flat-map-to-sphere vertex correspondence not established | Olus point morph is a required new construction, not verified UC internals |
| 1 Globe hero/nav | live 0%, menu.png | Edge microcopy; left operational heading and CTAs; giant right-cropped dotted globe, warm upper rim, cool lower rim and hub labels | Sticky globe child 900px in 2,250px wrapper | Lazy Three.js layer, independent scroll entry/user controls |
| 2 Intro and stats | U08; live 10% | Light field, left thumbnail and two-tone headline; right proof blocks separated by rules | Sticky intro child 900px in 1,436px wrapper; counts trigger at entry | Pinned/sticky left, independently scrolling stats; Olus scrub-count is adaptation |
| 3 Crane/service transition | U12; live 20/30/40% | Vehicle-scale canvas/image sequence, rising container, dark service strip with horizontal content | Long multi-stage sticky section, source driven by viewport offsets | Reference frame-sequence crane is not needed for aviation; preserve transport-to-content continuity |
| 4 Vertical road | U14; live 50% | Narrow dark center road with top-down truck, white feature copy flanking | Third-screen sticky 900px in 2,025px wrapper; truck belongs to additional 4,024px wrapper | Olus runway and aircraft use equivalent spatial reading order |
| 5 Ocean/benefits | U07; live 60/70% | Top-down ship, ocean fills screen, caption/feature composition over water | Sticky child 900px in 6,662px wrapper | Source is a long scene hold; do not copy its empty distance into product UI |
| 6 Testimonial/plane | live detail-hometesti-40.png; live 80% | Very large top-down plane crosses quote content and obscures parts of headline; soft shadow/cloud overlap | Plane sticky 900px; testimonial parent 2,991px; source overlap scroll interval 200vh | Separate plane/shadow/occlusion layers; requested diagonal narrowbody differs from reference image and overlap construction |
| 7 Industry/updates | live 90% | Dark-gradient transition into industry content | Ordinary content after scene handoff | Brief reveal/gradient transition; no fabricated Olus industry deployments |
| 8 FAQ | U01; live DOM | Sparse white FAQ, heading left, question rows right, compact secondary contact | Sticky heading rail; accessible accordion behavior requires independent verification | Native semantic disclosure and small GSAP interior transition |
| 9 Footer | U06; live 100% | Spacious white footer, columns, contacts, image/map accents, huge pale brand | Footer about 864px | Olus follows requested Joby footer structure instead |

## All captured Mobbin sections

The indexes retain source URLs and exact intrinsic screenshot sizes. Complete identification list:

- **Joby:** J00 technical metrics; J01 company metrics; J02 passenger/window; J03 aircraft summary; J04 manufacturing imagery; J05 in-house engineering; J06 homepage news; J07 company origin; J08 news listing; J09 blue loader; J10 article lead; J11 cabin media/caption; J12 cruise hero; J13 technology; J14 illustration title; J15 skyward aircraft; J16 forest media; J17 company chronology; J18 app/journey; J19 blue nav state; J20 gallery title; J21 aircraft diagrams/tabs; J22 homepage hero; J23 manufacturing gallery; J24 propeller diagram; J25 experience typography; J26 quiet-flight diagram.
- **United:** U00 industry road hero; U01 FAQ; U02 company/global trade; U03 technology platforms; U04 media/copy introduction; U05 categorized FAQ; U06 footer; U07 ocean hero; U08 intro/proof; U09 service cards; U10 concentric loader; U11 Earth/vision; U12 crane scene; U13 black transient; U14 road features; U15 industry list; U16 articles.

## Direction for Olus

Keep the memorable aviation scale, menu transition and network motion. Put the operator's task into the opening through the existing MacBook demo. Use the requested neutral/amber/jade system, clear display sans type and comfortable dashboard rows. Decorative full-screen staging belongs to marketing; the Plan/Legality/Explain views must be immediately readable and backed by actual API/model evidence.

See [revised full brief](OLUS-MASTER-BUILD-PROMPT.md), [measured motion](motion-forensics.md), and [asset inventory](asset-research.md). Reference fonts are declarations, not licensed fonts for reuse; screenshot-derived rhythm is qualitative outside the measured desktop geometry. No product UI, rebrand migration, performance certification or deployment has occurred in this research stage.
