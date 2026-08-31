import express from "express";
import authRoutes from "./auth.routes.js";
import salonRoutes from "./salon.routes.js";
import barberRoutes from "./barber.routes.js";
import serviceRoutes from "./service.routes.js";
import bookingRoutes from "./booking.routes.js";
import reviewRoutes from "./review.routes.js";
import favoriteRoutes from "./favorite.routes.js";
import adminRoutes from "./admin.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/salons", salonRoutes);
router.use("/barbers", barberRoutes);
router.use("/services", serviceRoutes);
router.use("/bookings", bookingRoutes);
router.use("/reviews", reviewRoutes);
router.use("/favorites", favoriteRoutes);
router.use("/admin", adminRoutes);

export default router;
