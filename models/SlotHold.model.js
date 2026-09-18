import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  salonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Salon', required: true },
  barberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Barber', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Service' }],
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ['active', 'expired'], default: 'active' },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
}, { timestamps: true });
schema.index({ barberId: 1, status: 1, expiresAt: 1, startTime: 1, endTime: 1 });
export default mongoose.model('SlotHold', schema);
