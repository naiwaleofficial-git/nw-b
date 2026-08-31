import express from "express";
import {
  listSalons,
  nearbySalons,
  getSalon,
  createSalon,
  updateSalon,
  deleteSalon,
  mySalons,
} from "../controllers/salon.controller.js";
import { listBarbersForSalon, createBarber } from "../controllers/barber.controller.js";
import { listServicesForSalon, createService } from "../controllers/service.controller.js";
import { listReviewsForSalon } from "../controllers/review.controller.js";
import { salonBookings } from "../controllers/booking.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

const router = express.Router();

router.get("/", listSalons);
router.get("/nearby", nearbySalons);
router.get("/my/list", protect, authorize("SALON_OWNER", "ADMIN"), mySalons);

router.get("/:id", getSalon);
router.post("/", protect, authorize("SALON_OWNER", "ADMIN"), createSalon);
router.put("/:id", protect, authorize("SALON_OWNER", "ADMIN"), updateSalon);
router.delete("/:id", protect, authorize("SALON_OWNER", "ADMIN"), deleteSalon);

router.get("/:salonId/barbers", listBarbersForSalon);
router.post("/:salonId/barbers", protect, authorize("SALON_OWNER", "ADMIN"), (req, res, next) => {
  req.body.salonId = req.params.salonId;
  createBarber(req, res, next);
});

router.get("/:salonId/services", listServicesForSalon);
router.post("/:salonId/services", protect, authorize("SALON_OWNER", "ADMIN"), (req, res, next) => {
  req.body.salonId = req.params.salonId;
  createService(req, res, next);
});

router.get("/:salonId/reviews", listReviewsForSalon);
router.get("/:salonId/bookings", protect, authorize("SALON_OWNER", "ADMIN"), salonBookings);

export default router;
