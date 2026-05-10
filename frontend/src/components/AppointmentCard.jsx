import { formatDate, isCancellable } from '../utils/dateHelpers';

const STATUS_LABELS = {
  pending:     'Pendiente',
  confirmed:   'Confirmada',
  in_progress: 'En proceso',
  completed:   'Completada',
  cancelled:   'Cancelada',
};

const CANCELLABLE_STATUSES = new Set(['pending', 'confirmed']);

export default function AppointmentCard({ appointment: a, onCancel, cancelling }) {
  const canCancel    = CANCELLABLE_STATUSES.has(a.status);
  const withinWindow = canCancel && !isCancellable(a.date, a.timeSlot);

  return (
    <div className="card">
      <div className="appointment-card-header">
        <div>
          <p className="appointment-datetime">{formatDate(a.date)} a las {a.timeSlot}</p>
          <div className="appointment-meta">
            <span>{a.service?.name ?? '—'}</span>
            <span className="appointment-meta-sep">·</span>
            <span>{a.vehicleType}</span>
            {a.employee && (
              <>
                <span className="appointment-meta-sep">·</span>
                <span>Empleado: {a.employee.name}</span>
              </>
            )}
          </div>
        </div>
        <span className={`badge badge-${a.status}`}>{STATUS_LABELS[a.status] ?? a.status}</span>
      </div>

      {canCancel && onCancel && (
        <div className="appointment-actions">
          <button
            className="btn btn-danger btn-sm"
            onClick={() => onCancel(a.id)}
            disabled={withinWindow || cancelling}
            title={withinWindow ? 'No se puede cancelar — faltan menos de 2 horas' : undefined}
          >
            {cancelling
              ? <><span className="spinner" /> Cancelando…</>
              : 'Cancelar cita'}
          </button>
          {withinWindow && (
            <span className="cancellation-hint">
              El período de cancelación ha vencido (menos de 2 horas).
            </span>
          )}
        </div>
      )}
    </div>
  );
}
