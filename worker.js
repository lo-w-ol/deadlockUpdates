const SITE_NAME = 'Deadlock Updates Tracker';
// Intentionally static registry for canonical Deadlock character pages.
// This is the single source of truth for character SEO routes for now and can
// later be replaced by an API/source-driven registry without changing routes.
const DEADLOCK_CHARACTERS = [
  { name: "Abrams", slug: "abrams" }, { name: "Bebop", slug: "bebop" }, { name: "Calico", slug: "calico" },
  { name: "Dynamo", slug: "dynamo" }, { name: "Grey Talon", slug: "grey-talon" }, { name: "Haze", slug: "haze" },
  { name: "Infernus", slug: "infernus" }, { name: "Ivy", slug: "ivy" }, { name: "Kelvin", slug: "kelvin" },
  { name: "Lady Geist", slug: "lady-geist" }, { name: "Lash", slug: "lash" }, { name: "McGinnis", slug: "mcginnis" },
  { name: "Mirage", slug: "mirage" }, { name: "Mo & Krill", slug: "mo-and-krill", aliases: ["Mo and Krill", "Mo & Krill"] },
  { name: "Paradox", slug: "paradox" }, { name: "Pocket", slug: "pocket" }, { name: "Seven", slug: "seven" },
  { name: "Shiv", slug: "shiv" }, { name: "Vindicta", slug: "vindicta" }, { name: "Viscous", slug: "viscous" },
  { name: "Warden", slug: "warden" }, { name: "Wraith", slug: "wraith" }, { name: "Yamato", slug: "yamato" }
];

function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
function escapeXml(s) { return escapeHtml(s); }
function truncateText(s, max) { var t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1) + '…' : t; }
function absoluteUrl(base, path) { return new URL(path, base).toString(); }
function slugifyName(name) { return String(name || '').toLowerCase().trim().replace(/&/g, ' and ').replace(/['’`]/g, '').replace(/[^a-z0-9\s-]/g, ' ').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, ''); }
function normalizeName(name) { return String(name || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim(); }
function characterNameSet(character) { return [character.name].concat(character.aliases || []).map(normalizeName); }
function characterBySlug(slug) { var norm = slugifyName(slug); return DEADLOCK_CHARACTERS.find(function(c){ return c.slug === norm || slugifyName(c.name) === norm; }) || null; }
function parseHeroChangesFromPost(post) { var txt = String(post && post.contents || '').replace(/<\s*br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\[\*]/gi, '\n- ').replace(/\[\/?(?:p|list|b|i|u|h[1-6]|quote|code|url(?:=[^\]]+)?)\]/gi, '\n').replace(/\r/g, ''); var lines = txt.split('\n'); var category = 'General'; var out = []; var i; for (i = 0; i < lines.length; i++) { var line = lines[i].replace(/\s+/g, ' ').trim(); if (!line) continue; var sec = line.match(/^\[\s*([^\]]+?)\s*\]$/); if (sec) { category = sec[1].trim(); continue; } var cleaned = line.replace(/^\s*(?:[-•*])\s+/, '').trim(); var m = cleaned.match(/^([^:]{2,60}):\s*(.+)$/); if (/heroes?/i.test(category) && m) { out.push({ category: category, primaryEntity: m[1].trim(), raw: m[2].trim() || cleaned }); } } return out; }
function semanticClass(type) { return ({ buff:'change-buff', nerf:'change-nerf', mixed:'change-mixed', rework:'change-rework', bugfix:'change-bugfix', neutral:'change-neutral' }[type] || 'change-neutral'); }

async function fetchSteamFromOrigin(env) { const steamUrl = new URL('https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/'); steamUrl.searchParams.set('appid', String(APP_ID)); steamUrl.searchParams.set('count', String(MAX_ITEMS)); steamUrl.searchParams.set('maxlength', '0'); steamUrl.searchParams.set('format', 'json'); steamUrl.searchParams.set('feeds', 'steam_community_announcements'); if (env.STEAM_API_KEY) steamUrl.searchParams.set('key', env.STEAM_API_KEY); const res = await fetch(steamUrl.toString(), { cf: { cacheTtl: 300, cacheEverything: false } }); if (!res.ok) throw new Error('Steam upstream ' + res.status); const json = await res.json(); return (json && json.appnews && json.appnews.newsitems) || []; }
async function hashText(text) {
  var data = new TextEncoder().encode(String(text || ''));
  var digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(function(b){ return b.toString(16).padStart(2, '0'); }).join('');
}
function updateMemorySnapshot(snapshot) {
  memorySnapshot = snapshot;
  memorySnapshotExpiresAt = Date.now() + MEMORY_SNAPSHOT_TTL_MS;
}
async function getCachedPostsSnapshot(env) {
  var now = Date.now();
  if (memorySnapshot && now < memorySnapshotExpiresAt) return memorySnapshot;
  if (memorySnapshotPromise) return memorySnapshotPromise;
  memorySnapshotPromise = readStoredNews(env).then(function(snapshot) { updateMemorySnapshot(snapshot); return snapshot; }).finally(function() { memorySnapshotPromise = null; });
  return memorySnapshotPromise;
}
async function refreshStoredNews(env, source) {
  const items = await fetchSteamFromOrigin(env);
  const now = new Date().toISOString();
  const itemsJson = JSON.stringify(items);
  const nextHash = await hashText(itemsJson);
  const existing = await readStoredNews(env);
  const existingHash = existing && existing.meta && existing.meta.hash ? existing.meta.hash : null;
  const meta = { lastRefreshedAt: now, source: source || 'manual', count: items.length, hash: nextHash };
  if (existingHash === nextHash) {
    const unchanged = { items: existing.items || items, meta: Object.assign({}, existing.meta || {}, meta), changed: false };
    updateMemorySnapshot(unchanged);
    return { items: unchanged.items, lastRefreshedAt: meta.lastRefreshedAt, source: meta.source, changed: false };
  }
  const snapshot = { items: items, meta: meta };
  await env.DEADLOCK_KV.put(NEWS_SNAPSHOT_V2_KEY, JSON.stringify(snapshot));
  updateMemorySnapshot(snapshot);
  return { items, lastRefreshedAt: now, source: source || 'manual', changed: true };
}
async function readStoredNews(env) {
  const rawSnapshot = await env.DEADLOCK_KV.get(NEWS_SNAPSHOT_V2_KEY);
  if (rawSnapshot) {
    try {
      const parsed = JSON.parse(rawSnapshot);
      return { items: Array.isArray(parsed.items) ? parsed.items : null, meta: parsed.meta || null };
    } catch (_) {}
  }
  const [rawItems, rawMeta] = await Promise.all([env.DEADLOCK_KV.get(NEWS_KEY), env.DEADLOCK_KV.get(NEWS_META_KEY)]);
  const items = rawItems ? JSON.parse(rawItems) : null;
  const meta = rawMeta ? JSON.parse(rawMeta) : null;
  return { items: items, meta: meta };
}

function buildRobots(origin) { return `User-agent: *\nAllow: /\nSitemap: ${absoluteUrl(origin, '/sitemap.xml')}\n`; }
function buildSitemap(origin, items, lastRefreshedAt) { const now = lastRefreshedAt || new Date().toISOString(); const urls = [{ loc: absoluteUrl(origin, '/'), lastmod: now }, { loc: absoluteUrl(origin, '/characters'), lastmod: now }]; DEADLOCK_CHARACTERS.forEach(function(c){ urls.push({ loc: absoluteUrl(origin, '/characters/' + c.slug), lastmod: now }); }); (items || []).slice(0, 100).forEach(function(item) { if (item && item.gid) urls.push({ loc: absoluteUrl(origin, '/post/' + encodeURIComponent(item.gid)), lastmod: item.date ? new Date(item.date * 1000).toISOString() : now }); }); return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(function(u){ return `  <url><loc>${escapeXml(u.loc)}</loc><lastmod>${escapeXml(u.lastmod)}</lastmod></url>`; }).join('\n')}\n</urlset>`; }
function collectCharacterData(items) { var map = {}; DEADLOCK_CHARACTERS.forEach(function(c){ map[c.slug] = { character: c, changes: [], latest: null, typeCounts: {}, statCounts: {} }; }); (items || []).forEach(function(post){ var heroChanges = parseHeroChangesFromPost(post); heroChanges.forEach(function(ch){ var matched = DEADLOCK_CHARACTERS.find(function(c){ return characterNameSet(c).indexOf(normalizeName(ch.primaryEntity)) !== -1; }); if (!matched) return; var bucket = map[matched.slug]; var entry = { gid: post.gid, title: post.title, url: post.url, date: post.date ? new Date(post.date * 1000).toISOString() : null, category: ch.category, raw: ch.raw, changeType: /fixed|issue/i.test(ch.raw) ? 'bugfix' : 'neutral', statTags: [] }; bucket.changes.push(entry); if (entry.date && (!bucket.latest || entry.date > bucket.latest)) bucket.latest = entry.date; bucket.typeCounts[entry.changeType] = (bucket.typeCounts[entry.changeType] || 0) + 1; }); }); return map; }


function buildDerivedSiteData(snapshot) {
  var items = (snapshot && snapshot.items) || [];
  var latestPost = items[0] || null;
  var postByGid = {};
  items.forEach(function(item){ if (item && item.gid) postByGid[String(item.gid)] = item; });
  var characterData = collectCharacterData(items);
  return { items: items, latestPost: latestPost, postByGid: postByGid, characterData: characterData, latestPostHref: latestPost && latestPost.gid ? '/post/' + encodeURIComponent(latestPost.gid) : '/' };
}

function renderFloatingHeader(origin, latestPost) {
  var latestHref = latestPost && latestPost.gid ? '/post/' + encodeURIComponent(latestPost.gid) : '/';
  var latestClass = latestPost && latestPost.gid ? '' : ' is-disabled';
  var latestLabel = latestPost && latestPost.gid ? 'Latest Patch' : 'Latest Patch (Unavailable)';
  return `<header class="site-header"><div class="site-header-inner"><a class="site-brand" href="/">${SITE_NAME}</a><nav aria-label="Primary navigation" class="primary-nav"><a href="/">Home</a><a href="/characters">Characters</a><a class="${latestClass.trim()}" href="${latestHref}"${latestPost && latestPost.gid ? '' : ' aria-disabled="true"'}>${latestLabel}</a></nav></div></header>`;
}
function buildHtml(origin, items, meta) {
  const canonical = absoluteUrl(origin, '/');
  const latestPost = (items || [])[0] || null;
  const list = (items || []).slice(0, 15).map(function(p){ const dt = p.date ? new Date(p.date * 1000).toISOString().slice(0, 10) : 'Recent'; return `<li><a href="/post/${encodeURIComponent(p.gid)}">${escapeHtml(p.title || 'Deadlock patch update')}</a> <span class="muted">(${dt})</span></li>`; }).join('');
  const jsonLd = { '@context':'https://schema.org', '@type':'WebSite', name:SITE_NAME, url:canonical, description:'Deadlock updates, patch notes, hero changes, item changes, buffs, nerfs, bug fixes, and balance changes from Steam news.' };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${SITE_NAME} | Deadlock Patch Notes & Steam News</title><meta name="description" content="Track Deadlock updates with searchable patch notes from Steam news, including hero changes, item changes, buffs, nerfs, bug fixes, and balance changes." /><link rel="canonical" href="${canonical}" /><meta name="robots" content="index,follow" /><meta property="og:type" content="website" /><meta property="og:site_name" content="${SITE_NAME}" /><meta property="og:title" content="${SITE_NAME} | Deadlock Patch Notes & Steam News" /><meta property="og:description" content="Follow Deadlock patch notes and balance updates from Steam news in one searchable tracker." /><meta property="og:url" content="${canonical}" /><meta name="twitter:card" content="summary" /><meta name="twitter:title" content="${SITE_NAME} | Deadlock Patch Notes & Steam News" /><meta name="twitter:description" content="Search Deadlock Steam patch notes for hero changes, item changes, buffs, nerfs, and bug fixes." /><link rel="stylesheet" href="/styles.css" /><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body>${renderFloatingHeader(origin, latestPost)}<main class="home-main"><div class="home-layout"><section class="feed-column"><section><h2>Parsed update feed</h2><div id="home-view" class="list"></div><article id="detail-view" class="panel hidden"></article></section></section><aside class="sidebar-column"><section class="panel intro"><h2>Latest Deadlock updates and patch notes</h2><p>This site tracks recent Deadlock Steam news and organizes patch notes by heroes, items, buffs, nerfs, bug fixes, and balance changes.</p><p><a href="/characters">Browse character patch history pages</a></p><nav aria-label="Recent update pages"><h3>Recent update pages</h3><ul class="crawl-list">${list || '<li>No recent updates cached yet. Use the refresh button below.</li>'}</ul></nav><p class="muted">Last server refresh: ${escapeHtml((meta && meta.lastRefreshedAt) || 'unknown')}.</p></section><aside class="panel"><h2>Filters</h2><div class="row"><label for="search">Search</label><input id="search" placeholder="Search title/body/tags" style="width:100%" /></div><div class="row"><label for="category">Category</label><select id="category"></select></div><div class="row"><label for="entity">Entity/Tag</label><select id="entity"></select></div><div class="row"><label for="stat">Stat</label><select id="stat"></select></div><div class="row"><label for="type">Type</label><select id="type"></select></div><div class="row"><button id="refresh" aria-label="Refresh cached patch notes">Refresh posts</button></div><p id="cors-msg" class="muted hidden"></p></aside></aside></div></main><footer class="muted" style="padding:1rem; text-align:center;">Source: Steam announcements. This fan-made tracker is not affiliated with Valve.</footer><noscript><p style="padding:1rem">JavaScript is disabled. You can still browse update pages from the list above.</p></noscript><script src="/app.js"></script></body></html>`;
}
function buildPostHtml(origin, post) {
  const path = '/post/' + encodeURIComponent(post.gid);
  const canonical = absoluteUrl(origin, path);
  const published = post.date ? new Date(post.date * 1000).toISOString() : new Date().toISOString();
  const plain = truncateText(String(post.contents || '').replace(/<[^>]+>/g, ' ').replace(/\[[^\]]+\]/g, ' '), 220);
  const jsonLd = { '@context':'https://schema.org', '@type':'NewsArticle', headline:post.title || 'Deadlock update', datePublished:published, dateModified:published, url:canonical, articleBody:plain, publisher:{ '@type':'Organization', name:SITE_NAME } };
  var related = Array.from(new Set(parseHeroChangesFromPost(post).map(function(c){ var m = DEADLOCK_CHARACTERS.find(function(ch){ return characterNameSet(ch).indexOf(normalizeName(c.primaryEntity)) !== -1; }); return m ? `<a href="/characters/${m.slug}">${escapeHtml(m.name)}</a>` : ''; }).filter(Boolean))).join(', ');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(post.title || 'Deadlock update')} | ${SITE_NAME}</title><meta name="description" content="${escapeHtml(plain || 'Deadlock patch notes update from Steam news.')}"/><link rel="canonical" href="${canonical}"/><meta name="robots" content="index,follow"/><meta property="og:type" content="article"/><meta property="og:site_name" content="${SITE_NAME}"/><meta property="og:title" content="${escapeHtml(post.title || 'Deadlock update')}"/><meta property="og:description" content="${escapeHtml(plain)}"/><meta property="og:url" content="${canonical}"/><meta name="twitter:card" content="summary"/><meta name="twitter:title" content="${escapeHtml(post.title || 'Deadlock update')}"/><meta name="twitter:description" content="${escapeHtml(plain)}"/><link rel="stylesheet" href="/styles.css"/><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body>${renderFloatingHeader(origin, post)}<main class="page-main" style="max-width: 900px;"><article class="panel"><h1>${escapeHtml(post.title || 'Deadlock update')}</h1><p class="muted">Published: ${escapeHtml(published)} • <a href="${escapeHtml(post.url || '#')}" target="_blank" rel="noopener">Original Steam post</a></p><p>${escapeHtml(plain)}</p>${related ? `<p class="muted">Related characters: ${related}</p>` : ''}<p><a href="/">Back to Deadlock updates homepage</a> • <a href="/characters">Browse all characters</a></p></article></main></body></html>`;
}
function buildCharactersIndexHtml(origin, map, meta, latestPost) { var canonical = absoluteUrl(origin, '/characters'); var cards = DEADLOCK_CHARACTERS.map(function(c){ var d = map[c.slug]; var topTypes = Object.entries(d.typeCounts).sort(function(a,b){ return b[1]-a[1]; }).slice(0,3).map(function(x){ return x[0]; }).join(', ') || 'None yet'; return `<article class="card"><h2><a href="/characters/${c.slug}">${escapeHtml(c.name)}</a></h2><p class="muted">Parsed changes: ${d.changes.length}</p><p class="muted">Latest patch: ${d.latest ? escapeHtml(d.latest.slice(0,10)) : 'No detected changes yet'}</p><p class="muted">Common types: ${escapeHtml(topTypes)}</p>${d.changes.length ? '' : '<p class="muted">No parsed patch changes found for this character yet.</p>'}</article>`; }).join(''); return `<!doctype html><html><head><meta charset="utf-8"/><title>Deadlock Characters Patch History</title><meta name="description" content="Browse Deadlock character patch-note history pages with buffs, nerfs, bug fixes, and change summaries."/><link rel="canonical" href="${canonical}"/><meta property="og:title" content="Deadlock Characters Patch History"/><meta property="og:description" content="Browse every tracked Deadlock character and open dedicated patch history pages."/><meta property="og:url" content="${canonical}"/><meta name="twitter:card" content="summary"/><link rel="stylesheet" href="/styles.css"/></head><body>${renderFloatingHeader(origin, latestPost)}<main class="page-main"><article class="panel"><h1>Deadlock Characters</h1><p><a href="/">Back to homepage</a></p><p class="muted">Last server refresh: ${escapeHtml((meta && meta.lastRefreshedAt) || 'unknown')}.</p></article><section class="list">${cards}</section></main></body></html>`; }
function buildCharacterDetailHtml(origin, character, data, latestPost) { var path = '/characters/' + character.slug; var canonical = absoluteUrl(origin, path); var title = `${character.name} Deadlock Changes & Patch History`; var desc = `Track ${character.name} changes in Deadlock patch notes, including buffs, nerfs, bug fixes, stat changes and update history.`; var grouped = {}; data.changes.sort(function(a,b){ return (b.date || '').localeCompare(a.date || ''); }).forEach(function(c){ var k = c.gid; if (!grouped[k]) grouped[k] = { title: c.title, date: c.date, url: c.url, lines: [] }; grouped[k].lines.push(c); }); var blocks = Object.entries(grouped).map(function(entry){ var g = entry[1]; var byCat={}; g.lines.forEach(function(l){ if (!byCat[l.category]) byCat[l.category]=[]; byCat[l.category].push(l); }); return `<article class="card"><h2>${escapeHtml(g.title || 'Patch update')}</h2><p class="muted">${escapeHtml((g.date || '').slice(0,10))} • <a href="/post/${encodeURIComponent(entry[0])}">Post page</a> • <a href="${escapeHtml(g.url || '#')}" target="_blank" rel="noopener">Steam URL</a></p>${Object.entries(byCat).map(function(b){ return `<section class="patch-category"><h3>[${escapeHtml(b[0])}]</h3><div class="diff-list">${b[1].map(function(line){ return `<div class="diff-line ${semanticClass(line.changeType)}">• ${escapeHtml(line.raw)} <span class="muted">(${escapeHtml(line.changeType)})</span></div>`; }).join('')}</div></section>`; }).join('')}</article>`; }).join(''); var itemList = Object.entries(grouped).slice(0,20).map(function(e, i){ return { '@type':'ListItem', position:i+1, name:e[1].title || 'Patch update', url:absoluteUrl(origin, '/post/' + encodeURIComponent(e[0])) }; }); var ld = { '@context':'https://schema.org', '@type':'CollectionPage', name:title, description:desc, url:canonical, mainEntity:{ '@type':'ItemList', itemListElement:itemList } }; return `<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(desc)}"/><link rel="canonical" href="${canonical}"/><meta property="og:title" content="${escapeHtml(title)}"/><meta property="og:description" content="${escapeHtml(desc)}"/><meta property="og:url" content="${canonical}"/><meta name="twitter:card" content="summary"/><meta name="twitter:title" content="${escapeHtml(title)}"/><meta name="twitter:description" content="${escapeHtml(desc)}"/><link rel="stylesheet" href="/styles.css"/><script type="application/ld+json">${JSON.stringify(ld)}</script></head><body>${renderFloatingHeader(origin, latestPost)}<main class="page-main"><article class="panel"><h1>${escapeHtml(character.name)} patch history</h1><p><a href="/characters">All characters</a> • <a href="/">Homepage</a></p></article>${data.changes.length ? blocks : '<article class="card"><p>No parsed patch changes found for this character yet.</p><p class="muted">If cache is empty, this page will populate after the next refresh.</p></article>'}</main></body></html>`; }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok', { status: 200 });
    if (url.pathname === '/robots.txt') return new Response(buildRobots(url.origin), { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600, s-maxage=86400' } });
    if (url.pathname === '/app.js' || url.pathname === '/styles.css') {
      if (env.ASSETS && env.ASSETS.fetch) return env.ASSETS.fetch(request);
      return new Response('asset not found', { status: 404 });
    }
    if (url.pathname === '/sitemap.xml') {
      const cache = await getCachedPostsSnapshot(env);
      return new Response(buildSitemap(url.origin, cache.items, cache.meta && cache.meta.lastRefreshedAt), { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=900, s-maxage=3600' } });
    }
    if (url.pathname === '/api/posts') {
      const cache = await getCachedPostsSnapshot(env);
      if (cache.items && cache.items.length) return Response.json({ items: cache.items, source: 'kv-cache', lastRefreshedAt: cache.meta && cache.meta.lastRefreshedAt }, { headers: { 'cache-control': 'public, max-age=300, stale-while-revalidate=900' } });
      const refreshed = await refreshStoredNews(env, 'lazy-first-request');
      return Response.json({ items: refreshed.items, source: refreshed.source, lastRefreshedAt: refreshed.lastRefreshedAt }, { headers: { 'cache-control': 'public, max-age=300, stale-while-revalidate=900' } });
    }
    if (url.pathname === '/characters') {
      const cache = await getCachedPostsSnapshot(env);
      const derived = buildDerivedSiteData(cache);
      return new Response(buildCharactersIndexHtml(url.origin, derived.characterData, cache.meta, derived.latestPost), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=900' } });
    }
    if (url.pathname.startsWith('/hero/')) {
      return Response.redirect(absoluteUrl(url.origin, '/characters/' + url.pathname.slice('/hero/'.length)), 301);
    }
    if (url.pathname.startsWith('/characters/')) {
      const slug = decodeURIComponent(url.pathname.slice('/characters/'.length));
      const character = characterBySlug(slug);
      const cache = await getCachedPostsSnapshot(env);
      const derived = buildDerivedSiteData(cache);
      const latest = derived.latestPost;
      if (!character) return new Response(`<!doctype html><html><body>${renderFloatingHeader(url.origin, latest)}<main class="page-main"><h1>Character not found</h1><p><a href="/characters">Browse all characters</a></p></main></body></html>`, { status: 404, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=900' } });
      return new Response(buildCharacterDetailHtml(url.origin, character, derived.characterData[character.slug], latest), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=900' } });
    }
    if (url.pathname.startsWith('/post/')) {
      const gid = decodeURIComponent(url.pathname.slice('/post/'.length));
      const cache = await getCachedPostsSnapshot(env);
      const derived = buildDerivedSiteData(cache);
      const post = derived.postByGid[gid] || null;
      if (!post) return new Response('Post not found', { status: 404, headers: { 'cache-control': 'public, max-age=300, s-maxage=900' } });
      return new Response(buildPostHtml(url.origin, post), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=900' } });
    }
    if (url.pathname === '/admin/refresh') {
      const auth = request.headers.get('authorization') || '';
      const expected = env.ADMIN_REFRESH_TOKEN ? 'Bearer ' + env.ADMIN_REFRESH_TOKEN : '';
      if (!expected || auth !== expected) return new Response('unauthorized', { status: 401, headers: { 'cache-control': 'no-store' } });
      const refreshed = await refreshStoredNews(env, 'admin-refresh');
      return Response.json({ ok: true, count: refreshed.items.length, lastRefreshedAt: refreshed.lastRefreshedAt, changed: refreshed.changed }, { headers: { 'cache-control': 'no-store' } });
    }
    const cache = await getCachedPostsSnapshot(env);
    return new Response(buildHtml(url.origin, cache.items, cache.meta), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=900' } });
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(refreshStoredNews(env, 'scheduled-daily')); }
};
