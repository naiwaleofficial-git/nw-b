import Booking from '../models/Booking.model.js';
import SlotHold from '../models/SlotHold.model.js';
import Service from '../models/Service.model.js';
import Barber from '../models/Barber.model.js';
import BarberLeave from '../models/BarberLeave.model.js';
import Salon from '../models/Salon.model.js';
import ApiError from '../utils/apiError.js';
import { ACTIVE_BOOKING_STATUSES } from '../constants/bookingStatus.js';
import { dayBounds, shopDate } from '../utils/bookingRules.js';

const minutes = (value) => { const [h, m] = value.split(':').map(Number); return h * 60 + m; };
const label = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

export async function getAvailableSlots({ salonId, barberId, serviceIds, date, ignoreHoldId, session = null, walkIn = false }) {
  if (!Array.isArray(serviceIds) || !serviceIds.length || new Set(serviceIds.map(String)).size !== serviceIds.length) throw new ApiError(400, 'Select distinct services');
  const salon = await Salon.findOne({ _id: salonId, isActive: true, isApproved: true }).session(session);
  if (!salon) throw new ApiError(404, 'Salon is unavailable');
  const barber = await Barber.findOne({ _id: barberId, salonId, isActive: true }).session(session);
  if (!barber) throw new ApiError(404, 'Barber is unavailable');
  const services = await Service.find({ _id: { $in: serviceIds }, salonId, isActive: true }).session(session);
  if (services.length !== serviceIds.length) throw new ApiError(400, 'Invalid services');
  const totalDuration = services.reduce((sum, s) => sum + s.durationMinutes, 0) + salon.bookingBufferMinutes;
  const { start, end } = dayBounds(date);
  const today = dayBounds(shopDate()).start;
  if (+start > +today + salon.advanceBookingDays * 86400000) return { date, totalDuration, slots: [] };
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const schedule = barber.workingHours.find((h) => h.day === day && h.isWorking);
  const shopSchedule = salon.workingHours.find((h) => h.day === day);
  const leave = await BarberLeave.exists({ barberId, startDate: { $lt: end }, endDate: { $gte: start } }).session(session);
  if (!schedule || shopSchedule?.isOpen === false || leave) return { date, totalDuration, slots: [] };
  const bookings = await Booking.find({ barberId, bookingStatus: { $in: ACTIVE_BOOKING_STATUSES }, startTime: { $lt: end }, endTime: { $gt: start } }).session(session);
  const holds = await SlotHold.find({ barberId, status: 'active', expiresAt: { $gt: new Date() }, ...(ignoreHoldId ? { _id: { $ne: ignoreHoldId } } : {}), startTime: { $lt: end }, endTime: { $gt: start } }).session(session);
  const occupied = [...bookings, ...holds];
  const first = Math.max(minutes(schedule.startTime), shopSchedule ? minutes(shopSchedule.openTime) : 0);
  const last = Math.min(minutes(schedule.endTime), shopSchedule ? minutes(shopSchedule.closeTime) : 1440);
  const minimum = Date.now() + (walkIn || ignoreHoldId ? 0 : salon.minimumAdvanceBookingMinutes) * 60000;
  const slots = [];
  for (let m = first; m + totalDuration <= last; m += salon.slotInterval) {
    const slotStart = new Date(+start + m * 60000);
    const slotEnd = new Date(+slotStart + totalDuration * 60000);
    if (+slotStart < minimum) continue;
    if (occupied.some((b) => slotStart < b.endTime && slotEnd > b.startTime)) continue;
    if (barber.breaks.some((b) => b.day === day && m < minutes(b.endTime) && m + totalDuration > minutes(b.startTime))) continue;
    slots.push({ startTime: slotStart, endTime: slotEnd, displayStart: label(m), displayEnd: label(m + totalDuration) });
  }
  return { date, totalDuration, slots };
}
export default getAvailableSlots;
