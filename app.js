(function() {
  var APP_ID = 1422450;
  var CACHE_KEY = 'deadlock-news-parser-v1';
  var API_POSTS_URL = '/api/posts';
  var state = { posts: [], filtered: [], lastUpdated: null, fetched: 0, processed: 0 };

  var LOG_VERSION = '2026-05-27b';
  var LOG_PREFIX = '[DeadlockInit]';
  var sessionId = String(Date.now()) + '-' + Math.random().toString(16).slice(2, 8);
  var trace = [];

  function log(stage, data) { var entry = { t: new Date().toISOString(), session: sessionId, stage: stage, data: data || null }; trace.push(entry); if (trace.length > 200) trace.shift(); console.log(LOG_PREFIX, entry); }

  var STAT_SPECS = [
    { key: 'cooldown', label: 'Cooldown', pattern: /\bcooldown\b/i, preferLower: true },
    { key: 'damage', label: 'Damage', pattern: /\bdamage\b/i, preferLower: false },
    { key: 'bullet_damage', label: 'Bullet Damage', pattern: /\bbullet\s+damage\b/i, preferLower: false },
    { key: 'weapon_damage', label: 'Weapon Damage', pattern: /\bweapon\s+damage\b/i, preferLower: false },
    { key: 'spirit_damage', label: 'Spirit Damage', pattern: /\bspirit\s+damage\b/i, preferLower: false },
    { key: 'spirit_scaling', label: 'Spirit Scaling', pattern: /\bspirit\s+scal(?:ing|e)\b/i, preferLower: false },
    { key: 'spirit_power', label: 'Spirit Power', pattern: /\bspirit\s+power\b/i, preferLower: false },
    { key: 'health', label: 'Health', pattern: /\bhealth\b/i, preferLower: false },
    { key: 'max_health', label: 'Max Health', pattern: /\bmax\s+health\b/i, preferLower: false },
    { key: 'bonus_health', label: 'Bonus Health', pattern: /\bbonus\s+health\b/i, preferLower: false },
    { key: 'regen', label: 'Regen', pattern: /\b(?:health\s+)?regen\b/i, preferLower: false },
    { key: 'healing', label: 'Healing', pattern: /\bheal(?:ing)?\b/i, preferLower: false },
    { key: 'barrier', label: 'Barrier', pattern: /\bbarrier\b/i, preferLower: false },
    { key: 'bullet_resistance', label: 'Bullet Resistance', pattern: /\bbullet\s+resist(?:ance)?\b/i, preferLower: false },
    { key: 'spirit_resistance', label: 'Spirit Resistance', pattern: /\bspirit\s+resist(?:ance)?\b/i, preferLower: false },
    { key: 'melee_resist', label: 'Melee Resist', pattern: /\bmelee\s+resist(?:ance)?\b/i, preferLower: false },
    { key: 'debuff_resist', label: 'Debuff Resist', pattern: /\bdebuff\s+resist(?:ance)?\b/i, preferLower: false },
    { key: 'fire_rate', label: 'Fire Rate', pattern: /\bfire\s+rate\b/i, preferLower: false },
    { key: 'duration', label: 'Duration', pattern: /\bduration\b/i, preferLower: null },
    { key: 'radius', label: 'Radius', pattern: /\bradius\b/i, preferLower: false },
    { key: 'range', label: 'Range', pattern: /\brange\b/i, preferLower: false },
    { key: 'cast_range', label: 'Cast Range', pattern: /\bcast\s+range\b/i, preferLower: false },
    { key: 'stun_duration', label: 'Stun Duration', pattern: /\bstun\s+duration\b/i, preferLower: false },
    { key: 'slow', label: 'Slow', pattern: /\bslow\b/i, preferLower: false },
    { key: 'lifesteal', label: 'Lifesteal', pattern: /\blifesteal\b/i, preferLower: false },
    { key: 'stamina', label: 'Stamina', pattern: /\bstamina\b/i, preferLower: false },
    { key: 'move_speed', label: 'Move Speed', pattern: /\bmove\s+speed\b/i, preferLower: false },
    { key: 'sprint_speed', label: 'Sprint Speed', pattern: /\bsprint\s+speed\b/i, preferLower: false },
    { key: 'ammo', label: 'Ammo', pattern: /\bammo\b/i, preferLower: false },
    { key: 'bullet_velocity', label: 'Bullet Velocity', pattern: /\bbullet\s+velocity\b/i, preferLower: false },
    { key: 'air_control', label: 'Air Control', pattern: /\bair\s+control\b/i, preferLower: false },
    { key: 'gravity', label: 'Gravity', pattern: /\bgravity\b/i, preferLower: true },
    { key: 'charges', label: 'Charges', pattern: /\bcharges?\b/i, preferLower: false },
    { key: 'souls', label: 'Souls', pattern: /\bsouls?\b/i, preferLower: false },
    { key: 'bounty', label: 'Bounty', pattern: /\bbounty\b/i, preferLower: false },
    { key: 'spawn_time', label: 'Spawn Time', pattern: /\bspawn\s+time\b/i, preferLower: null },
    { key: 'respawn_time', label: 'Respawn Time', pattern: /\brespawn\s+time\b/i, preferLower: null }
  ];
  var STAT_DICTIONARY = STAT_SPECS.map(function(s) { return s.label; });

  window.__deadlockDebug = { version: LOG_VERSION, sessionId: sessionId, getTrace: function() { return trace.slice(); }, dump: function() { console.log(LOG_PREFIX, 'TRACE_DUMP', trace); return trace.slice(); } };
  window.addEventListener('error', function(ev) { log('window.error', { message: ev.message, source: ev.filename, line: ev.lineno, col: ev.colno }); });
  window.addEventListener('unhandledrejection', function(ev) { var reason = ev.reason && ev.reason.message ? ev.reason.message : String(ev.reason); log('window.unhandledrejection', { reason: reason }); });
  log('bootstrap.start', { href: location.href, version: LOG_VERSION });

  var el = { progress: document.getElementById('progress'), home: document.getElementById('home-view'), detail: document.getElementById('detail-view'), search: document.getElementById('search'), category: document.getElementById('category'), entity: document.getElementById('entity'), stat: document.getElementById('stat'), type: document.getElementById('type'), refresh: document.getElementById('refresh'), cors: document.getElementById('cors-msg') };

  function setProgress(text){ if (el.progress) el.progress.textContent = text; log('ui.progress', { text: text }); }
  function saveCache(){ localStorage.setItem(CACHE_KEY, JSON.stringify({ posts: state.posts, lastUpdated: state.lastUpdated })); }
  function loadCache(){ try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (e) { return null; } }
  function shouldRevalidate(lastUpdated){ if (!lastUpdated) return true; var t = Date.parse(lastUpdated); if (!t) return true; return (Date.now() - t) > 15 * 60 * 1000; }

  async function fetchSteamNews(){ try { var res = await fetch(API_POSTS_URL, { headers: { 'accept': 'application/json' } }); if (!res.ok) throw new Error('API HTTP ' + res.status); var json = await res.json(); var items = (json && json.items) || []; var source = (json && json.source) || 'unknown'; if (el.cors) { el.cors.classList.remove('hidden'); el.cors.textContent = 'Data source: ' + source + '. Last server refresh: ' + ((json && json.lastRefreshedAt) || 'unknown') + '.'; } return items; } catch (err) { if (el.cors) { el.cors.classList.remove('hidden'); el.cors.textContent = 'Server API fetch failed. Try again shortly.'; } return null; } }

  function normalizeSteamContent(content){ var txt = document.createElement('textarea'); txt.innerHTML = content || ''; var s = txt.value; s = s.replace(/<\s*br\s*\/?\s*>/gi,'\n').replace(/<\/?p[^>]*>/gi,'\n').replace(/<\/?div[^>]*>/gi,'\n').replace(/<\/?li[^>]*>/gi,'\n- '); s = s.replace(/<[^>]+>/g,' '); s = s.replace(/\[\/?p\]/gi,'\n').replace(/\[\/?list\]/gi,'\n').replace(/\[\*\]/gi,'\n- ').replace(/\[\/?(?:b|i|u|h[1-6]|quote|code|url(?:=[^\]]+)?)\]/gi,' '); s = s.replace(/\r/g,'').replace(/\n{3,}/g,'\n\n'); return s.split('\n').map(function(x){ return x.replace(/\s+/g,' ').trim(); }).filter(Boolean).join('\n'); }
  function parseSectionsAndBullets(normalized){ var lines = normalized.split('\n'); var currentCategory = 'General'; var out=[]; for (var i = 0; i < lines.length; i++) { var line = (lines[i] || '').trim(); if (!line) continue; var sec = line.match(/^\s*\[\s*([^\]]+?)\s*\]\s*$/); if (sec){ currentCategory = sec[1].trim(); continue; } var cleaned = line.replace(/^\s*(?:[-•*]|\[\*\])\s+/, '').trim(); var isHeading = /^(gameplay|general|heroes|hero|items|item|abilities|ability|misc|bug fixes?|fixes|audio|ui|maps?)\s*:?$/i.test(cleaned); if (isHeading){ currentCategory = cleaned.replace(/:$/, ''); continue; } var looksLikeBullet = /^\s*(?:[-•*]|\[\*\])\s+/.test(line); if (looksLikeBullet || /[a-z0-9]/i.test(cleaned)) out.push({ category: currentCategory, text: cleaned }); } return out; }
  function detectStatTags(text){ var lower = text.toLowerCase(); return STAT_DICTIONARY.filter(function(s){ return lower.indexOf(s.toLowerCase()) !== -1; }); }
  function detectEntity(category, text){ var primaryEntity=null, secondaryEntity=null, entityType='unknown'; var m = text.match(/^([^:]{2,60}):\s*(.+)$/); if (/heroes/i.test(category) && m){ primaryEntity=m[1].trim(); entityType='hero'; secondaryEntity = detectSecondary(m[2]); return { primaryEntity: primaryEntity, secondaryEntity: secondaryEntity, entityType: entityType }; } if (/items/i.test(category) && m){ primaryEntity=m[1].trim(); entityType='item'; return { primaryEntity: primaryEntity, secondaryEntity: secondaryEntity, entityType: entityType }; } if (/general/i.test(category)) { var l=text.toLowerCase(); if (/(guardian|shrine|walker|midboss)/.test(l)) entityType='objective'; else entityType='system'; } return { primaryEntity: primaryEntity, secondaryEntity: secondaryEntity, entityType: entityType }; }
  function detectSecondary(rest){ var pre = rest.split(/\b(cooldown|damage|fixed|increased|reduced|decreased|changed|removed|added|now|no longer)\b/i)[0].trim(); if (/^[A-Z][A-Za-z0-9'\- ]{2,40}$/.test(pre)) return pre; return null; }

  function findStatSpec(text) { var i; for (i = 0; i < STAT_SPECS.length; i++) if (STAT_SPECS[i].pattern.test(text)) return STAT_SPECS[i]; return null; }
  function parseNumber(raw) { if (!raw) return null; var m = String(raw).match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; }
  function extractStatChanges(text){ var arr=[]; var r = /(cooldown|damage|bullet damage|weapon damage|spirit damage|spirit scaling|spirit power|health|max health|bonus health|regen|healing|barrier|bullet resistance|spirit resistance|melee resist(?:ance)?|debuff resist(?:ance)?|fire rate|duration|radius|cast range|range|stun duration|slow|lifesteal|stamina|move speed|sprint speed|ammo|bullet velocity|air control|gravity|charges?|souls|bounty|spawn time|respawn time)[^\n]*?\b(increased|decreased|reduced)\s+from\s+([^\s][^\n]*?)\s+to\s+([^\s][^\n]*?)(?:$|[,.])/ig; var m; while ((m = r.exec(text)) !== null) { arr.push({ statName: m[1], oldValue: m[3], newValue: m[4], direction: m[2].toLowerCase(), confidence: 0.9 }); } return arr; }

  function classifyChangeSemantic(category, text, entityType) {
    var lower = text.toLowerCase(); var score = { buff: 0, nerf: 0, mixed: 0, rework: 0, bugfix: 0, neutral: 0 }; var reasons = []; var statChanges = extractStatChanges(text);
    function add(type, pts, why) { score[type] = score[type] + pts; reasons.push(why); }
    function applyDirection(statSpec, direction) { if (!statSpec) return; if (statSpec.preferLower === null) { add('neutral', 0.5, 'context-sensitive stat ' + statSpec.label); return; } if (direction === 'increased') add(statSpec.preferLower ? 'nerf' : 'buff', 2, statSpec.label + ' increased'); if (direction === 'decreased' || direction === 'reduced') add(statSpec.preferLower ? 'buff' : 'nerf', 2, statSpec.label + ' reduced'); }

    var spec = findStatSpec(lower); if (spec && /(increased|reduced|decreased)/.test(lower)) { var dir = /increased/.test(lower) ? 'increased' : 'decreased'; applyDirection(spec, dir); }
    if (/now also grants|now grants|can now|now allows|no longer prevents|no longer restricts/.test(lower)) add('buff', 1.6, 'QoL/utility gain wording');
    if (/no longer grants/.test(lower)) add('nerf', 1.6, 'lost granted benefit');
    if (/\bremoved\b/.test(lower)) { if (/removed (?:cooldown|penalty|restriction|slow)/.test(lower)) add('buff', 1.2, 'restriction removed'); else add('neutral', 0.7, 'removed without clear direction'); }
    if (/\bfixed\b|\bfixes\b/.test(lower)) add('bugfix', 2.5, 'explicit bug fix wording');
    if (/changed from/.test(lower) || /\brework/.test(lower)) add('rework', 1.4, 'explicit rework/change-from wording');

    if (statChanges.length > 0) {
      var i; for (i = 0; i < statChanges.length; i++) { var c = statChanges[i]; applyDirection(findStatSpec(c.statName.toLowerCase()), c.direction); }
    }

    if ((/changed from/.test(lower) && / to /.test(lower)) || (score.buff > 0 && score.nerf > 0)) add('mixed', 1.7, 'tradeoff or conversion pattern');
    if ((/guardian|shrine|walker|midboss|objective|spawn time|respawn time/.test(lower) || entityType === 'objective') && score.buff === 0 && score.nerf === 0) add('neutral', 1.3, 'objective/system timing treated cautiously');

    var finalType = 'neutral'; var best = -1; var k; for (k in score) { if (score[k] > best) { best = score[k]; finalType = k; } }
    if (score.mixed >= 1.7 && (score.buff > 0 || score.nerf > 0 || score.rework > 0)) finalType = 'mixed';
    if (finalType === 'bugfix' && (score.buff > 2 || score.nerf > 2)) finalType = score.buff > score.nerf ? 'buff' : 'nerf';
    if (finalType === 'rework' && score.buff > 0 && score.nerf > 0) finalType = 'mixed';
    var conf = Math.max(0.2, Math.min(0.99, best / 3.2));
    return { changeType: finalType, confidence: conf, classificationReason: reasons.slice(0, 2).join('; ') || 'no strong semantic signal', statChanges: statChanges };
  }

  function parseChangeLine(category, text, idx){ var statTags = detectStatTags(text); var entity = detectEntity(category, text); var tags = [entity.primaryEntity, entity.secondaryEntity].concat(statTags).filter(Boolean); var seen = {}; tags = tags.filter(function(x){ if (seen[x]) return false; seen[x]=1; return true; }); var sem = classifyChangeSemantic(category, text, entity.entityType); return { id: category + '-' + idx, raw:text, category:category, primaryEntity:entity.primaryEntity, secondaryEntity:entity.secondaryEntity, entityType:entity.entityType, tags:tags, statTags:statTags, statChanges:sem.statChanges, changeType:sem.changeType, confidence:sem.confidence, classificationReason: sem.classificationReason }; }
  function parsePost(post){ var normalized = normalizeSteamContent(post.contents || ''); var bullets = parseSectionsAndBullets(normalized); var changes = bullets.map(function(b,i){ return parseChangeLine(b.category,b.text,i); }); var categories = Array.from(new Set(changes.map(function(c){ return c.category; }))); return { appid:APP_ID, gid:post.gid, title:post.title, url:post.url, date:new Date(post.date*1000).toISOString(), categories:categories, changes:changes, rawText: normalized }; }

  function escapeHtml(s){ return String(s).replace(/[&<>"']/g, function(c){ return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]); }); }
  function chip(t,cls){ return '<span class="chip '+(cls || '')+'">'+escapeHtml(t)+'</span>'; }
  function countMap(arr){ var m={}; arr.forEach(function(x){ m[x]=(m[x]||0)+1; }); return m; }
  function summaryTop(p){ var x=countMap(p.changes.flatMap(function(c){ return [c.primaryEntity].concat(c.statTags); }).filter(Boolean)); return Object.entries(x).sort(function(a,b){ return b[1]-a[1]; }).slice(0,4).map(function(kv){ return kv[0]+'('+kv[1]+')'; }).join(', ') || 'N/A'; }
  function diffKind(changeType){ var map = { buff:'change-buff', nerf:'change-nerf', mixed:'change-mixed', rework:'change-rework', bugfix:'change-bugfix', neutral:'change-neutral' }; return map[changeType] || 'change-neutral'; }
  function diffPrefix(changeType){ if (changeType === 'buff') return '+'; if (changeType === 'nerf') return '-'; if (changeType === 'mixed' || changeType === 'rework') return '~'; return '•'; }
  function renderDiffLine(change){ return '<div class="diff-line '+diffKind(change.changeType)+'">'+diffPrefix(change.changeType)+' '+escapeHtml(change.raw)+'</div>'; }
  function renderPatchCategories(p){ var byCat = p.changes.reduce(function(m,c){ if (!m[c.category]) m[c.category] = []; m[c.category].push(c); return m; }, {}); return Object.entries(byCat).map(function(entry){ var cat = entry[0], list = entry[1]; return '<section class="patch-category"><h4>['+escapeHtml(cat)+']</h4><div class="diff-list">'+list.map(renderDiffLine).join('')+'</div></section>'; }).join(''); }

  function runClassifierFixtures(){ var fixtures=[ {name:'cooldown reduced',line:'Grey Talon: Rain of Arrows cooldown reduced from 30s to 22s',want:'buff'}, {name:'cooldown increased',line:'Shiv: Killing Blow cooldown increased from 105s to 125s',want:'nerf'}, {name:'damage increased',line:'Gun damage increased from 20 to 24',want:'buff'}, {name:'damage reduced',line:'Bullet damage reduced from 13 to 12',want:'nerf'}, {name:'scaling increased',line:'Spirit scaling increased from 0.6 to 0.8',want:'buff'}, {name:'health increased',line:'Health increased from 790 to 830',want:'buff'}, {name:'resistance increased',line:'Shrine Bullet Resistance increased from 10% to 20%',want:'buff'}, {name:'now also grants',line:'T2 now also grants +20 spirit power',want:'buff'}, {name:'no longer grants',line:'No longer grants bonus health',want:'nerf'}, {name:'no longer prevents',line:'No longer prevents jumping and mantling',want:'buff'}, {name:'changed from/to',line:'T2 changed from "+0.75s Duration" to "-5s Cooldown"',want:'mixed'}, {name:'clear bugfix',line:'Fixed an issue where lash could clip through walls',want:'bugfix'}, {name:'objective/system change',line:'Midboss respawn time increased from 5m to 7m',want:'neutral'}, {name:'mixed tradeoff',line:'Now also grants a charge but reduced duration from 4s to 2s',want:'mixed'} ]; var out=[]; var pass=0; for (var i=0;i<fixtures.length;i++){ var f=fixtures[i]; var got=classifyChangeSemantic('General', f.line, 'system').changeType; var ok=got===f.want; if(ok) pass++; out.push({ name:f.name, expected:f.want, actual:got, pass:ok }); } return { pass:pass, total:fixtures.length, results:out }; }

  window.__deadlockDebug.testClassifier = runClassifierFixtures;

  function renderHome(){ el.detail.classList.add('hidden'); el.home.classList.remove('hidden'); el.home.innerHTML = state.filtered.map(function(p, idx){ var tops = summaryTop(p); var divider = idx < state.filtered.length - 1 ? '<div class="patch-divider" aria-hidden="true"></div>' : ''; return '<article class="card"><h3><a href="#/post/'+p.gid+'">'+escapeHtml(p.title)+'</a></h3><div class="muted">'+new Date(p.date).toLocaleString()+' • <a href="'+p.url+'" target="_blank" rel="noopener">Steam URL</a></div><div class="chips">'+p.categories.map(function(c){ return chip(c); }).join('')+'</div><p class="muted">Parsed changes: '+p.changes.length+'</p><p class="muted">Top: '+escapeHtml(tops)+'</p>'+renderPatchCategories(p)+'</article>'+divider; }).join('') || '<div class="card">No posts match current filters.</div>'; }
  function renderPostDetail(gid){ var p = state.posts.find(function(x){ return x.gid===gid; }); if (!p){ location.hash='#/'; return; } el.home.classList.add('hidden'); el.detail.classList.remove('hidden'); var byCat = p.changes.reduce(function(m,c){ if (!m[c.category]) m[c.category] = []; m[c.category].push(c); return m; },{}); el.detail.innerHTML = '<h2>'+escapeHtml(p.title)+'</h2><p class="muted">'+new Date(p.date).toLocaleString()+' • <a href="'+p.url+'" target="_blank" rel="noopener">Open on Steam</a></p>'+'<button id="toggle-raw">Toggle raw text</button><pre id="raw" class="hidden">'+escapeHtml(p.rawText)+'</pre>'+Object.entries(byCat).map(function(entry){ var cat = entry[0], list = entry[1]; return '<section><h3>['+escapeHtml(cat)+']</h3>'+list.map(function(c){ return '<div class="change"><div>'+escapeHtml(c.raw)+'</div><div class="chips">'+c.tags.map(chip).join('')+chip(c.changeType,'tag-'+c.changeType)+'</div></div>'; }).join('')+'</section>'; }).join(''); document.getElementById('toggle-raw').onclick = function(){ document.getElementById('raw').classList.toggle('hidden'); }; }
  function routeRender(){ var m=location.hash.match(/^#\/post\/(.+)$/); if (m) renderPostDetail(m[1]); else renderHome(); }
  function applyFilters(){ var q = el.search.value.toLowerCase(), c=el.category.value, e=el.entity.value, s=el.stat.value, t=el.type.value; state.filtered = state.posts.filter(function(p){ var blob=(p.title+' '+p.rawText+' '+p.changes.flatMap(function(x){ return x.tags; }).join(' ')).toLowerCase(); if (q && blob.indexOf(q) === -1) return false; if (c && p.categories.indexOf(c) === -1) return false; if (e && !p.changes.some(function(x){ return x.tags.indexOf(e) !== -1; })) return false; if (s && !p.changes.some(function(x){ return x.statTags.indexOf(s) !== -1; })) return false; if (t && !p.changes.some(function(x){ return x.changeType===t; })) return false; return true; }); routeRender(); }
  function fill(select, values, label){ var keep=select.value; select.innerHTML = values.map(function(v){ return '<option value="'+v+'">'+(v||label)+'</option>'; }).join(''); select.value=keep; }
  function populateFilterOptions(){ var categories=[''].concat(Array.from(new Set(state.posts.flatMap(function(p){ return p.categories; })))); var entities=[''].concat(Array.from(new Set(state.posts.flatMap(function(p){ return p.changes.flatMap(function(c){ return c.tags; }); }).filter(Boolean)))).sort(); var stats=[''].concat(Array.from(new Set(state.posts.flatMap(function(p){ return p.changes.flatMap(function(c){ return c.statTags; }); })))).sort(); var types=['','buff','nerf','mixed','rework','bugfix','neutral']; fill(el.category,categories,'All categories'); fill(el.entity,entities,'All entities/tags'); fill(el.stat,stats,'All stats'); fill(el.type,types,'All change types'); }
  function injectPostJsonLd(posts){ var old=document.getElementById('posts-jsonld'); if(old) old.remove(); var data = posts.slice(0,20).map(function(p){ return { '@context':'https://schema.org','@type':'NewsArticle', headline:p.title, datePublished:p.date, url:p.url, about:'Deadlock patch notes'}; }); var s=document.createElement('script'); s.id='posts-jsonld'; s.type='application/ld+json'; s.textContent=JSON.stringify(data); document.head.appendChild(s); }
  function schedule(fn){ if ('requestIdleCallback' in window) requestIdleCallback(fn); else setTimeout(function(){ fn(null); },0); }
  async function processPostsInChunks(items){ state.fetched = items.length; state.processed=0; setProgress('Fetched '+state.fetched+' posts'); var sorted = [].concat(items).sort(function(a,b){ return b.date-a.date; }); var parsed=[]; var i=0; return new Promise(function(resolve){ function work(deadline){ while (i<sorted.length && ((deadline && deadline.timeRemaining()>4) || !deadline)) { parsed.push(parsePost(sorted[i++])); state.processed=i; setProgress('Fetched '+state.fetched+' posts • Processed '+state.processed+' / '+state.fetched); } if (i<sorted.length) schedule(work); else resolve(parsed); } schedule(work); }); }
  async function refreshFromSteam(){ var items = await fetchSteamNews(); if (!items) return; state.posts = await processPostsInChunks(items); state.lastUpdated = new Date().toISOString(); saveCache(); populateFilterOptions(); applyFilters(); injectPostJsonLd(state.posts); setProgress('Fetched '+state.fetched+' posts • Processed '+state.processed+' / '+state.fetched+' • Last updated '+new Date(state.lastUpdated).toLocaleString()); }
  function bindEvents(){ [el.search, el.category, el.entity, el.stat, el.type].forEach(function(node){ node.addEventListener('input', applyFilters); }); el.refresh.addEventListener('click', refreshFromSteam); window.addEventListener('hashchange', routeRender); }
  function init(){ var cached = loadCache(); if (cached && cached.posts && cached.posts.length){ state.posts = cached.posts; state.lastUpdated = cached.lastUpdated; state.filtered=state.posts; populateFilterOptions(); routeRender(); injectPostJsonLd(state.posts); setProgress('Loaded '+state.posts.length+' cached posts • Last updated '+new Date(state.lastUpdated).toLocaleString()); } else { setProgress('No cache found yet.'); } bindEvents(); if (shouldRevalidate(state.lastUpdated)) { refreshFromSteam(); } else if (el.cors) { el.cors.classList.remove('hidden'); el.cors.textContent = 'Using local cache; server refresh deferred.'; } }
  try { init(); } catch (e) { setProgress('Initialization failed. Open console and run window.__deadlockDebug.dump()'); }
})();
