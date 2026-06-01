import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import geminiHandler from './api/gemini.js';
import imageGenHandler from './api/image-gen.js';
import pineconeHandler from './api/pinecone.js';
import searchHandler from './api/search.js';
import pdfContentHandler from './api/pdf-content.js';
import pdfPageHandler from './api/pdf-page.js';
import pdfImageHandler from './api/pdf-image.js';
import { connectMongo, createSessionRecord, addStudentToSession } from './config/mongodb.js';
import sessionDbRouter from './api/sessions-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));
app.use('/pages', express.static('pages'));

// API routes
app.post('/api/gemini', geminiHandler);
app.post('/api/image-gen', imageGenHandler);
app.post('/api/pinecone', pineconeHandler);
app.post('/api/search', searchHandler);
app.post('/api/pdf-content', pdfContentHandler);
app.post('/api/pdf-page', pdfPageHandler);
app.get('/api/pdf-image', pdfImageHandler);
app.use('/api/db', sessionDbRouter);

// ── Session store ──────────────────────────────────────────────
const sessions = new Map();
const sessionConnections = new Map();

function generateSessionId() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
}

function broadcastToSession(sessionId, message, excludeWs = null) {
    const connections = sessionConnections.get(sessionId) || [];
    connections.forEach(({ ws }) => {
        if (ws !== excludeWs && ws.readyState === 1) {
            ws.send(JSON.stringify(message));
        }
    });
}

// Create session
app.post('/api/sessions/create', (req, res) => {
    const { hostName, avatar, color, isPublic = true, sessionTitle, userEmail } = req.body;
    if (!hostName || !hostName.trim()) {
        return res.status(400).json({ error: 'Host name is required' });
    }
    const sessionId = generateSessionId();
    const session = {
        sessionId,
        hostName: hostName.trim(),
        isPublic,
        sessionTitle: sessionTitle || '',
        participants: new Map([[hostName.trim(), { userName: hostName.trim(), avatar: avatar || '👨🏫', color: color || '#007bff', isHost: true, joinedAt: new Date() }]]),
        messages: [],
        whiteboardActions: [],
        createdAt: new Date(),
        lastActivity: new Date(),
    };
    sessions.set(sessionId, session);
    sessionConnections.set(sessionId, []);

    console.log(`Session created: ${sessionId} by ${hostName}`);

    // Persist to MongoDB
    createSessionRecord({
      sessionId,
      sessionTitle: sessionTitle || '',
      hostName: hostName.trim(),
      hostEmail: userEmail || '',
    }).catch(err => console.error('[MongoDB] Failed to persist session:', err.message));

    res.json({ sessionId, message: 'Session created successfully', session: serializeSession(session) });
});

// Join session
app.post('/api/sessions/:sessionId/join', (req, res) => {
    const { sessionId } = req.params;
    const { userName, avatar, color } = req.body;
    if (!userName || !userName.trim()) return res.status(400).json({ error: 'User name is required' });
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.participants.has(userName.trim())) return res.status(400).json({ error: 'User name already taken' });
    session.participants.set(userName.trim(), { userName: userName.trim(), avatar: avatar || '👤', color: color || '#6c757d', isHost: false, joinedAt: new Date() });
    session.lastActivity = new Date();

    // Persist student to MongoDB
    const { userEmail: studentEmail, tableNumber } = req.body;
    if (studentEmail) {
      addStudentToSession({
        sessionId,
        name: userName.trim(),
        email: studentEmail,
        tableNumber: Number(tableNumber) || 0,
      }).catch(err => console.error('[MongoDB] Failed to add student:', err.message));
    }

    res.json({ message: 'Joined successfully', session: serializeSession(session) });
});

// Find session by table number
app.get('/api/sessions/by-table/:tableNumber', (req, res) => {
    const tableNumber = Number(req.params.tableNumber);
    const session = Array.from(sessions.values()).find(
        s => s.sessionTitle === `Table ${tableNumber}`
    );
    if (!session) return res.status(404).json({ error: `No active session found for Table ${tableNumber}` });
    res.json({ sessionId: session.sessionId, sessionTitle: session.sessionTitle });
});

// Public sessions
app.get('/api/sessions/public', (req, res) => {
    const publicSessions = Array.from(sessions.values())
        .filter(s => s.isPublic)
        .map(s => ({ sessionId: s.sessionId, sessionTitle: s.sessionTitle, hostName: s.hostName, participantCount: s.participants.size, createdAt: s.createdAt }));
    res.json(publicSessions);
});

// Get session
app.get('/api/sessions/:sessionId', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(serializeSession(session));
});

// Download session
app.get('/api/sessions/:sessionId/download', (req, res) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ ...serializeSession(session), exportedAt: new Date().toISOString() });
});

function serializeSession(session) {
    return {
        ...session,
        participants: Array.from(session.participants.values()),
    };
}

// ── WebSocket ──────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
    const sessionId = new URL(req.url, `http://localhost`).pathname.split('/')[2];
    const session = sessions.get(sessionId);
    if (!session) { ws.close(1008, 'Session not found'); return; }
    if (!sessionConnections.has(sessionId)) sessionConnections.set(sessionId, []);

    let userName = null;

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            switch (msg.type) {
                case 'join':
                    userName = msg.userName;
                    if (session.participants.has(userName)) {
                        const p = session.participants.get(userName);
                        p.avatar = msg.avatar || p.avatar;
                        p.color = msg.color || p.color;
                    }
                    sessionConnections.get(sessionId).push({ ws, userName });
                    broadcastToSession(sessionId, { type: 'participant_joined', userName, timestamp: new Date().toISOString() }, ws);
                    ws.send(JSON.stringify({ type: 'session_info', sessionTitle: session.sessionTitle, isPublic: session.isPublic, participants: Array.from(session.participants.values()) }));
                    ws.send(JSON.stringify({ type: 'participants_update', participants: Array.from(session.participants.values()) }));
                    break;
                case 'message':
                    if (userName) {
                        const msgObj = { id: uuidv4(), message: msg.message, sender: msg.sender, userName, timestamp: new Date().toISOString(), files: msg.files || [] };
                        session.messages.push(msgObj);
                        session.lastActivity = new Date();
                        broadcastToSession(sessionId, { type: 'message', ...msgObj });
                    }
                    break;
                case 'whiteboard_action':
                    if (userName) {
                        broadcastToSession(sessionId, { type: 'whiteboard_action', action: msg.action, targetBoard: msg.targetBoard, userName, timestamp: new Date().toISOString() }, ws);
                    }
                    break;
                case 'leave':
                    if (userName) {
                        session.participants.delete(userName);
                        broadcastToSession(sessionId, { type: 'participant_left', userName, timestamp: new Date().toISOString() }, ws);
                    }
                    break;
                case 'profile_update':
                    if (userName && session.participants.has(userName)) {
                        const p = session.participants.get(userName);
                        p.avatar = msg.avatar || p.avatar;
                        p.color = msg.color || p.color;
                        broadcastToSession(sessionId, { type: 'participants_update', participants: Array.from(session.participants.values()) });
                    }
                    break;
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong' }));
                    break;
            }
        } catch (e) { console.error('WS message error:', e); }
    });

    ws.on('close', () => {
        if (userName) {
            const conns = sessionConnections.get(sessionId) || [];
            const idx = conns.findIndex(c => c.ws === ws);
            if (idx > -1) conns.splice(idx, 1);
            session.participants.delete(userName);
            broadcastToSession(sessionId, { type: 'participant_left', userName, timestamp: new Date().toISOString() });
            if (session.participants.size === 0) {
                sessions.delete(sessionId);
                sessionConnections.delete(sessionId);
            }
        }
    });
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'tutor.html'));
});

// Dashboard – all session attendance
app.get('/dashboard', async (req, res) => {
    try {
        const connected = await connectMongo();
        if (!connected) return res.status(503).send('<h2>MongoDB not connected</h2>');

        const { Session } = await import('./config/mongodb.js');
        const allSessions = await Session.find().sort({ createdAt: -1 }).lean();

        const rows = allSessions.flatMap(s =>
            s.students.length === 0
                ? [{ session: s.sessionTitle, date: s.createdAt, name: '—', email: '—', table: '—' }]
                : s.students.map(st => ({ session: s.sessionTitle, date: s.createdAt, name: st.name, email: st.email, table: st.tableNumber }))
        );

        const tableRows = rows.map(r => `
            <tr>
                <td>${r.session}</td>
                <td>${new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td>${r.name}</td>
                <td>${r.email}</td>
                <td>${r.table}</td>
            </tr>`).join('');

        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Session Attendance</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; background: #f5f7fa; color: #333; }
    h1 { margin-bottom: 8px; }
    p.subtitle { color: #666; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    th { background: #4a6cf7; color: white; padding: 12px 16px; text-align: left; font-weight: 600; }
    td { padding: 11px 16px; border-bottom: 1px solid #f0f0f0; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #f8f9ff; }
    .refresh { display: inline-block; margin-bottom: 20px; padding: 8px 16px; background: #4a6cf7; color: white; border-radius: 6px; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <h1>📋 Session Attendance</h1>
  <p class="subtitle">Last updated: ${new Date().toLocaleString()}</p>
  <a class="refresh" href="/dashboard">🔄 Refresh</a>
  <table>
    <thead><tr><th>Session</th><th>Date</th><th>Name</th><th>Email</th><th>Table #</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`);
    } catch (err) {
        res.status(500).send(`<h2>Error: ${err.message}</h2>`);
    }
});

connectMongo();

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});