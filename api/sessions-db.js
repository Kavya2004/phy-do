import express from 'express';
import { connectMongo, getSessionModel } from '../config/mongodb.js';

const router = express.Router();

// GET /api/db/sessions  – get all sessions (dashboard use)
router.get('/sessions', async (req, res) => {
  try {
    const Session = getSessionModel();
    const sessions = await Session.find().sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/db/sessions/:sessionId  – get one session with students
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const Session = getSessionModel();
    const session = await Session.findOne({ sessionId: req.params.sessionId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/db/sessions/:sessionId/end
router.patch('/sessions/:sessionId/end', async (req, res) => {
  try {
    const Session = getSessionModel();
    const session = await Session.findOneAndUpdate(
      { sessionId: req.params.sessionId },
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