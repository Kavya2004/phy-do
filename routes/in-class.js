// routes/in-class.js
// All in-class storage: session records, student attendance,
// login/logout activity, and chat history — written to the
// separate MONGODB_URI_INCLASS database.

import express from 'express';
import {
  connectInClassMongo,
  createInClassSessionRecord,
  addStudentToInClassSession,
  recordInClassLogin,
  recordInClassLogout,
  getInClassChatModel,
  getInClassSessionModel,
  getInClassUserActivityModel,
} from '../config/mongodb.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// SESSION RECORDS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/in-class/sessions
// Called when the first student creates a table session.
// Body: { sessionId, sessionTitle, tableNumber, sessionNumber, hostName, hostEmail }
router.post('/sessions', async (req, res) => {
  const { sessionId, sessionTitle, tableNumber, sessionNumber, hostName, hostEmail } = req.body;
  if (!sessionId || !tableNumber || !sessionNumber) {
    return res.status(400).json({ error: 'sessionId, tableNumber, sessionNumber required' });
  }
  const doc = await createInClassSessionRecord({
    sessionId,
    sessionTitle: sessionTitle || `Table ${tableNumber} Session ${sessionNumber}`,
    tableNumber: Number(tableNumber),
    sessionNumber: Number(sessionNumber),
    hostName: hostName || 'unknown',
    hostEmail: hostEmail || '',
  });
  res.json({ ok: true, doc });
});

// POST /api/in-class/sessions/:sessionId/join
// Called when a student joins an existing table session.
// Body: { name, email, tableNumber, sessionNumber }
router.post('/sessions/:sessionId/join', async (req, res) => {
  const { sessionId } = req.params;
  const { name, email, tableNumber, sessionNumber } = req.body;
  if (!email || !tableNumber || !sessionNumber) {
    return res.status(400).json({ error: 'email, tableNumber, sessionNumber required' });
  }
  const doc = await addStudentToInClassSession({
    sessionId,
    name: name || email.split('@')[0],
    email,
    tableNumber: Number(tableNumber),
    sessionNumber: Number(sessionNumber),
  });
  res.json({ ok: true, doc });
});

// ─────────────────────────────────────────────────────────────────────────────
// LOGIN / LOGOUT ACTIVITY
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/in-class/activity/login
// Body: { email, tableNumber, sessionNumber, sessionId }
// Returns: { activityId }
router.post('/activity/login', async (req, res) => {
  const { email, tableNumber, sessionNumber, sessionId } = req.body;
  if (!email || !tableNumber || !sessionNumber) {
    return res.status(400).json({ error: 'email, tableNumber, sessionNumber required' });
  }
  const activityId = await recordInClassLogin({
    email: email.trim().toLowerCase(),
    tableNumber: Number(tableNumber),
    sessionNumber: Number(sessionNumber),
    sessionId: sessionId || '',
  });
  res.json({ activityId: activityId || null });
});

// POST /api/in-class/activity/logout
// Body: { activityId }
router.post('/activity/logout', async (req, res) => {
  const { activityId } = req.body;
  if (!activityId) return res.status(400).json({ error: 'activityId required' });
  const doc = await recordInClassLogout(activityId);
  if (!doc) return res.status(404).json({ error: 'Record not found or DB unavailable' });
  res.json({
    email: doc.email,
    tableNumber: doc.tableNumber,
    sessionNumber: doc.sessionNumber,
    loginTime: doc.loginTime,
    logoutTime: doc.logoutTime,
    durationSeconds: doc.durationSeconds,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CHAT HISTORY
// ─────────────────────────────────────────────────────────────────────────────

async function getChatModel() {
  const connected = await connectInClassMongo();
  if (!connected) throw new Error('InClass DB unavailable');
  return getInClassChatModel();
}

// POST /api/in-class/chat
// Create a new in-class chat conversation record.
// Body: { sessionId, sessionTitle, tableNumber, sessionNumber, email, title? }
router.post('/chat', async (req, res) => {
  const { sessionId, sessionTitle, tableNumber, sessionNumber, email, title } = req.body;
  if (!sessionId || !email || !tableNumber || !sessionNumber) {
    return res.status(400).json({ error: 'sessionId, email, tableNumber, sessionNumber required' });
  }
  try {
    const Convo = await getChatModel();
    const doc = await Convo.create({
      sessionId,
      sessionTitle: sessionTitle || `Table ${tableNumber} Session ${sessionNumber}`,
      tableNumber: Number(tableNumber),
      sessionNumber: Number(sessionNumber),
      email: email.trim().toLowerCase(),
      title: title || 'In-Class Conversation',
      messages: [],
    });
    res.json(doc);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// GET /api/in-class/chat?email=...
// List all in-class conversations for a student (no messages).
router.get('/chat', async (req, res) => {
  const { email, sessionId } = req.query;
  if (!email && !sessionId) return res.status(400).json({ error: 'email or sessionId required' });
  try {
    const Convo = await getChatModel();
    const filter = {};
    if (email) filter.email = email.trim().toLowerCase();
    if (sessionId) filter.sessionId = sessionId;
    const list = await Convo.find(filter, 'title sessionTitle tableNumber sessionNumber email createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(200);
    res.json(list);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// GET /api/in-class/chat/:id  — full conversation with messages
router.get('/chat/:id', async (req, res) => {
  try {
    const Convo = await getChatModel();
    const doc = await Convo.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// PATCH /api/in-class/chat/:id/messages
// Append messages to an in-class conversation.
// Body: { messages: [{ role, content, userName? }] }
router.patch('/chat/:id/messages', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }
  try {
    const Convo = await getChatModel();
    const doc = await Convo.findByIdAndUpdate(
      req.params.id,
      { $push: { messages: { $each: messages } } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, messageCount: doc.messages.length });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// PATCH /api/in-class/chat/:id/title
router.patch('/chat/:id/title', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const Convo = await getChatModel();
    const doc = await Convo.findByIdAndUpdate(req.params.id, { title }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, title: doc.title });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// DELETE /api/in-class/chat/:id
router.delete('/chat/:id', async (req, res) => {
  try {
    const Convo = await getChatModel();
    await Convo.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD (in-class attendance view)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/in-class/dashboard  — returns HTML attendance table
router.get('/dashboard', async (req, res) => {
  try {
    const connected = await connectInClassMongo();
    if (!connected) return res.status(503).send('<h2>InClass MongoDB not connected</h2>');
    const Session = getInClassSessionModel();
    const allSessions = await Session.find().sort({ createdAt: -1 }).lean();

    const rows = allSessions.flatMap(s => {
      const base = { session: s.sessionTitle, table: s.tableNumber, sessionNum: s.sessionNumber, date: s.createdAt };
      if (s.students.length === 0) {
        return [{ ...base, name: s.createdBy.name, email: s.createdBy.email }];
      }
      return s.students.map(st => ({ ...base, name: st.name, email: st.email }));
    });

    const tableRows = rows.map(r => `
      <tr>
        <td>${r.session}</td>
        <td>${r.table}</td>
        <td>${r.sessionNum}</td>
        <td>${new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
        <td>${r.name}</td>
        <td>${r.email}</td>
      </tr>`).join('');

    const csvRows = [
      ['Session', 'Table', 'Session #', 'Date', 'Name', 'Email'],
      ...rows.map(r => [r.session, r.table, r.sessionNum, new Date(r.date).toLocaleDateString(), r.name, r.email])
    ].map(r => r.join(',')).join('\n');

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>In-Class Attendance</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; background: #f5f7fa; color: #333; }
    h1 { margin-bottom: 8px; }
    p.subtitle { color: #666; margin-bottom: 16px; }
    .toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 20px; flex-wrap: wrap; }
    input#search { padding: 8px 12px; border: 2px solid #e9ecef; border-radius: 6px; font-size: 14px; width: 220px; outline: none; }
    a.btn, button.btn { display: inline-block; padding: 8px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; border: none; text-decoration: none; }
    .btn-blue { background: #881c1c; color: white; }
    .btn-green { background: #28a745; color: white; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    th { background: #881c1c; color: white; padding: 12px 16px; text-align: left; cursor: pointer; user-select: none; white-space: nowrap; }
    th:hover { background: #6e1616; }
    th .arrow { margin-left: 6px; opacity: 0.6; font-size: 11px; }
    td { padding: 11px 16px; border-bottom: 1px solid #f0f0f0; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #fff5f5; }
    .no-results { text-align: center; padding: 24px; color: #999; }
  </style>
</head>
<body>
  <h1>🏫 In-Class Attendance</h1>
  <p class="subtitle">Last updated: ${new Date().toLocaleString()}</p>
  <div class="toolbar">
    <a class="btn btn-blue" href="/api/in-class/dashboard">🔄 Refresh</a>
    <button class="btn btn-green" onclick="exportCSV()">⬇️ Export CSV</button>
    <input id="search" placeholder="Search name, email, table..." oninput="filterTable(this.value)">
  </div>
  <table id="mainTable">
    <thead><tr>
      <th onclick="sortTable(0)">Session <span class="arrow">↕</span></th>
      <th onclick="sortTable(1)">Table # <span class="arrow">↕</span></th>
      <th onclick="sortTable(2)">Session # <span class="arrow">↕</span></th>
      <th onclick="sortTable(3)">Date <span class="arrow">↕</span></th>
      <th onclick="sortTable(4)">Name <span class="arrow">↕</span></th>
      <th onclick="sortTable(5)">Email <span class="arrow">↕</span></th>
    </tr></thead>
    <tbody id="tableBody">${tableRows}</tbody>
  </table>
  <script>
    const csvData = ${JSON.stringify(csvRows)};
    let sortDir = {};
    function sortTable(col) {
      const tbody = document.getElementById('tableBody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      sortDir[col] = !sortDir[col];
      rows.sort((a, b) => {
        const aVal = a.cells[col].textContent.trim();
        const bVal = b.cells[col].textContent.trim();
        const n = (col === 1 || col === 2) ? Number(aVal) - Number(bVal) : aVal.localeCompare(bVal);
        return sortDir[col] ? n : -n;
      });
      rows.forEach(r => tbody.appendChild(r));
      document.querySelectorAll('th .arrow').forEach((a, i) => {
        a.textContent = i === col ? (sortDir[col] ? '↑' : '↓') : '↕';
      });
    }
    function filterTable(q) {
      const rows = document.querySelectorAll('#tableBody tr');
      const lower = q.toLowerCase();
      let any = false;
      rows.forEach(r => {
        const match = r.textContent.toLowerCase().includes(lower);
        r.style.display = match ? '' : 'none';
        if (match) any = true;
      });
      let noRes = document.getElementById('noResults');
      if (!any) {
        if (!noRes) { noRes = document.createElement('tr'); noRes.id = 'noResults'; noRes.innerHTML = '<td colspan="6" class="no-results">No results found</td>'; document.getElementById('tableBody').appendChild(noRes); }
      } else if (noRes) noRes.remove();
    }
    function exportCSV() {
      const blob = new Blob([csvData], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'inclass-attendance-${new Date().toISOString().split('T')[0]}.csv';
      a.click();
    }
  </script>
</body>
</html>`);
  } catch (err) {
    res.status(500).send(`<h2>Error: ${err.message}</h2>`);
  }
});

export default router;
