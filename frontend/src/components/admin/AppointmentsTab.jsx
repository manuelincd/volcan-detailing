import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { appointmentService } from '../../services/appointmentService';
import { formatDate } from '../../utils/dateHelpers';

const STATUS_OPTIONS = ['confirmed', 'in_progress', 'completed', 'cancelled'];

const STATUS_LABELS = {
  pending:     'Pending',
  confirmed:   'Confirmed',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

// Statuses an admin may transition TO from a given current status
const NEXT_STATUSES = {
  pending:     ['confirmed', 'in_progress', 'cancelled'],
  confirmed:   ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed:   [],
  cancelled:   [],
};

export default function AppointmentsTab() {
  const { accessToken } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [updating,     setUpdating]     = useState(null); // id of row being updated

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
    } catch {
      setError('Failed to update status.');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <p>Loading appointments…</p>;
  if (error)   return <p role="alert">{error}</p>;
  if (!appointments.length) return <p>No appointments found.</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Time</th>
          <th>Client</th>
          <th>Service</th>
          <th>Vehicle</th>
          <th>Status</th>
          <th>Change status</th>
        </tr>
      </thead>
      <tbody>
        {appointments.map((a) => (
          <tr key={a.id}>
            <td>{formatDate(a.date)}</td>
            <td>{a.timeSlot}</td>
            <td>{a.client?.name ?? '—'}</td>
            <td>{a.service?.name ?? '—'}</td>
            <td>{a.vehicleType}</td>
            <td>{STATUS_LABELS[a.status] ?? a.status}</td>
            <td>
              {NEXT_STATUSES[a.status]?.length > 0 ? (
                <select
                  defaultValue=""
                  disabled={updating === a.id}
                  onChange={(e) => {
                    if (e.target.value) handleStatusChange(a.id, e.target.value);
                  }}
                >
                  <option value="" disabled>Move to…</option>
                  {NEXT_STATUSES[a.status].map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              ) : (
                <span>—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
