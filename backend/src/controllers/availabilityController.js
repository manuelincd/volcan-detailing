const prisma = require('../config/db');
const { ok, fail } = require('../utils/response');
const { APPOINTMENT_STATUS, AVAILABILITY_WINDOW_DAYS } = require('../config/constants');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Parse a YYYY-MM-DD string as UTC midnight, matching how Prisma stores @db.Date values.
function toUtcMidnight(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

exports.getAvailability = async (req, res, next) => {
  try {
    const { date } = req.query;

    // ── Input validation ──────────────────────────────────────────────────────

    if (!date)
      return fail(res, 'date query param is required (YYYY-MM-DD)', 'MISSING_DATE', 400);

    if (!DATE_RE.test(date))
      return fail(res, 'date must be in YYYY-MM-DD format', 'INVALID_DATE_FORMAT', 400);

    const parsed = toUtcMidnight(date);
    if (isNaN(parsed.getTime()))
      return fail(res, 'date is not a valid calendar date', 'INVALID_DATE', 400);

    const todayUtc = toUtcMidnight(new Date().toISOString().slice(0, 10));

    if (parsed < todayUtc)
      return fail(res, 'date must not be in the past', 'DATE_IN_PAST', 400);

    const maxDate = new Date(todayUtc);
    maxDate.setUTCDate(maxDate.getUTCDate() + AVAILABILITY_WINDOW_DAYS);
    if (parsed > maxDate)
      return fail(
        res,
        `date must be within the next ${AVAILABILITY_WINDOW_DAYS} days`,
        'DATE_OUT_OF_RANGE',
        400,
      );

    // ── Fetch schedule and bookings in parallel ───────────────────────────────

    // Use getUTCDay() — parsed is UTC midnight, so getDay() would return the
    // wrong weekday in any UTC− timezone
    const dayOfWeek = parsed.getUTCDay();

    const [slots, booked] = await Promise.all([
      prisma.timeSlot.findMany({
        where:   { dayOfWeek, isActive: true },
        select:  { id: true, startTime: true, endTime: true },
        orderBy: { startTime: 'asc' },
      }),
      prisma.appointment.findMany({
        where:  { date: parsed, status: { notIn: [APPOINTMENT_STATUS.CANCELLED] } },
        select: { timeSlot: true },
      }),
    ]);

    // ── Build response ────────────────────────────────────────────────────────

    const bookedSet = new Set(booked.map((a) => a.timeSlot));
    const available = slots.filter((s) => !bookedSet.has(s.startTime));

    ok(res, {
      date,
      dayOfWeek,
      available,
    });
  } catch (err) { next(err); }
};
