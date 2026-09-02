import mongoose from "mongoose";
import Booking from "../models/Booking.model.js";
import Service from "../models/Service.model.js";
import Barber from "../models/Barber.model.js";
import Salon from "../models/Salon.model.js";
import ApiError from "../utils/apiError.js";
import generateBookingNumber from "../utils/generateBookingNumber.js";
import { ACTIVE_BOOKING_STATUSES, BOOKING_STATUS, PAYMENT_STATUS } from "../constants/bookingStatus.js";

let transactionSupportPromise;

async function supportsTransactions() {
  if (!transactionSupportPromise) {
    transactionSupportPromise = mongoose.connection.db
      .admin()
      .command({ hello: 1 })
      .then((topology) => Boolean(topology.setName || topology.msg === "isdbgrid"));
  }

  return transactionSupportPromise;
}

/**
 * Creates a booking after re-validating availability. Getting available
 * slots earlier is not enough on its own — two customers can request the
 * same slot moments apart, so we re-run the exact same overlap check here,
 * as close as possible to the write, before committing the document.
 */
export async function createBooking({ customerId, salonId, barberId, serviceIds, startTime, bookingFor, paymentMethod }) {
  const salon = await Salon.findOne({ _id: salonId, isActive: true, isApproved: true });
  if (!salon) throw new ApiError(404, "Salon is unavailable");

  const barber = await Barber.findOne({ _id: barberId, salonId, isActive: true });
  if (!barber) throw new ApiError(404, "Barber is unavailable");

  const services = await Service.find({ _id: { $in: serviceIds }, salonId, isActive: true });
  if (services.length !== serviceIds.length) {
    throw new ApiError(400, "One or more selected services are invalid");
  }

  const serviceDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalDuration = serviceDuration + (salon.bookingBufferMinutes || 0);
  const subtotal = services.reduce((sum, s) => sum + s.price, 0);

  const bookingStart = new Date(startTime);
  if (Number.isNaN(bookingStart.getTime())) {
    throw new ApiError(400, "Invalid start time");
  }
  if (bookingStart.getTime() < Date.now()) {
    throw new ApiError(400, "Cannot book a slot in the past");
  }

  const bookingEnd = new Date(bookingStart.getTime() + totalDuration * 60000);
  const bookingData = {
    bookingNumber: generateBookingNumber(),
    customerId,
    salonId,
    barberId,
    services: services.map((s) => ({
      serviceId: s._id,
      name: s.name,
      price: s.price,
      durationMinutes: s.durationMinutes,
    })),
    bookingFor,
    startTime: bookingStart,
    endTime: bookingEnd,
    totalDurationMinutes: totalDuration,
    subtotal,
    discountAmount: 0,
    totalAmount: subtotal,
    bookingStatus: BOOKING_STATUS.PENDING,
    paymentStatus: PAYMENT_STATUS.PENDING,
    paymentMethod: paymentMethod || "PAY_AT_SALON",
  };

  const createIfAvailable = async (session) => {
    const conflictQuery = Booking.findOne({
      barberId,
      bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
      startTime: { $lt: bookingEnd },
      endTime: { $gt: bookingStart },
    });

    if (session) conflictQuery.session(session);

    const conflict = await conflictQuery;
    if (conflict) {
      throw new ApiError(409, "This slot was just booked. Please select another slot.");
    }

    if (!session) return Booking.create(bookingData);

    const [booking] = await Booking.create([bookingData], { session });
    return booking;
  };

  if (!(await supportsTransactions())) {
    return createIfAvailable();
  }

  const session = await mongoose.startSession();
  try {
    let booking;
    await session.withTransaction(async () => {
      booking = await createIfAvailable(session);
    });
    return booking;
  } finally {
    await session.endSession();
  }
}

export async function cancelBooking({ bookingId, userId, userRole, reason }) {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, "Booking not found");

  const isOwner = booking.customerId.toString() === userId.toString();
  if (!isOwner && userRole === "CUSTOMER") {
    throw new ApiError(403, "You can only cancel your own bookings");
  }

  if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED].includes(booking.bookingStatus)) {
    throw new ApiError(400, `Booking is already ${booking.bookingStatus.toLowerCase()}`);
  }

  booking.bookingStatus = BOOKING_STATUS.CANCELLED;
  booking.cancellationReason = reason || "No reason provided";
  booking.cancelledAt = new Date();
  booking.cancelledBy = userRole === "CUSTOMER" ? "CUSTOMER" : userRole === "ADMIN" ? "ADMIN" : "SALON";

  await booking.save();
  return booking;
}

export default { createBooking, cancelBooking };
