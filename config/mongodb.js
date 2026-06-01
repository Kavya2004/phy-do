import mongoose from 'mongoose';

// ── Schemas ────────────────────────────────────────────────────

const classSchema = new mongoose.Schema({
  className:     { type: String, required: true },
  professorName: { type: String, required: true },
  createdAt:     { type: Date, default: Date.now },
});

const studentSchema = new mongoose.Schema({
  studentId:   { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  name:        { type: String, required: true },
  email:       { type: String, required: true },
  tableNumber: { type: Number, required: true },
  joinedAt:    { type: Date, default: Date.now },
}, { _id: false });

const sessionSchema = new mongoose.Schema({
  sessionId:    { type: String, required: true, unique: true },
  classId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  sessionTitle: { type: String, required: true },
  createdBy: {
    name:  { type: String, required: true },
    email: { type: String, required: true },
  },
  status:   { type: String, enum: ['active', 'ended'], default: 'active' },
  students: { type: [studentSchema], default: [] },
}, { timestamps: true });

export const Class   = mongoose.models.Class   || mongoose.model('Class',   classSchema);
export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);

// ── Connection ─────────────────────────────────────────────────

let connectPromise = null;

export function connectMongo() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI not set – session data will not be persisted');
    return Promise.resolve(false);
  }
  if (mongoose.connection.readyState === 1) return Promise.resolve(true);
  if (connectPromise) return connectPromise;

  mongoose.set('bufferCommands', false);

  connectPromise = mongoose
    .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
    .then(() => { console.log('MongoDB connected'); return true; })
    .catch((err) => { console.error('MongoDB error:', err.message); connectPromise = null; return false; });

  return connectPromise;
}

// ── Helpers ────────────────────────────────────────────────────

export async function createSessionRecord({ sessionId, sessionTitle, hostName, hostEmail, className = 'Physics Class', professorName = 'Professor' }) {
  try {
    const connected = await connectMongo();
    if (!connected) return null;

    let classDoc = await Class.findOne({ className, professorName });
    if (!classDoc) {
      classDoc = await Class.create({ className, professorName });
    }

    const existing = await Session.findOne({ sessionId });
    if (existing) return existing;

    const session = await Session.create({
      sessionId,
      classId: classDoc._id,
      sessionTitle,
      createdBy: { name: hostName, email: hostEmail || '' },
      status: 'active',
      students: [],
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

    const session = await Session.findOne({ sessionId });
    if (!session) return null;

    const alreadyJoined = session.students.some(s => s.email === email);
    if (alreadyJoined) return session;

    session.students.push({
      studentId: new mongoose.Types.ObjectId().toString(),
      name,
      email,
      tableNumber,
      joinedAt: new Date(),
    });

    await session.save();
    console.log('[MongoDB] Student added:', name, 'to session', sessionId);
    return session;
  } catch (err) {
    console.error('[MongoDB] addStudentToSession error:', err.message);
    return null;
  }
}