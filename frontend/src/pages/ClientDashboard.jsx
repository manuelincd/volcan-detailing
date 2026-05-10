import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentService }  from '../services/appointmentService';
import { availabilityService } from '../services/availabilityService';
import { serviceService }      from '../services/serviceService';
import AppointmentCard from '../components/AppointmentCard';
import Navbar from '../components/Navbar';
import { localToday, localMaxDate } from '../utils/dateHelpers';

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Truck', 'Van', 'Motorcycle', 'Other'];
const MAX_DAYS = 30;

const EMPTY_FORM = { serviceId: '', date: '', timeSlot: '', vehicleType: '', notes: '' };

// ─── Booking form ─────────────────────────────────────────────────────────────

function BookingForm({ accessToken, onBooked }) {
  const [services,      setServices]      = useState([]);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [slots,         setSlots]         = useState([]);
  const [slotsLoading,  setSlotsLoading]  = useState(false);
  const [slotsError,    setSlotsError]    = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState('');
  const [success,       setSuccess]       = useState('');

  useEffect(() => {
    serviceService.list()
      .then((res) => setServices(res.data.data))
      .catch(() => setError('Could not load services.'));
  }, []);

  const setField = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  // Fetch available slots whenever the date changes
  const handleDateChange = async (e) => {
    const date = e.target.value;
    setForm((f) => ({ ...f, date, timeSlot: '' }));
    setSlots([]);
    setSlotsError('');
    if (!date) return;

    setSlotsLoading(true);
    try {
      const res = await availabilityService.getSlots(date);
      const available = res.data.data.available;
      setSlots(available);
      if (!available.length) setSlotsError('No available slots for this date.');
    } catch (err) {
      setSlotsError(err.response?.data?.message ?? 'Could not load slots.');
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await appointmentService.create(accessToken, {
        serviceId:   parseInt(form.serviceId, 10),
        date:        form.date,
        timeSlot:    form.timeSlot,
        vehicleType: form.vehicleType,
        notes:       form.notes || undefined,
      });
      setSuccess('Appointment booked successfully!');
      setForm(EMPTY_FORM);
      setSlots([]);
      onBooked(); // switch tab + refresh list
    } catch (err) {
      setError(err.response?.data?.message ?? 'Booking failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const today   = localToday();
  const maxDate = localMaxDate(MAX_DAYS);

  return (
    <form onSubmit={handleSubmit}>
      <h2>Book an appointment</h2>

      {error   && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}

      {/* Service */}
      <label htmlFor="serviceId">Service</label>
      <select
        id="serviceId"
        value={form.serviceId}
        onChange={setField('serviceId')}
        required
      >
        <option value="">Select a service…</option>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} — {s.durationMinutes} min — ${Number(s.price).toFixed(2)}
          </option>
        ))}
      </select>

      {/* Date */}
      <label htmlFor="date">Date</label>
      <input
        id="date"
        type="date"
        value={form.date}
        min={today}
        max={maxDate}
        onChange={handleDateChange}
        required
      />

      {/* Time slot — only shown once a date is picked */}
      {form.date && (
        <>
          <label htmlFor="timeSlot">Available time slots</label>
          {slotsLoading && <p>Loading slots…</p>}
          {slotsError   && <p role="alert">{slotsError}</p>}
          {!slotsLoading && !slotsError && (
            <select
              id="timeSlot"
              value={form.timeSlot}
              onChange={setField('timeSlot')}
              required
              disabled={!slots.length}
            >
              <option value="">
                {slots.length ? 'Select a time…' : 'No slots available'}
              </option>
              {slots.map((s) => (
                <option key={s.id} value={s.startTime}>
                  {s.startTime} – {s.endTime}
                </option>
              ))}
            </select>
          )}
        </>
      )}

      {/* Vehicle type */}
      <label htmlFor="vehicleType">Vehicle type</label>
      <select
        id="vehicleType"
        value={form.vehicleType}
        onChange={setField('vehicleType')}
        required
      >
        <option value="">Select vehicle type…</option>
        {VEHICLE_TYPES.map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>

      {/* Notes */}
      <label htmlFor="notes">Notes (optional)</label>
      <textarea
        id="notes"
        value={form.notes}
        onChange={setField('notes')}
        maxLength={500}
        rows={3}
        placeholder="Any details about your vehicle or special requests…"
      />

      <button type="submit" disabled={submitting || slotsLoading}>
        {submitting ? 'Booking…' : 'Book appointment'}
      </button>
    </form>
  );
}

// ─── Appointments list ────────────────────────────────────────────────────────

function AppointmentsList({ accessToken, refreshKey }) {
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [cancelling,   setCancelling]   = useState(null); // id in flight

  const load = useCallback(() => {
    setLoading(true);
    appointmentService.list(accessToken)
      .then((res) => setAppointments(res.data.data))
      .catch(() => setError('Failed to load appointments.'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  // Reload whenever refreshKey changes (triggered after a new booking)
  useEffect(() => { load(); }, [load, refreshKey]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this appointment?')) return;
    setCancelling(id);
    try {
      const res = await appointmentService.update(accessToken, id, { status: 'cancelled' });
      setAppointments((prev) => prev.map((a) => (a.id === id ? res.data.data : a)));
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to cancel appointment.');
    } finally {
      setCancelling(null);
    }
  };

  if (loading) return <p>Loading appointments…</p>;
  if (error)   return <p role="alert">{error}</p>;
  if (!appointments.length) return <p>You have no appointments yet.</p>;

  return (
    <div>
      {appointments.map((a) => (
        <AppointmentCard
          key={a.id}
          appointment={a}
          onCancel={handleCancel}
          cancelling={cancelling === a.id}
        />
      ))}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'appointments', label: 'My appointments' },
  { id: 'book',         label: 'Book appointment' },
];

export default function ClientDashboard() {
  const { accessToken }   = useAuth();
  const [tab, setTab]     = useState('appointments');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleBooked = () => {
    setRefreshKey((k) => k + 1); // forces AppointmentsList to reload
    setTab('appointments');
  };

  return (
    <div>
      <Navbar />
      <h1>My dashboard</h1>

      <nav aria-label="Dashboard tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <section>
        {tab === 'appointments' && (
          <AppointmentsList accessToken={accessToken} refreshKey={refreshKey} />
        )}
        {tab === 'book' && (
          <BookingForm accessToken={accessToken} onBooked={handleBooked} />
        )}
      </section>
    </div>
  );
}
