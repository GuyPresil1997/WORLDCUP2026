/* ============================================================
   מונדיאל 2026 — שרת לייב מקומי
   מגיש את האתר + מושך תוצאות חיות מ-football-data.org בצד השרת
   (כדי לעקוף את חסימת ה-CORS של הדפדפן).

   הפעלה:   node live-server.js
   פתיחה:   http://localhost:8080
   מפתח:    הדבק את מפתח ה-API שלך בקובץ  api-key.txt
   ============================================================ */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = __dirname;
const TOKEN = (process.env.FOOTBALL_DATA_TOKEN || readToken()).trim();

function readToken() {
  try { return fs.readFileSync(path.join(ROOT, 'api-key.txt'), 'utf8'); }
  catch (e) { return ''; }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
let cache = { t: 0, data: null };

// שליפת המשחקים מ-football-data.org (צד שרת, בלי CORS)
function fetchLive() {
  return new Promise((resolve) => {
    if (!TOKEN) { resolve({ error: 'no_token', hint: 'הדבק את מפתח ה-API בקובץ api-key.txt והפעל מחדש' }); return; }
    if (cache.data && Date.now() - cache.t < 20000) { resolve(cache.data); return; } // קאש 20 שניות
    const opts = { host: 'api.football-data.org', path: '/v4/competitions/WC/matches', headers: { 'X-Auth-Token': TOKEN } };
    https.get(opts, (r) => {
      let b = '';
      r.on('data', c => b += c);
      r.on('end', () => {
        try {
          const j = JSON.parse(b);
          if (!j.matches) { resolve({ error: j.message || ('HTTP ' + r.statusCode) }); return; }
          const matches = j.matches.map(m => ({
            home: (m.homeTeam && m.homeTeam.name) || '',
            away: (m.awayTeam && m.awayTeam.name) || '',
            hs: m.score && m.score.fullTime ? m.score.fullTime.home : null,
            as: m.score && m.score.fullTime ? m.score.fullTime.away : null,
            status: m.status || '',
            utcDate: m.utcDate || ''
          }));
          const out = { matches, updated: new Date().toISOString() };
          cache = { t: Date.now(), data: out };
          resolve(out);
        } catch (e) { resolve({ error: 'parse: ' + e.message }); }
      });
    }).on('error', e => resolve({ error: e.message }));
  });
}

// שליפת מלך השערים (Golden Boot)
let cacheS = { t: 0, data: null };
function fetchScorers() {
  return new Promise((resolve) => {
    if (!TOKEN) { resolve({ error: 'no_token' }); return; }
    if (cacheS.data && Date.now() - cacheS.t < 30000) { resolve(cacheS.data); return; }
    const opts = { host: 'api.football-data.org', path: '/v4/competitions/WC/scorers?limit=25', headers: { 'X-Auth-Token': TOKEN } };
    https.get(opts, (r) => {
      let b = '';
      r.on('data', c => b += c);
      r.on('end', () => {
        try {
          const j = JSON.parse(b);
          if (!j.scorers) { resolve({ error: j.message || ('HTTP ' + r.statusCode) }); return; }
          const scorers = j.scorers.map(s => ({
            name: (s.player && s.player.name) || '',
            team: (s.team && s.team.name) || '',
            goals: s.goals || 0,
            assists: s.assists || 0
          }));
          const out = { scorers, updated: new Date().toISOString() };
          cacheS = { t: Date.now(), data: out };
          resolve(out);
        } catch (e) { resolve({ error: 'parse: ' + e.message }); }
      });
    }).on('error', e => resolve({ error: e.message }));
  });
}

http.createServer(async (req, res) => {
  const u = req.url.split('?')[0];
  if (u === '/api/live') {
    const data = await fetchLive();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
    return;
  }
  if (u === '/api/scorers') {
    const data = await fetchScorers();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
    return;
  }
  let p = decodeURIComponent(u);
  if (p === '/' || p === '') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(file, (err, d) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(d);
  });
}).listen(PORT, () => {
  console.log('================================================');
  console.log('  Mondial 2026 - LIVE server is running');
  console.log('  Open in browser:  http://localhost:' + PORT);
  console.log('  API key: ' + (TOKEN ? 'loaded OK' : 'MISSING -> paste it into api-key.txt'));
  console.log('  Stop: Ctrl+C');
  console.log('================================================');
});
