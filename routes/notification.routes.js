import express from 'express';
import Notification from '../models/Notification.model.js';
import { protect } from '../middleware/auth.middleware.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();
router.use(protect);
router.get('/', asyncHandler(async (req, res) => {
  const data = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(100);
  const unread = await Notification.countDocuments({ userId: req.user._id, read: false });
  res.json({ success: true, data, unread });
}));
router.put('/read', asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, _id: { $in: req.body.ids || [] } }, { read: true });
  res.json({ success: true });
}));
// A database change stream works across API instances and only emits committed writes.
router.get('/stream', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders();
  const stream = Notification.watch([{ $match: { operationType: 'insert', 'fullDocument.userId': req.user._id } }]);
  stream.on('change', (event) => res.write(`data: ${JSON.stringify(event.fullDocument)}\n\n`));
  stream.on('error', () => res.end());
  const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);
  const expiry = setTimeout(() => res.end(), 15 * 60000);
  res.on('close', () => { clearInterval(heartbeat); clearTimeout(expiry); stream.close().catch(() => {}); });
  res.write(': connected\n\n');
});
export default router;
