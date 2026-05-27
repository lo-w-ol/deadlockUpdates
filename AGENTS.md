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
