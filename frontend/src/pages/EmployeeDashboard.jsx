import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentService } from '../services/appointmentService';
import AppointmentCard from '../components/AppointmentCard';
import Navbar from '../components/Navbar';

export default function EmployeeDashboard() {
  const { accessToken } = useAuth();
  const [appointments, setAppointments] = useState([]);

  useEffect(() => {
    appointmentService.list(accessToken).then((res) => setAppointments(res.data.data));
  }, [accessToken]);

  return (
    <div>
      <Navbar />
      <h1>My Jobs</h1>
      {appointments.map((a) => (
        <AppointmentCard key={a.id} appointment={a} />
      ))}
    </div>
  );
}
