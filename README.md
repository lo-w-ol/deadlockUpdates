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
