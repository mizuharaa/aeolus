# Olus rebrand and Stage B handoff

Branch: `ui/olus-opening`. Local implementation; no commit, push or deployment performed.

## Implemented

- Canonical product copy, source identifiers, package names/lockfiles, metadata, owned aircraft asset names, Docker service references and environment examples use Olus/olus.
- New aviation opening: supplied photo, SVG draw/fill/FLIP, masked wordmark, downward reveal, fixed nav with native modal media panel, scroll-pinned hero.
- The live DOM MacBook remains immediately after the identity block. Added pause/replay and explicit illustrative labeling. Phones under 640px and reduced-motion users receive a static device with readable narrative context.
- The old globe, plans, methodology and footer remain below the new opening pending their scheduled rebuild. Dashboard routes are rebranded; their UX overhaul, FAQ, 404 and remaining landing sections are not implemented yet.

## Compatibility that intentionally retains the old name

- Browser preferences: `aeolus-*` keys copy once to `olus-*` before hydration. Existing `olus-*` values win; legacy values remain intact; unavailable storage does not block rendering.
- SQLite: both application startup and replay call `default_db_path()`. Existing `aeolus.db` remains the active file, including its WAL. Fresh directories use `olus.db`. This preserves scenarios without copying an active SQLite database. A physical rename requires a coordinated offline migration.
- Terraform EFS access-point directory `/aeolus` remains unchanged to preserve the mounted state. The repository/OIDC identity stays `mizuharaa/aeolus`, matching `git remote -v`. External GitHub/deployment URLs are not invented or renamed. The README clone command explicitly creates an `olus` checkout directory.
- `.venv-aeolus` and archived `reference/retired-landing-sky` files remain historical/runtime paths. Real credentials and `.env` files are untouched.
- Fresh infrastructure defaults and example resource labels use olus. Existing deployments must keep their configured project/resource IDs when applying Terraform; no infrastructure apply was run.

## Validation

- `cd apps/web; node scripts/check-brand-storage.mjs`: PASS for migration, canonical preference priority, idempotence, blocked storage and prepaint theme initialization.
- `cd apps/api; python tests/check_brand_storage.py`: PASS for fresh database name and existing scenario/WAL recovery.
- `npm run type-check`: PASS.
- `npm run build`: PASS. Existing custom-font warning remains. Landing first load: 274 KB; full-page performance budget remains open.
- `node scripts/olus-opening-qa.mjs` (development server on 3001): same logo node, intro duration, session reuse, menu hover/focus/Escape, demo pause/replay, responsive overflow and visible brightness at 320/390/768/1024/1440/1920/2560, no reduced-motion pins, scoped axe and no runtime errors. See JSON for exact counts/timing.
- `node scripts/olus-opening-recording.mjs`: production browser checks and desktop/mobile recordings.
- Full Python persistence/golden replay tests were attempted but not run: system Python 3.14 lacks pytest; `.venv-aeolus` points at a missing Python 3.11 installation under the old Windows user. No full backend test-suite claim is made.

## Next review boundary

The user's working agreement asks to review and iterate on the opening recording before the globe. Once accepted, branch the globe from this opening, then complete the remaining landing and dashboard stages in `OLUS-MASTER-BUILD-PROMPT.md`.


Final production smoke: both desktop and touch-mobile visibly showed the covering intro and centered logo; both menus closed, no runtime errors occurred, and the mobile demo label cleared the fixed navbar. Final recordings are `opening-desktop.webm` and `opening-mobile.webm`. Detailed development regression: 32/32 assertions passed; opening/menu axe violations: 0. Production build log is retained in `verification/opening/build.log`. Preview is running locally at `http://localhost:3001`.

## Reload replay update

The user requested replay on every website reload. Removed the session flag and scroll-position gates from the opening, and set the prepaint cover pending on every document load. Reduced motion still skips the intro. `scripts/check-intro-reload.mjs` verifies reload at the top, reload after scrolling, an existing legacy session flag, same-node completion, and reduced motion. Earlier session-reuse results above describe the previous behavior.
