/**
 * Seeds the database with:
 *   - 1 admin, 20 salon owners, 40 customers (demo login credentials printed at the end)
 *   - 100 salons spread across 20 Indian cities (5 per city)
 *   - 2-5 barbers per salon (~350 barbers total)
 *   - 6-10 services per salon
 *   - A handful of past COMPLETED bookings + reviews per salon, so ratings
 *     and "my bookings" have real data to show immediately after seeding
 *
 * Run with:  npm run seed
 * Wipe with: npm run seed:destroy
 */
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import slugify from "../utils/slugify.js";
import generateBookingNumber from "../utils/generateBookingNumber.js";

import User from "../models/User.model.js";
import Salon from "../models/Salon.model.js";
import Barber from "../models/Barber.model.js";
import Service from "../models/Service.model.js";
import Booking from "../models/Booking.model.js";
import Review from "../models/Review.model.js";

import { CITIES } from "./cities.js";

// ---------- small deterministic-ish random helpers ----------
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}
function pickMany(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

// ---------- data pools ----------
const SALON_PREFIXES = [
  "The Gentleman's", "Royal", "Urban", "Classic", "Deluxe", "Elite", "Modern",
  "Prime", "Signature", "Golden", "Silver", "Style", "Sharp", "Trendy",
  "Legacy", "Vintage", "Metro", "Grand", "Fresh", "Premier",
];
const SALON_SUFFIXES = [
  "Barber Shop", "Salon", "Grooming Lounge", "Cuts & Shaves", "Hair Studio",
  "Men's Salon", "Style Studio", "Grooming Zone", "Hair & Beard Bar", "Salon & Spa",
];

const BARBER_FIRST_NAMES = [
  "Rahul", "Amit", "Mohan", "Suresh", "Vikram", "Arjun", "Sanjay", "Karan",
  "Rohit", "Deepak", "Manoj", "Ajay", "Vivek", "Naveen", "Ravi", "Anil",
  "Pankaj", "Rajesh", "Sunil", "Yash", "Kabir", "Aditya", "Nikhil", "Gaurav",
  "Priya", "Neha", "Simran", "Anjali", "Pooja",
];
const BARBER_LAST_NAMES = [
  "Sharma", "Verma", "Singh", "Kumar", "Gupta", "Yadav", "Mishra", "Chauhan",
  "Reddy", "Nair", "Iyer", "Khan", "Patel", "Joshi", "Rathore", "Das",
];

const SERVICE_CATALOG = [
  { name: "Classic Haircut", category: "Haircut", price: 150, duration: 30 },
  { name: "Kids Haircut", category: "Kids Haircut", price: 100, duration: 20 },
  { name: "Beard Trim", category: "Beard", price: 100, duration: 15 },
  { name: "Beard Shaping & Styling", category: "Beard", price: 150, duration: 20 },
  { name: "Hot Towel Shave", category: "Beard", price: 120, duration: 20 },
  { name: "Hair Spa", category: "Hair Spa", price: 700, duration: 45 },
  { name: "Head Massage", category: "Head Massage", price: 250, duration: 25 },
  { name: "Relaxing Body Massage", category: "Massage", price: 900, duration: 60 },
  { name: "Manicure", category: "Manicure", price: 450, duration: 35 },
  { name: "Pedicure", category: "Pedicure", price: 550, duration: 40 },
  { name: "Face Threading", category: "Threading", price: 120, duration: 15 },
  { name: "Hand Waxing", category: "Waxing", price: 350, duration: 30 },
  { name: "Facial", category: "Facial", price: 500, duration: 45 },
  { name: "Fruit Facial", category: "Facial", price: 650, duration: 50 },
  { name: "Hair Coloring", category: "Hair Coloring", price: 400, duration: 40 },
  { name: "Global Hair Color", category: "Hair Coloring", price: 900, duration: 60 },
  { name: "Hair Styling", category: "Hair Styling", price: 200, duration: 25 },
  { name: "Bridal Grooming Package", category: "Bridal & Grooming", price: 2500, duration: 120 },
  { name: "Hair Wash & Blow Dry", category: "Other", price: 120, duration: 20 },
];

const TAG_POOL = ["AC", "Card Payment", "Home Service", "Parking", "Kids Friendly", "WiFi", "Herbal Products"];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SALON_IMAGES = [
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1512690459411-b9245aed614b?auto=format&fit=crop&w=1200&q=85",
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=85",
];

const BARBER_IMAGES = [
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=600&q=85",
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=600&q=85",
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=600&q=85",
];

function buildWorkingHours({ closedDay = null } = {}) {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    isOpen: day !== closedDay,
    openTime: "09:00",
    closeTime: day === 0 ? "20:00" : "21:00", // Sundays close slightly earlier
  }));
}

function buildBarberWorkingHours({ closedDay }) {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    isWorking: day !== closedDay,
    startTime: "09:30",
    endTime: "20:30",
  }));
}

async function seed() {
  await connectDB();

  console.log("Clearing existing collections...");
  await Promise.all([
    User.deleteMany({}),
    Salon.deleteMany({}),
    Barber.deleteMany({}),
    Service.deleteMany({}),
    Booking.deleteMany({}),
    Review.deleteMany({}),
  ]);

  // ---------- Users ----------
  console.log("Creating users...");

  const admin = await User.create({
    name: "NaiWale Admin",
    email: "admin@groombook.app",
    phone: "9000000001",
    password: "Admin@123",
    role: "ADMIN",
  });

  const owners = [];
  for (let i = 1; i <= 20; i++) {
    const owner = await User.create({
      name: `${pick(BARBER_FIRST_NAMES)} ${pick(BARBER_LAST_NAMES)}`,
      email: `owner${i}@groombook.app`,
      phone: `90000001${String(i).padStart(2, "0")}`,
      password: "Owner@123",
      role: "SALON_OWNER",
    });
    owners.push(owner);
  }

  const customers = [];
  for (let i = 1; i <= 40; i++) {
    const customer = await User.create({
      name: `${pick(BARBER_FIRST_NAMES)} ${pick(BARBER_LAST_NAMES)}`,
      email: `customer${i}@groombook.app`,
      phone: `90000002${String(i).padStart(2, "0")}`,
      password: "Customer@123",
      role: "CUSTOMER",
    });
    customers.push(customer);
  }

  console.log(`Created 1 admin, ${owners.length} owners, ${customers.length} customers`);

  // ---------- Salons, Barbers, Services (100 salons: 5 per city x 20 cities) ----------
  console.log("Creating 100 salons with barbers and services...");

  let salonCounter = 0;
  const allSalons = [];

  for (const cityInfo of CITIES) {
    for (let n = 1; n <= 5; n++) {
      salonCounter += 1;

      const prefix = pick(SALON_PREFIXES);
      const suffix = pick(SALON_SUFFIXES);
      const name = `${prefix} ${suffix}`;
      const owner = pick(owners);
      const category = pick(["MEN", "MEN", "MEN", "UNISEX", "UNISEX", "WOMEN"]);

      // small jitter so salons in the same city aren't stacked on one point
      const jitterLng = (Math.random() - 0.5) * 0.15;
      const jitterLat = (Math.random() - 0.5) * 0.15;

      const closedDay = Math.random() < 0.3 ? randInt(0, 6) : null;

      const salon = await Salon.create({
        ownerId: owner._id,
        name,
        slug: slugify(`${name}-${cityInfo.city}`, salonCounter.toString(36)),
        description: `${name} is a ${category.toLowerCase()} grooming destination in ${cityInfo.city}, offering everything from classic haircuts to full grooming packages.`,
        phone: `70000${String(salonCounter).padStart(5, "0")}`,
        email: `contact${salonCounter}@groombook.app`,
        address: {
          fullAddress: `${randInt(1, 200)}, ${pick(["MG Road", "Station Road", "Civil Lines", "Main Market", "Sector 12", "Model Town", "Park Street"])}, ${cityInfo.city}`,
          landmark: pick(["Near City Mall", "Opp. Bus Stand", "Near Railway Station", "Near Central Park", null]),
          city: cityInfo.city,
          state: cityInfo.state,
          pincode: String(randInt(100000, 999999)),
        },
        location: {
          type: "Point",
          coordinates: [round2(cityInfo.lng + jitterLng), round2(cityInfo.lat + jitterLat)],
        },
        category,
        tags: pickMany(TAG_POOL, randInt(2, 4)),
        images: [SALON_IMAGES[salonCounter % SALON_IMAGES.length], SALON_IMAGES[(salonCounter + 1) % SALON_IMAGES.length]],
        coverImage: SALON_IMAGES[(salonCounter + 2) % SALON_IMAGES.length],
        workingHours: buildWorkingHours({ closedDay }),
        slotInterval: pick([15, 20, 30]),
        bookingBufferMinutes: pick([0, 5, 10]),
        offersHomeService: Math.random() < 0.25,
        isApproved: true,
        isActive: true,
        priceLevel: pick([1, 1, 2, 2, 2, 3]),
      });

      allSalons.push(salon);

      // --- Services: 6-10 randomly selected from catalog, price varies +/-20% by priceLevel ---
      const chosenServices = pickMany(SERVICE_CATALOG, randInt(6, 10));
      const priceMultiplier = salon.priceLevel === 1 ? 0.8 : salon.priceLevel === 3 ? 1.5 : 1;

      const serviceDocs = chosenServices.map((s, idx) => ({
        salonId: salon._id,
        name: s.name,
        category: s.category,
        description: `${s.name} performed by our experienced grooming staff.`,
        price: Math.round((s.price * priceMultiplier) / 10) * 10,
        durationMinutes: s.duration,
        isActive: true,
        displayOrder: idx,
      }));

      const createdServices = await Service.insertMany(serviceDocs);

      // --- Barbers: 2-5 per salon ---
      const barberCount = randInt(2, 5);
      const createdBarbers = [];

      for (let b = 0; b < barberCount; b++) {
        const barberClosedDay = Math.random() < 0.4 ? randInt(0, 6) : null;

        const barber = await Barber.create({
          salonId: salon._id,
          name: `${pick(BARBER_FIRST_NAMES)} ${pick(BARBER_LAST_NAMES)}`,
          phone: `80000${String(salonCounter).padStart(3, "0")}${b}`,
          profileImage: BARBER_IMAGES[(salonCounter + b) % BARBER_IMAGES.length],
          experienceYears: randInt(1, 15),
          bio: "Specialist in modern and classic grooming styles.",
          specializations: pickMany(
            ["Haircut", "Beard Styling", "Hair Coloring", "Facial", "Hair Spa", "Kids Haircut"],
            randInt(2, 4)
          ),
          workingHours: buildBarberWorkingHours({ closedDay: barberClosedDay }),
          breaks: [{ day: randInt(0, 6), startTime: "13:30", endTime: "14:15" }],
          isActive: true,
        });

        createdBarbers.push(barber);
      }

      // --- A few past completed bookings + reviews for realism ---
      const pastBookingCount = randInt(3, 8);

      for (let i = 0; i < pastBookingCount; i++) {
        const customer = pick(customers);
        const barber = pick(createdBarbers);
        const service = pick(createdServices);

        const daysAgo = randInt(2, 60);
        const start = new Date();
        start.setDate(start.getDate() - daysAgo);
        start.setHours(randInt(10, 18), pick([0, 15, 30, 45]), 0, 0);

        const end = new Date(start.getTime() + service.durationMinutes * 60000);

        const booking = await Booking.create({
          bookingNumber: generateBookingNumber(),
          customerId: customer._id,
          salonId: salon._id,
          barberId: barber._id,
          services: [
            {
              serviceId: service._id,
              name: service.name,
              price: service.price,
              durationMinutes: service.durationMinutes,
            },
          ],
          bookingFor: { type: "SELF" },
          startTime: start,
          endTime: end,
          totalDurationMinutes: service.durationMinutes,
          subtotal: service.price,
          discountAmount: 0,
          totalAmount: service.price,
          bookingStatus: "COMPLETED",
          paymentStatus: "PAID",
          paymentMethod: pick(["ONLINE", "PAY_AT_SALON"]),
          paidAmount: service.price,
        });

        // ~70% of completed bookings get a review
        if (Math.random() < 0.7) {
          await Review.create({
            customerId: customer._id,
            salonId: salon._id,
            barberId: barber._id,
            bookingId: booking._id,
            rating: pick([3, 4, 4, 5, 5, 5]),
            comment: pick([
              "Great haircut, very professional!",
              "Loved the experience, will come back again.",
              "Good service but had to wait a bit.",
              "Excellent beard styling, highly recommend.",
              "Clean salon and friendly staff.",
              "Best barber in the area.",
            ]),
          });
        }
      }

      // Recalculate salon + barber ratings from the reviews we just created
      const salonReviews = await Review.find({ salonId: salon._id });
      if (salonReviews.length) {
        const avg = salonReviews.reduce((sum, r) => sum + r.rating, 0) / salonReviews.length;
        await Salon.findByIdAndUpdate(salon._id, {
          ratingAverage: Math.round(avg * 10) / 10,
          totalReviews: salonReviews.length,
        });

        for (const barber of createdBarbers) {
          const barberReviews = salonReviews.filter((r) => r.barberId.toString() === barber._id.toString());
          if (barberReviews.length) {
            const bAvg = barberReviews.reduce((sum, r) => sum + r.rating, 0) / barberReviews.length;
            await Barber.findByIdAndUpdate(barber._id, {
              ratingAverage: Math.round(bAvg * 10) / 10,
              totalReviews: barberReviews.length,
            });
          }
        }
      }

      process.stdout.write(`\r  ${salonCounter}/100 salons created`);
    }
  }

  console.log("\n\nSeed complete!\n");
  console.log("================ Demo Login Credentials ================");
  console.log("Admin:        phone 9000000001  /  password Admin@123");
  console.log("Salon Owner:  phone 9000000101  /  password Owner@123   (owner1)");
  console.log("Customer:     phone 9000000201  /  password Customer@123 (customer1)");
  console.log("==========================================================");
  console.log(`Total: 100 salons across ${CITIES.length} cities, ~${salonCounter * 3} barbers, reviews & past bookings seeded.`);

  await mongoose.connection.close();
  process.exit(0);
}

async function destroy() {
  await connectDB();
  console.log("Destroying all NaiWale data...");
  await Promise.all([
    User.deleteMany({}),
    Salon.deleteMany({}),
    Barber.deleteMany({}),
    Service.deleteMany({}),
    Booking.deleteMany({}),
    Review.deleteMany({}),
  ]);
  console.log("All collections cleared.");
  await mongoose.connection.close();
  process.exit(0);
}

if (process.argv.includes("--destroy")) {
  destroy();
} else {
  seed();
}
