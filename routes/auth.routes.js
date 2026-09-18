import express from "express";
import { sendOtp, verifyOtp } from '../controllers/otp.controller.js';
import rateLimit from 'express-rate-limit';
import { register, login, logout, getMe, updateMe } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();
const otpLimiter = rateLimit({ windowMs: 15 * 60000, limit: 15, standardHeaders: true, legacyHeaders: false });
router.post('/otp/send', otpLimiter, sendOtp);
router.post('/otp/verify', otpLimiter, verifyOtp);

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", protect, getMe);
router.put("/me", protect, updateMe);

export default router;
