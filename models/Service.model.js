import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },

    category: {
      type: String,
      required: true,
      enum: [
        "Haircut",
        "Beard",
        "Hair Spa",
        "Facial",
        "Hair Coloring",
        "Hair Styling",
        "Head Massage",
        "Massage",
        "Manicure",
        "Pedicure",
        "Waxing",
        "Threading",
        "Kids Haircut",
        "Bridal & Grooming",
        "Other",
      ],
    },

    description: { type: String, maxlength: 1000, default: "" },

    price: { type: Number, required: true, min: 0 },
    discountedPrice: { type: Number, min: 0, default: null },

    durationMinutes: { type: Number, required: true, min: 5, max: 600 },

    isActive: { type: Boolean, default: true },
    displayOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

serviceSchema.index({ salonId: 1, isActive: 1 });
serviceSchema.index({ salonId: 1, name: 1 }, { unique: true });

export default mongoose.model("Service", serviceSchema);
