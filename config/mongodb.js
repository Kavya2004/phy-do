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

// ── User Activity Schema (login / logout tracking) ──
const userActivitySchema = new mongoose.Schema({
  email:      { type: String, required: true },
  loginTime:  { type: Date, required: true },
  logoutTime: { type: Date, default: null },
  // duration in seconds; set when user logs out
  durationSeconds: { type: Number, default: null },
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

export function getUserActivityModel() {
  return getConn().models.UserActivity || getConn().model('UserActivity', userActivitySchema);
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

// ── User Activity Helpers ──

/**
 * Record a new login. Returns the created document's _id string,
 * which the client stores and sends back on logout.
 */
export async function recordLogin(email) {
  try {
    const connected = await connectMongo();
    if (!connected) return null;
    const UserActivity = getUserActivityModel();
    const doc = await UserActivity.create({ email, loginTime: new Date() });
    console.log('[MongoDB] Login recorded:', email);
    return doc._id.toString();
  } catch (err) {
    console.error('[MongoDB] recordLogin error:', err.message);
    return null;
  }
}

/**
 * Update an existing activity record with logout time and total duration.
 */
export async function recordLogout(activityId) {
  try {
    const connected = await connectMongo();
    if (!connected) return null;
    const UserActivity = getUserActivityModel();
    const doc = await UserActivity.findById(activityId);
    if (!doc) return null;
    const logoutTime = new Date();
    const durationSeconds = Math.round((logoutTime - doc.loginTime) / 1000);
    doc.logoutTime = logoutTime;
    doc.durationSeconds = durationSeconds;
    await doc.save();
    console.log('[MongoDB] Logout recorded:', doc.email, `(${durationSeconds}s)`);
    return doc;
  } catch (err) {
    console.error('[MongoDB] recordLogout error:', err.message);
    return null;
  }
}
