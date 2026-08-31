import mongoose from "mongoose";

const barberWorkingHoursSchema = new mongoose.Schema(
  {
    day: { type: Number, required: true, min: 0, max: 6 },
    isWorking: { type: Boolean, default: true },
    startTime: { type: String, default: "09:00" },
    endTime: { type: String, default: "21:00" },
  },
  { _id: false }
);

const barberBreakSchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6 },
    startTime: String,
    endTime: String,
  },
  { _id: false }
);

const barberSchema = new mongoose.Schema(
  {
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },
    phone: String,
    profileImage: { type: String, default: null },

    experienceYears: { type: Number, default: 0 },
    bio: { type: String, maxlength: 1000, default: "" },

    specializations: {
      type: [String],
      default: [],
    },

    workingHours: {
      type: [barberWorkingHoursSchema],
      default: [],
    },

    breaks: {
      type: [barberBreakSchema],
      default: [],
    },

    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    totalReviews: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

barberSchema.index({ salonId: 1, isActive: 1 });

export default mongoose.model("Barber", barberSchema);
