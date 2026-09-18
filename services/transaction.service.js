import mongoose from 'mongoose';
import Salon from '../models/Salon.model.js';
import ApiError from '../utils/apiError.js';

// All capacity-changing writes contend on the same salon document. A read-only
// overlap check inside a transaction alone does not prevent write skew.
export async function withSalonTransaction(salonId, operation) {
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') {
    throw new ApiError(503, 'Booking requires MongoDB Atlas or a replica set for safe transactions');
  }
  return mongoose.connection.transaction(async (session) => {
    const salon = await Salon.findOneAndUpdate({ _id: salonId }, { $inc: { bookingRevision: 1 } }, { new: true, session });
    if (!salon) throw new ApiError(404, 'Salon not found');
    return operation(session, salon);
  });
}
