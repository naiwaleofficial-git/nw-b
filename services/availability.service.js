import Booking from "../models/Booking.model.js";
import Service from "../models/Service.model.js";
import Barber from "../models/Barber.model.js";
import BarberLeave from "../models/BarberLeave.model.js";
import Salon from "../models/Salon.model.js";
import ApiError from "../utils/apiError.js";
import { ACTIVE_BOOKING_STATUSES } from "../constants/bookingStatus.js";

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Returns every bookable start time for a given salon + barber + service
 * combination on a given date, taking into account:
 *  - the barber's weekly working hours
 *  - the barber's approved leave
 *  - the barber's recurring breaks
 *  - existing active bookings (using the overlap formula)
 *
 * Overlap formula (the core rule of the whole booking engine):
 *   candidateStart < existingEnd AND candidateEnd > existingStart
 */
export async function getAvailableSlots({ salonId, barberId, serviceIds, date }) {
  const salon = await Salon.findOne({ _id: salonId, isActive: true, isApproved: true });
  if (!salon) throw new ApiError(404, "Salon not found or unavailable");

  const barber = await Barber.findOne({ _id: barberId, salonId, isActive: true });
  if (!barber) throw new ApiError(404, "Barber not found or unavailable");

  const services = await Service.find({
    _id: { $in: serviceIds },
    salonId,
    isActive: true,
  });

  if (services.length !== serviceIds.length) {
    throw new ApiError(400, "One or more selected services are invalid");
  }

  const serviceDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalDuration = serviceDuration + (salon.bookingBufferMinutes || 0);

  const selectedDate = new Date(date);
  if (Number.isNaN(selectedDate.getTime())) {
    throw new ApiError(400, "Invalid date");
  }

  const startOfDay = new Date(selectedDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(selectedDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Don't allow booking in the past
  const now = new Date();
  const minimumStart = new Date(now.getTime() + (salon.minimumAdvanceBookingMinutes || 0) * 60000);

  const leave = await BarberLeave.findOne({
    barberId,
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
  });

  if (leave) {
    return { date, totalDuration, slots: [], message: "Barber is unavailable on this date" };
  }

  const dayOfWeek = selectedDate.getDay();
  const barberSchedule = barber.workingHours.find((item) => item.day === dayOfWeek);

  if (!barberSchedule || !barberSchedule.isWorking) {
    return { date, totalDuration, slots: [], message: "Barber is not working on this day" };
  }

  const workStartMinutes = timeToMinutes(barberSchedule.startTime);
  const workEndMinutes = timeToMinutes(barberSchedule.endTime);

  const existingBookings = await Booking.find({
    barberId,
    bookingStatus: { $in: ACTIVE_BOOKING_STATUSES },
    startTime: { $lt: endOfDay },
    endTime: { $gt: startOfDay },
  }).select("startTime endTime");

  const breaks = barber.breaks.filter((item) => item.day === dayOfWeek);

  const availableSlots = [];

  for (
    let startMinutes = workStartMinutes;
    startMinutes + totalDuration <= workEndMinutes;
    startMinutes += salon.slotInterval
  ) {
    const endMinutes = startMinutes + totalDuration;

    const candidateStart = new Date(selectedDate);
    candidateStart.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

    const candidateEnd = new Date(selectedDate);
    candidateEnd.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);

    if (candidateStart < minimumStart) continue;

    const hasBookingConflict = existingBookings.some(
      (booking) => candidateStart < booking.endTime && candidateEnd > booking.startTime
    );
    if (hasBookingConflict) continue;

    const hasBreakConflict = breaks.some((breakItem) => {
      const breakStartMinutes = timeToMinutes(breakItem.startTime);
      const breakEndMinutes = timeToMinutes(breakItem.endTime);

      const breakStart = new Date(selectedDate);
      breakStart.setHours(Math.floor(breakStartMinutes / 60), breakStartMinutes % 60, 0, 0);

      const breakEnd = new Date(selectedDate);
      breakEnd.setHours(Math.floor(breakEndMinutes / 60), breakEndMinutes % 60, 0, 0);

      return candidateStart < breakEnd && candidateEnd > breakStart;
    });
    if (hasBreakConflict) continue;

    availableSlots.push({
      startTime: candidateStart,
      endTime: candidateEnd,
      displayStart: minutesToTime(startMinutes),
      displayEnd: minutesToTime(endMinutes),
    });
  }

  return { date, totalDuration, slots: availableSlots };
}

export default getAvailableSlots;
