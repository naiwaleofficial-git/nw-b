import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  phone: { type: String, unique: true, required: true },
  digest: String,
  expiresAt: Date,
  sentAt: Date,
  attempts: { type: Number, default: 0 },
  consumed: { type: Boolean, default: false },
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export default mongoose.model('OtpChallenge', schema);
