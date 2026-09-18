import { randomInt, createHmac, randomBytes } from 'node:crypto';
import User from '../models/User.model.js';
import OtpChallenge from '../models/OtpChallenge.model.js';
import ApiError from '../utils/apiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { sendTokenResponse } from '../utils/generateToken.js';

export function normalizePhone(value) {
  let phone = String(value || '').replace(/[\s()-]/g, '');
  if (/^\d{10}$/.test(phone)) phone = '+91' + phone;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new ApiError(400, 'Enter a valid phone number with country code');
  return phone;
}
const digest = (phone, code) => createHmac('sha256', process.env.JWT_SECRET).update(`${phone}:${code}`).digest('hex');

export const sendOtp = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const demo = process.env.NODE_ENV !== 'production' && process.env.OTP_DEVELOPMENT_MODE === 'true';
  if (!demo && !process.env.SMS_WEBHOOK_URL) throw new ApiError(503, 'SMS delivery is not configured. Contact the administrator.');
  const code = String(randomInt(100000, 1000000));
  const sentAt = new Date();
  try {
    const challenge = await OtpChallenge.findOneAndUpdate({ phone, $or: [{ sentAt: { $lte: new Date(Date.now() - 60000) } }, { sentAt: { $exists: false } }] }, { digest: digest(phone, code), sentAt, expiresAt: new Date(Date.now() + 300000), attempts: 0, consumed: false }, { upsert: true, new: true });
    if (!challenge) throw new ApiError(429, 'Wait 60 seconds before requesting another OTP');
  } catch (error) {
    if (error.code === 11000) throw new ApiError(429, 'Wait 60 seconds before requesting another OTP');
    throw error;
  }
  if (!demo) {
    try {
      const response = await fetch(process.env.SMS_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN || ''}` }, body: JSON.stringify({ phone, message: `Your CutBook verification code is ${code}. Valid for 5 minutes.` }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Delivery failed');
    } catch {
      await OtpChallenge.deleteOne({ phone, sentAt });
      throw new ApiError(502, 'Could not send OTP. Please try again.');
    }
  }
  res.json({ success: true, message: 'OTP sent', ...(demo ? { developmentCode: code } : {}) });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const existing = await User.findOne({ phone: { $in: [phone, phone.startsWith('+91') ? phone.slice(3) : phone] } });
  if (!existing && (!req.body.name?.trim() || req.body.name.trim().length < 2)) throw new ApiError(400, 'Owner name is required for a new account');
  const attempt = await OtpChallenge.findOneAndUpdate({ phone, consumed: false, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } }, { new: true });
  if (!attempt || attempt.digest !== digest(phone, String(req.body.code))) throw new ApiError(400, 'Invalid or expired OTP');
  const consumed = await OtpChallenge.findOneAndUpdate({ _id: attempt._id, digest: attempt.digest, consumed: false, expiresAt: { $gt: new Date() } }, { consumed: true });
  if (!consumed) throw new ApiError(400, 'OTP already used');
  let user = existing;
  if (!user) user = await User.create({ name: req.body.name.trim(), phone, ...(req.body.email?.trim() ? { email: req.body.email.trim() } : {}), password: randomBytes(32).toString('hex'), role: 'SALON_OWNER', isPhoneVerified: true });
  if (!user.isActive) throw new ApiError(403, 'Account is deactivated');
  if (!user.isPhoneVerified) { user.isPhoneVerified = true; await user.save(); }
  sendTokenResponse(user, 200, res);
});
