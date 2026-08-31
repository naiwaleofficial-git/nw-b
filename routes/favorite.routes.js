import express from "express";
import { addFavorite, removeFavorite, myFavorites } from "../controllers/favorite.controller.js";
import { protect } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect);

router.get("/", myFavorites);
router.post("/", addFavorite);
router.delete("/:salonId", removeFavorite);

export default router;
