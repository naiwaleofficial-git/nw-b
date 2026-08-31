import express from "express";
import {
  getAvailableSlotsController,
  createBookingController,
  myBookings,
  getBooking,
  cancelBookingController,
  updateBookingStatus,
} from "../controllers/booking.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

const router = express.Router();

// Public: check availability before login-gating the actual booking action
router.get("/available-slots", getAvailableSlotsController);

router.post("/", protect, createBookingController);
router.get("/my-bookings", protect, myBookings);
router.get("/:id", protect, getBooking);
router.put("/:id/cancel", protect, cancelBookingController);
router.put("/:id/status", protect, authorize("SALON_OWNER", "ADMIN"), updateBookingStatus);

export default router;
