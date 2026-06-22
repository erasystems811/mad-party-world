const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const SIGNUPS_FILE = path.join(__dirname, 'signups.json');
const ADMIN_KEY = 'madparty2026';

app.use(express.json());

const useDB = !!process.env.DATABASE_URL;
let pool;

if (useDB) {
  pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  pool.query(`
    CREATE TABLE IF NOT EXISTS signups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).then(() => console.log('DB ready')).catch(console.error);
} else {
  if (!fs.existsSync(SIGNUPS_FILE)) fs.writeFileSync(SIGNUPS_FILE, '[]');
  console.log('No DATABASE_URL — using file storage');
}

app.post('/api/signup', async (req, res) => {
  const { name, email } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'Name and email required' });
  try {
    if (useDB) {
      await pool.query(
        'INSERT INTO signups (name, email) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
        [name, email]
      );
    } else {
      const signups = JSON.parse(fs.readFileSync(SIGNUPS_FILE, 'utf8'));
      if (!signups.find(s => s.email === email)) {
        signups.push({ name, email, date: new Date().toISOString() });
        fs.writeFileSync(SIGNUPS_FILE, JSON.stringify(signups, null, 2));
      }
    }
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/admin', async (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(401).send(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Inter,sans-serif;background:#080810;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;flex-direction:column;gap:12px}
  h2{font-size:24px;font-weight:800}p{color:rgba(255,255,255,0.35);font-size:14px}
</style></head><body><h2>Access Denied</h2><p>Invalid key</p></body></html>`);
  }

  try {
    let signups = [];
    if (useDB) {
      const result = await pool.query('SELECT name, email, created_at AS date FROM signups ORDER BY created_at DESC');
      signups = result.rows;
    } else {
      signups = JSON.parse(fs.readFileSync(SIGNUPS_FILE, 'utf8'));
    }

    const today = signups.filter(s => {
      const d = new Date(s.date || s.created_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;

    const csvData = 'Name,Email,Date\n' + signups.map(s => `"${s.name}","${s.email}","${new Date(s.date || s.created_at).toLocaleString('en-GB')}"`).join('\n');
    const csv = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvData);

    const rows = signups.map((s, i) => {
      const initials = s.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
      const date = new Date(s.date || s.created_at);
      const dateStr = date.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
      const timeStr = date.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
      return `
      <tr>
        <td><span class="num">${i+1}</span></td>
        <td>
          <div class="person">
            <div class="avatar">${initials}</div>
            <span class="name">${s.name}</span>
          </div>
        </td>
        <td><a href="mailto:${s.email}" class="email-link">${s.email}</a></td>
        <td><span class="date-cell">${dateStr}</span><span class="time-cell">${timeStr}</span></td>
      </tr>`;
    }).join('');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MAD Party — Signups</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  :root{--blue:#3A4FD4;--blue-l:#5B73FF;--pink:#C8187A;--gold:#FFD460;--bg:#080810;--bg2:#0F0F1A;--gb:rgba(255,255,255,0.1)}
  body{font-family:'Inter',sans-serif;background:var(--bg);color:#fff;min-height:100vh}

  /* SIDEBAR */
  .sidebar{position:fixed;top:0;left:0;bottom:0;width:240px;background:var(--bg2);border-right:1px solid var(--gb);padding:32px 20px;display:flex;flex-direction:column;gap:8px}
  .brand{font-size:20px;font-weight:800;letter-spacing:.04em;margin-bottom:24px;padding:0 8px}
  .brand span{background:linear-gradient(135deg,var(--blue-l),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;font-size:13px;font-weight:500;color:rgba(255,255,255,0.5);cursor:default;transition:.2s}
  .nav-item.active{background:rgba(91,115,255,0.12);color:#fff;border:1px solid rgba(91,115,255,0.2)}
  .nav-icon{width:18px;height:18px;opacity:.7}
  .sidebar-foot{margin-top:auto;padding:12px;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid var(--gb)}
  .sidebar-foot p{font-size:11px;color:rgba(255,255,255,0.3);line-height:1.5}
  .sidebar-foot strong{color:rgba(255,255,255,0.6)}

  /* MAIN */
  .main{margin-left:240px;padding:40px 40px 60px}

  /* TOPBAR */
  .topbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:36px;flex-wrap:wrap;gap:16px}
  .topbar-left h1{font-size:26px;font-weight:800;letter-spacing:-.01em}
  .topbar-left p{font-size:13px;color:rgba(255,255,255,0.4);margin-top:4px}
  .btn-export{display:inline-flex;align-items:center;gap:8px;background:var(--gold);color:#000;text-decoration:none;padding:11px 24px;border-radius:100px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;transition:.2s}
  .btn-export:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(255,212,96,0.4)}

  /* STATS */
  .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px}
  .stat-card{background:var(--bg2);border:1px solid var(--gb);border-radius:16px;padding:22px 24px}
  .stat-label{font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,0.35);margin-bottom:10px}
  .stat-value{font-size:36px;font-weight:800;line-height:1}
  .stat-value.blue{background:linear-gradient(135deg,var(--blue-l),var(--pink));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .stat-sub{font-size:12px;color:rgba(255,255,255,0.3);margin-top:6px}

  /* TABLE */
  .table-wrap{background:var(--bg2);border:1px solid var(--gb);border-radius:20px;overflow:hidden}
  .table-head{padding:20px 24px;border-bottom:1px solid var(--gb);display:flex;align-items:center;justify-content:space-between}
  .table-head h3{font-size:14px;font-weight:700}
  .count-badge{background:rgba(91,115,255,0.15);color:var(--blue-l);border:1px solid rgba(91,115,255,0.25);border-radius:100px;padding:3px 12px;font-size:12px;font-weight:600}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;padding:12px 20px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,0.3);border-bottom:1px solid var(--gb);font-weight:600}
  td{padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:middle}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:rgba(255,255,255,0.02)}
  .num{font-size:12px;color:rgba(255,255,255,0.25);font-weight:500}
  .person{display:flex;align-items:center;gap:12px}
  .avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--pink));display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0}
  .name{font-size:14px;font-weight:600}
  .email-link{color:rgba(255,255,255,0.55);font-size:13px;text-decoration:none;transition:.2s}
  .email-link:hover{color:#fff}
  .date-cell{display:block;font-size:13px;color:rgba(255,255,255,0.7)}
  .time-cell{display:block;font-size:11px;color:rgba(255,255,255,0.3);margin-top:2px}
  .empty-state{text-align:center;padding:80px 20px}
  .empty-icon{font-size:48px;margin-bottom:16px;opacity:.3}
  .empty-state h3{font-size:18px;font-weight:700;margin-bottom:8px;color:rgba(255,255,255,0.5)}
  .empty-state p{font-size:14px;color:rgba(255,255,255,0.25)}

  @media(max-width:900px){
    .sidebar{display:none}
    .main{margin-left:0;padding:24px 16px}
    .stats{grid-template-columns:1fr 1fr}
  }
</style>
</head>
<body>

<div class="sidebar">
  <div class="brand">MAD <span>Admin</span></div>
  <div class="nav-item active">
    <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    Signups
  </div>
  <div class="sidebar-foot">
    <p><strong>Admin Panel</strong><br>MAD Party World<br>madpartyworld.com</p>
  </div>
</div>

<div class="main">
  <div class="topbar">
    <div class="topbar-left">
      <h1>Signups</h1>
      <p>Everyone who signed up on the website</p>
    </div>
    <a class="btn-export" href="${csv}" download="mad-signups.csv">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Export CSV
    </a>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-label">Total Signups</div>
      <div class="stat-value blue">${signups.length}</div>
      <div class="stat-sub">All time</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Today</div>
      <div class="stat-value blue">${today}</div>
      <div class="stat-sub">New today</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Latest</div>
      <div class="stat-value" style="font-size:18px;color:#fff;margin-top:4px">${signups.length > 0 ? signups[0].name : '—'}</div>
      <div class="stat-sub">${signups.length > 0 ? signups[0].email : 'No signups yet'}</div>
    </div>
  </div>

  <div class="table-wrap">
    <div class="table-head">
      <h3>All Signups</h3>
      <span class="count-badge">${signups.length} total</span>
    </div>
    ${signups.length === 0 ? `
    <div class="empty-state">
      <div class="empty-icon">📭</div>
      <h3>No signups yet</h3>
      <p>When people sign up on the website, they'll appear here.</p>
    </div>` : `
    <table>
      <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`}
  </div>
</div>

</body></html>`);
  } catch (e) {
    console.error(e);
    res.status(500).send('Server error');
  }
});

app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MAD Party running on port ${PORT}`));
