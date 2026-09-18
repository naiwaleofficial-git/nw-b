import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import mongoose from 'mongoose';
import express from 'express';
import jwt from 'jsonwebtoken';
import Booking from '../models/Booking.model.js';
import Salon from '../models/Salon.model.js';
import Barber from '../models/Barber.model.js';
import Service from '../models/Service.model.js';
import User from '../models/User.model.js';
import SlotHold from '../models/SlotHold.model.js';
import Notification from '../models/Notification.model.js';
import Upload from '../models/Upload.model.js';
import OtpChallenge from '../models/OtpChallenge.model.js';
import apiRoutes from '../routes/index.js';
import { errorMiddleware } from '../middleware/error.middleware.js';
import { createHold, createBooking, releaseHold, changeBooking } from '../services/booking.service.js';
import { getAvailableSlots } from '../services/availability.service.js';
import { shopDate } from '../utils/bookingRules.js';

let mongoProcess, directory, server, base, owner, customer, stranger, salon, barber, service, date, input;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function freePort() { const socket = net.createServer(); await new Promise((r) => socket.listen(0, '127.0.0.1', r)); const port = socket.address().port; await new Promise((r) => socket.close(r)); return port; }
async function request(url, method, body, user = owner) {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  const response = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...(await response.json()) };
}

before(async () => {
  process.env.JWT_SECRET = 'isolated-test-secret-only';
  process.env.NODE_ENV = 'test';
  process.env.OTP_DEVELOPMENT_MODE = 'true';
  const root = path.resolve('.test-db');
  await mkdir(root, { recursive: true });
  directory = await mkdtemp(path.join(root, 'run-'));
  const port = await freePort();
  mongoProcess = spawn(process.env.MONGOD_BINARY || 'mongod', ['--dbpath', directory, '--port', String(port), '--bind_ip', '127.0.0.1', '--replSet', 'cutbook-test', '--quiet'], { stdio: 'ignore', windowsHide: true });
  let spawnError;
  mongoProcess.on('error', (error) => { spawnError = error; });
  const direct = `mongodb://127.0.0.1:${port}/?directConnection=true`;
  let client;
  for (let i = 0; i < 80; i++) {
    if (spawnError) throw spawnError;
    try { client = new mongoose.mongo.MongoClient(direct, { serverSelectionTimeoutMS: 300 }); await client.connect(); break; } catch { await client?.close(); await pause(250); }
  }
  await client.db('admin').command({ replSetInitiate: { _id: 'cutbook-test', members: [{ _id: 0, host: `127.0.0.1:${port}` }] } });
  await client.close();
  await mongoose.connect(`mongodb://127.0.0.1:${port}/cutbook_test?replicaSet=cutbook-test`, { serverSelectionTimeoutMS: 30000 });
  for (const model of Object.values(mongoose.models)) await model.init();
  const app = express(); app.use(express.json({ limit: '10mb' })); app.use('/api', apiRoutes); app.use(errorMiddleware);
  server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 60000 });

after(async () => {
  if (server) { server.closeAllConnections(); await new Promise((r) => server.close(r)); }
  await mongoose.disconnect();
  if (mongoProcess && mongoProcess.exitCode === null) { const stopped = new Promise((r) => mongoProcess.once('exit', r)); mongoProcess.kill(); await stopped; }
  // Delete only the isolated directory created by this test, never the configured DB.
  if (directory && path.resolve(directory).startsWith(path.resolve('.test-db') + path.sep)) await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

beforeEach(async () => {
  for (const model of Object.values(mongoose.models)) await model.deleteMany({});
  [owner, customer, stranger] = await User.insertMany([
    { name: 'Test Owner', phone: '+919000000001', password: 'unused-test-password', role: 'SALON_OWNER', isPhoneVerified: true },
    { name: 'Test Customer', phone: '+919000000002', password: 'unused-test-password', role: 'CUSTOMER' },
    { name: 'Other Owner', phone: '+919000000003', password: 'unused-test-password', role: 'SALON_OWNER', isPhoneVerified: true },
  ]);
  salon = await Salon.create({ name: 'Test shop', ownerId: owner._id, phone: owner.phone, slug: 'test-shop', isApproved: true, chairCount: 2, minimumAdvanceBookingMinutes: 0, workingHours: Array.from({ length: 7 }, (_, day) => ({ day, isOpen: true, openTime: '09:00', closeTime: '21:00' })) });
  barber = await Barber.create({ salonId: salon._id, name: 'Test Barber', chair: 1, workingHours: Array.from({ length: 7 }, (_, day) => ({ day, isWorking: true, startTime: '09:00', endTime: '21:00' })) });
  service = await Service.create({ salonId: salon._id, name: 'Haircut', category: 'Haircut', price: 200, durationMinutes: 30 });
  date = shopDate(Date.now() + 86400000);
  input = { salonId: salon._id, barberId: barber._id, serviceIds: [String(service._id)], startTime: `${date}T10:00:00+05:30`, customerId: customer._id };
});

test('concurrent customers cannot hold overlapping slots; held slot disappears from availability', async () => {
  const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => createHold({ ...input, customerId: new mongoose.Types.ObjectId(), startTime: `${date}T10:${i % 2 ? '15' : '00'}:00+05:30` })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await SlotHold.countDocuments({ status: 'active' }), 1);
  const result = await getAvailableSlots({ ...input, date });
  assert.equal(result.slots.some((s) => +s.startTime === +new Date(input.startTime)), false);
});

test('confirmation consumes hold, is idempotent, snapshots price and emits persistent notifications', async () => {
  const hold = await createHold(input);
  const results = await Promise.all(Array.from({ length: 4 }, () => createBooking({ ...input, holdId: hold._id })));
  assert.equal(new Set(results.map((b) => String(b._id))).size, 1);
  assert.equal(await Booking.countDocuments(), 1);
  assert.equal((await SlotHold.findById(hold._id)).status, 'expired');
  assert.equal(results[0].bookingStatus, 'PENDING');
  assert.equal(results[0].totalAmount, 200);
  assert.equal(await Notification.countDocuments(), 2);
  await assert.rejects(createHold({ ...input, customerId: stranger._id }));
});

test('expired holds cannot confirm; another customer can acquire; unauthorized release is rejected', async () => {
  const hold = await createHold(input);
  await assert.rejects(releaseHold(hold._id, stranger), /do not own/);
  await SlotHold.updateOne({ _id: hold._id }, { expiresAt: new Date(Date.now() - 1000) });
  await assert.rejects(createBooking({ ...input, holdId: hold._id }), /expired/);
  const replacement = await createHold({ ...input, customerId: stranger._id });
  await releaseHold(replacement._id, owner);
  assert.equal((await SlotHold.findById(replacement._id)).status, 'expired');
});

test('auto accept and walk-ins obey overlap protection and owner authorization', async () => {
  await Salon.updateOne({ _id: salon._id }, { autoAccept: true });
  const hold = await createHold(input);
  const booking = await createBooking({ ...input, holdId: hold._id });
  assert.equal(booking.bookingStatus, 'ACCEPTED');
  const walk = { ...input, customerId: undefined, walkIn: true, userId: owner._id, userRole: owner.role, bookingFor: { type: 'OTHER', name: 'Walk In', phone: '9000000004' } };
  await assert.rejects(createBooking(walk), /unavailable/);
  await assert.rejects(createBooking({ ...walk, userId: stranger._id, startTime: `${date}T11:00:00+05:30` }), /do not own/);
  const accepted = await createBooking({ ...walk, startTime: `${date}T11:00:00+05:30` });
  assert.equal(accepted.bookingStatus, 'ACCEPTED');
  assert.equal(accepted.isWalkIn, true);
});

test('concurrent rejections stop at three per shop and unauthorized owners cannot mutate bookings', async () => {
  const bookings = [];
  for (let i = 0; i < 4; i++) {
    const candidate = { ...input, startTime: `${date}T${10 + i}:00:00+05:30` };
    const hold = await createHold(candidate); bookings.push(await createBooking({ ...candidate, holdId: hold._id }));
  }
  await assert.rejects(changeBooking({ bookingId: bookings[0]._id, userId: stranger._id, userRole: stranger.role, status: 'CANCELLED' }), /do not own/);
  const results = await Promise.allSettled(bookings.map((b) => changeBooking({ bookingId: b._id, userId: owner._id, userRole: owner.role, status: 'CANCELLED', reason: 'Emergency' })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 3);
  assert.equal((await Salon.findById(salon._id)).cancellationCount, 3);
  assert.equal(await Booking.countDocuments({ bookingStatus: 'CANCELLED' }), 3);
});

test('start window, barber/chair collision, completion and feedback are enforced', async () => {
  const hold = await createHold(input);
  const booking = await createBooking({ ...input, holdId: hold._id });
  const action = { bookingId: booking._id, userId: owner._id, userRole: owner.role };
  await assert.rejects(changeBooking({ ...action, status: 'COMPLETED' }));
  await changeBooking({ ...action, status: 'ACCEPTED' });
  await assert.rejects(changeBooking({ ...action, status: 'IN_PROGRESS', chair: 1 }));
  await Booking.updateOne({ _id: booking._id }, { startTime: new Date(Date.now() - 1000), endTime: new Date(Date.now() + 1800000) });
  await assert.rejects(changeBooking({ ...action, status: 'CANCELLED' }));
  await assert.rejects(changeBooking({ ...action, status: 'IN_PROGRESS', chair: 3 }));
  const started = await changeBooking({ ...action, status: 'IN_PROGRESS', chair: 1 });
  assert.ok(started.startedAt);
  const completed = await changeBooking({ ...action, status: 'COMPLETED' });
  assert.ok(completed.completedAt);
  await assert.rejects(changeBooking({ ...action, status: 'COMPLETED' }));
  assert.equal(await Notification.countDocuments({ userId: customer._id, kind: 'COMPLETED' }), 1);
});

test('shop registration is atomic, pending, validates photos, and is idempotent', async () => {
  await Salon.deleteMany({});
  const url = '/api/uploads/test-board.jpeg';
  await Upload.create({ ownerId: owner._id, url });
  const payload = { name: 'New Shop', address: { district: 'Pune', city: 'Pune', street: 'Main', shopNumber: '1', pincode: '411001' }, workingHours: Array.from({ length: 7 }, (_, day) => ({ day, isOpen: day !== 0, openTime: '09:00', closeTime: '21:00' })), barbers: [{ name: 'Barber One' }, { name: 'Barber Two' }], services: [{ name: 'Trim', category: 'Beard', price: 80, durationMinutes: 15 }], coverImage: url, images: [] };
  assert.equal((await request('/salons/registration', 'POST', { ...payload, coverImage: '' })).status, 400);
  const results = await Promise.all([request('/salons/registration', 'POST', payload), request('/salons/registration', 'POST', payload)]);
  assert.equal(results[0].status, 201);
  assert.equal(results[1].status, 201);
  assert.equal(results[0].data._id, results[1].data._id);
  assert.equal(results[0].data.isApproved, false);
  assert.equal(await Barber.countDocuments({ salonId: results[0].data._id }), 2);
  const attempted = await request(`/salons/${results[0].data._id}`, 'PUT', { isApproved: true, ownerId: stranger._id });
  assert.equal(attempted.data.isApproved, false);
  assert.equal(attempted.data.ownerId, String(owner._id));
});

test('two barbers cannot start work on the same chair concurrently', async () => {
  const second = await Barber.create({ salonId: salon._id, name: 'Second Barber', chair: 2, workingHours: barber.workingHours });
  const bookings = [];
  for (const barberId of [barber._id, second._id]) {
    const candidate = { ...input, barberId };
    const hold = await createHold(candidate);
    const booking = await createBooking({ ...candidate, holdId: hold._id });
    await Booking.updateOne({ _id: booking._id }, { bookingStatus: 'ACCEPTED', startTime: new Date(Date.now() - 1000), endTime: new Date(Date.now() + 1800000) });
    bookings.push(booking);
  }
  const results = await Promise.allSettled(bookings.map((b) => changeBooking({ bookingId: b._id, userId: owner._id, userRole: owner.role, status: 'IN_PROGRESS', chair: 1 })));
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(await Booking.countDocuments({ bookingStatus: 'IN_PROGRESS', chair: 1 }), 1);
});

test('holds remain confirmable inside the minimum advance interval and shop closures block new holds', async () => {
  const hold = await createHold(input);
  await Salon.updateOne({ _id: salon._id }, { minimumAdvanceBookingMinutes: 10000 });
  assert.equal((await createBooking({ ...input, holdId: hold._id })).bookingStatus, 'PENDING');
  await Salon.updateOne({ _id: salon._id }, { minimumAdvanceBookingMinutes: 0, workingHours: Array.from({ length: 7 }, (_, day) => ({ day, isOpen: false, openTime: '09:00', closeTime: '21:00' })) });
  await assert.rejects(createHold({ ...input, startTime: `${date}T12:00:00+05:30` }), /unavailable/);
});

test('authenticated server events deliver committed notifications to the owner', async () => {
  const abort = new AbortController();
  const token = jwt.sign({ id: owner._id }, process.env.JWT_SECRET);
  const response = await fetch(base + '/notifications/stream', { headers: { Authorization: `Bearer ${token}` }, signal: abort.signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  await reader.read();
  // Let the MongoDB cursor establish before the insert. Inbox polling covers reconnect gaps.
  await pause(200);
  const hold = await createHold(input);
  const booking = await createBooking({ ...input, holdId: hold._id });
  const timeout = setTimeout(() => abort.abort(), 5000);
  try {
    const decoder = new TextDecoder(); let text = '';
    while (!text.includes('data: ')) { const part = await reader.read(); if (part.done) break; text += decoder.decode(part.value); }
    assert.ok(text.includes(String(booking._id)));
    assert.ok(text.includes('NEW_BOOKING'));
  } finally { clearTimeout(timeout); abort.abort(); }
});

test('phone OTP supports returning owners, cooldown, attempt limit and one-time use', async () => {
  const sent = await request('/auth/otp/send', 'POST', { phone: owner.phone });
  assert.equal(sent.status, 200); assert.match(sent.developmentCode, /^\d{6}$/);
  assert.equal((await request('/auth/otp/send', 'POST', { phone: owner.phone })).status, 429);
  const verified = await request('/auth/otp/verify', 'POST', { phone: owner.phone, code: sent.developmentCode });
  assert.equal(verified.status, 200); assert.equal(verified.user.isPhoneVerified, true);
  assert.equal((await request('/auth/otp/verify', 'POST', { phone: owner.phone, code: sent.developmentCode })).status, 400);
  const other = await request('/auth/otp/send', 'POST', { phone: stranger.phone });
  for (let i = 0; i < 5; i++) assert.equal((await request('/auth/otp/verify', 'POST', { phone: stranger.phone, code: '000000' })).status, 400);
  assert.equal((await request('/auth/otp/verify', 'POST', { phone: stranger.phone, code: other.developmentCode })).status, 400);
});
