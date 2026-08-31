import mongoose from "mongoose";

const workingHoursSchema = new mongoose.Schema(
  {
    day: {
      type: Number, // 0 = Sunday ... 6 = Saturday
      required: true,
      min: 0,
      max: 6,
    },
    isOpen: { type: Boolean, default: true },
    openTime: { type: String, default: "09:00" },
    closeTime: { type: String, default: "21:00" },
  },
  { _id: false }
);

const salonSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    slug: {
      type: String,
      unique: true,
      index: true,
    },

    description: {
      type: String,
      maxlength: 2000,
      default: "",
    },

    phone: { type: String, required: true },
    email: { type: String, lowercase: true },

    address: {
      fullAddress: String,
      landmark: String,
      city: { type: String, index: true },
      state: String,
      pincode: String,
    },

    // GeoJSON point, indexed for nearby search
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    category: {
      type: String,
      enum: ["MEN", "WOMEN", "UNISEX"],
      default: "UNISEX",
    },

    tags: {
      // e.g. ["AC", "Home Service", "Card Payment", "Parking"]
      type: [String],
      default: [],
    },

    images: {
      type: [String],
      default: [],
    },

    coverImage: {
      type: String,
      default: null,
    },

    workingHours: {
      type: [workingHoursSchema],
      default: [],
    },

    slotInterval: {
      type: Number,
      default: 15,
      enum: [10, 15, 20, 30],
    },

    bookingBufferMinutes: {
      type: Number,
      default: 0,
      min: 0,
      max: 60,
    },

    advanceBookingDays: {
      type: Number,
      default: 30,
    },

    minimumAdvanceBookingMinutes: {
      type: Number,
      default: 30,
    },

    offersHomeService: {
      type: Boolean,
      default: false,
    },

    isApproved: {
      type: Boolean,
      default: true, // true for seeded/demo data; real signups should default to false
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    ratingAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalReviews: {
      type: Number,
      default: 0,
    },

    priceLevel: {
      // 1 = budget, 2 = mid, 3 = premium — helps with "price range" filter
      type: Number,
      enum: [1, 2, 3],
      default: 2,
    },
  },
  { timestamps: true }
);

salonSchema.index({ location: "2dsphere" });
salonSchema.index({ isApproved: 1, isActive: 1 });
salonSchema.index({ name: "text", "address.city": "text", tags: "text" });

export default mongoose.model("Salon", salonSchema);
