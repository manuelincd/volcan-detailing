import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { appointmentService } from '../../services/appointmentService';
import { userService } from '../../services/userService';
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
  confirmed:   ['pending', 'in_progress', 'cancelled'],
  in_progress: ['pending', 'confirmed', 'completed', 'cancelled'],
  completed:   ['pending', 'confirmed', 'in_progress', 'cancelled'],
  cancelled:   ['pending', 'confirmed', 'in_progress'],
};

export default function AppointmentsTab() {
  const { accessToken } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [employees,    setEmployees]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [updating,     setUpdating]     = useState(null);
  const [assigning,    setAssigning]    = useState(null);
  // per-row selected status value (controlled dropdown)
  const [statusSel,    setStatusSel]    = useState({});
  // rows in "pick a new employee" mode (for already-assigned appointments)
  const [editAssign,   setEditAssign]   = useState(new Set());
  // per-row selected employee value
  const [assignSel,    setAssignSel]    = useState({});

  const load = useCallback(() => {
    setLoading(true);
    appointmentService.list(accessToken)
      .then((res) => setAppointments(res.data.data))
      .catch(() => setError('No se pudieron cargar las citas.'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    userService.listEmployees(accessToken)
      .then((res) => setEmployees(res.data.data))
      .catch(() => {});
  }, [accessToken]);

  const handleStatusChange = async (id, status) => {
    if (!status) return;
    setUpdating(id);
    try {
      const res = await appointmentService.update(accessToken, id, { status });
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? res.data.data : a))
      );
      // Reset this row's dropdown to placeholder after successful update
      setStatusSel((prev) => ({ ...prev, [id]: '' }));
    } catch {
      setError('No se pudo actualizar el estado.');
    } finally {
      setUpdating(null);
    }
  };

  const handleAssign = async (appointmentId, employeeId) => {
    if (!employeeId) return;
    setAssigning(appointmentId);
    try {
      const res = await appointmentService.assign(accessToken, appointmentId, Number(employeeId));
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? res.data.data : a))
      );
      setEditAssign((prev) => { const s = new Set(prev); s.delete(appointmentId); return s; });
      setAssignSel((prev) => { const o = { ...prev }; delete o[appointmentId]; return o; });
    } catch {
      setError('No se pudo asignar el empleado.');
    } finally {
      setAssigning(null);
    }
  };

  const startEditAssign = (id) => {
    setEditAssign((prev) => new Set(prev).add(id));
    setAssignSel((prev) => ({ ...prev, [id]: '' }));
  };

  const cancelEditAssign = (id) => {
    setEditAssign((prev) => { const s = new Set(prev); s.delete(id); return s; });
    setAssignSel((prev) => { const o = { ...prev }; delete o[id]; return o; });
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
            <th>Empleado</th>
            <th>Cambiar estado</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => {
            const inEditAssign = editAssign.has(a.id);
            const selectedEmp  = assignSel[a.id] ?? '';
            const isAssigning  = assigning === a.id;

            return (
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

                {/* ── Assign employee column ── */}
                <td>
                  {a.employee && !inEditAssign ? (
                    <div className="table-actions">
                      <span className="td-primary">{a.employee.name}</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => startEditAssign(a.id)}
                      >
                        Cambiar
                      </button>
                    </div>
                  ) : (
                    <div className="table-actions">
                      <select
                        className="select-constrained"
                        value={selectedEmp}
                        onChange={(e) => setAssignSel((prev) => ({ ...prev, [a.id]: e.target.value }))}
                        disabled={isAssigning || !employees.length}
                      >
                        <option value="">
                          {employees.length ? 'Empleado…' : 'Sin empleados'}
                        </option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleAssign(a.id, selectedEmp)}
                        disabled={!selectedEmp || isAssigning}
                      >
                        {isAssigning ? <span className="spinner" /> : 'Asignar'}
                      </button>
                      {inEditAssign && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => cancelEditAssign(a.id)}
                          disabled={isAssigning}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}
                </td>

                {/* ── Status change column ── */}
                <td>
                  {NEXT_STATUSES[a.status]?.length > 0 ? (
                    <div className="table-actions">
                      <select
                        className="select-constrained"
                        value={statusSel[a.id] ?? ''}
                        disabled={updating === a.id}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStatusSel((prev) => ({ ...prev, [a.id]: val }));
                          handleStatusChange(a.id, val);
                        }}
                      >
                        <option value="" disabled>Cambiar estado…</option>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
