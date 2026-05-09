const prisma = require('../config/db');
const { ok, fail } = require('../utils/response');
const { ROLES, APPOINTMENT_STATUS, CANCEL_CUTOFF_HOURS } = require('../config/constants');

// Which status transitions each role may make.
// Terminal states (completed, cancelled) intentionally have no entries.
const ALLOWED_TRANSITIONS = {
  [ROLES.CLIENT]: {
    [APPOINTMENT_STATUS.PENDING]:   [APPOINTMENT_STATUS.CANCELLED],
    [APPOINTMENT_STATUS.CONFIRMED]: [APPOINTMENT_STATUS.CANCELLED],
  },
  [ROLES.EMPLOYEE]: {
    [APPOINTMENT_STATUS.PENDING]:     [APPOINTMENT_STATUS.IN_PROGRESS],
    [APPOINTMENT_STATUS.CONFIRMED]:   [APPOINTMENT_STATUS.IN_PROGRESS],
    [APPOINTMENT_STATUS.IN_PROGRESS]: [APPOINTMENT_STATUS.COMPLETED],
  },
  [ROLES.ADMIN]: {
    [APPOINTMENT_STATUS.PENDING]:     [APPOINTMENT_STATUS.CONFIRMED, APPOINTMENT_STATUS.IN_PROGRESS, APPOINTMENT_STATUS.CANCELLED],
    [APPOINTMENT_STATUS.CONFIRMED]:   [APPOINTMENT_STATUS.IN_PROGRESS, APPOINTMENT_STATUS.CANCELLED],
    [APPOINTMENT_STATUS.IN_PROGRESS]: [APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.CANCELLED],
  },
};

// Shared include shape used by all read responses
const INCLUDE = {
  service:  { select: { id: true, name: true, durationMinutes: true, price: true } },
  client:   { select: { id: true, name: true, phone: true } },
  employee: { select: { id: true, name: true } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseId(param) {
  const id = parseInt(param, 10);
  return Number.isNaN(id) ? null : id;
}

// Combines a DATE-only value from Postgres with an HH:MM time slot string
// into a single local-time Date, used for the cancellation cutoff check.
function appointmentDateTime(date, timeSlot) {
  const [hours, minutes] = timeSlot.split(':').map(Number);
  const dt = new Date(date);
  dt.setHours(hours, minutes, 0, 0);
  return dt;
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

exports.list = async (req, res, next) => {
  try {
    const { role, sub } = req.user;
    const where =
      role === ROLES.ADMIN    ? {} :
      role === ROLES.EMPLOYEE ? { employeeId: sub } :
                                { clientId: sub };

    const appointments = await prisma.appointment.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ date: 'asc' }, { timeSlot: 'asc' }],
    });
    ok(res, appointments);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { serviceId, vehicleType, date, timeSlot, notes } = req.body;

    // Verify service exists and is available
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    if (!service || !service.isActive)
      return fail(res, 'Service not found or unavailable', 'SERVICE_NOT_FOUND', 404);

    // Verify the requested slot exists in the schedule for that day of week
    const dayOfWeek = date.getUTCDay(); // date is a Joi-parsed Date, stored as UTC midnight
    const slot = await prisma.timeSlot.findUnique({
      where: { dayOfWeek_startTime: { dayOfWeek, startTime: timeSlot } },
    });
    if (!slot || !slot.isActive)
      return fail(res, 'Time slot does not exist for that day', 'SLOT_UNAVAILABLE', 422);

    // Application-level conflict check (partial unique index is the DB-level safety net)
    const conflict = await prisma.appointment.findFirst({
      where: {
        date:     new Date(date),
        timeSlot,
        status:   { notIn: [APPOINTMENT_STATUS.CANCELLED] },
      },
    });
    if (conflict) return fail(res, 'Time slot is already booked', 'SLOT_TAKEN', 409);

    const appointment = await prisma.appointment.create({
      data: { clientId: req.user.sub, serviceId, vehicleType, date: new Date(date), timeSlot, notes },
      include: INCLUDE,
    });
    ok(res, appointment, 201);
  } catch (err) {
    // Partial unique index violation — lost the race between check and insert
    if (err.code === 'P2002') return fail(res, 'Time slot is already booked', 'SLOT_TAKEN', 409);
    next(err);
  }
};

exports.get = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 'Invalid id', 'INVALID_ID', 400);

    const appointment = await prisma.appointment.findUnique({ where: { id }, include: INCLUDE });
    if (!appointment) return fail(res, 'Appointment not found', 'NOT_FOUND', 404);

    const { role, sub } = req.user;
    if (role === ROLES.CLIENT   && appointment.clientId   !== sub)
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    if (role === ROLES.EMPLOYEE && appointment.employeeId !== sub)
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);

    ok(res, appointment);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 'Invalid id', 'INVALID_ID', 400);

    const { role, sub } = req.user;
    const newStatus = req.body.status;

    const appointment = await prisma.appointment.findUnique({ where: { id } });
    if (!appointment) return fail(res, 'Appointment not found', 'NOT_FOUND', 404);

    // ── IDOR checks ──────────────────────────────────────────────────────────
    if (role === ROLES.CLIENT   && appointment.clientId   !== sub)
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);
    if (role === ROLES.EMPLOYEE && appointment.employeeId !== sub)
      return fail(res, 'Forbidden', 'FORBIDDEN', 403);

    // ── Status transition validation ─────────────────────────────────────────
    const allowed = ALLOWED_TRANSITIONS[role]?.[appointment.status] ?? [];
    if (!allowed.includes(newStatus))
      return fail(
        res,
        `Cannot transition from '${appointment.status}' to '${newStatus}'`,
        'INVALID_TRANSITION',
        422,
      );

    // ── Cancellation window (clients only) ───────────────────────────────────
    if (role === ROLES.CLIENT && newStatus === APPOINTMENT_STATUS.CANCELLED) {
      const apptAt = appointmentDateTime(appointment.date, appointment.timeSlot);
      const cutoff = new Date(apptAt.getTime() - CANCEL_CUTOFF_HOURS * 60 * 60 * 1000);
      if (Date.now() > cutoff.getTime())
        return fail(res, 'Cancellation window has passed', 'CANCEL_WINDOW_PASSED', 422);
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data:  { status: newStatus },
      include: INCLUDE,
    });
    ok(res, updated);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return fail(res, 'Invalid id', 'INVALID_ID', 400);

    await prisma.appointment.delete({ where: { id } });
    ok(res, { message: 'Deleted' });
  } catch (err) {
    if (err.code === 'P2025') return fail(res, 'Appointment not found', 'NOT_FOUND', 404);
    next(err);
  }
};
