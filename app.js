(function() {
  var APP_ID = 1422450;
  var CACHE_KEY = 'deadlock-news-parser-v1';
  var API_POSTS_URL = '/api/posts';
  var state = { posts: [], filtered: [], lastUpdated: null, fetched: 0, processed: 0 };

  var LOG_VERSION = '2026-05-27a';
  var LOG_PREFIX = '[DeadlockInit]';
  var sessionId = String(Date.now()) + '-' + Math.random().toString(16).slice(2, 8);
  var trace = [];

  function log(stage, data) {
    var entry = { t: new Date().toISOString(), session: sessionId, stage: stage, data: data || null };
    trace.push(entry);
    if (trace.length > 200) trace.shift();
    console.log(LOG_PREFIX, entry);
  }

  window.__deadlockDebug = {
    version: LOG_VERSION,
    sessionId: sessionId,
    getTrace: function() { return trace.slice(); },
    dump: function() { console.log(LOG_PREFIX, 'TRACE_DUMP', trace); return trace.slice(); }
  };

  window.addEventListener('error', function(ev) {
    log('window.error', { message: ev.message, source: ev.filename, line: ev.lineno, col: ev.colno });
  });
  window.addEventListener('unhandledrejection', function(ev) {
    var reason = ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason);
    log('window.unhandledrejection', { reason: reason });
  });

  log('bootstrap.start', { href: location.href, version: LOG_VERSION });

  var el = {
    progress: document.getElementById('progress'), home: document.getElementById('home-view'), detail: document.getElementById('detail-view'),
    search: document.getElementById('search'), category: document.getElementById('category'), entity: document.getElementById('entity'), stat: document.getElementById('stat'), type: document.getElementById('type'),
    refresh: document.getElementById('refresh'), cors: document.getElementById('cors-msg')
  };
  log('bootstrap.dom_refs', { hasProgress: !!el.progress, hasHome: !!el.home, hasDetail: !!el.detail, hasRefresh: !!el.refresh });

  var STAT_DICTIONARY = ['Cooldown','Damage','Bullet Damage','Weapon Damage','Spirit Damage','Spirit Scaling','Spirit Power','Bullet Resistance','Spirit Resistance','Melee Resist','Debuff Resist','Fire Rate','Duration','Radius','Range','Cast Range','Stun Duration','Slow','Lifesteal','Spirit Lifesteal','Health','Max Health','Bonus Health','Regen','Stamina','Move Speed','Sprint Speed','Barrier','Souls','Ammo','Bullet Velocity','Air Control','Gravity','Charges','Scaling'];

  function setProgress(text){ if (el.progress) el.progress.textContent = text; log('ui.progress', { text: text }); }
  function saveCache(){ localStorage.setItem(CACHE_KEY, JSON.stringify({ posts: state.posts, lastUpdated: state.lastUpdated })); log('cache.save', { postCount: state.posts.length, lastUpdated: state.lastUpdated }); }
  function loadCache(){ try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { log('cache.load_error', { message: e.message }); return null; } }

  async function fetchSteamNews(){
    log('steam.fetch_start', { url: API_POSTS_URL });
    try {
      var res = await fetch(API_POSTS_URL, { headers: { 'accept': 'application/json' } });
      log('steam.fetch_response', { ok: res.ok, status: res.status });
      if (!res.ok) throw new Error('API HTTP ' + res.status);
      var json = await res.json();
      var items = (json && json.items) || [];
      var source = (json && json.source) || 'unknown';
      log('steam.fetch_success', { count: items.length, source: source });
      if (el.cors) {
        el.cors.classList.remove('hidden');
        el.cors.textContent = 'Data source: ' + source + '. Last server refresh: ' + ((json && json.lastRefreshedAt) || 'unknown') + '.';
      }
      return items;
    } catch (err) {
      if (el.cors) {
        el.cors.classList.remove('hidden');
        el.cors.textContent = 'Server API fetch failed. Try again shortly.';
      }
      log('steam.fetch_error', { message: err.message, stack: err.stack ? String(err.stack).slice(0, 300) : null });
      return null;
    }
  }


  function normalizeSteamContent(content){ var txt = document.createElement('textarea'); txt.innerHTML = content || ''; var s = txt.value; s = s.replace(/<\s*br\s*\/?\s*>/gi,'\n').replace(/<\/?p[^>]*>/gi,'\n').replace(/<\/?div[^>]*>/gi,'\n').replace(/<\/?li[^>]*>/gi,'\n- '); s = s.replace(/<[^>]+>/g,' '); s = s.replace(/\r/g,'').replace(/\n{3,}/g,'\n\n'); return s.split('\n').map(function(x){ return x.trim(); }).filter(Boolean).join('\n'); }
  function parseSectionsAndBullets(normalized){ var lines = normalized.split('\n'); var currentCategory = 'General'; var out=[]; for (var i = 0; i < lines.length; i++) { var line = lines[i]; var sec = line.match(/^\s*\[\s*([^\]]+?)\s*\]\s*$/); if (sec){ currentCategory = sec[1].trim(); continue; } var bullet = line.match(/^\s*[-•]\s+(.+)$/); if (bullet){ out.push({ category: currentCategory, text: bullet[1].trim() }); } } return out; }
  function detectStatTags(text){ var lower = text.toLowerCase(); return STAT_DICTIONARY.filter(function(s){ return lower.includes(s.toLowerCase()); }); }
  function detectEntity(category, text){ var primaryEntity=null, secondaryEntity=null, entityType='unknown'; var m = text.match(/^([^:]{2,60}):\s*(.+)$/); if (/heroes/i.test(category) && m){ primaryEntity=m[1].trim(); entityType='hero'; secondaryEntity = detectSecondary(m[2]); return { primaryEntity: primaryEntity, secondaryEntity: secondaryEntity, entityType: entityType }; } if (/items/i.test(category) && m){ primaryEntity=m[1].trim(); entityType='item'; return { primaryEntity: primaryEntity, secondaryEntity: secondaryEntity, entityType: entityType }; } if (/soul urn/i.test(category)) entityType='objective'; if (/street brawl/i.test(category)) entityType='mode'; if (/general/i.test(category)) { var l=text.toLowerCase(); if (/(guardian|shrine|walker|midboss)/.test(l)) entityType='objective'; else if (/(zipline|jump pad|ropes|map)/.test(l)) entityType='map'; else entityType='system'; } return { primaryEntity: primaryEntity, secondaryEntity: secondaryEntity, entityType: entityType }; }
  function detectSecondary(rest){ var pre = rest.split(/\b(cooldown|damage|fixed|increased|reduced|decreased|changed|removed|added|now|no longer)\b/i)[0].trim(); if (/^[A-Z][A-Za-z0-9'\- ]{2,40}$/.test(pre)) return pre; var fixed = rest.match(/^Fixed\s+([A-Z][A-Za-z0-9'\-]+)/i); if (fixed) return fixed[1]; return null; }
  function extractStatChanges(text){ var arr=[]; var patterns=[/(.*?)\s+(increased|reduced|decreased|changed)\s+from\s+([^\s].*?)\s+to\s+([^\s].*?)(?:$|[,.])/i,/([^\s]+)\s*->\s*([^\s]+)/i,/changed from\s+"([^"]+)"\s+to\s+"([^"]+)"/i,/now grants\s+([^\s].*?)\s+([A-Za-z ]+)/i,/no longer grants\s+([^\s].*?)\s+([A-Za-z ]+)/i,/(increased|reduced) by\s+([^\s].*?)(?:$|[,.])/i]; for (var pIdx = 0; pIdx < patterns.length; pIdx++) { var p = patterns[pIdx], m=text.match(p); if (!m) continue; if (pIdx===0) arr.push({statName:m[1].trim()||'Unknown',oldValue:m[3].trim(),newValue:m[4].trim(),unit:guessUnit(m[4]),direction:dirFromVerb(m[2]),confidence:0.9}); else if (pIdx===1) arr.push({statName:'Unknown',oldValue:m[1],newValue:m[2],unit:guessUnit(m[2]),direction:'changed',confidence:0.75}); else if (pIdx===2) arr.push({statName:'Text',oldValue:m[1],newValue:m[2],unit:null,direction:'changed',confidence:0.8}); else if (pIdx===3) arr.push({statName:m[2].trim(),oldValue:null,newValue:m[1].trim(),unit:guessUnit(m[1]),direction:'added',confidence:0.8}); else if (pIdx===4) arr.push({statName:m[2].trim(),oldValue:m[1].trim(),newValue:null,unit:guessUnit(m[1]),direction:'removed',confidence:0.8}); else arr.push({statName:'Unknown',oldValue:null,newValue:m[2].trim(),unit:guessUnit(m[2]),direction:m[1].toLowerCase()==='increased'?'increased':'decreased',confidence:0.65}); } return arr; }
  function guessUnit(v){ if (!v) return null; if (/%/.test(v)) return '%'; if (/s\b/i.test(v)) return 's'; if (/m\b/i.test(v)) return 'm'; return null; }
  function dirFromVerb(v){ v=v.toLowerCase(); if (v==='increased') return 'increased'; if (v==='reduced'||v==='decreased') return 'decreased'; if (v==='changed') return 'changed'; return 'unknown'; }
  function classifyChangeType(text){ var l=text.toLowerCase(); if (/\bfix(ed)?\b/.test(l)) return 'fix'; if (/\badded\b/.test(l)) return 'added'; if (/\bremoved\b|no longer/.test(l)) return 'removed'; if (/\bchanged from\b/.test(l)) return 'changed'; if (/\brework(ed)?\b|\bnow\b/.test(l)) return 'rework'; if (/(ui|visual|text|keybind|smoothing)/.test(l)) return 'qol'; if (/(objective|guardian|walker|midboss|soul urn|mechanic)/.test(l)) return 'mechanics'; if (/(cooldown reduced|damage increased|health increased|resistance increased|radius increased|range increased|spirit scaling increased)/.test(l)) return 'buff'; if (/(cooldown increased|damage reduced|health reduced|resistance reduced|radius reduced|range reduced|spirit scaling reduced)/.test(l)) return 'nerf'; return 'unknown'; }
  function parseChangeLine(category, text, idx){ var statTags = detectStatTags(text); var entity = detectEntity(category, text); var statChanges = extractStatChanges(text); var changeType = classifyChangeType(text); var tags = [entity.primaryEntity, entity.secondaryEntity].concat(statTags).filter(Boolean); var seen = {}; tags = tags.filter(function(x){ if (seen[x]) return false; seen[x]=1; return true; }); var confidence = 0.5; if (entity.primaryEntity && changeType!=='unknown' && statChanges.some(function(x){ return x.oldValue && x.newValue; })) confidence=0.95; else if (entity.primaryEntity && changeType!=='unknown') confidence=0.85; else if (category) confidence=0.7; return { id: category + '-' + idx, raw:text, category:category, primaryEntity:entity.primaryEntity, secondaryEntity:entity.secondaryEntity, entityType:entity.entityType, tags:tags, statTags:statTags, changeType:changeType, statChanges:statChanges, confidence:confidence }; }
  function parsePost(post){ var normalized = normalizeSteamContent(post.contents || ''); var bullets = parseSectionsAndBullets(normalized); var changes = bullets.map(function(b,i){ return parseChangeLine(b.category,b.text,i); }); var categories = Array.from(new Set(changes.map(function(c){ return c.category; }))); return { appid:APP_ID, gid:post.gid, title:post.title, url:post.url, date:new Date(post.date*1000).toISOString(), categories:categories, changes:changes, rawText: normalized }; }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(c){ return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]); }); }
  function chip(t,cls){ return '<span class="chip '+(cls || '')+'">'+escapeHtml(t)+'</span>'; }
  function countMap(arr){ var m={}; arr.forEach(function(x){ m[x]=(m[x]||0)+1; }); return m; }
  function summaryTop(p){ var x=countMap(p.changes.flatMap(function(c){ return [c.primaryEntity].concat(c.statTags); }).filter(Boolean)); return Object.entries(x).sort(function(a,b){ return b[1]-a[1]; }).slice(0,4).map(function(kv){ return kv[0]+'('+kv[1]+')'; }).join(', ') || 'N/A'; }
  function diffKind(type){ if (type==='buff') return 'buff'; if (type==='nerf') return 'nerf'; if (['changed','rework','added','removed','mechanics','qol'].includes(type)) return 'change'; return 'other'; }
  function renderDiffLine(change){ var kind = diffKind(change.changeType); var prefix = kind==='buff' ? '+' : kind==='nerf' ? '-' : kind==='change' ? '~' : '•'; var cls = kind==='buff' ? 'diff-buff' : kind==='nerf' ? 'diff-nerf' : kind==='change' ? 'diff-change' : 'diff-other'; return '<div class="diff-line '+cls+'">'+prefix+' '+escapeHtml(change.raw)+'</div>'; }

  function renderPatchCategories(p){
    var byCat = p.changes.reduce(function(m,c){ if (!m[c.category]) m[c.category] = []; m[c.category].push(c); return m; }, {});
    return Object.entries(byCat).map(function(entry){
      var cat = entry[0], list = entry[1];
      return '<section class="patch-category"><h4>['+escapeHtml(cat)+']</h4><div class="diff-list">'+list.map(renderDiffLine).join('')+'</div></section>';
    }).join('');
  }

  function renderHome(){
    el.detail.classList.add('hidden');
    el.home.classList.remove('hidden');
    el.home.innerHTML = state.filtered.map(function(p, idx){
      var tops = summaryTop(p);
      var divider = idx < state.filtered.length - 1 ? '<div class="patch-divider" aria-hidden="true"></div>' : '';
      return '<article class="card"><h3><a href="#/post/'+p.gid+'">'+escapeHtml(p.title)+'</a></h3><div class="muted">'+new Date(p.date).toLocaleString()+' • <a href="'+p.url+'" target="_blank" rel="noopener">Steam URL</a></div><div class="chips">'+p.categories.map(function(c){ return chip(c); }).join('')+'</div><p class="muted">Parsed changes: '+p.changes.length+'</p><p class="muted">Top: '+escapeHtml(tops)+'</p>'+renderPatchCategories(p)+'</article>'+divider;
    }).join('') || '<div class="card">No posts match current filters.</div>';
  }
  function renderPostDetail(gid){ var p = state.posts.find(function(x){ return x.gid===gid; }); if (!p){ location.hash='#/'; return; } el.home.classList.add('hidden'); el.detail.classList.remove('hidden'); var byCat = p.changes.reduce(function(m,c){ if (!m[c.category]) m[c.category] = []; m[c.category].push(c); return m; },{}); el.detail.innerHTML = '<h2>'+escapeHtml(p.title)+'</h2><p class="muted">'+new Date(p.date).toLocaleString()+' • <a href="'+p.url+'" target="_blank" rel="noopener">Open on Steam</a></p>'+'<button id="toggle-raw">Toggle raw text</button><pre id="raw" class="hidden">'+escapeHtml(p.rawText)+'</pre>'+Object.entries(byCat).map(function(entry){ var cat = entry[0], list = entry[1]; return '<section><h3>['+escapeHtml(cat)+']</h3>'+list.map(function(c){ return '<div class="change"><div>'+escapeHtml(c.raw)+'</div><div class="chips">'+c.tags.map(chip).join('')+chip(c.changeType,'tag-'+c.changeType)+'</div></div>'; }).join('')+'</section>'; }).join(''); document.getElementById('toggle-raw').onclick = function(){ document.getElementById('raw').classList.toggle('hidden'); }; }

  function routeRender(){ var m=location.hash.match(/^#\/post\/(.+)$/); if (m) renderPostDetail(m[1]); else renderHome(); }
  function applyFilters(){ var q = el.search.value.toLowerCase(), c=el.category.value, e=el.entity.value, s=el.stat.value, t=el.type.value; state.filtered = state.posts.filter(function(p){ var blob=(p.title+' '+p.rawText+' '+p.changes.flatMap(function(x){ return x.tags; }).join(' ')).toLowerCase(); if (q && !blob.includes(q)) return false; if (c && !p.categories.includes(c)) return false; if (e && !p.changes.some(function(x){ return x.tags.includes(e); })) return false; if (s && !p.changes.some(function(x){ return x.statTags.includes(s); })) return false; if (t && !p.changes.some(function(x){ return x.changeType===t; })) return false; return true; }); log('filters.applied', { query: q, filtered: state.filtered.length, total: state.posts.length }); routeRender(); }
  function fill(select, values, label){ var keep=select.value; select.innerHTML = values.map(function(v){ return '<option value="'+v+'">'+(v||label)+'</option>'; }).join(''); select.value=keep; }
  function populateFilterOptions(){ var categories=[''].concat(Array.from(new Set(state.posts.flatMap(function(p){ return p.categories; })))); var entities=[''].concat(Array.from(new Set(state.posts.flatMap(function(p){ return p.changes.flatMap(function(c){ return c.tags; }); }).filter(Boolean)))).sort(); var stats=[''].concat(Array.from(new Set(state.posts.flatMap(function(p){ return p.changes.flatMap(function(c){ return c.statTags; }); })))).sort(); var types=['','buff','nerf','fix','added','removed','changed','rework','qol','mechanics','unknown']; fill(el.category,categories,'All categories'); fill(el.entity,entities,'All entities/tags'); fill(el.stat,stats,'All stats'); fill(el.type,types,'All change types'); }
  function injectPostJsonLd(posts){ var old=document.getElementById('posts-jsonld'); if(old) old.remove(); var data = posts.slice(0,20).map(function(p){ return { '@context':'https://schema.org','@type':'NewsArticle', headline:p.title, datePublished:p.date, url:p.url, about:'Deadlock patch notes'}; }); var s=document.createElement('script'); s.id='posts-jsonld'; s.type='application/ld+json'; s.textContent=JSON.stringify(data); document.head.appendChild(s); }
  function schedule(fn){ if ('requestIdleCallback' in window) requestIdleCallback(fn); else setTimeout(function(){ fn(null); },0); }
  async function processPostsInChunks(items){ state.fetched = items.length; state.processed=0; setProgress('Fetched '+state.fetched+' posts'); var sorted = [].concat(items).sort(function(a,b){ return b.date-a.date; }); var parsed=[]; var i=0; return new Promise(function(resolve){ function work(deadline){ while (i<sorted.length && ((deadline && deadline.timeRemaining()>4) || !deadline)) { parsed.push(parsePost(sorted[i++])); state.processed=i; if (i % 20 === 0 || i === sorted.length) log('posts.processing', { processed: i, total: sorted.length }); setProgress('Fetched '+state.fetched+' posts • Processed '+state.processed+' / '+state.fetched); } if (i<sorted.length) schedule(work); else resolve(parsed); } schedule(work); }); }
  async function refreshFromSteam(){ log('refresh.start'); var items = await fetchSteamNews(); if (!items) return; state.posts = await processPostsInChunks(items); state.lastUpdated = new Date().toISOString(); saveCache(); populateFilterOptions(); applyFilters(); injectPostJsonLd(state.posts); setProgress('Fetched '+state.fetched+' posts • Processed '+state.processed+' / '+state.fetched+' • Last updated '+new Date(state.lastUpdated).toLocaleString()); log('refresh.done', { posts: state.posts.length, lastUpdated: state.lastUpdated }); }

  function bindEvents(){ [el.search, el.category, el.entity, el.stat, el.type].forEach(function(node){ node.addEventListener('input', applyFilters); }); el.refresh.addEventListener('click', refreshFromSteam); window.addEventListener('hashchange', routeRender); log('events.bound'); }

  function init(){
    log('init.start');
    var cached = loadCache();
    if (cached && cached.posts && cached.posts.length){ state.posts = cached.posts; state.lastUpdated = cached.lastUpdated; state.filtered=state.posts; populateFilterOptions(); routeRender(); injectPostJsonLd(state.posts); setProgress('Loaded '+state.posts.length+' cached posts • Last updated '+new Date(state.lastUpdated).toLocaleString()); log('init.cache_loaded', { posts: state.posts.length }); }
    else { setProgress('No cache found yet.'); log('init.no_cache'); }
    bindEvents();
    refreshFromSteam();
    log('init.finish');
  }

  try { init(); } catch (e) { log('init.crash', { message: e.message, stack: e.stack ? String(e.stack).slice(0, 600) : null }); setProgress('Initialization failed. Open console and run window.__deadlockDebug.dump()'); }
})();
