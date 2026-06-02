// config/mongodb.js  ← REPLACE ENTIRE FILE with this (same for both repos)
import mongoose from 'mongoose';

const studentSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  email:       { type: String, required: true },
  tableNumber: { type: Number, required: true },
  joinedAt:    { type: Date, default: Date.now },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  sessionId:    { type: String, required: true, unique: true },
  sessionTitle: { type: String, required: true },
  createdBy: {
    name:  { type: String, required: true },
    email: { type: String, default: '' },
  },
  status:   { type: String, enum: ['active', 'ended'], default: 'active' },
  students: { type: [studentSchema], default: [] },
}, { timestamps: true });

// ── Connection (use createConnection to keep models isolated) ──
let conn = null;
let connectPromise = null;

export function connectMongo() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI not set – skipping DB');
    return Promise.resolve(false);
  }
  if (conn && conn.readyState === 1) return Promise.resolve(true);
  if (connectPromise) return connectPromise;

  conn = mongoose.createConnection();
  conn.set('bufferCommands', false);

  connectPromise = conn
    .openUri(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
    .then(() => { console.log('MongoDB connected'); return true; })
    .catch((err) => { console.error('MongoDB error:', err.message); connectPromise = null; conn = null; return false; });

  return connectPromise;
}

function getConn() {
  if (!conn || conn.readyState !== 1) throw new Error('MongoDB not connected');
  return conn;
}

export function getSessionModel() {
  return getConn().models.Session || getConn().model('Session', sessionSchema);
}

// ── Helpers ──
export async function createSessionRecord({ sessionId, sessionTitle, hostName, hostEmail }) {
  try {
    const connected = await connectMongo();
    if (!connected) return null;
    const Session = getSessionModel();
    const existing = await Session.findOne({ sessionId });
    if (existing) return existing;
    const session = await Session.create({
      sessionId,
      sessionTitle,
      createdBy: { name: hostName, email: hostEmail || '' },
    });
    console.log('[MongoDB] Session created:', sessionId);
    return session;
  } catch (err) {
    console.error('[MongoDB] createSessionRecord error:', err.message);
    return null;
  }
}

export async function addStudentToSession({ sessionId, name, email, tableNumber }) {
  try {
    const connected = await connectMongo();
    if (!connected) return null;
    const Session = getSessionModel();
    const session = await Session.findOne({ sessionId });
    if (!session) return null;
    if (session.students.some(s => s.email === email)) return session;
    session.students.push({ name, email, tableNumber, joinedAt: new Date() });
    await session.save();
    return session;
  } catch (err) {
    console.error('[MongoDB] addStudentToSession error:', err.message);
    return null;
  }
}