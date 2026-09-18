import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
  kind: String,
  message: String,
  read: { type: Boolean, default: false },
}, { timestamps: true });
schema.index({ userId: 1, createdAt: -1 });
export default mongoose.model('Notification', schema);
