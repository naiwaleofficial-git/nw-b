import Barber from "../models/Barber.model.js";
import Salon from "../models/Salon.model.js";
import ApiError from "../utils/apiError.js";
import asyncHandler from "../utils/asyncHandler.js";

async function assertOwnsSalon(salonId, user) {
  const salon = await Salon.findById(salonId);
  if (!salon) throw new ApiError(404, "Salon not found");

  if (salon.ownerId.toString() !== user._id.toString() && user.role !== "ADMIN") {
    throw new ApiError(403, "You do not own this salon");
  }
  return salon;
}

// GET /api/salons/:salonId/barbers
export const listBarbersForSalon = asyncHandler(async (req, res) => {
  const barbers = await Barber.find({ salonId: req.params.salonId, isActive: true }).sort({
    ratingAverage: -1,
  });
  res.status(200).json({ success: true, data: barbers });
});

// GET /api/barbers/:id
export const getBarber = asyncHandler(async (req, res) => {
  const barber = await Barber.findById(req.params.id);
  if (!barber) throw new ApiError(404, "Barber not found");
  res.status(200).json({ success: true, data: barber });
});

// POST /api/barbers  { salonId, ...barberFields }
export const createBarber = asyncHandler(async (req, res) => {
  await assertOwnsSalon(req.body.salonId, req.user);

  const barber = await Barber.create(req.body);
  res.status(201).json({ success: true, data: barber });
});

// PUT /api/barbers/:id
export const updateBarber = asyncHandler(async (req, res) => {
  const barber = await Barber.findById(req.params.id);
  if (!barber) throw new ApiError(404, "Barber not found");

  await assertOwnsSalon(barber.salonId, req.user);

  Object.assign(barber, req.body);
  await barber.save();

  res.status(200).json({ success: true, data: barber });
});

// DELETE /api/barbers/:id  (soft delete)
export const deleteBarber = asyncHandler(async (req, res) => {
  const barber = await Barber.findById(req.params.id);
  if (!barber) throw new ApiError(404, "Barber not found");

  await assertOwnsSalon(barber.salonId, req.user);

  barber.isActive = false;
  await barber.save();

  res.status(200).json({ success: true, message: "Barber removed" });
});
