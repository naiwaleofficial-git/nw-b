import express from "express";
import { getService, updateService, deleteService } from "../controllers/service.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

const router = express.Router();

router.get("/:id", getService);
router.put("/:id", protect, authorize("SALON_OWNER", "ADMIN"), updateService);
router.delete("/:id", protect, authorize("SALON_OWNER", "ADMIN"), deleteService);

export default router;
