import Salon from "../models/Salon.model.js";
import Service from "../models/Service.model.js";
import ApiError from "../utils/apiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import slugify from "../utils/slugify.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET /api/salons  — list + basic filters (category, city, price, rating, search)
export const listSalons = asyncHandler(async (req, res) => {
  const { city, category, minRating, priceLevel, service, q, page = 1, limit = 20 } = req.query;

  const filter = { isActive: true, isApproved: true };

  if (city) filter["address.city"] = new RegExp(`^${escapeRegex(String(city).trim())}$`, "i");
  if (category) filter.category = category;
  if (priceLevel) filter.priceLevel = Number(priceLevel);
  if (minRating) filter.ratingAverage = { $gte: Number(minRating) };
  if (q) filter.$text = { $search: q };
  const serviceTerm = String(service || "").trim();
  if (serviceTerm) {
    const serviceRegex = new RegExp(escapeRegex(serviceTerm), "i");
    const salonIds = await Service.distinct("salonId", {
      isActive: true,
      $or: [{ name: serviceRegex }, { category: serviceRegex }],
    });
    filter._id = { $in: salonIds };
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [salons, total] = await Promise.all([
    Salon.find(filter).sort({ ratingAverage: -1, _id: 1 }).skip(skip).limit(Number(limit)),
    Salon.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    data: salons,
    pagination: { page: Number(page), limit: Number(limit), total },
  });
});

// GET /api/salons/nearby?lat=..&lng=..&maxDistance=10000
export const nearbySalons = asyncHandler(async (req, res) => {
  const { lat, lng, maxDistance = 10000, category } = req.query;

  if (!lat || !lng) {
    throw new ApiError(400, "lat and lng query params are required");
  }

  const filter = {
    isActive: true,
    isApproved: true,
    location: {
      $near: {
        $geometry: { type: "Point", coordinates: [Number(lng), Number(lat)] },
        $maxDistance: Number(maxDistance),
      },
    },
  };

  if (category) filter.category = category;

  const salons = await Salon.find(filter).limit(50);

  res.status(200).json({ success: true, data: salons });
});

// GET /api/salons/:id
export const getSalon = asyncHandler(async (req, res) => {
  const salon = await Salon.findById(req.params.id);
  if (!salon) throw new ApiError(404, "Salon not found");

  res.status(200).json({ success: true, data: salon });
});

// POST /api/salons  (SALON_OWNER)
export const createSalon = asyncHandler(async (req, res) => {
  const payload = { ...req.body, ownerId: req.user._id };
  payload.slug = slugify(payload.name, Date.now().toString(36));

  const salon = await Salon.create(payload);

  res.status(201).json({ success: true, data: salon });
});

// PUT /api/salons/:id  (owner of that salon, or ADMIN)
export const updateSalon = asyncHandler(async (req, res) => {
  const salon = await Salon.findById(req.params.id);
  if (!salon) throw new ApiError(404, "Salon not found");

  if (salon.ownerId.toString() !== req.user._id.toString() && req.user.role !== "ADMIN") {
    throw new ApiError(403, "You do not own this salon");
  }

  Object.assign(salon, req.body);
  await salon.save();

  res.status(200).json({ success: true, data: salon });
});

// DELETE /api/salons/:id
export const deleteSalon = asyncHandler(async (req, res) => {
  const salon = await Salon.findById(req.params.id);
  if (!salon) throw new ApiError(404, "Salon not found");

  if (salon.ownerId.toString() !== req.user._id.toString() && req.user.role !== "ADMIN") {
    throw new ApiError(403, "You do not own this salon");
  }

  await salon.deleteOne();

  res.status(200).json({ success: true, message: "Salon deleted" });
});

// GET /api/salons/my/list  (SALON_OWNER — salons they own)
export const mySalons = asyncHandler(async (req, res) => {
  const salons = await Salon.find({ ownerId: req.user._id }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, data: salons });
});
