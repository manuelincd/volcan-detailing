import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentService } from '../services/appointmentService';
import AppointmentCard from '../components/AppointmentCard';
import Navbar from '../components/Navbar';

export default function ClientDashboard() {
  const { accessToken } = useAuth();
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    appointmentService.list(accessToken).then((res) => setAppointments(res.data.data));
  }, [accessToken]);

  const cancel = async (id) => {
    await appointmentService.update(accessToken, id, { status: 'cancelled' });
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)));
  };

  return (
    <div>
      <Navbar />
      <h1>My Appointments</h1>
      {appointments.map((a) => (
        <AppointmentCard key={a.id} appointment={a} onCancel={cancel} />
      ))}
    </div>
  );
}
