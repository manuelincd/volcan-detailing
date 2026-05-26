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

const TERMINAL = new Set(['completed', 'cancelled']);

function formatGroupHeader(dateStr) {
  const label = new Date(dateStr + 'T00:00:00Z').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupByDate(appointments) {
  const groups = {};
  for (const a of appointments) {
    const key = toDateString(a.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }
  return groups;
}

// ─── Employee appointment card ────────────────────────────────────────────────

function EmployeeAppointmentCard({ appointment: a, onStatusChange, updating, past }) {
  const nextOptions = past ? [] : (NEXT_STATUSES[a.status] ?? []);

  return (
    <div className={`card${past ? ' appointment-card--past' : ''}`}>
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

      {!past && (
        nextOptions.length > 0 ? (
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
        )
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
  const [showPast,     setShowPast]     = useState(false);

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

  const upcoming = appointments
    .filter((a) => {
      const d = toDateString(a.date);
      return d === today || (d > today && !TERMINAL.has(a.status));
    })
    .sort((a, b) => {
      const ka = toDateString(a.date) + a.timeSlot;
      const kb = toDateString(b.date) + b.timeSlot;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

  const past = appointments
    .filter((a) => {
      const d = toDateString(a.date);
      return d < today || (d > today && TERMINAL.has(a.status));
    })
    .sort((a, b) => {
      const ka = toDateString(a.date) + a.timeSlot;
      const kb = toDateString(b.date) + b.timeSlot;
      return ka > kb ? -1 : ka < kb ? 1 : 0;
    });

  const upcomingGroups  = groupByDate(upcoming);
  const upcomingDateKeys = Object.keys(upcomingGroups).sort();

  const pastGroups    = groupByDate(past);
  const pastDateKeys  = Object.keys(pastGroups).sort().reverse();

  return (
    <div className="page">
      <Navbar />
      <main className="container">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Mis citas próximas</h1>
          </div>
          <span className="badge badge-employee">
            {upcoming.length} {upcoming.length === 1 ? 'cita' : 'citas'}
          </span>
        </div>

        {error && <div className="alert alert-error" role="alert">{error}</div>}

        {loading ? (
          <div className="loading-state">
            <span className="spinner" /><span>Cargando…</span>
          </div>
        ) : upcoming.length === 0 ? (
          <div className="empty-state">No tienes citas próximas asignadas.</div>
        ) : (
          <div className="appointments-list">
            {upcomingDateKeys.map((dateKey) => (
              <div key={dateKey} className="date-group">
                <h3 className="date-group-heading">{formatGroupHeader(dateKey)}</h3>
                {upcomingGroups[dateKey].map((a) => (
                  <EmployeeAppointmentCard
                    key={a.id}
                    appointment={a}
                    onStatusChange={handleStatusChange}
                    updating={updating === a.id}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {!loading && past.length > 0 && (
          <div className="past-section">
            {!showPast ? (
              <button
                className="btn btn-sm btn-reactivate"
                onClick={() => setShowPast(true)}
              >
                Ver citas anteriores ({past.length})
              </button>
            ) : (
              <>
                <div className="appointments-list">
                  {pastDateKeys.map((dateKey) => (
                    <div key={dateKey} className="date-group">
                      <h3 className="date-group-heading">{formatGroupHeader(dateKey)}</h3>
                      {pastGroups[dateKey].map((a) => (
                        <EmployeeAppointmentCard
                          key={a.id}
                          appointment={a}
                          onStatusChange={handleStatusChange}
                          updating={updating === a.id}
                          past
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => setShowPast(false)}
                >
                  Ocultar citas anteriores
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
