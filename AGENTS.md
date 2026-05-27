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
