import express from "express";
import {
  getPlatformStats,
  listSalonsAdmin,
  approveSalon,
  deactivateSalon,
  listUsersAdmin,
  deactivateUser,
  listReviewsAdmin,
  hideReview,
} from "../controllers/admin.controller.js";
import { protect } from "../middleware/auth.middleware.js";
import { authorize } from "../middleware/role.middleware.js";

const router = express.Router();

router.use(protect, authorize("ADMIN"));

router.get("/stats", getPlatformStats);

router.get("/salons", listSalonsAdmin);
router.put("/salons/:id/approve", approveSalon);
router.put("/salons/:id/deactivate", deactivateSalon);

router.get("/users", listUsersAdmin);
router.put("/users/:id/deactivate", deactivateUser);

router.get("/reviews", listReviewsAdmin);
router.put("/reviews/:id/hide", hideReview);

export default router;
