import { formatDate } from '../utils/dateHelpers';

export default function AppointmentCard({ appointment, onCancel }) {
  return (
    <div>
      <p>{formatDate(appointment.date)} — {appointment.timeSlot}</p>
      <p>{appointment.service?.name}</p>
      <p>Status: {appointment.status}</p>
      {onCancel && appointment.status === 'pending' && (
        <button onClick={() => onCancel(appointment.id)}>Cancel</button>
      )}
    </div>
  );
}
