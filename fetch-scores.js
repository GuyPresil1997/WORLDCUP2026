/* ============================================================
   מונדיאל 2026 — משיכת תוצאות לקובץ סטטי (עבור GitHub Pages)
   רץ ע"י GitHub Action כל ~10 דקות, מושך מ-football-data.org,
   וכותב live.json + scorers.json שהאתר הסטטי קורא מהם.
   מפתח ה-API מגיע ממשתנה סביבה (GitHub Secret), לא מהקוד.

   הרצה מקומית:  FOOTBALL_DATA_TOKEN=xxxx node fetch-scores.js
   ============================================================ */
const https = require('https');
const fs = require('fs');

const TOKEN = (process.env.FOOTBALL_DATA_TOKEN || '').trim();
if (!TOKEN) { console.error('❌ חסר FOOTBALL_DATA_TOKEN'); process.exit(1); }

function get(path) {
  return new Promise((resolve, reject) => {
    https.get({ host: 'api.football-data.org', path, headers: { 'X-Auth-Token': TOKEN } }, r => {
      let b = '';
      r.on('data', c => b += c);
      r.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  // משחקים / תוצאות
  try {
    const m = await get('/v4/competitions/WC/matches');
    if (m.matches) {
      const matches = m.matches.map(x => ({
        home: (x.homeTeam && x.homeTeam.name) || '',
        away: (x.awayTeam && x.awayTeam.name) || '',
        hs: x.score && x.score.fullTime ? x.score.fullTime.home : null,
        as: x.score && x.score.fullTime ? x.score.fullTime.away : null,
        status: x.status || '',
        utcDate: x.utcDate || ''
      }));
      fs.writeFileSync('live.json', JSON.stringify({ matches, updated: new Date().toISOString() }));
      console.log('✓ live.json — ' + matches.length + ' משחקים');
    } else {
      console.error('שגיאת matches:', m.message || m.error || 'לא ידוע');
    }
  } catch (e) { console.error('כשל במשיכת matches:', e.message); }

  // מלך השערים
  try {
    const s = await get('/v4/competitions/WC/scorers?limit=25');
    if (s.scorers) {
      const scorers = s.scorers.map(x => ({
        name: (x.player && x.player.name) || '',
        team: (x.team && x.team.name) || '',
        goals: x.goals || 0,
        assists: x.assists || 0
      }));
      fs.writeFileSync('scorers.json', JSON.stringify({ scorers, updated: new Date().toISOString() }));
      console.log('✓ scorers.json — ' + scorers.length + ' מבקיעים');
    } else {
      console.error('שגיאת scorers:', s.message || s.error || 'לא ידוע');
    }
  } catch (e) { console.error('כשל במשיכת scorers:', e.message); }
})();
