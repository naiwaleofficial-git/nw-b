import mongoose from "mongoose";

const barberLeaveSchema = new mongoose.Schema(
  {
    barberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      required: true,
      index: true,
    },
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: String,
  },
  { timestamps: true }
);

barberLeaveSchema.index({ barberId: 1, startDate: 1, endDate: 1 });

export default mongoose.model("BarberLeave", barberLeaveSchema);
