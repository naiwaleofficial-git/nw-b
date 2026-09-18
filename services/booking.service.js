import Booking from '../models/Booking.model.js';
import SlotHold from '../models/SlotHold.model.js';
import Service from '../models/Service.model.js';
import Barber from '../models/Barber.model.js';
import User from '../models/User.model.js';
import Notification from '../models/Notification.model.js';
import ApiError from '../utils/apiError.js';
import generateBookingNumber from '../utils/generateBookingNumber.js';
import { withSalonTransaction } from './transaction.service.js';
import { getAvailableSlots } from './availability.service.js';
import { assertTransition, shopDate } from '../utils/bookingRules.js';
import { ACTIVE_BOOKING_STATUSES } from '../constants/bookingStatus.js';

export function assertOwner(salon, userId, role) {
  if (role !== 'ADMIN' && String(salon.ownerId) !== String(userId)) throw new ApiError(403, 'You do not own this salon');
}

async function available(input, session, ignoreHoldId) {
  const start = new Date(input.startTime);
  if (!Number.isFinite(+start)) throw new ApiError(400, 'Invalid start time');
  const result = await getAvailableSlots({ ...input, date: shopDate(start), session, ignoreHoldId });
  const slot = result.slots.find((s) => +s.startTime === +start);
  if (!slot) throw new ApiError(409, 'This slot is unavailable. Please choose another time.');
  return slot;
}

export async function createHold(input) {
  return withSalonTransaction(input.salonId, async (session) => {
    await SlotHold.updateMany({ salonId: input.salonId, status: 'active', $or: [{ expiresAt: { $lte: new Date() } }, { customerId: input.customerId }] }, { status: 'expired' }, { session });
    const slot = await available(input, session);
    const [hold] = await SlotHold.create([{ salonId: input.salonId, barberId: input.barberId, customerId: input.customerId, serviceIds: input.serviceIds, ...slot, expiresAt: new Date(Date.now() + 600000) }], { session });
    return hold;
  });
}

export async function releaseHold(id, user) {
  const initial = await SlotHold.findById(id);
  if (!initial) throw new ApiError(404, 'Hold not found');
  return withSalonTransaction(initial.salonId, async (session, salon) => {
    if (String(initial.customerId) !== String(user._id)) assertOwner(salon, user._id, user.role);
    return SlotHold.findOneAndUpdate({ _id: id }, { status: 'expired' }, { new: true, session });
  });
}

async function notify(booking, salon, kind, session) {
  const messages = { NEW_BOOKING: 'New booking received', ACCEPTED: 'Your booking is accepted', CANCELLED: 'Your booking was cancelled', IN_PROGRESS: 'Your appointment has started', COMPLETED: 'Your appointment is complete. Please leave feedback.' };
  const items = [{ userId: salon.ownerId, bookingId: booking._id, kind, message: kind === 'NEW_BOOKING' ? messages[kind] : `Booking ${booking.bookingNumber}: ${kind.toLowerCase().replaceAll('_', ' ')}` }];
  if (booking.customerId) items.push({ userId: booking.customerId, bookingId: booking._id, kind, message: kind === 'NEW_BOOKING' ? 'Booking request sent. Waiting for acceptance.' : messages[kind] });
  await Notification.create(items, { session, ordered: true });
}

export async function createBooking(input) {
  if (!Array.isArray(input.serviceIds) || !input.serviceIds.length) throw new ApiError(400, 'Select at least one service');
  return withSalonTransaction(input.salonId, async (session, salon) => {
    if (input.walkIn) assertOwner(salon, input.userId, input.userRole);
    let hold;
    if (!input.walkIn) {
      hold = input.holdId && await SlotHold.findOne({ _id: input.holdId, customerId: input.customerId, salonId: input.salonId }).session(session);
      if (hold?.bookingId) return Booking.findById(hold.bookingId).session(session);
      if (!hold || hold.status !== 'active' || +hold.expiresAt <= Date.now()) throw new ApiError(409, 'Your hold has expired. Select a slot again.');
      if (String(hold.barberId) !== String(input.barberId) || +hold.startTime !== +new Date(input.startTime) || hold.serviceIds.map(String).sort().join() !== input.serviceIds.map(String).sort().join()) throw new ApiError(400, 'Booking does not match the held slot');
    }
    const slot = await available(input, session, hold?._id);
    const services = await Service.find({ _id: { $in: input.serviceIds }, salonId: salon._id, isActive: true }).session(session);
    const barber = await Barber.findById(input.barberId).session(session);
    const customer = input.customerId ? await User.findById(input.customerId).session(session) : null;
    const details = input.bookingFor?.type === 'OTHER' ? input.bookingFor : customer;
    if (!details?.name?.trim() || !details?.phone?.trim()) throw new ApiError(400, 'Customer name and phone are required');
    if (!/^\+?\d{8,15}$/.test(details.phone.replace(/[\s()-]/g, ''))) throw new ApiError(400, 'Enter a valid customer phone number');
    const total = services.reduce((sum, s) => sum + s.price, 0);
    const [booking] = await Booking.create([{
      bookingNumber: generateBookingNumber(), customerId: input.customerId, salonId: salon._id, barberId: barber._id,
      barberName: barber.name, chair: barber.chair, isWalkIn: Boolean(input.walkIn), customerName: details.name, customerPhone: details.phone,
      services: services.map((s) => ({ serviceId: s._id, name: s.name, price: s.price, durationMinutes: s.durationMinutes })),
      bookingFor: input.bookingFor || { type: 'SELF' }, startTime: slot.startTime, endTime: slot.endTime,
      totalDurationMinutes: (+slot.endTime - +slot.startTime) / 60000, subtotal: total, totalAmount: total,
      bookingStatus: input.walkIn || salon.autoAccept ? 'ACCEPTED' : 'PENDING', paymentMethod: input.paymentMethod || 'PAY_AT_SALON',
    }], { session });
    if (hold) { hold.status = 'expired'; hold.bookingId = booking._id; await hold.save({ session }); }
    await notify(booking, salon, 'NEW_BOOKING', session);
    if (booking.bookingStatus === 'ACCEPTED') await notify(booking, salon, 'ACCEPTED', session);
    return booking;
  });
}

export async function changeBooking({ bookingId, userId, userRole, status, reason, barberId, chair }) {
  const initial = await Booking.findById(bookingId);
  if (!initial) throw new ApiError(404, 'Booking not found');
  return withSalonTransaction(initial.salonId, async (session, salon) => {
    const booking = await Booking.findById(bookingId).session(session);
    const customer = userRole === 'CUSTOMER' && String(booking.customerId) === String(userId);
    if (!customer) assertOwner(salon, userId, userRole);
    if (customer && status !== 'CANCELLED') throw new ApiError(403, 'Not authorized');
    assertTransition(booking, status);
    if (status === 'CANCELLED') {
      if (!customer) {
        const day = shopDate();
        if (salon.cancellationDay !== day) { salon.cancellationDay = day; salon.cancellationCount = 0; }
        if (salon.cancellationCount >= 3) throw new ApiError(409, 'Daily limit of 3 shop cancellations reached');
        salon.cancellationCount += 1;
        await salon.save({ session });
      }
      booking.cancelledAt = new Date();
      booking.cancelledBy = customer ? 'CUSTOMER' : userRole === 'ADMIN' ? 'ADMIN' : 'SALON';
      booking.cancellationReason = String(reason || '').slice(0, 500);
    }
    if (status === 'IN_PROGRESS') {
      const selected = await Barber.findOne({ _id: barberId || booking.barberId, salonId: salon._id, isActive: true }).session(session);
      const selectedChair = Number(chair);
      if (!selected || !Number.isInteger(selectedChair) || selectedChair < 1 || selectedChair > salon.chairCount) throw new ApiError(400, 'Select an available barber and chair');
      const actualEnd = new Date(Date.now() + booking.totalDurationMinutes * 60000);
      const conflict = await Booking.exists({ _id: { $ne: booking._id }, salonId: salon._id, $or: [
        { bookingStatus: 'IN_PROGRESS', $or: [{ barberId: selected._id }, { chair: selectedChair }] },
        { barberId: selected._id, bookingStatus: { $in: ACTIVE_BOOKING_STATUSES }, startTime: { $lt: actualEnd }, endTime: { $gt: new Date() } },
      ] }).session(session);
      const held = await SlotHold.exists({ barberId: selected._id, status: 'active', expiresAt: { $gt: new Date() }, startTime: { $lt: actualEnd }, endTime: { $gt: new Date() } }).session(session);
      if (conflict || held) throw new ApiError(409, 'Barber or chair is occupied during this work');
      booking.barberId = selected._id; booking.barberName = selected.name; booking.chair = selectedChair; booking.startedAt = new Date();
      booking.endTime = actualEnd;
    }
    if (status === 'COMPLETED') booking.completedAt = new Date();
    booking.bookingStatus = status;
    await booking.save({ session });
    await notify(booking, salon, status, session);
    return booking;
  });
}

export const cancelBooking = (input) => changeBooking({ ...input, status: 'CANCELLED' });
