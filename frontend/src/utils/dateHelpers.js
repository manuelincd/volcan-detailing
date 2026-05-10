// Returns YYYY-MM-DD for a given date value, interpreted as UTC.
// API dates are stored as UTC midnight; slicing the ISO string avoids
// off-by-one errors in UTC− timezones.
export const toDateString = (date) =>
  new Date(date).toISOString().slice(0, 10);

// Human-readable date, forced to UTC so a UTC-midnight value like
// "2024-01-15T00:00:00.000Z" always renders as "January 15, 2024"
// regardless of the browser timezone.
export const formatDate = (date) =>
  new Date(date).toLocaleDateString('es-MX', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });

// Returns today as YYYY-MM-DD in local time — used for <input type="date"> min.
export const localToday = () => new Date().toLocaleDateString('en-CA'); // en-CA = YYYY-MM-DD

// Returns today + n days as YYYY-MM-DD in local time — used for <input type="date"> max.
export const localMaxDate = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA');
};

// Returns true if the appointment can still be cancelled (> 2 h away).
// Builds the appointment datetime in local time from the UTC-midnight date
// and the HH:MM slot string, then checks the 2-hour cutoff.
export const isCancellable = (dateValue, timeSlot) => {
  const dateStr = toDateString(dateValue);               // "YYYY-MM-DD"
  const apptAt  = new Date(`${dateStr}T${timeSlot}:00`); // local-time parse (no Z)
  const cutoff  = apptAt.getTime() - 2 * 60 * 60 * 1000;
  return Date.now() < cutoff;
};
