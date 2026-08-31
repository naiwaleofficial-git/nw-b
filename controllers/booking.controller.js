import Booking from "../models/Booking.model.js";
import Salon from "../models/Salon.model.js";
import ApiError from "../utils/apiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getAvailableSlots } from "../services/availability.service.js";
import { createBooking, cancelBooking } from "../services/booking.service.js";
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
  });

  res.status(200).json({ success: true, data: result });
});

// POST /api/bookings
export const createBookingController = asyncHandler(async (req, res) => {
  const { salonId, barberId, serviceIds, startTime, bookingFor, paymentMethod } = req.body;

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

  const isCustomer = booking.customerId.toString() === req.user._id.toString();

  if (!isCustomer && req.user.role === "CUSTOMER") {
    throw new ApiError(403, "Not authorized to view this booking");
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
  const { status } = req.body;

  if (!Object.values(BOOKING_STATUS).includes(status)) {
    throw new ApiError(400, "Invalid booking status");
  }

  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, "Booking not found");

  const salon = await Salon.findById(booking.salonId);
  const owns = salon && salon.ownerId.toString() === req.user._id.toString();

  if (!owns && req.user.role !== "ADMIN") {
    throw new ApiError(403, "Not authorized to update this booking");
  }

  booking.bookingStatus = status;
  await booking.save();

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
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    filter.startTime = { $gte: start, $lte: end };
  }

  const bookings = await Booking.find(filter)
    .populate("customerId", "name phone")
    .populate("barberId", "name")
    .sort({ startTime: 1 });

  res.status(200).json({ success: true, data: bookings });
});
