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
