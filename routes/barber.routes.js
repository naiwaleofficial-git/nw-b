import express from "express";
import { getBarber, updateBarber, deleteBarber } from "../controllers/barber.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

const router = express.Router();

router.get("/:id", getBarber);
router.put("/:id", protect, authorize("SALON_OWNER", "ADMIN"), updateBarber);
router.delete("/:id", protect, authorize("SALON_OWNER", "ADMIN"), deleteBarber);

export default router;
