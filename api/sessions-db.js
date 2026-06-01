import express from 'express';
import mongoose from 'mongoose';
import { Class, Session } from '../config/mongodb.js';

const router = express.Router();

// POST /api/db/classes  – create a class
router.post('/classes', async (req, res) => {
  const { className, professorName } = req.body;
  if (!className || !professorName)
    return res.status(400).json({ error: 'className and professorName are required' });
  try {
    const cls = await Class.create({ className, professorName });
    res.status(201).json(cls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/db/sessions  – professor creates a session for a class
router.post('/sessions', async (req, res) => {
  const { classId, sessionTitle, createdBy } = req.body;
  if (!classId || !sessionTitle || !createdBy?.name || !createdBy?.email)
    return res.status(400).json({ error: 'classId, sessionTitle, and createdBy {name, email} are required' });
  if (!mongoose.Types.ObjectId.isValid(classId))
    return res.status(400).json({ error: 'Invalid classId' });
  try {
    const session = await Session.create({ classId, sessionTitle, createdBy });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/db/sessions/:sessionId/join  – student joins a session
router.post('/sessions/:sessionId/join', async (req, res) => {
  const { name, email, tableNumber } = req.body;
  if (!name || !email || tableNumber == null)
    return res.status(400).json({ error: 'name, email, and tableNumber are required' });
  if (!mongoose.Types.ObjectId.isValid(req.params.sessionId))
    return res.status(400).json({ error: 'Invalid sessionId' });
  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.status === 'ended') return res.status(400).json({ error: 'Session has ended' });

    // Prevent duplicate joins by email
    if (session.students.some(s => s.email === email))
      return res.status(409).json({ error: 'Student already joined this session' });

    session.students.push({ name, email, tableNumber: Number(tableNumber) });
    await session.save();
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/db/classes/:classId/sessions  – browse sessions for a class
router.get('/classes/:classId/sessions', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.classId))
    return res.status(400).json({ error: 'Invalid classId' });
  try {
    const sessions = await Session.find({ classId: req.params.classId }).sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/db/sessions/:sessionId/end  – professor ends a session
router.patch('/sessions/:sessionId/end', async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.sessionId))
    return res.status(400).json({ error: 'Invalid sessionId' });
  try {
    const session = await Session.findByIdAndUpdate(
      req.params.sessionId,
      { status: 'ended' },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
