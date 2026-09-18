import express from "express";
import {
  holdSlot, expireHold, listHolds, walkInBooking,
  getAvailableSlotsController,
  createBookingController,
  myBookings,
  getBooking,
  cancelBookingController,
  updateBookingStatus,
} from "../controllers/booking.controller.js";
import { protect, attachUserIfPresent } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

const router = express.Router();

// Public: check availability before login-gating the actual booking action
router.get("/available-slots", attachUserIfPresent, getAvailableSlotsController);

router.post('/holds', protect, authorize('CUSTOMER'), holdSlot);
router.delete('/holds/:id', protect, expireHold);
router.get('/holds/salon/:salonId', protect, authorize('SALON_OWNER', 'ADMIN'), listHolds);
router.post('/walk-in', protect, authorize('SALON_OWNER', 'ADMIN'), walkInBooking);
router.post("/", protect, createBookingController);
router.get("/my-bookings", protect, myBookings);
router.get("/:id", protect, getBooking);
router.put("/:id/cancel", protect, cancelBookingController);
router.put("/:id/status", protect, authorize("SALON_OWNER", "ADMIN"), updateBookingStatus);

export default router;
