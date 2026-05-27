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
