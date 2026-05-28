# Agent Decision Log

## Wrangler Worker Entry Configuration for Deploy
**Date and time:** 2026-05-27 00:00 UTC

**Summarised context:**
Reviewed the Cloudflare build log from May 27, 2026 showing `npx wrangler deploy` failed with "Could not detect a directory containing static files", and inspected repository files (`worker.js`, `README.md`) to confirm this is a Worker script project rather than a static assets project.

**Summarised reasoning:**
Wrangler needs explicit project configuration in this repo so deploy behavior targets a Worker entrypoint (`worker.js`) instead of trying to auto-detect static assets. A `wrangler.toml` file resolves that mode mismatch.

**Summarised changes:**
- Added `wrangler.toml` with Worker project configuration (`name`, `main`, `compatibility_date`, `workers_dev`).
- Left runtime logic in `worker.js` unchanged.
- Added this log entry at the end of `AGENTS.md` as a chronological record.

## Fix Initialisation Syntax Error and Add Git-Style Patch Default View
**Date and time:** 2026-05-27 00:59 UTC

**Summarised context:**
Reviewed the browser error report `Uncaught SyntaxError: Unexpected token '>' (at (index):103:31)` and inspected `worker.js` rendering and reducer logic for invalid JavaScript syntax and default list presentation.

**Summarised reasoning:**
The app could stall at "Initializing…" because a syntax error prevents script execution. The reducer in detail rendering used invalid nullish assignment syntax, so fixing that unblocks startup. To satisfy usability feedback, the home/default view should immediately show patch lines in a git-like diff format with color-coding for buffs, nerfs, and general changes.

**Summarised changes:**
- Fixed invalid reducer syntax in `renderPostDetail` by switching to valid nullish assignment expression behavior.
- Added git-style diff preview rows to each default-view post card with prefixes (`+`, `-`, `~`, `•`).
- Added color classes for diff rows: green buffs, red nerfs, yellow changes, and neutral blue-gray fallback.
- Added `renderDiffLine` and `diffKind` helpers to map parsed `changeType` values into display categories.
- Left fetch/parser behavior and data model unchanged.


## Replace Nullish Assignment in Category Reducer for Browser Compatibility
**Date and time:** 2026-05-27 01:04 UTC

**Summarised context:**
Reviewed the new runtime report `Uncaught SyntaxError: Unexpected token '>' (at (index):110)` and re-inspected inline script syntax in `worker.js`, especially modern assignment operators inside arrow-function reducers in detail rendering.

**Summarised reasoning:**
Some browser/parser combinations used by clients can still fail on `??=` in inline scripts, producing early parse failures that halt app startup. Replacing that expression with a broadly compatible reducer branch removes the parser risk without changing behavior.

**Summarised changes:**
- Replaced `??=` usage in `renderPostDetail` category grouping reducer with explicit array initialisation logic.
- Kept post parsing, filtering, UI layout, and diff rendering behavior unchanged.
- Added this decision-log entry at the end of `AGENTS.md` in chronological order.

## Broaden Browser Compatibility by Removing Arrow/Optional Syntax in Inline App Script
**Date and time:** 2026-05-27 01:08 UTC

**Summarised context:**
Reviewed the latest user screenshot showing the UI frozen at "Initializing..." and re-inspected `worker.js` inline browser script for any remaining modern JavaScript syntax that could still fail parsing in stricter/older browser engines.

**Summarised reasoning:**
When the app remains at the initial status text, the inline script is typically failing before `init()` runs. Remaining ES2020+ and arrow-function syntax can trigger parse-time failures in some browser contexts, so replacing those constructs with broadly compatible function expressions and explicit null checks is the safest way to restore execution.

**Summarised changes:**
- Replaced remaining optional chaining and arrow-function expressions in the inline app script with compatibility-safe equivalents.
- Kept parser logic, filtering behavior, and UI output intentionally unchanged.
- Left Worker routing/deploy config unchanged.
- Added this decision-log entry at the end of `AGENTS.md` in chronological order.

## Modularise Client Script and Add Structured Bootstrap Trace Logging
**Date and time:** 2026-05-27 01:14 UTC

**Summarised context:**
User reported the app still freezes at "Initializing…" and requested a refactor into multiple files plus richer diagnostics that make console output actionable for remote debugging.

**Summarised reasoning:**
Splitting the inline script/style into dedicated assets reduces monolithic surface area and makes parse/runtime failures easier to isolate. A structured stage-based logger with session IDs, global error hooks, and a callable trace dump gives deterministic breadcrumbs to identify the exact boot stage where execution fails.

**Summarised changes:**
- Refactored browser app logic into `app.js` and styles into `styles.css`, served by the Worker at `/app.js` and `/styles.css`.
- Updated `worker.js` HTML shell to load external assets while preserving existing UI and behavior.
- Added structured debug instrumentation (`[DeadlockInit]`), per-stage progress logs, `window.error`/`unhandledrejection` hooks, and `window.__deadlockDebug.dump()` trace export.
- Left parsing/fetch product behavior unchanged beyond diagnostics and modularization.


## Move Steam Access to Worker KV-Backed API with Daily Refresh
**Date and time:** 2026-05-27 01:22 UTC

**Summarised context:**
Reviewed the request to avoid client-side Steam calls, use a secret key safely in the Worker, prevent open proxy abuse/custom upstream calls, and persist updates with automatic daily checks.

**Summarised reasoning:**
Moving Steam fetches into Worker-only code keeps secrets server-side and prevents browser misuse. Restricting public endpoints to a fixed `/api/posts` shape (no user-controlled upstream parameters) and protecting manual refresh with a bearer token reduces abuse. Persisting results in KV with cron-driven refresh gives reliable daily update storage even when clients are idle.

**Summarised changes:**
- Updated client fetch path to call Worker endpoint `/api/posts` instead of Steam directly.
- Added Worker API endpoint for cached posts, KV-backed storage logic, and fixed Steam upstream request builder.
- Added protected `/admin/refresh` endpoint requiring `ADMIN_REFRESH_TOKEN` bearer auth.
- Added daily scheduled refresh handler and cron trigger configuration in `wrangler.toml`.
- Documented required secrets and architecture in `README.md`.
- Left parsing/filter UI behavior unchanged except for data source plumbing.


## Resolve KV Namespace Placeholder Deployment Failure
**Date and time:** 2026-05-27 01:40 UTC

**Summarised context:**
Reviewed the Cloudflare deploy log showing API error `code: 10042` and warning diff indicating `wrangler.toml` still used placeholder KV namespace IDs while Dashboard config had a real namespace ID.

**Summarised reasoning:**
Wrangler deploy in non-interactive CI applies local `wrangler.toml` bindings, so placeholder IDs override the working remote binding and cause validation failure. Replacing placeholders with the actual namespace ID aligns local and remote config and unblocks deploys.

**Summarised changes:**
- Updated `wrangler.toml` KV binding `id` from placeholder to the real namespace ID from deploy logs.
- Updated `wrangler.toml` `preview_id` to the same real namespace ID as a safe default until a separate preview namespace is created.
- Left Worker runtime logic and API behavior unchanged.
- Added this decision-log entry at the end of `AGENTS.md` in chronological order.

## Eliminate Client-Side Steam Calls from Worker-Served App Bundle
**Date and time:** 2026-05-27 01:41 UTC

**Summarised context:**
Reviewed browser console errors showing CORS failures to `api.steampowered.com` and compared the deployed Worker-served `/app.js` source inside `worker.js` against the standalone `app.js` file.

**Summarised reasoning:**
The Worker was still serving an embedded legacy app bundle that fetched Steam directly (`STEAM_URL`), so browsers hit CORS even though newer repository code expected `/api/posts`. The served bundle must be aligned to the Worker API path to enforce server-side upstream access only.

**Summarised changes:**
- Updated the embedded `APP_JS` bundle in `worker.js` to use `API_POSTS_URL` (`/api/posts`) instead of direct Steam URL fetches.
- Updated embedded fetch response parsing to consume Worker API shape (`items`, `source`, `lastRefreshedAt`) and adjusted user-facing status text accordingly.
- Updated embedded HTML shell copy in `worker.js` to reflect Worker API sourcing (noscript/header/refresh button wording).
- Left KV refresh, admin refresh auth, and scheduled refresh behavior unchanged.
- Added this decision-log entry at the end of `AGENTS.md` in chronological order.

## Default View Groups Full Patch Diff by Category with Patch Dividers
**Date and time:** 2026-05-27 01:51 UTC

**Summarised context:**
Reviewed the request to make the default loaded view show all patch changes in git-style lines, grouped under category headings for each patch post and visually separated between patches.

**Summarised reasoning:**
The existing default cards only previewed a limited slice of changes and did not provide per-patch category grouping. Rendering full grouped diff blocks on the home view improves scanability and matches the requested structure: patch -> category -> git-style lines, with a clear divider before the next patch.

**Summarised changes:**
- Updated default home rendering to show all parsed changes for each patch, grouped by category headings (e.g., `[Category]`) with git-style colored diff lines under each group.
- Added a reusable `renderPatchCategories` helper to build grouped home-view sections from parsed changes.
- Added visual patch dividers between patch cards in the default list view.
- Added supporting CSS rules for category section spacing/heading and patch divider styling.
- Synced the Worker-embedded `/app.js` and `/styles.css` bundles with the updated standalone source files.
- Left parsing, API routes, refresh logic, and detail-view behavior intentionally unchanged.

## Add Fallback Line Parsing for Non-Bulleted Steam Patch Posts
**Date and time:** 2026-05-27 02:00 UTC

**Summarised context:**
Reviewed user-reported examples where recent gameplay update posts rendered with "Parsed changes: 0" and inspected current client parsing logic in `app.js`/embedded Worker bundle to confirm extraction only accepted explicit bullet markers.

**Summarised reasoning:**
Some Steam announcements are not consistently formatted with `-`/`•` bullets or bracketed section headers, so strict bullet-only parsing drops valid change lines. Adding a compatibility fallback that treats non-empty content lines as changes (while still handling section-like headings) restores visibility for those posts without changing fetch or storage behavior.

**Summarised changes:**
- Expanded section/bullet parsing to support additional bullet markers (`*`, `[*]`) and a fallback mode that captures non-empty lines as change entries.
- Added heading detection for common category-only lines so category context is preserved when present.
- Synced the same parser update into the Worker-embedded `APP_JS` bundle.
- Left API routes, KV refresh behavior, and filter UI structure unchanged.

## Parse Steam BBCode Paragraph Tags into Proper Diff Lines
**Date and time:** 2026-05-27 02:34 UTC

**Summarised context:**
Reviewed the latest user report and screenshot showing `Parsed changes: 1` with a single long line still containing Steam BBCode markers like `[p]`/`[/p]`/`[b]`, and inspected current `normalizeSteamContent` logic in `app.js` and the Worker-embedded `APP_JS` bundle in `worker.js`.

**Summarised reasoning:**
The parser fallback correctly captures non-empty lines, but Steam posts that arrive with BBCode paragraph/list tags are not being normalized into newline-separated bullet lines before parsing. Converting those BBCode tags to line breaks (and stripping styling tags) ensures each gameplay change becomes an individual parsed line and restores category diff readability.

**Summarised changes:**
- Updated client normalization to translate Steam BBCode structure tags (`[p]`, `[/p]`, `[list]`, `[\*]`) into newline/bullet separators before section parsing.
- Stripped common BBCode formatting tags (`[b]`, `[i]`, `[u]`, headings, quote/code/url wrappers) during normalization so rendered diff text is clean.
- Normalized line whitespace before final join to avoid merged or malformed output lines.
- Synced the same normalization update into the Worker-embedded `APP_JS` bundle in `worker.js` so `/app.js` served by the Worker matches the standalone source.
- Left API routes, KV refresh behavior, and filter behavior unchanged.

## Semantic Patch-Note Classification and Colour Mapping Overhaul
**Date and time:** 2026-05-27 02:52 UTC

**Summarised context:**
Reviewed the parser/classification flow in `app.js` and the Worker-embedded `APP_JS` bundle in `worker.js`, along with current diff rendering and CSS classes used to color default-view patch lines.

**Summarised reasoning:**
The prior keyword-heavy classifier produced coarse types and collapsed many meaningful balance changes into generic yellow rows, which made obvious buffs/nerfs read incorrectly. A deterministic semantic scoring layer with explicit stat-direction rules, contextual phrase handling, and mixed/rework/bugfix separation improves readability while preserving the no-build client parser model.

**Summarised changes:**
- Replaced broad keyword classification with semantic helper-based classification that returns canonical `buff|nerf|mixed|rework|bugfix|neutral`, plus `confidence` and `classificationReason`.
- Added richer stat support/direction handling, contextual phrase handling (e.g., `now also grants`, `no longer grants`, `no longer prevents`), and cautious objective/system treatment.
- Updated diff rendering to map directly to semantic classes and prefixes from final classification output.
- Updated Type filter options to canonical types only.
- Added lightweight classifier fixtures exposed via `window.__deadlockDebug.testClassifier()`.
- Updated standalone `app.js` and synced identical logic into Worker-embedded `APP_JS` in `worker.js`.
- Updated `styles.css` and synced Worker-embedded `STYLES_CSS` for distinct semantic color classes.
- Left Worker `/api/posts`, KV cache flow, cron refresh, admin refresh endpoint, and Wrangler config unchanged.

## Add Crawlable SEO Pages, Metadata, Robots, and Sitemap for Public Indexing
**Date and time:** 2026-05-27 03:10 UTC

**Summarised context:**
Reviewed current Worker routing, homepage HTML shell output, and API/KV behavior to confirm the app was functionally correct but primarily JS-driven for content discovery.

**Summarised reasoning:**
Search engines index static, semantic HTML more reliably than JS-only shells. Adding lightweight server-rendered content, route-level metadata, and standard crawl/index files improves discoverability without changing API behavior or client filtering logic.

**Summarised changes:**
- Added Worker routes for `/robots.txt` and `/sitemap.xml` with crawler-friendly defaults and absolute URLs.
- Added server-rendered homepage intro and recent update links so crawlers/users see meaningful content immediately.
- Added server-rendered `/post/:gid` pages with canonical metadata, OG/Twitter tags, and JSON-LD `NewsArticle`.
- Improved homepage metadata with clear branding and Deadlock patch-note focused wording.
- Added small helper functions for HTML/XML escaping, absolute URL generation, and safe text truncation.
- Kept `/api/posts`, KV refresh behavior, cron schedule, and admin refresh auth unchanged.
- Updated README with a dedicated SEO/indexing section and documented limitations.

**Checks run:**
- `node --check worker.js`
- `node --check app.js`
- `curl -i http://127.0.0.1:8787/robots.txt` (via local Wrangler dev)
- `curl -i http://127.0.0.1:8787/sitemap.xml` (via local Wrangler dev)
- `curl -s http://127.0.0.1:8787/ | head -n 80` (via local Wrangler dev)
- `curl -i http://127.0.0.1:8787/post/<gid>` using a gid from `/api/posts` (via local Wrangler dev)

**Remaining TODOs:**
- Consider adding persistent OG image support for richer social snippets if a stable image source is introduced.

## Add Static Character SEO Routes and Crawlable Hero Patch History Pages
**Date and time:** 2026-05-27 03:26 UTC

**Summarised context:**
Reviewed existing Worker routing/SEO rendering in `worker.js`, existing `/api/posts` and KV refresh flow constraints, and the request to add crawlable character index/detail pages backed by the current cached Steam data model.

**Summarised reasoning:**
A single static character registry is needed to keep canonical slugs stable, guarantee route/sitemap coverage for every character, and avoid drift from noisy dynamically-detected entities. Server-rendered `/characters` and `/characters/:slug` pages can reuse cached post content and parser-compatible hero extraction without changing public API security or refresh behavior.

**Summarised changes:**
- Added a single hardcoded `DEADLOCK_CHARACTERS` registry with canonical slugs and aliases (including `Mo & Krill` alias variants) and a comment noting this is intentionally static for now.
- Added Worker-side helper utilities for slug normalization, character matching, and hero-line extraction from cached post content.
- Added crawlable `/characters` index page listing all static characters (including zero-change entries) with summary metadata.
- Added crawlable `/characters/:slug` detail pages with grouped per-patch hero changes and empty-state rendering when no changes are detected.
- Added optional compatibility redirect route `/hero/:slug` -> `/characters/:slug` (301).
- Updated server-rendered homepage and post-detail pages with internal links to character pages.
- Updated sitemap generation to include `/characters` and every canonical character detail URL from the static registry.
- Left `/api/posts`, KV storage/refresh logic, scheduled refresh, and `/admin/refresh` authorization behavior unchanged.

## Reduce KV Read/Write Volume with Route-Scoped Snapshot Loading and V2 Snapshot Key
**Date and time:** 2026-05-27 04:36 UTC

**Summarised context:**
Reviewed the Worker request flow and identified that `readStoredNews(env)` was called before route branching, causing KV reads on non-data routes (`/health`, `/robots.txt`, `/app.js`, `/styles.css`) and amplifying quota usage during normal page loads.

**Summarised reasoning:**
KV usage can be reduced significantly by deferring snapshot reads to only data-dependent routes, adding isolate-memory snapshot reuse, and avoiding refresh writes when payload content is unchanged. A v2 single-key snapshot format also cuts cold-read operations while keeping backward compatibility with existing KV keys.

**Summarised changes:**
- Moved KV snapshot reads out of the top of `fetch()` and into only routes that require cached posts (`/`, `/api/posts`, `/sitemap.xml`, `/post/:gid`, `/characters`, `/characters/:slug`).
- Added module-level in-memory snapshot caching with TTL and in-flight promise deduplication via `getCachedPostsSnapshot(env)`.
- Added a new v2 KV key (`deadlock-news-snapshot-v2`) storing `{ items, meta }` in one document; `readStoredNews` now attempts v2 first and falls back to legacy two-key reads.
- Added SHA-256 hashing for refreshed item payloads and changed refresh logic to skip KV writes when content hash is unchanged.
- Kept legacy keys written when content changes for compatibility while introducing the v2 snapshot write path.
- Updated cache headers: static assets and robots now cache publicly for longer, sitemap uses shorter public cache, and public HTML pages use short public cache.
- Kept `/admin/refresh` auth-first and uncached (`no-store`), and removed visitor IP from `/api/posts` response payload.
- Left Steam fetch parameters, parser/classifier behavior, static character list behavior, and scheduled daily cron trigger unchanged.

## Restore Missing KV Snapshot Module State to Prevent Worker 1101
**Date and time:** 2026-05-27 05:02 UTC

**Summarised context:**
Reviewed `worker.js` after the KV optimisation update and traced runtime references used by `getCachedPostsSnapshot()`, `readStoredNews()`, and `refreshStoredNews()` that could throw at module scope if missing.

**Summarised reasoning:**
The Worker 1101 exception was caused by missing top-level declarations for new snapshot key and memory-cache state introduced in the KV optimisation. Reinstating those constants and `let` bindings at module scope resolves runtime reference errors without altering route or SEO behavior.

**Summarised changes:**
- Added `NEWS_SNAPSHOT_V2_KEY` with value `'steam_news_snapshot_v2'` near existing Worker constants.
- Added `MEMORY_SNAPSHOT_TTL_MS` with value `5 * 60 * 1000` near existing Worker constants.
- Added module-level cache state variables: `memorySnapshot`, `memorySnapshotExpiresAt`, and `memorySnapshotPromise`.
- Re-checked `getCachedPostsSnapshot()`, `readStoredNews()`, and `refreshStoredNews()` for additional undefined identifiers and left logic unchanged.
- Left route handling, API behavior, and SEO page/rendering behavior intentionally unchanged.

## Add Global Floating Navigation Header and Wide Home Two-Column Desktop Layout
**Date and time:** 2026-05-27 04:47 UTC

**Summarised context:**
Reviewed current Worker server-rendered routes (`/`, `/characters`, `/characters/:slug`, `/post/:gid`), existing CSS layout constraints, and recent KV optimisation logic to ensure UX/layout changes would not reintroduce unnecessary KV reads.

**Summarised reasoning:**
The app needed crawlable, consistent top-level navigation and better desktop information density. A reusable server-rendered header helper with standard anchors satisfies crawlability/accessibility, while a wide feed-first homepage grid with stacked sidebar panels improves usability without changing API/KV behavior.

**Summarised changes:**
- Added reusable server-rendered floating header helper and integrated it across homepage, post pages, characters index/detail pages, and 404 character pages.
- Added primary nav links for Home, Characters, and Latest Patch (graceful fallback when no latest post exists).
- Reworked homepage HTML shell into a feed-dominant two-column layout with stacked right sidebar panels (intro + filters).
- Updated CSS to support sticky header styling, wrapping navigation on small screens, wider desktop layout usage, and right-edge sidebar alignment.
- Kept KV optimisation behavior intact (no static-route KV reads added, no global top-of-request snapshot read reintroduced).

## Worker Bundle and Runtime Usage Reduction via Asset Binding and Derived Snapshot Reuse
**Date and time:** 2026-05-27 06:10 UTC

**Summarised context:**
Reviewed user goals to reduce overall Worker usage, identified duplicated client asset embedding in `worker.js`, repeated character derivation work on character/post routes, repeated browser API fetch behavior in `app.js`, and redundant legacy KV writes during refresh.

**Summarised reasoning:**
Serving `app.js`/`styles.css` via an assets binding removes large embedded string constants from Worker source and shrinks script size. Reusing derived snapshot structures per route avoids repeated scans/lookups during a single request path. Stopping legacy-key writes reduces KV write operations while keeping v2 snapshot reads intact. Client-side freshness gating reduces routine browser-triggered `/api/posts` calls.

**Summarised changes:**
- Removed embedded static asset payload section from `worker.js` so Worker code no longer contains giant inlined client JS/CSS string constants.
- Switched `/app.js` and `/styles.css` handling to `env.ASSETS.fetch(request)` fallback route handling.
- Added `[assets]` binding in `wrangler.toml` with include list for `app.js` and `styles.css`.
- Added `buildDerivedSiteData(snapshot)` helper and reused it on character/post routes for shared latest-post/post-map/character-data derivation.
- Reduced refresh KV writes to only the v2 snapshot key path when changed; removed legacy items/meta writes.
- Updated `app.js` init flow with cache age revalidation guard to avoid automatic API calls when local cache is fresh.
- Left routes, SEO pages, character pages, static character list, sitemap/robots, cron refresh, and admin refresh endpoint behavior intentionally unchanged.

## Restore Missing Worker Runtime Constants and Precompute Character Alias Maps
**Date and time:** 2026-05-27 06:22 UTC

**Summarised context:**
Reviewed the reported Cloudflare Worker 1101 runtime error and re-inspected the latest `worker.js` changes from the bundle-reduction commit, with focus on top-level constants/state and character matching hot paths.

**Summarised reasoning:**
The previous edit removed embedded assets correctly but also inadvertently dropped required Worker constants/state (`APP_ID`, KV keys, memory snapshot vars), which can throw runtime `ReferenceError` and produce 1101 failures. Character matching also still performed repeated full-list scans in parsing/render helpers, so precomputed alias/slug maps were added to cut repeated per-request CPU.

**Summarised changes:**
- Restored missing top-level Worker constants and in-memory snapshot state variables required by fetch/refresh/storage flow.
- Added precomputed `CHARACTER_BY_SLUG` and `CHARACTER_ALIAS_TO_SLUG` maps.
- Updated `characterBySlug` to use the precomputed slug map first.
- Updated character data collection and post-related-character rendering to use alias map lookups instead of repeated `DEADLOCK_CHARACTERS.find(...)` scans.
- Left route structure, SEO endpoints, sitemap, cron refresh, admin refresh auth, and asset-binding strategy unchanged.

## Add Combined Steam + Forum Changelog Crawl with Reply Subpatch Support and Snapshot Dedupe
**Date and time:** 2026-05-28 00:20 UTC

**Summarised context:**
Reviewed the existing Worker ingestion path (`worker.js`) which only pulled Steam `ISteamNews/GetNewsForApp/v2`, existing single-key KV snapshot flow (`steam_news_snapshot_v2`), route-scoped snapshot loading/memory reuse, and client rendering in `app.js` to understand where multi-source data and source labeling needed to be integrated.

**Summarised reasoning:**
To capture forum-only micro-updates while keeping KV efficiency, the ingestion flow needed a bounded forum crawler, source-aware normalization, and deterministic dedupe merged into the existing single snapshot write path. Reply posts must remain as separate subpatch entries when meaningful even if thread post #1 duplicates Steam embed content.

**Summarised changes:**
- Added forum crawling helpers for index pages, thread URL extraction, thread fetch, post parsing, and forum-post normalization into source-typed items.
- Added caps and forum load protections (`MAX_FORUM_PAGES`, `MAX_FORUM_THREADS`, `MAX_FORUM_REPLIES_PER_THREAD`) plus thread URL dedupe and cache hints on forum fetches.
- Added canonicalization/hash helpers and merged dedupe flow that combines Steam + forum into one item list while preserving unique forum reply/subpatch posts.
- Updated refresh flow to build combined snapshot metadata (`steamCount`, `forumCount`, `dedupedCount`) and keep single v2 KV document writes only when hash changes.
- Updated source-aware UI wording for original links and source labels across server-rendered post detail and client list/detail views.
- Left route-scoped KV reads, memory snapshot TTL/in-flight dedupe behavior, and static-route no-KV-read behavior unchanged.

## Add Secret Path Refresh Endpoint with Per-IP Hourly Rate Limiting
**Date and time:** 2026-05-28 00:34 UTC

**Summarised context:**
Reviewed the latest request for a direct path-based refresh trigger and inspected current refresh routes in `worker.js` (`/admin/refresh`) plus existing KV usage constraints to ensure security and abuse protections could be added without affecting normal visitor routes.

**Summarised reasoning:**
A secret-in-path refresh route enables simple manual recrawl triggering from a browser, but needs defense-in-depth. Constant-time secret comparison and a per-IP fixed-window limiter (10 attempts/hour) reduce brute-force and abuse risk while preserving the single-snapshot refresh architecture.

**Summarised changes:**
- Added configurable path refresh secret support via `REFRESH_PATH_SECRET` and new route pattern `/refresh/{secret}`.
- Added helper utilities for client IP extraction, constant-time-like secret comparison, and per-IP hourly limit checks backed by KV TTL counters.
- Enforced limit of 10 refresh attempts per IP per hour with HTTP `429` + `retry-after` when exceeded.
- Kept refresh behavior on success routed through existing `refreshStoredNews` single-snapshot pipeline (no per-thread/per-post KV writes added).
- Left existing `/admin/refresh` bearer-token route and scheduled refresh behavior unchanged.
