import mongoose from 'mongoose';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import Salon from '../models/Salon.model.js';
import Barber from '../models/Barber.model.js';
import Service from '../models/Service.model.js';
import User from '../models/User.model.js';
import Upload from '../models/Upload.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import slugify from '../utils/slugify.js';

export const uploadPhoto = asyncHandler(async (req, res) => {
  if (!req.user.isPhoneVerified) throw new ApiError(403, 'Verify your phone first');
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(req.body.image || '');
  if (!match) throw new ApiError(400, 'Choose a JPEG, PNG or WebP photo');
  const bytes = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'jpeg' ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) : match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid || bytes.length > 2 * 1024 * 1024) throw new ApiError(400, 'Photo must be a valid image under 2 MB');
  const directory = new URL('../uploads/', import.meta.url);
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${match[1]}`;
  await writeFile(new URL(filename, directory), bytes);
  const url = `/api/uploads/${filename}`;
  await Upload.create({ ownerId: req.user._id, url });
  res.status(201).json({ success: true, data: { url } });
});

export const submitRegistration = asyncHandler(async (req, res) => {
  if (!req.user.isPhoneVerified) throw new ApiError(403, 'Verify your phone first');
  const { name, address, workingHours, barbers, services = [], coverImage, images = [], location } = req.body;
  if (!name?.trim() || !['district', 'city', 'street', 'shopNumber', 'pincode'].every((key) => String(address?.[key] || '').trim())) throw new ApiError(400, 'Complete all shop address fields');
  if (!/^\d{6}$/.test(address.pincode)) throw new ApiError(400, 'Enter a valid six-digit PIN');
  if (!Array.isArray(barbers) || barbers.length < 1 || barbers.length > 5 || barbers.some((b) => !b.name?.trim())) throw new ApiError(400, 'Provide names for 1 to 5 barbers/chairs');
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!Array.isArray(workingHours) || workingHours.length !== 7 || new Set(workingHours.map((h) => h.day)).size !== 7 || workingHours.some((h) => !Number.isInteger(h.day) || h.day < 0 || h.day > 6 || typeof h.isOpen !== 'boolean' || !time.test(h.openTime) || !time.test(h.closeTime) || h.openTime >= h.closeTime)) throw new ApiError(400, 'Provide valid hours for all seven days');
  if (!coverImage || !Array.isArray(images) || images.length > 4) throw new ApiError(400, 'Name-board photo is required; up to four interior photos are allowed');
  const photos = [...new Set([coverImage, ...images])];
  if (await Upload.countDocuments({ ownerId: req.user._id, url: { $in: photos } }) !== photos.length) throw new ApiError(400, 'Upload your shop photos before submitting');
  const categories = ['Haircut', 'Beard', 'Facial', 'Hair Spa', 'Other'];
  if (!Array.isArray(services) || services.length > 100 || services.some((s) => !s.name?.trim() || !categories.includes(s.category) || !Number.isFinite(s.price) || s.price < 0 || !Number.isFinite(s.durationMinutes) || s.durationMinutes < 5 || s.durationMinutes > 600)) throw new ApiError(400, 'Invalid service details');
  if (new Set(services.map((s) => s.name.trim().toLowerCase())).size !== services.length) throw new ApiError(400, 'Service names must be distinct');
  if (location && (!Array.isArray(location.coordinates) || location.coordinates.length !== 2 || !location.coordinates.every(Number.isFinite) || Math.abs(location.coordinates[0]) > 180 || Math.abs(location.coordinates[1]) > 90)) throw new ApiError(400, 'Invalid map coordinates');
  const topology = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!topology.setName && topology.msg !== 'isdbgrid') throw new ApiError(503, 'Registration requires MongoDB Atlas or a replica set');
  const salon = await mongoose.connection.transaction(async (session) => {
    // Serializes duplicate submissions by this account.
    await User.updateOne({ _id: req.user._id }, { $inc: { registrationRevision: 1 } }, { session });
    const existing = await Salon.findOne({ ownerId: req.user._id }).session(session);
    if (existing) return existing;
    const [created] = await Salon.create([{
      ownerId: req.user._id, name: name.trim(), slug: slugify(name, randomUUID().slice(0, 8)), phone: req.user.phone, email: req.user.email,
      address: { ...address, fullAddress: `${address.shopNumber}, ${address.street}, ${address.city}` },
      ...(location ? { location: { type: 'Point', coordinates: location.coordinates } } : {}), workingHours,
      chairCount: barbers.length, coverImage, images, isApproved: false, isActive: true,
    }], { session });
    await Barber.create(barbers.map((b, i) => ({ salonId: created._id, name: b.name.trim(), chair: i + 1, workingHours: workingHours.map((h) => ({ day: h.day, isWorking: h.isOpen, startTime: h.openTime, endTime: h.closeTime })) })), { session, ordered: true });
    if (services.length) await Service.create(services.map((s) => ({ salonId: created._id, name: s.name.trim(), category: s.category, price: s.price, durationMinutes: s.durationMinutes })), { session, ordered: true });
    return created;
  });
  res.status(201).json({ success: true, data: salon });
});
