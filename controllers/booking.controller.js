import SlotHold from "../models/SlotHold.model.js";
import { dayBounds } from "../utils/bookingRules.js";
import Booking from "../models/Booking.model.js";
import Salon from "../models/Salon.model.js";
import ApiError from "../utils/apiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getAvailableSlots } from "../services/availability.service.js";
import { createBooking, cancelBooking, changeBooking, createHold, releaseHold, assertOwner } from "../services/booking.service.js";
import { BOOKING_STATUS } from "../constants/bookingStatus.js";

// GET /api/bookings/available-slots?salonId=&barberId=&serviceIds=a,b&date=2026-08-30
export const getAvailableSlotsController = asyncHandler(async (req, res) => {
  const { salonId, barberId, serviceIds, date } = req.query;

  if (!salonId || !barberId || !serviceIds || !date) {
    throw new ApiError(400, "salonId, barberId, serviceIds and date are required");
  }

  const result = await getAvailableSlots({
    salonId,
    barberId,
    serviceIds: serviceIds.split(","),
    date,
    walkIn: req.query.walkIn === 'true' && req.user && (req.user.role === 'SALON_OWNER' || req.user.role === 'ADMIN'),
  });

  res.status(200).json({ success: true, data: result });
});

// POST /api/bookings
export const createBookingController = asyncHandler(async (req, res) => {
  const { salonId, barberId, serviceIds, startTime, bookingFor, paymentMethod, holdId } = req.body;

  if (!salonId || !barberId || !serviceIds?.length || !startTime) {
    throw new ApiError(400, "salonId, barberId, serviceIds and startTime are required");
  }

  const booking = await createBooking({
    customerId: req.user._id,
    salonId,
    barberId,
    serviceIds,
    startTime,
    bookingFor: bookingFor || { type: "SELF" },
    paymentMethod,
    holdId,
  });

  res.status(201).json({ success: true, message: "Booking created successfully", data: booking });
});

// GET /api/bookings/my-bookings
export const myBookings = asyncHandler(async (req, res) => {
  const { status } = req.query;

  const filter = { customerId: req.user._id };
  if (status) filter.bookingStatus = status;

  const bookings = await Booking.find(filter)
    .populate("salonId", "name address images coverImage")
    .populate("barberId", "name profileImage")
    .sort({ startTime: -1 });

  res.status(200).json({ success: true, data: bookings });
});

// GET /api/bookings/:id
export const getBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate("salonId", "name address images coverImage phone")
    .populate("barberId", "name profileImage");

  if (!booking) throw new ApiError(404, "Booking not found");

  const isCustomer = String(booking.customerId) === req.user._id.toString();

  if (!isCustomer) {
    const salon = await Salon.findById(booking.salonId._id);
    assertOwner(salon, req.user._id, req.user.role);
  }

  res.status(200).json({ success: true, data: booking });
});

// PUT /api/bookings/:id/cancel
export const cancelBookingController = asyncHandler(async (req, res) => {
  const booking = await cancelBooking({
    bookingId: req.params.id,
    userId: req.user._id,
    userRole: req.user.role,
    reason: req.body.reason,
  });

  res.status(200).json({ success: true, message: "Booking cancelled", data: booking });
});

// PUT /api/bookings/:id/status  (SALON_OWNER / ADMIN — move through the lifecycle)
export const updateBookingStatus = asyncHandler(async (req, res) => {
  const booking = await changeBooking({
    bookingId: req.params.id, userId: req.user._id, userRole: req.user.role,
    status: req.body.status === 'CONFIRMED' ? 'ACCEPTED' : req.body.status,
    reason: req.body.reason, barberId: req.body.barberId, chair: req.body.chair,
  });

  res.status(200).json({ success: true, data: booking });
});

// GET /api/bookings/salon/:salonId  (SALON_OWNER dashboard — bookings for one salon)
export const salonBookings = asyncHandler(async (req, res) => {
  const salon = await Salon.findById(req.params.salonId);
  if (!salon) throw new ApiError(404, "Salon not found");

  if (salon.ownerId.toString() !== req.user._id.toString() && req.user.role !== "ADMIN") {
    throw new ApiError(403, "You do not own this salon");
  }

  const { status, date } = req.query;
  const filter = { salonId: req.params.salonId };
  if (status) filter.bookingStatus = status;

  if (date) {
    const { start, end } = dayBounds(date);
    filter.startTime = { $gte: start, $lt: end };
  }

  const bookings = await Booking.find(filter)
    .populate("customerId", "name phone")
    .populate("barberId", "name")
    .sort({ startTime: 1 });

  res.status(200).json({ success: true, data: bookings });
});

export const holdSlot = asyncHandler(async (req, res) => {
  const { salonId, barberId, serviceIds, startTime } = req.body;
  const data = await createHold({ salonId, barberId, serviceIds, startTime, customerId: req.user._id });
  res.status(201).json({ success: true, data });
});
export const expireHold = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await releaseHold(req.params.id, req.user) });
});
export const listHolds = asyncHandler(async (req, res) => {
  const salon = await Salon.findById(req.params.salonId);
  if (!salon) throw new ApiError(404, 'Salon not found');
  assertOwner(salon, req.user._id, req.user.role);
  const data = await SlotHold.find({ salonId: salon._id, status: 'active', expiresAt: { $gt: new Date() } }).populate('barberId', 'name');
  res.json({ success: true, data });
});
export const walkInBooking = asyncHandler(async (req, res) => {
  const { salonId, barberId, serviceIds, startTime, name, phone } = req.body;
  const data = await createBooking({ salonId, barberId, serviceIds, startTime, bookingFor: { type: 'OTHER', name, phone }, walkIn: true, userId: req.user._id, userRole: req.user.role });
  res.status(201).json({ success: true, data });
});
