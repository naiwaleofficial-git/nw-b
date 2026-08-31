import mongoose from "mongoose";
import { BOOKING_STATUS, PAYMENT_STATUS, PAYMENT_METHOD } from "../constants/bookingStatus.js";

// Services are snapshotted at booking time so a later price change at the
// salon never rewrites the price of a past appointment.
const bookedServiceSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    durationMinutes: { type: Number, required: true },
  },
  { _id: false }
);

const bookingForSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["SELF", "OTHER"], default: "SELF" },
    name: String,
    phone: String,
    gender: { type: String, enum: ["MALE", "FEMALE", "OTHER"] },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
      index: true,
    },

    barberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      required: true,
      index: true,
    },

    services: {
      type: [bookedServiceSchema],
      required: true,
      validate: [(arr) => arr.length > 0, "At least one service is required"],
    },

    bookingFor: {
      type: bookingForSchema,
      required: true,
    },

    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date, required: true, index: true },

    totalDurationMinutes: { type: Number, required: true },

    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    bookingStatus: {
      type: String,
      enum: Object.values(BOOKING_STATUS),
      default: BOOKING_STATUS.PENDING,
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },

    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHOD),
      default: PAYMENT_METHOD.PAY_AT_SALON,
    },

    paidAmount: { type: Number, default: 0 },

    cancellationReason: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
    cancelledBy: {
      type: String,
      enum: ["CUSTOMER", "SALON", "ADMIN", null],
      default: null,
    },

    notes: { type: String, maxlength: 1000 },
  },
  { timestamps: true }
);

// The single most important index in the app: every availability check
// and conflict check filters by barberId + status + a time range.
bookingSchema.index({ barberId: 1, bookingStatus: 1, startTime: 1, endTime: 1 });
bookingSchema.index({ customerId: 1, startTime: -1 });
bookingSchema.index({ salonId: 1, startTime: -1 });

bookingSchema.pre("validate", function enforceTimeOrder(next) {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    return next(new Error("endTime must be after startTime"));
  }
  next();
});

export default mongoose.model("Booking", bookingSchema);
