// config/mongodb.js
import mongoose from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// IN-CLASS DATABASE  (MONGODB_URI_INCLASS)
// Separate connection + models for in-class sessions, activity, and chat history
// ─────────────────────────────────────────────────────────────────────────────

let inClassConn = null;
let inClassConnectPromise = null;

export function connectInClassMongo() {
  const uri = process.env.MONGODB_URI_INCLASS;
  if (!uri) {
    console.warn('MONGODB_URI_INCLASS not set – skipping in-class DB');
    return Promise.resolve(false);
  }
  if (inClassConn && inClassConn.readyState === 1) return Promise.resolve(true);
  if (inClassConnectPromise) return inClassConnectPromise;

  inClassConn = mongoose.createConnection();
  inClassConn.set('bufferCommands', false);

  inClassConnectPromise = inClassConn
    .openUri(uri, { serverSelectionTimeoutMS: 15000 })
    .then(() => { console.log('[InClass DB] connected'); return true; })
    .catch((err) => {
      console.error('[InClass DB] error:', err.message);
      inClassConnectPromise = null;
      inClassConn = null;
      return false;
    });

  return inClassConnectPromise;
}

function getInClassConn() {
  if (!inClassConn || inClassConn.readyState !== 1) throw new Error('InClass MongoDB not connected');
  return inClassConn;
}

// ── In-Class Session Schema ───────────────────────────────────────────────────
const inClassStudentSchema = new mongoose.Schema({
  name:          { type: String, required: true },
  email:         { type: String, required: true },
  tableNumber:   { type: Number, required: true },
  sessionNumber: { type: Number, required: true },
  joinedAt:      { type: Date, default: Date.now },
}, { _id: false });

const inClassSessionSchema = new mongoose.Schema({
  sessionId:     { type: String, required: true, unique: true },
  sessionTitle:  { type: String, required: true },   // "Table N Session S"
  tableNumber:   { type: Number, required: true },
  sessionNumber: { type: Number, required: true },
  createdBy: {
    name:  { type: String, required: true },
    email: { type: String, default: '' },
  },
  status:   { type: String, enum: ['active', 'ended'], default: 'active' },
  students: { type: [inClassStudentSchema], default: [] },
}, { timestamps: true });

export function getInClassSessionModel() {
  return getInClassConn().models.InClassSession ||
    getInClassConn().model('InClassSession', inClassSessionSchema);
}

// ── In-Class Chat History Schema ──────────────────────────────────────────────
const inClassChatMessageSchema = new mongoose.Schema({
  role:      { type: String, enum: ['user', 'bot'], required: true },
  content:   { type: String, required: true },
  userName:  { type: String, default: '' },   // who sent it (in shared sessions)
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const inClassChatConversationSchema = new mongoose.Schema({
  sessionId:     { type: String, required: true, index: true },
  sessionTitle:  { type: String, required: true },
  tableNumber:   { type: Number, required: true },
  sessionNumber: { type: Number, required: true },
  email:         { type: String, required: true, index: true },  // student who initiated
  title:         { type: String, default: 'In-Class Conversation' },
  messages:      { type: [inClassChatMessageSchema], default: [] },
}, { timestamps: true });

export function getInClassChatModel() {
  return getInClassConn().models.InClassChatConversation ||
    getInClassConn().model('InClassChatConversation', inClassChatConversationSchema);
}

// ── In-Class User Activity Schema ─────────────────────────────────────────────
const inClassUserActivitySchema = new mongoose.Schema({
  email:         { type: String, required: true },
  tableNumber:   { type: Number, required: true },
  sessionNumber: { type: Number, required: true },
  sessionId:     { type: String, default: '' },
  loginTime:     { type: Date, required: true },
  logoutTime:    { type: Date, default: null },
  durationSeconds: { type: Number, default: null },
}, { timestamps: true });

export function getInClassUserActivityModel() {
  return getInClassConn().models.InClassUserActivity ||
    getInClassConn().model('InClassUserActivity', inClassUserActivitySchema);
}

// ── In-Class Helpers ──────────────────────────────────────────────────────────

export async function createInClassSessionRecord({ sessionId, sessionTitle, tableNumber, sessionNumber, hostName, hostEmail }) {
  try {
    const connected = await connectInClassMongo();
    if (!connected) return null;
    const Session = getInClassSessionModel();
    const existing = await Session.findOne({ sessionId });
    if (existing) return existing;
    const doc = await Session.create({
      sessionId,
      sessionTitle,
      tableNumber,
      sessionNumber,
      createdBy: { name: hostName, email: hostEmail || '' },
    });
    console.log('[InClass DB] Session created:', sessionId);
    return doc;
  } catch (err) {
    console.error('[InClass DB] createInClassSessionRecord error:', err.message);
    return null;
  }
}

export async function addStudentToInClassSession({ sessionId, name, email, tableNumber, sessionNumber }) {
  try {
    const connected = await connectInClassMongo();
    if (!connected) return null;
    const Session = getInClassSessionModel();
    const session = await Session.findOne({ sessionId });
    if (!session) return null;
    if (session.students.some(s => s.email === email)) return session;
    session.students.push({ name, email, tableNumber, sessionNumber, joinedAt: new Date() });
    await session.save();
    return session;
  } catch (err) {
    console.error('[InClass DB] addStudentToInClassSession error:', err.message);
    return null;
  }
}

export async function recordInClassLogin({ email, tableNumber, sessionNumber, sessionId }) {
  try {
    const connected = await connectInClassMongo();
    if (!connected) return null;
    const Activity = getInClassUserActivityModel();
    const doc = await Activity.create({
      email,
      tableNumber,
      sessionNumber,
      sessionId: sessionId || '',
      loginTime: new Date(),
    });
    console.log('[InClass DB] Login recorded:', email, `T${tableNumber}S${sessionNumber}`);
    return doc._id.toString();
  } catch (err) {
    console.error('[InClass DB] recordInClassLogin error:', err.message);
    return null;
  }
}

export async function recordInClassLogout(activityId) {
  try {
    const connected = await connectInClassMongo();
    if (!connected) return null;
    const Activity = getInClassUserActivityModel();
    const doc = await Activity.findById(activityId);
    if (!doc) return null;
    const logoutTime = new Date();
    doc.logoutTime = logoutTime;
    doc.durationSeconds = Math.round((logoutTime - doc.loginTime) / 1000);
    await doc.save();
    return doc;
  } catch (err) {
    console.error('[InClass DB] recordInClassLogout error:', err.message);
    return null;
  }
}

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

// ── Chat History Schema ──
const chatMessageSchema = new mongoose.Schema({
  role:      { type: String, enum: ['user', 'bot'], required: true },
  content:   { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const chatConversationSchema = new mongoose.Schema({
  email:    { type: String, required: true, index: true },
  title:    { type: String, default: 'New Conversation' },
  messages: { type: [chatMessageSchema], default: [] },
}, { timestamps: true });

export function getChatConversationModel() {
  return getConn().models.ChatConversation || getConn().model('ChatConversation', chatConversationSchema);
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
