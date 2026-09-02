# GroomBook API (backend)

Express + MongoDB (Mongoose) API for GroomBook — a local barber/salon discovery
and appointment booking platform.

## Setup

```bash
cd backend
npm install
cp .env.example .env      # then edit mongoURIAtlas or MONGO_URI / JWT_SECRET as needed
```

You need a MongoDB instance. Either:
- run one locally (`mongod`), and keep `MONGO_URI=mongodb://127.0.0.1:27017/groombook`, or
- use a free MongoDB Atlas cluster and paste its connection string into `mongoURIAtlas` in `.env`.

## Seed 100 salons of demo data

```bash
npm run seed          # populates users, 100 salons, barbers, services, bookings, reviews
npm run seed:destroy  # wipes all collections
```

Demo logins printed at the end of the seed script:
- Admin: `9000000001` / `Admin@123`
- Salon owner: `9000000101` / `Owner@123` (owner1 — owns several salons)
- Customer: `9000000201` / `Customer@123` (customer1)

## Run

```bash
npm run dev     # nodemon, http://localhost:5000
npm start       # plain node
```

## Project layout

```
config/        DB connection
constants/     roles, booking status enums
models/        Mongoose schemas (User, Salon, Barber, Service, Booking, Review, Favorite, BarberLeave)
services/      availability.service.js (slot algorithm) + booking.service.js (transactional create/cancel)
controllers/   route handlers
routes/        Express routers, mounted under /api
middleware/    auth (JWT), role-based authorization, centralized error handling
seed/          seed script + 20-city dummy data pool
```

## The booking engine, in one paragraph

Every appointment is stored with real `startTime`/`endTime` `Date` values (UTC).
Given a barber and a set of services, `availability.service.js` walks every
possible start time in the barber's working hours at the salon's slot interval,
and discards any candidate where `candidateStart < existingEnd AND candidateEnd > existingStart`
is true for an existing active booking — the standard interval-overlap check.
`booking.service.js` re-runs that exact same check inside a MongoDB transaction
immediately before writing the new booking, so two customers racing for the same
slot can't both win.

## Key API routes

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/salons                 ?city=&category=&q=&minRating=&priceLevel=
GET    /api/salons/nearby          ?lat=&lng=&maxDistance=
GET    /api/salons/:id
GET    /api/salons/:salonId/barbers
GET    /api/salons/:salonId/services
GET    /api/salons/:salonId/reviews

GET    /api/bookings/available-slots  ?salonId=&barberId=&serviceIds=a,b&date=YYYY-MM-DD
POST   /api/bookings
GET    /api/bookings/my-bookings
PUT    /api/bookings/:id/cancel

POST   /api/reviews
POST   /api/favorites

GET    /api/admin/stats            (ADMIN only)
```
