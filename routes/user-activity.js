// api/user-activity.js
// Handles login and logout tracking for UMass students.
import express from 'express';
import { recordLogin, recordLogout, connectMongo, getUserActivityModel } from '../config/mongodb.js';

const router = express.Router();

// POST /api/user-activity/login
// Body: { email: "student@umass.edu" }
// Returns: { activityId: "<mongo _id>" }
router.post('/login', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.endsWith('@umass.edu')) {
    return res.status(400).json({ error: 'Valid @umass.edu email required' });
  }
  const activityId = await recordLogin(email.trim().toLowerCase());
  if (!activityId) {
    // DB unavailable — return a soft error so the client still works
    return res.status(200).json({ activityId: null, warning: 'DB unavailable' });
  }
  res.json({ activityId });
});

// POST /api/user-activity/logout
// Body: { activityId: "<mongo _id>" }
// Returns: { email, loginTime, logoutTime, durationSeconds }
router.post('/logout', async (req, res) => {
  const { activityId } = req.body;
  if (!activityId) {
    return res.status(400).json({ error: 'activityId required' });
  }
  const doc = await recordLogout(activityId);
  if (!doc) {
    return res.status(404).json({ error: 'Activity record not found or DB unavailable' });
  }
  res.json({
    email: doc.email,
    loginTime: doc.loginTime,
    logoutTime: doc.logoutTime,
    durationSeconds: doc.durationSeconds,
  });
});

// GET /api/user-activity  — dashboard / admin view of all activity
router.get('/', async (req, res) => {
  try {
    const connected = await connectMongo();
    if (!connected) return res.status(503).json({ error: 'DB unavailable' });
    const UserActivity = getUserActivityModel();
    const records = await UserActivity.find().sort({ loginTime: -1 }).limit(500);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
