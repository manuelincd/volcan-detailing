import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentService } from '../services/appointmentService';
import Navbar from '../components/Navbar';
import { toDateString, localToday } from '../utils/dateHelpers';

const NEXT_STATUSES = {
  pending:     ['in_progress'],
  confirmed:   ['in_progress'],
  in_progress: ['completed'],
};

const STATUS_LABELS = {
  pending:     'Pendiente',
  confirmed:   'Confirmada',
  in_progress: 'En proceso',
  completed:   'Completada',
  cancelled:   'Cancelada',
};

// ─── Employee appointment card ────────────────────────────────────────────────

function EmployeeAppointmentCard({ appointment: a, onStatusChange, updating }) {
  const nextOptions = NEXT_STATUSES[a.status] ?? [];

  return (
    <div className="card">
      <div className="appointment-card-header">
        <div>
          <p className="appointment-datetime">{a.timeSlot}</p>
          <div className="appointment-meta">
            <span>{a.client?.name ?? '—'}</span>
            <span className="appointment-meta-sep">·</span>
            <span>{a.service?.name ?? '—'} ({a.service?.durationMinutes} min)</span>
            <span className="appointment-meta-sep">·</span>
            <span>{a.vehicleType}</span>
          </div>
        </div>
        <span className={`badge badge-${a.status}`}>{STATUS_LABELS[a.status] ?? a.status}</span>
      </div>

      {a.notes && <p className="appointment-notes">{a.notes}</p>}

      {nextOptions.length > 0 ? (
        <div className="status-select-row">
          <label htmlFor={`status-${a.id}`}>Actualizar estado</label>
          <select
            id={`status-${a.id}`}
            defaultValue=""
            disabled={updating}
            onChange={(e) => {
              if (e.target.value) onStatusChange(a.id, e.target.value);
            }}
          >
            <option value="" disabled>
              {updating ? 'Actualizando…' : 'Cambiar a…'}
            </option>
            {nextOptions.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {updating && <span className="spinner" />}
        </div>
      ) : (
        <p className="no-actions-note">Sin acciones disponibles.</p>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { accessToken } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [updating,     setUpdating]     = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    appointmentService.list(accessToken)
      .then((res) => setAppointments(res.data.data))
      .catch(() => setError('No se pudieron cargar las citas.'))
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
      setError(err.response?.data?.message ?? 'No se pudo actualizar el estado.');
    } finally {
      setUpdating(null);
    }
  };

  const today = localToday();
  const todayAppointments = appointments
    .filter((a) => toDateString(a.date) === today)
    .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));

  const dateLabel = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const count = todayAppointments.length;

  return (
    <div className="page">
      <Navbar />
      <main className="container">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Trabajos de hoy</h1>
            <p className="dashboard-subtitle">{dateLabel}</p>
          </div>
          <span className="badge badge-employee">
            {count} {count === 1 ? 'cita' : 'citas'}
          </span>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        {loading ? (
          <div className="loading-state">
            <span className="spinner" /><span>Cargando…</span>
          </div>
        ) : todayAppointments.length === 0 ? (
          <div className="empty-state">No hay citas programadas para hoy.</div>
        ) : (
          <div className="appointments-list">
            {todayAppointments.map((a) => (
              <EmployeeAppointmentCard
                key={a.id}
                appointment={a}
                onStatusChange={handleStatusChange}
                updating={updating === a.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
