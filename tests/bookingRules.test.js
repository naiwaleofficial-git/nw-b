import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertTransition, bookingWindow, dayBounds, shopDate } from '../utils/bookingRules.js';

test('booking windows include exact boundaries', () => {
  const start = Date.parse('2026-09-20T10:00:00+05:30');
  assert.equal(bookingWindow(start, start - 600001), 'EARLY');
  assert.equal(bookingWindow(start, start - 600000), 'LOCKED');
  assert.equal(bookingWindow(start, start - 1), 'LOCKED');
  assert.equal(bookingWindow(start, start), 'START');
  assert.equal(bookingWindow(start, start + 1800000), 'START');
  assert.equal(bookingWindow(start, start + 1800001), 'EXPIRED');
});
test('state machine rejects skips, reversals, repeated completion and locked cancellations', () => {
  const now = Date.now();
  assertTransition({ bookingStatus: 'PENDING' }, 'ACCEPTED', now);
  assertTransition({ bookingStatus: 'ACCEPTED', startTime: now }, 'IN_PROGRESS', now);
  assertTransition({ bookingStatus: 'IN_PROGRESS' }, 'COMPLETED', now);
  for (const [current, next] of [['PENDING','COMPLETED'], ['PENDING','IN_PROGRESS'], ['COMPLETED','COMPLETED'], ['CANCELLED','ACCEPTED'], ['IN_PROGRESS','CANCELLED'], ['ACCEPTED','CANCELLED']]) assert.throws(() => assertTransition({ bookingStatus: current, startTime: now }, next, now));
});
test('shop dates and cancellation day boundaries always use IST', () => {
  assert.equal(shopDate('2026-09-19T18:30:00Z'), '2026-09-20');
  const { start, end } = dayBounds('2026-09-20');
  assert.equal(start.toISOString(), '2026-09-19T18:30:00.000Z');
  assert.equal(+end - +start, 86400000);
  assert.throws(() => dayBounds('2026-02-31'));
});
