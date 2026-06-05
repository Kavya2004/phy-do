// api/chat-history.js
// Stores and retrieves per-user chat conversations.
import express from 'express';
import { connectMongo, getChatConversationModel } from '../config/mongodb.js';

const router = express.Router();

// ── helpers ──────────────────────────────────────────────────────────────────

async function getModel() {
  const connected = await connectMongo();
  if (!connected) throw new Error('DB unavailable');
  return getChatConversationModel();
}

// ── routes ───────────────────────────────────────────────────────────────────

// GET /api/chat-history?email=...
// Returns all conversations for the user (messages excluded for speed)
router.get('/', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const Convo = await getModel();
    const list = await Convo.find({ email }, 'title createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(100);
    res.json(list);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// POST /api/chat-history
// Create a new empty conversation
// Body: { email }
// Returns: { _id, title, messages, createdAt, updatedAt }
router.post('/', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });
  try {
    const Convo = await getModel();
    const doc = await Convo.create({ email, title: 'New Conversation', messages: [] });
    res.json(doc);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// GET /api/chat-history/:id
// Returns a full conversation including all messages
router.get('/:id', async (req, res) => {
  try {
    const Convo = await getModel();
    const doc = await Convo.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// PATCH /api/chat-history/:id/messages
// Append one or more messages to an existing conversation
// Body: { messages: [{ role, content }] }
router.patch('/:id/messages', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }
  try {
    const Convo = await getModel();
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

// PATCH /api/chat-history/:id/title
// Update the auto-generated title
// Body: { title }
router.patch('/:id/title', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const Convo = await getModel();
    const doc = await Convo.findByIdAndUpdate(req.params.id, { title }, { new: true });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, title: doc.title });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// DELETE /api/chat-history/:id
router.delete('/:id', async (req, res) => {
  try {
    const Convo = await getModel();
    await Convo.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

export default router;
