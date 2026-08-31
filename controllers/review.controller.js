import Review from "../models/Review.model.js";
import Booking from "../models/Booking.model.js";
import Salon from "../models/Salon.model.js";
import Barber from "../models/Barber.model.js";
import ApiError from "../utils/apiError.js";
import asyncHandler from "../utils/asyncHandler.js";

async function recalculateRatings(salonId, barberId) {
  const [salonAgg] = await Review.aggregate([
    { $match: { salonId, isVisible: true } },
    { $group: { _id: "$salonId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  const [barberAgg] = await Review.aggregate([
    { $match: { barberId, isVisible: true } },
    { $group: { _id: "$barberId", avg: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);

  await Salon.findByIdAndUpdate(salonId, {
    ratingAverage: salonAgg ? Math.round(salonAgg.avg * 10) / 10 : 0,
    totalReviews: salonAgg ? salonAgg.count : 0,
  });

  await Barber.findByIdAndUpdate(barberId, {
    ratingAverage: barberAgg ? Math.round(barberAgg.avg * 10) / 10 : 0,
    totalReviews: barberAgg ? barberAgg.count : 0,
  });
}

// POST /api/reviews  { bookingId, rating, comment }
export const createReview = asyncHandler(async (req, res) => {
  const { bookingId, rating, comment } = req.body;

  if (!bookingId || !rating) {
    throw new ApiError(400, "bookingId and rating are required");
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, "Booking not found");

  if (booking.customerId.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only review your own bookings");
  }

  if (booking.bookingStatus !== "COMPLETED") {
    throw new ApiError(400, "Only completed bookings can be reviewed");
  }

  const existing = await Review.findOne({ bookingId });
  if (existing) throw new ApiError(409, "This booking has already been reviewed");

  const review = await Review.create({
    customerId: req.user._id,
    salonId: booking.salonId,
    barberId: booking.barberId,
    bookingId,
    rating,
    comment,
  });

  await recalculateRatings(booking.salonId, booking.barberId);

  res.status(201).json({ success: true, data: review });
});

// GET /api/salons/:salonId/reviews
export const listReviewsForSalon = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ salonId: req.params.salonId, isVisible: true })
    .populate("customerId", "name profileImage")
    .populate("barberId", "name")
    .sort({ createdAt: -1 });

  res.status(200).json({ success: true, data: reviews });
});
