import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { appointmentService } from '../../services/appointmentService';
import { formatDate } from '../../utils/dateHelpers';

const STATUS_LABELS = {
  pending:     'Pendiente',
  confirmed:   'Confirmada',
  in_progress: 'En proceso',
  completed:   'Completada',
  cancelled:   'Cancelada',
};

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
    } catch {
      setError('No se pudo actualizar el estado.');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return (
    <div className="loading-state">
      <span className="spinner" /><span>Cargando citas…</span>
    </div>
  );
  if (error) return <div className="alert alert-error" role="alert">{error}</div>;
  if (!appointments.length) return <div className="empty-state">No se encontraron citas.</div>;

  return (
    <div className="table-wrapper">
      <table className="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Cliente</th>
            <th>Servicio</th>
            <th>Vehículo</th>
            <th>Estado</th>
            <th>Cambiar estado</th>
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
              <td>
                <span className={`badge badge-${a.status}`}>
                  {STATUS_LABELS[a.status] ?? a.status}
                </span>
              </td>
              <td>
                {NEXT_STATUSES[a.status]?.length > 0 ? (
                  <div className="table-actions">
                    <select
                      className="select-constrained"
                      defaultValue=""
                      disabled={updating === a.id}
                      onChange={(e) => {
                        if (e.target.value) handleStatusChange(a.id, e.target.value);
                      }}
                    >
                      <option value="" disabled>Cambiar a…</option>
                      {NEXT_STATUSES[a.status].map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                    {updating === a.id && <span className="spinner" />}
                  </div>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
