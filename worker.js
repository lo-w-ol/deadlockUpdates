export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return new Response('ok', { status: 200 });
    }

    return new Response(buildHtml(), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store'
      }
    });
  }
};

function buildHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Deadlock News Browser (Client-side Steam Parser)</title>
  <meta name="description" content="Browse Deadlock Steam announcements with in-browser parsing, filters, and shareable post routes." />
  <link rel="canonical" href="/" />
  <meta name="robots" content="index,follow" />
  <style>
    :root { color-scheme: dark; --bg:#0b1020; --card:#121a31; --muted:#98a2b3; --text:#e5e7eb; --accent:#60a5fa; --good:#22c55e; --bad:#ef4444; --warn:#f59e0b; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:linear-gradient(180deg,#0b1020,#0f172a); color:var(--text); }
    a { color: var(--accent); }
    header { padding: 1rem; border-bottom:1px solid #223; position:sticky; top:0; backdrop-filter: blur(8px); background:#0b1020cc; z-index:10; }
    main { max-width: 1100px; margin: 0 auto; padding: 1rem; }
    .grid { display:grid; grid-template-columns: 320px 1fr; gap:1rem; }
    .panel, .card { background:var(--card); border:1px solid #223; border-radius:12px; padding:1rem; }
    .list { display:grid; gap:.75rem; }
    .row { display:flex; gap:.5rem; flex-wrap:wrap; align-items:center; }
    input, select, button { background:#0f1730; color:var(--text); border:1px solid #2a375f; border-radius:8px; padding:.5rem .6rem; }
    button { cursor:pointer; }
    .muted { color:var(--muted); font-size:.9rem; }
    .chips { display:flex; gap:.35rem; flex-wrap:wrap; }
    .chip { padding:.2rem .45rem; border-radius:999px; border:1px solid #345; font-size:.75rem; color:#cde; }
    .card h3 { margin:.2rem 0 .35rem 0; }
    .hidden { display:none; }
    .change { border-top:1px dashed #334; padding:.5rem 0; }
    .diff-list { margin-top:.65rem; border:1px solid #2a375f; border-radius:10px; overflow:hidden; }
    .diff-line { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; padding:.4rem .55rem; border-top:1px solid #25304f; white-space:pre-wrap; }
    .diff-line:first-child { border-top:none; }
    .diff-buff { background:#0e2a1b; color:#86efac; }
    .diff-nerf { background:#331313; color:#fca5a5; }
    .diff-change { background:#3a2b10; color:#fde68a; }
    .diff-other { background:#17213d; color:#cbd5e1; }
    .tag-buff { border-color:#14532d; color:#86efac; }
    .tag-nerf { border-color:#7f1d1d; color:#fca5a5; }
    .tag-fix,.tag-qol,.tag-mechanics { border-color:#4b5563; color:#d1d5db; }
    @media (max-width: 900px){ .grid{ grid-template-columns:1fr; } header{ position:static; } }
  </style>
  <script type="application/ld+json" id="site-jsonld">{
    "@context":"https://schema.org",
    "@type":"WebSite",
    "name":"Deadlock News Browser",
    "description":"Client-side Steam announcement browser and parser for Deadlock.",
    "url":"/"
  }</script>
</head>
<body>
  <noscript>This app requires JavaScript. Deadlock Steam news is fetched directly from Steam in your browser.</noscript>
  <header>
    <h1>Deadlock News Browser</h1>
    <div class="muted">Steam app 1422450 • static Worker shell, browser-only fetch + parse</div>
    <div id="progress" class="muted">Initializing…</div>
  </header>
  <main>
    <div class="grid">
      <aside class="panel">
        <div class="row"><input id="search" placeholder="Search title/body/tags" style="width:100%" /></div>
        <div class="row"><label>Category</label><select id="category"></select></div>
        <div class="row"><label>Entity/Tag</label><select id="entity"></select></div>
        <div class="row"><label>Stat</label><select id="stat"></select></div>
        <div class="row"><label>Type</label><select id="type"></select></div>
        <div class="row"><button id="refresh">Refresh from Steam</button></div>
        <p id="cors-msg" class="muted hidden"></p>
      </aside>
      <section>
        <div id="home-view" class="list"></div>
        <article id="detail-view" class="panel hidden"></article>
      </section>
    </div>
  </main>

<script>
(function() {
  const APP_ID = 1422450;
  const CACHE_KEY = 'deadlock-news-parser-v1';
  const STEAM_URL = 'https://api.steampowered.com/ISteamNews/GetNewsForApp/v2/?appid=1422450&count=100&maxlength=0&format=json&feeds=steam_community_announcements';
  const state = { posts: [], filtered: [], lastUpdated: null, fetched: 0, processed: 0 };

  const el = {
    progress: document.getElementById('progress'), home: document.getElementById('home-view'), detail: document.getElementById('detail-view'),
    search: document.getElementById('search'), category: document.getElementById('category'), entity: document.getElementById('entity'), stat: document.getElementById('stat'), type: document.getElementById('type'),
    refresh: document.getElementById('refresh'), cors: document.getElementById('cors-msg')
  };

  const STAT_DICTIONARY = ['Cooldown','Damage','Bullet Damage','Weapon Damage','Spirit Damage','Spirit Scaling','Spirit Power','Bullet Resistance','Spirit Resistance','Melee Resist','Debuff Resist','Fire Rate','Duration','Radius','Range','Cast Range','Stun Duration','Slow','Lifesteal','Spirit Lifesteal','Health','Max Health','Bonus Health','Regen','Stamina','Move Speed','Sprint Speed','Barrier','Souls','Ammo','Bullet Velocity','Air Control','Gravity','Charges','Scaling'];

  function setProgress(text){ el.progress.textContent = text; }
  function saveCache(){ localStorage.setItem(CACHE_KEY, JSON.stringify({ posts: state.posts, lastUpdated: state.lastUpdated })); }
  function loadCache(){ try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; } }

  async function fetchSteamNews(){
    try {
      const res = await fetch(STEAM_URL, { mode:'cors' });
      if (!res.ok) throw new Error('Steam HTTP ' + res.status);
      const json = await res.json();
      return (json && json.appnews && json.appnews.newsitems) || [];
    } catch (err) {
      el.cors.classList.remove('hidden');
      el.cors.textContent = 'Direct browser access to Steam may be blocked by CORS/network policy. This static Worker intentionally has no proxy/API layer. Add a dedicated proxy/API if you need reliable cross-origin access.';
      console.warn('Steam fetch failed:', err);
      return null;
    }
  }

  function normalizeSteamContent(content){
    const txt = document.createElement('textarea'); txt.innerHTML = content || '';
    let s = txt.value;
    s = s.replace(/<\s*br\s*\/?\s*>/gi,'\n').replace(/<\/?p[^>]*>/gi,'\n').replace(/<\/?div[^>]*>/gi,'\n').replace(/<\/?li[^>]*>/gi,'\n- ');
    s = s.replace(/<[^>]+>/g,' ');
    s = s.replace(/\r/g,'').replace(/\n{3,}/g,'\n\n');
    return s.split('\n').map(function(x){ return x.trim(); }).filter(Boolean).join('\n');
  }

  function parseSectionsAndBullets(normalized){
    const lines = normalized.split('\n'); let currentCategory = 'General'; const out=[];
    for (const line of lines){
      const sec = line.match(/^\s*\[\s*([^\]]+?)\s*\]\s*$/);
      if (sec){ currentCategory = sec[1].trim(); continue; }
      const bullet = line.match(/^\s*[-•]\s+(.+)$/);
      if (bullet){ out.push({ category: currentCategory, text: bullet[1].trim() }); }
    }
    return out;
  }

  function detectStatTags(text){ const lower = text.toLowerCase(); return STAT_DICTIONARY.filter(function(s){ return lower.includes(s.toLowerCase()); }); }

  function detectEntity(category, text){
    let primaryEntity=null, secondaryEntity=null, entityType='unknown';
    const m = text.match(/^([^:]{2,60}):\s*(.+)$/);
    if (/heroes/i.test(category) && m){ primaryEntity=m[1].trim(); entityType='hero'; const rest=m[2]; secondaryEntity = detectSecondary(rest); return { primaryEntity, secondaryEntity, entityType }; }
    if (/items/i.test(category) && m){ primaryEntity=m[1].trim(); entityType='item'; return { primaryEntity, secondaryEntity, entityType }; }
    if (/soul urn/i.test(category)) entityType='objective';
    if (/street brawl/i.test(category)) entityType='mode';
    if (/general/i.test(category)) {
      const l=text.toLowerCase();
      if (/(guardian|shrine|walker|midboss)/.test(l)) entityType='objective'; else if (/(zipline|jump pad|ropes|map)/.test(l)) entityType='map'; else if (/(stamina|sprint|wall jump|bullet velocity)/.test(l)) entityType='system'; else entityType='system';
    }
    return { primaryEntity, secondaryEntity, entityType };
  }

  function detectSecondary(rest){
    const pre = rest.split(/\b(cooldown|damage|fixed|increased|reduced|decreased|changed|removed|added|now|no longer)\b/i)[0].trim();
    if (/^[A-Z][A-Za-z0-9'\- ]{2,40}$/.test(pre)) return pre;
    const fixed = rest.match(/^Fixed\s+([A-Z][A-Za-z0-9'\-]+)/i); if (fixed) return fixed[1];
    return null;
  }

  function extractStatChanges(text){
    const arr=[]; const patterns=[
      /(.*?)\s+(increased|reduced|decreased|changed)\s+from\s+([^\s].*?)\s+to\s+([^\s].*?)(?:$|[,.])/i,
      /([^\s]+)\s*->\s*([^\s]+)/i,
      /changed from\s+"([^"]+)"\s+to\s+"([^"]+)"/i,
      /now grants\s+([^\s].*?)\s+([A-Za-z ]+)/i,
      /no longer grants\s+([^\s].*?)\s+([A-Za-z ]+)/i,
      /(increased|reduced) by\s+([^\s].*?)(?:$|[,.])/i
    ];
    for (const p of patterns){ const m=text.match(p); if (!m) continue; if (p===patterns[0]) {arr.push({statName:m[1].trim()||'Unknown',oldValue:m[3].trim(),newValue:m[4].trim(),unit:guessUnit(m[4]),direction:dirFromVerb(m[2]),confidence:0.9});}
      else if (p===patterns[1]) {arr.push({statName:'Unknown',oldValue:m[1],newValue:m[2],unit:guessUnit(m[2]),direction:'changed',confidence:0.75});}
      else if (p===patterns[2]) {arr.push({statName:'Text',oldValue:m[1],newValue:m[2],unit:null,direction:'changed',confidence:0.8});}
      else if (p===patterns[3]) {arr.push({statName:m[2].trim(),oldValue:null,newValue:m[1].trim(),unit:guessUnit(m[1]),direction:'added',confidence:0.8});}
      else if (p===patterns[4]) {arr.push({statName:m[2].trim(),oldValue:m[1].trim(),newValue:null,unit:guessUnit(m[1]),direction:'removed',confidence:0.8});}
      else {arr.push({statName:'Unknown',oldValue:null,newValue:m[2].trim(),unit:guessUnit(m[2]),direction:m[1].toLowerCase()==='increased'?'increased':'decreased',confidence:0.65});}
    }
    return arr;
  }

  function guessUnit(v){ if (!v) return null; if (/%/.test(v)) return '%'; if (/s\b/i.test(v)) return 's'; if (/m\b/i.test(v)) return 'm'; return null; }
  function dirFromVerb(v){ v=v.toLowerCase(); if (v==='increased') return 'increased'; if (v==='reduced'||v==='decreased') return 'decreased'; if (v==='changed') return 'changed'; return 'unknown'; }

  function classifyChangeType(text){
    const l=text.toLowerCase();
    if (/\bfix(ed)?\b/.test(l)) return 'fix'; if (/\badded\b/.test(l)) return 'added'; if (/\bremoved\b|no longer/.test(l)) return 'removed'; if (/\bchanged from\b/.test(l)) return 'changed'; if (/\brework(ed)?\b|\bnow\b/.test(l)) return 'rework'; if (/(ui|visual|text|keybind|smoothing)/.test(l)) return 'qol'; if (/(objective|guardian|walker|midboss|soul urn|mechanic)/.test(l)) return 'mechanics';
    if (/(cooldown reduced|damage increased|health increased|resistance increased|radius increased|range increased|spirit scaling increased)/.test(l)) return 'buff';
    if (/(cooldown increased|damage reduced|health reduced|resistance reduced|radius reduced|range reduced|spirit scaling reduced)/.test(l)) return 'nerf';
    return 'unknown';
  }

  function parseChangeLine(category, text, idx){
    const statTags = detectStatTags(text); const entity = detectEntity(category, text); const statChanges = extractStatChanges(text); const changeType = classifyChangeType(text);
    const tags = [...new Set([entity.primaryEntity, entity.secondaryEntity, ...statTags].filter(Boolean))];
    let confidence = 0.5;
    if (entity.primaryEntity && changeType!=='unknown' && statChanges.some(function(x){ return x.oldValue && x.newValue; })) confidence=0.95;
    else if (entity.primaryEntity && changeType!=='unknown') confidence=0.85;
    else if (category) confidence=0.7;
    return { id: category + '-' + idx, raw:text, category, primaryEntity:entity.primaryEntity, secondaryEntity:entity.secondaryEntity, entityType:entity.entityType, tags, statTags, changeType, statChanges, confidence };
  }

  function parsePost(post){
    const normalized = normalizeSteamContent(post.contents || '');
    const bullets = parseSectionsAndBullets(normalized);
    var changes = bullets.map(function(b,i){ return parseChangeLine(b.category,b.text,i); });
    var categories = Array.from(new Set(changes.map(function(c){ return c.category; })));
    return { appid:APP_ID, gid:post.gid, title:post.title, url:post.url, date:new Date(post.date*1000).toISOString(), categories, changes, rawText: normalized };
  }

  function applyFilters(){
    const q = el.search.value.toLowerCase(); const c=el.category.value; const e=el.entity.value; const s=el.stat.value; const t=el.type.value;
    state.filtered = state.posts.filter(function(p){
      const blob=(p.title+' '+p.rawText+' '+p.changes.flatMap(function(x){ return x.tags; }).join(' ')).toLowerCase(); if (q && !blob.includes(q)) return false;
      if (c && !p.categories.includes(c)) return false;
      if (e && !p.changes.some(function(x){ return x.tags.includes(e); })) return false;
      if (s && !p.changes.some(function(x){ return x.statTags.includes(s); })) return false;
      if (t && !p.changes.some(function(x){ return x.changeType===t; })) return false;
      return true;
    });
    routeRender();
  }

  function renderHome(){
    el.detail.classList.add('hidden'); el.home.classList.remove('hidden');
    el.home.innerHTML = state.filtered.map(function(p){
      const tops = summaryTop(p);
      var preview = p.changes.slice(0,12).map(renderDiffLine).join('');
      return '<article class="card"><h3><a href="#/post/'+p.gid+'">'+escapeHtml(p.title)+'</a></h3><div class="muted">'+new Date(p.date).toLocaleString()+' • <a href="'+p.url+'" target="_blank" rel="noopener">Steam URL</a></div><div class="chips">'+p.categories.map(function(c){ return chip(c); }).join('')+'</div><p class="muted">Parsed changes: '+p.changes.length+'</p><p class="muted">Top: '+escapeHtml(tops)+'</p><div class="diff-list">'+preview+'</div></article>';
    }).join('') || '<div class="card">No posts match current filters.</div>';
  }

  function renderPostDetail(gid){
    const p = state.posts.find(function(x){ return x.gid===gid; }); if (!p){ location.hash='#/'; return; }
    el.home.classList.add('hidden'); el.detail.classList.remove('hidden');
    var byCat = p.changes.reduce(function(m,c){ if (!m[c.category]) m[c.category] = []; m[c.category].push(c); return m; },{});
    el.detail.innerHTML = '<h2>'+escapeHtml(p.title)+'</h2><p class="muted">'+new Date(p.date).toLocaleString()+' • <a href="'+p.url+'" target="_blank" rel="noopener">Open on Steam</a></p>'+
      '<button id="toggle-raw">Toggle raw text</button><pre id="raw" class="hidden">'+escapeHtml(p.rawText)+'</pre>'+
      Object.entries(byCat).map(function(entry){ var cat = entry[0], list = entry[1]; return '<section><h3>['+escapeHtml(cat)+']</h3>'+list.map(function(c){ return '<div class="change"><div>'+escapeHtml(c.raw)+'</div><div class="chips">'+c.tags.map(chip).join('')+chip(c.changeType,'tag-'+c.changeType)+'</div></div>'; }).join('')+'</section>'; }).join('');
    document.getElementById('toggle-raw').onclick = function(){ document.getElementById('raw').classList.toggle('hidden'); };
  }


  function renderDiffLine(change){
    const kind = diffKind(change.changeType);
    const prefix = kind==='buff' ? '+' : kind==='nerf' ? '-' : kind==='change' ? '~' : '•';
    const cls = kind==='buff' ? 'diff-buff' : kind==='nerf' ? 'diff-nerf' : kind==='change' ? 'diff-change' : 'diff-other';
    return '<div class="diff-line '+cls+'">'+prefix+' '+escapeHtml(change.raw)+'</div>';
  }

  function diffKind(type){
    if (type==='buff') return 'buff';
    if (type==='nerf') return 'nerf';
    if (['changed','rework','added','removed','mechanics','qol'].includes(type)) return 'change';
    return 'other';
  }

  function routeRender(){ const m=location.hash.match(/^#\/post\/(.+)$/); if (m) renderPostDetail(m[1]); else renderHome(); }
  function chip(t,cls=''){ return '<span class="chip '+cls+'">'+escapeHtml(t)+'</span>'; }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(c){ return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]); }); }
  function summaryTop(p){ var x=countMap(p.changes.flatMap(function(c){ return [c.primaryEntity].concat(c.statTags); }).filter(Boolean)); return Object.entries(x).sort(function(a,b){ return b[1]-a[1]; }).slice(0,4).map(function(kv){ return kv[0]+'('+kv[1]+')'; }).join(', ') || 'N/A'; }
  function countMap(arr){ var m={}; arr.forEach(function(x){ m[x]=(m[x]||0)+1; }); return m; }

  function populateFilterOptions(){
    const categories=[''].concat(Array.from(new Set(state.posts.flatMap(function(p){ return p.categories; }))));
    const entities=[''].concat(Array.from(new Set(state.posts.flatMap(function(p){ return p.changes.flatMap(function(c){ return c.tags; }); }).filter(Boolean)))).sort();
    const stats=[''].concat(Array.from(new Set(state.posts.flatMap(function(p){ return p.changes.flatMap(function(c){ return c.statTags; }); })))).sort();
    const types=['','buff','nerf','fix','added','removed','changed','rework','qol','mechanics','unknown'];
    fill(el.category,categories,'All categories'); fill(el.entity,entities,'All entities/tags'); fill(el.stat,stats,'All stats'); fill(el.type,types,'All change types');
  }
  function fill(select, values, label){ var keep=select.value; select.innerHTML = values.map(function(v){ return '<option value="'+v+'">'+(v||label)+'</option>'; }).join(''); select.value=keep; }

  function injectPostJsonLd(posts){
    const old=document.getElementById('posts-jsonld'); if(old) old.remove();
    const data = posts.slice(0,20).map(function(p){ return { '@context':'https://schema.org','@type':'NewsArticle', headline:p.title, datePublished:p.date, url:p.url, about:'Deadlock patch notes'}; });
    const s=document.createElement('script'); s.id='posts-jsonld'; s.type='application/ld+json'; s.textContent=JSON.stringify(data); document.head.appendChild(s);
  }

  function runParserTests(){
    const tests=[
      {cat:'Items',line:'Torment Pulse: Melee Resist increased from 15% to 18%',expect:{entityType:'item',primary:'Torment Pulse',stat:'Melee Resist',old:'15%',next:'18%',type:'buff'}},
      {cat:'Heroes',line:'Grey Talon: Rain of Arrows cooldown reduced from 30s to 22s',expect:{entityType:'hero',primary:'Grey Talon',secondary:'Rain of Arrows',stat:'Cooldown',old:'30s',next:'22s',type:'buff'}},
      {cat:'Heroes',line:'Graves: Fixed Deadheads becoming inactive if Graves dies while they are following her',expect:{primary:'Graves',secondary:'Deadheads',type:'fix'}},
      {cat:'General',line:'Base Guardian Bullet Resistance increased from 10% to 20%',expect:{entityType:'objective',stat:'Bullet Resistance',old:'10%',next:'20%'}}
    ];
    console.group('Deadlock parser debug tests');
    tests.forEach(function(t,i){ const r=parseChangeLine(t.cat,t.line,i); console.log(i+1, t.line, r); });
    console.groupEnd();
  }

  async function processPostsInChunks(items){
    state.fetched = items.length; state.processed=0; setProgress('Fetched '+state.fetched+' posts');
    const sorted = [].concat(items).sort(function(a,b){ return b.date-a.date; }); const parsed=[]; let i=0;
    return new Promise(function(resolve){
      function work(deadline){
        while (i<sorted.length && ((deadline && deadline.timeRemaining()>4) || !deadline)) {
          parsed.push(parsePost(sorted[i++])); state.processed=i; setProgress('Fetched '+state.fetched+' posts • Processed '+state.processed+' / '+state.fetched);
        }
        if (i<sorted.length) schedule(work); else resolve(parsed);
      }
      schedule(work);
    });
  }
  function schedule(fn){ if ('requestIdleCallback' in window) requestIdleCallback(fn); else setTimeout(function(){ fn(null); },0); }

  async function refreshFromSteam(){
    const items = await fetchSteamNews(); if (!items) return;
    state.posts = await processPostsInChunks(items); state.lastUpdated = new Date().toISOString();
    saveCache(); populateFilterOptions(); applyFilters(); injectPostJsonLd(state.posts);
    setProgress('Fetched '+state.fetched+' posts • Processed '+state.processed+' / '+state.fetched+' • Last updated '+new Date(state.lastUpdated).toLocaleString());
  }

  function init(){
    const cached = loadCache();
    if (cached && cached.posts && cached.posts.length){ state.posts = cached.posts; state.lastUpdated = cached.lastUpdated; state.filtered=state.posts; populateFilterOptions(); routeRender(); injectPostJsonLd(state.posts); setProgress('Loaded '+state.posts.length+' cached posts • Last updated '+new Date(state.lastUpdated).toLocaleString()); }
    else { setProgress('No cache found yet.'); }

    [el.search, el.category, el.entity, el.stat, el.type].forEach(function(node){ node.addEventListener('input', applyFilters); });
    el.refresh.addEventListener('click', refreshFromSteam);
    window.addEventListener('hashchange', routeRender);
    if (new URLSearchParams(location.search).get('debug') === '1') runParserTests();
    refreshFromSteam();
  }

  init();
})();
</script>
</body>
</html>`;
}
