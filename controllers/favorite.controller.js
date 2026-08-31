import Favorite from "../models/Favorite.model.js";
import ApiError from "../utils/apiError.js";
import asyncHandler from "../utils/asyncHandler.js";

// POST /api/favorites  { salonId }
export const addFavorite = asyncHandler(async (req, res) => {
  const { salonId } = req.body;
  if (!salonId) throw new ApiError(400, "salonId is required");

  const favorite = await Favorite.findOneAndUpdate(
    { customerId: req.user._id, salonId },
    { customerId: req.user._id, salonId },
    { upsert: true, new: true }
  );

  res.status(201).json({ success: true, data: favorite });
});

// DELETE /api/favorites/:salonId
export const removeFavorite = asyncHandler(async (req, res) => {
  await Favorite.findOneAndDelete({ customerId: req.user._id, salonId: req.params.salonId });
  res.status(200).json({ success: true, message: "Removed from favorites" });
});

// GET /api/favorites
export const myFavorites = asyncHandler(async (req, res) => {
  const favorites = await Favorite.find({ customerId: req.user._id }).populate("salonId");
  res.status(200).json({ success: true, data: favorites });
});
