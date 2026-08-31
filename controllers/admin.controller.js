import User from "../models/User.model.js";
import Salon from "../models/Salon.model.js";
import Booking from "../models/Booking.model.js";
import Review from "../models/Review.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/apiError.js";

// GET /api/admin/stats
export const getPlatformStats = asyncHandler(async (req, res) => {
  const [totalUsers, totalCustomers, totalOwners, totalSalons, approvedSalons, totalBookings, completedBookings, revenueAgg] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "CUSTOMER" }),
      User.countDocuments({ role: "SALON_OWNER" }),
      Salon.countDocuments(),
      Salon.countDocuments({ isApproved: true }),
      Booking.countDocuments(),
      Booking.countDocuments({ bookingStatus: "COMPLETED" }),
      Booking.aggregate([
        { $match: { bookingStatus: "COMPLETED" } },
        { $group: { _id: null, total: { $sum: "$totalAmount" } } },
      ]),
    ]);

  res.status(200).json({
    success: true,
    data: {
      totalUsers,
      totalCustomers,
      totalOwners,
      totalSalons,
      approvedSalons,
      pendingSalons: totalSalons - approvedSalons,
      totalBookings,
      completedBookings,
      totalRevenue: revenueAgg[0]?.total || 0,
    },
  });
});

// GET /api/admin/salons?isApproved=false
export const listSalonsAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.isApproved !== undefined) filter.isApproved = req.query.isApproved === "true";

  const salons = await Salon.find(filter).populate("ownerId", "name phone email").sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: salons });
});

// PUT /api/admin/salons/:id/approve
export const approveSalon = asyncHandler(async (req, res) => {
  const salon = await Salon.findByIdAndUpdate(req.params.id, { isApproved: true }, { new: true });
  if (!salon) throw new ApiError(404, "Salon not found");
  res.status(200).json({ success: true, data: salon });
});

// PUT /api/admin/salons/:id/deactivate
export const deactivateSalon = asyncHandler(async (req, res) => {
  const salon = await Salon.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!salon) throw new ApiError(404, "Salon not found");
  res.status(200).json({ success: true, data: salon });
});

// GET /api/admin/users
export const listUsersAdmin = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.role) filter.role = req.query.role;

  const users = await User.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: users });
});

// PUT /api/admin/users/:id/deactivate
export const deactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!user) throw new ApiError(404, "User not found");
  res.status(200).json({ success: true, data: user });
});

// GET /api/admin/reviews
export const listReviewsAdmin = asyncHandler(async (req, res) => {
  const reviews = await Review.find().populate("customerId", "name").populate("salonId", "name").sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: reviews });
});

// PUT /api/admin/reviews/:id/hide
export const hideReview = asyncHandler(async (req, res) => {
  const review = await Review.findByIdAndUpdate(req.params.id, { isVisible: false }, { new: true });
  if (!review) throw new ApiError(404, "Review not found");
  res.status(200).json({ success: true, data: review });
});
