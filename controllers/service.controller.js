import Service from "../models/Service.model.js";
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

// GET /api/salons/:salonId/services
export const listServicesForSalon = asyncHandler(async (req, res) => {
  const services = await Service.find({ salonId: req.params.salonId, isActive: true }).sort({
    displayOrder: 1,
    category: 1,
  });
  res.status(200).json({ success: true, data: services });
});

// GET /api/services/:id
export const getService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw new ApiError(404, "Service not found");
  res.status(200).json({ success: true, data: service });
});

// POST /api/services
export const createService = asyncHandler(async (req, res) => {
  await assertOwnsSalon(req.body.salonId, req.user);

  const service = await Service.create(req.body);
  res.status(201).json({ success: true, data: service });
});

// PUT /api/services/:id
export const updateService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw new ApiError(404, "Service not found");

  await assertOwnsSalon(service.salonId, req.user);

  Object.assign(service, req.body);
  await service.save();

  res.status(200).json({ success: true, data: service });
});

// DELETE /api/services/:id  (soft delete)
export const deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw new ApiError(404, "Service not found");

  await assertOwnsSalon(service.salonId, req.user);

  service.isActive = false;
  await service.save();

  res.status(200).json({ success: true, message: "Service removed" });
});
