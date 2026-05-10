import { formatDate, isCancellable } from '../utils/dateHelpers';

const STATUS_LABELS = {
  pending:     'Pending',
  confirmed:   'Confirmed',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
};

const CANCELLABLE_STATUSES = new Set(['pending', 'confirmed']);

export default function AppointmentCard({ appointment: a, onCancel, cancelling }) {
  const canCancel    = CANCELLABLE_STATUSES.has(a.status);
  const withinWindow = canCancel && !isCancellable(a.date, a.timeSlot);

  return (
    <div>
      <p><strong>{formatDate(a.date)}</strong> at {a.timeSlot}</p>
      <p>{a.service?.name ?? '—'} · {a.vehicleType}</p>
      <p>Status: {STATUS_LABELS[a.status] ?? a.status}</p>
      {a.employee && <p>Employee: {a.employee.name}</p>}

      {canCancel && onCancel && (
        <button
          onClick={() => onCancel(a.id)}
          disabled={withinWindow || cancelling}
          title={withinWindow ? 'Cancellation window has passed (less than 2 hours away)' : undefined}
        >
          {cancelling ? 'Cancelling…' : 'Cancel appointment'}
        </button>
      )}
      {withinWindow && <small>Cannot cancel — less than 2 hours away.</small>}
    </div>
  );
}
