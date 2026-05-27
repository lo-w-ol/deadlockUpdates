# deadlockUpdates

## Worker-side Steam API design

- The browser now calls `/api/posts` only; the Worker calls Steam directly with fixed query params and optional `STEAM_API_KEY` secret.
- Parsed source data is stored in Cloudflare KV (`DEADLOCK_KV`) and reused for client reads.
- A daily cron (`0 3 * * *`) refreshes the KV snapshot automatically.
- Manual refresh is restricted to `/admin/refresh` and requires `Authorization: Bearer <ADMIN_REFRESH_TOKEN>`.
- No public custom upstream URL or custom query passthrough is exposed, reducing abuse surface.

### Required secrets

```bash
wrangler secret put STEAM_API_KEY
wrangler secret put ADMIN_REFRESH_TOKEN
```

## SEO and indexing improvements

- Added crawl-friendly server-rendered HTML for the homepage and `/post/:gid` pages, including visible intro content and discoverable internal links to recent updates.
- Added crawl-friendly server-rendered character pages at `/character/:name/` that list all hero-specific patch lines found in cached posts.
- Added SEO metadata: improved titles/descriptions, canonical URLs, Open Graph tags, and Twitter card tags on home and post pages.
- Added `robots.txt` at `/robots.txt` allowing crawling and referencing the sitemap.
- Added sitemap generation at `/sitemap.xml` with absolute URLs for homepage, cached post pages, and generated character pages, including `lastmod` timestamps.
- Added basic JSON-LD (`WebSite` for homepage and `NewsArticle` for post pages).

### Current limitations / future improvements

- Post pages are generated from KV-cached Steam items; if a post has not been cached yet, it will not appear in the sitemap or resolve at `/post/:gid`.
- Richer social previews (images per post) are not included yet because upstream image metadata is inconsistent.
