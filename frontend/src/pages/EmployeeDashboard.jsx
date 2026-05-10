import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentService } from '../services/appointmentService';
import Navbar from '../components/Navbar';
import { toDateString, localToday } from '../utils/dateHelpers';

// Transitions an employee may make, mirroring the backend ALLOWED_TRANSITIONS
const NEXT_STATUSES = {
  pending:     ['in_progress'],
  confirmed:   ['in_progress'],
  in_progress: ['completed'],
};

const STATUS_LABELS = {
  pending:     'Pending',
  confirmed:   'Confirmed',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

// ─── Employee appointment card ────────────────────────────────────────────────

function EmployeeAppointmentCard({ appointment: a, onStatusChange, updating }) {
  const nextOptions = NEXT_STATUSES[a.status] ?? [];

  return (
    <div>
      <p>
        <strong>{a.timeSlot}</strong>
        {' · '}
        {STATUS_LABELS[a.status] ?? a.status}
      </p>
      <p>Client: {a.client?.name ?? '—'}</p>
      <p>Service: {a.service?.name ?? '—'} ({a.service?.durationMinutes} min)</p>
      <p>Vehicle: {a.vehicleType}</p>
      {a.notes && <p>Notes: {a.notes}</p>}

      {nextOptions.length > 0 ? (
        <select
          defaultValue=""
          disabled={updating}
          onChange={(e) => {
            if (e.target.value) onStatusChange(a.id, e.target.value);
          }}
        >
          <option value="" disabled>
            {updating ? 'Updating…' : 'Update status…'}
          </option>
          {nextOptions.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      ) : (
        <p><em>No further actions available.</em></p>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { accessToken }   = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [updating,     setUpdating]     = useState(null); // id in flight

  const load = useCallback(() => {
    setLoading(true);
    appointmentService.list(accessToken)
      .then((res) => setAppointments(res.data.data))
      .catch(() => setError('Failed to load appointments.'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id, status) => {
    setUpdating(id);
    try {
      const res = await appointmentService.update(accessToken, id, { status });
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? res.data.data : a))
      );
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to update status.');
    } finally {
      setUpdating(null);
    }
  };

  // Filter to today's appointments only and sort chronologically by time slot.
  // The API already orders by date+timeSlot, but we filter client-side and
  // re-sort so the order is correct regardless of what the server returns.
  const today = localToday();
  const todayAppointments = appointments
    .filter((a) => toDateString(a.date) === today)
    .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

  return (
    <div>
      <Navbar />
      <h1>Today's jobs</h1>
      <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

      {error && <p role="alert">{error}</p>}

      {loading ? (
        <p>Loading…</p>
      ) : todayAppointments.length === 0 ? (
        <p>No appointments scheduled for today.</p>
      ) : (
        todayAppointments.map((a) => (
          <EmployeeAppointmentCard
            key={a.id}
            appointment={a}
            onStatusChange={handleStatusChange}
            updating={updating === a.id}
          />
        ))
      )}
    </div>
  );
}
