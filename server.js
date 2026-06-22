const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const SIGNUPS_FILE = path.join(__dirname, 'signups.json');
const ADMIN_KEY = 'madparty2026';

app.use(express.json());

if (!fs.existsSync(SIGNUPS_FILE)) fs.writeFileSync(SIGNUPS_FILE, '[]');

// Routes BEFORE static so they are not blocked
app.post('/api/signup', (req, res) => {
  const { name, email } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  const signups = JSON.parse(fs.readFileSync(SIGNUPS_FILE, 'utf8'));
  if (signups.find(s => s.email === email)) return res.json({ success: true });
  signups.push({ name, email, date: new Date().toISOString() });
  fs.writeFileSync(SIGNUPS_FILE, JSON.stringify(signups, null, 2));
  res.json({ success: true });
});

app.get('/admin', (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#080810;color:#fff;gap:16px}</style></head><body><h2>Access Denied</h2><p style="color:rgba(255,255,255,0.4)">Wrong key</p></body></html>`);
  }
  const signups = JSON.parse(fs.readFileSync(SIGNUPS_FILE, 'utf8'));
  const rows = signups.map((s, i) =>
    `<tr><td>${i+1}</td><td>${s.name}</td><td>${s.email}</td><td>${new Date(s.date).toLocaleString('en-GB')}</td></tr>`
  ).join('');
  const csvData = 'Name,Email,Date\n' + signups.map(s => `"${s.name}","${s.email}","${new Date(s.date).toLocaleString('en-GB')}"`).join('\n');
  const csv = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvData);
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MAD Signups</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,sans-serif;background:#080810;color:#fff;padding:40px 20px;min-height:100vh}
  .wrap{max-width:900px;margin:0 auto}
  .header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;margin-bottom:36px}
  h1{font-size:28px;font-weight:800}
  .sub{color:rgba(255,255,255,.4);font-size:13px;margin-top:4px}
  .badge{background:#3A4FD4;color:#fff;border-radius:100px;padding:6px 18px;font-size:14px;font-weight:700}
  .export{background:#FFD460;color:#000;text-decoration:none;padding:10px 22px;border-radius:100px;font-size:13px;font-weight:700;cursor:pointer}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;padding:12px 16px;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.4);border-bottom:1px solid rgba(255,255,255,.08)}
  td{padding:14px 16px;font-size:14px;border-bottom:1px solid rgba(255,255,255,.05)}
  tr:hover td{background:rgba(255,255,255,.03)}
  .empty{text-align:center;padding:80px;color:rgba(255,255,255,.3);font-size:16px}
</style></head><body><div class="wrap">
<div class="header">
  <div><h1>MAD Signups</h1><p class="sub">All email signups from the website</p></div>
  <div style="display:flex;gap:12px;align-items:center">
    <span class="badge">${signups.length} signup${signups.length !== 1 ? 's' : ''}</span>
    <a class="export" href="${csv}" download="mad-signups.csv">Export CSV</a>
  </div>
</div>
${signups.length === 0
  ? '<p class="empty">No signups yet.</p>'
  : `<table><thead><tr><th>#</th><th>Name</th><th>Email</th><th>Date</th></tr></thead><tbody>${rows}</tbody></table>`}
</div></body></html>`);
});

// Static files after routes
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MAD Party running on port ${PORT}`));
