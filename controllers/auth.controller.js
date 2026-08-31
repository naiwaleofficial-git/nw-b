import User from "../models/User.model.js";
import ApiError from "../utils/apiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendTokenResponse } from "../utils/generateToken.js";

export const register = asyncHandler(async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  if (!name || !phone || !password) {
    throw new ApiError(400, "Name, phone and password are required");
  }

  const existing = await User.findOne({ phone });
  if (existing) {
    throw new ApiError(409, "An account with this phone number already exists");
  }

  // Only allow self-registration as CUSTOMER or SALON_OWNER — never ADMIN
  const safeRole = role === "SALON_OWNER" ? "SALON_OWNER" : "CUSTOMER";

  const user = await User.create({ name, email, phone, password, role: safeRole });

  sendTokenResponse(user, 201, res);
});

export const login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    throw new ApiError(400, "Phone and password are required");
  }

  const user = await User.findOne({ phone }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, "Invalid phone number or password");
  }

  if (!user.isActive) {
    throw new ApiError(403, "This account has been deactivated");
  }

  sendTokenResponse(user, 200, res);
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ success: true, message: "Logged out successfully" });
});

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: req.user });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, email, address, profileImage } = req.body;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { name, email, address, profileImage } },
    { new: true, runValidators: true }
  );

  res.status(200).json({ success: true, data: user });
});
