import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
    },
  },
  { timestamps: true }
);

favoriteSchema.index({ customerId: 1, salonId: 1 }, { unique: true });

export default mongoose.model("Favorite", favoriteSchema);
