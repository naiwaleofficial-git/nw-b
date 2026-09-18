import ApiError from './apiError.js';

export function bookingWindow(startTime, now = Date.now()) {
  const minutes = (new Date(startTime).getTime() - Number(now)) / 60000;
  if (minutes > 10) return 'EARLY';
  if (minutes > 0) return 'LOCKED';
  if (minutes >= -30) return 'START';
  return 'EXPIRED';
}

export function assertTransition(booking, next, now = Date.now()) {
  const current = booking.bookingStatus;
  const accepted = ['ACCEPTED', 'CONFIRMED', 'CHECKED_IN'].includes(current);
  if (next === 'ACCEPTED' && current === 'PENDING') return;
  if (next === 'IN_PROGRESS' && accepted && bookingWindow(booking.startTime, now) === 'START') return;
  if (next === 'COMPLETED' && current === 'IN_PROGRESS') return;
  if (next === 'CANCELLED' && (current === 'PENDING' || (accepted && bookingWindow(booking.startTime, now) === 'EARLY'))) return;
  throw new ApiError(409, 'This action is not allowed in the current booking status or time window');
}

export function shopDate(value = new Date()) {
  return new Date(new Date(value).getTime() + 330 * 60000).toISOString().slice(0, 10);
}

export function dayBounds(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError(400, 'Invalid date');
  const start = new Date(`${date}T00:00:00+05:30`);
  if (!Number.isFinite(+start) || shopDate(start) !== date) throw new ApiError(400, 'Invalid date');
  return { start, end: new Date(+start + 86400000) };
}
