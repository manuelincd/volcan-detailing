import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentService }  from '../services/appointmentService';
import { availabilityService } from '../services/availabilityService';
import { serviceService }      from '../services/serviceService';
import AppointmentCard from '../components/AppointmentCard';
import Navbar from '../components/Navbar';
import { localToday, localMaxDate } from '../utils/dateHelpers';

const VEHICLE_TYPES = ['Sedán', 'SUV', 'Camioneta', 'Van', 'Motocicleta', 'Otro'];
const MAX_DAYS = 30;
const EMPTY_FORM = { serviceId: '', date: '', timeSlot: '', vehicleType: '', notes: '' };

// ─── Booking form ─────────────────────────────────────────────────────────────

function BookingForm({ accessToken, onBooked }) {
  const [services,     setServices]     = useState([]);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [slots,        setSlots]        = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError,   setSlotsError]   = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');
  const [success,      setSuccess]      = useState('');

  useEffect(() => {
    serviceService.list()
      .then((res) => setServices(res.data.data))
      .catch(() => setError('No se pudieron cargar los servicios.'));
  }, []);

  const setField = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleDateChange = async (e) => {
    const date = e.target.value;
    setForm((f) => ({ ...f, date, timeSlot: '' }));
    setSlots([]);
    setSlotsError('');
    if (!date) return;

    setSlotsLoading(true);
    try {
      const res = await availabilityService.getSlots(date);
      const available = res.data.data.available;
      setSlots(available);
      if (!available.length) setSlotsError('No hay horarios disponibles para esta fecha.');
    } catch (err) {
      setSlotsError(err.response?.data?.message ?? 'No se pudieron cargar los horarios.');
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await appointmentService.create(accessToken, {
        serviceId:   parseInt(form.serviceId, 10),
        date:        form.date,
        timeSlot:    form.timeSlot,
        vehicleType: form.vehicleType,
        notes:       form.notes || undefined,
      });
      setSuccess('¡Cita reservada!');
      setForm(EMPTY_FORM);
      setSlots([]);
      onBooked();
    } catch (err) {
      setError(err.response?.data?.message ?? 'La reserva falló. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const today   = localToday();
  const maxDate = localMaxDate(MAX_DAYS);

  return (
    <div className="card">
      <h2 className="card-title">Reservar una cita</h2>

      {error   && <div className="alert alert-error"  role="alert">{error}</div>}
      {success && <div className="alert alert-success" role="status">{success}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="serviceId">Servicio</label>
          <select
            id="serviceId"
            value={form.serviceId}
            onChange={setField('serviceId')}
            required
            disabled={submitting}
          >
            <option value="">Selecciona un servicio…</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.durationMinutes} min — ${Number(s.price).toFixed(2)} MXN
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="date">Fecha</label>
          <input
            id="date"
            type="date"
            value={form.date}
            min={today}
            max={maxDate}
            onChange={handleDateChange}
            required
            disabled={submitting}
          />
        </div>

        {form.date && (
          <div className="form-group">
            <label htmlFor="timeSlot">Horarios disponibles</label>
            {slotsLoading && (
              <div className="loading-state loading-state-sm">
                <span className="spinner" /><span>Cargando horarios…</span>
              </div>
            )}
            {slotsError && <div className="alert alert-error" role="alert">{slotsError}</div>}
            {!slotsLoading && !slotsError && (
              <select
                id="timeSlot"
                value={form.timeSlot}
                onChange={setField('timeSlot')}
                required
                disabled={!slots.length || submitting}
              >
                <option value="">
                  {slots.length ? 'Selecciona un horario…' : 'Sin horarios disponibles'}
                </option>
                {slots.map((s) => (
                  <option key={s.id} value={s.startTime}>
                    {s.startTime} – {s.endTime}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="vehicleType">Tipo de vehículo</label>
          <select
            id="vehicleType"
            value={form.vehicleType}
            onChange={setField('vehicleType')}
            required
            disabled={submitting}
          >
            <option value="">Selecciona el tipo de vehículo…</option>
            {VEHICLE_TYPES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="notes">
            Notas <span className="text-muted label-opt">(opcional)</span>
          </label>
          <textarea
            id="notes"
            value={form.notes}
            onChange={setField('notes')}
            maxLength={500}
            rows={3}
            placeholder="Detalles sobre tu vehículo o solicitudes especiales…"
            disabled={submitting}
          />
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-submit"
          disabled={submitting || slotsLoading}
        >
          {submitting ? <><span className="spinner" /> Reservando…</> : 'Reservar cita'}
        </button>
      </form>
    </div>
  );
}

// ─── Appointments list ────────────────────────────────────────────────────────

function AppointmentsList({ accessToken, refreshKey }) {
  const [appointments, setAppointments] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [cancelling,   setCancelling]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    appointmentService.list(accessToken)
      .then((res) => setAppointments(res.data.data))
      .catch(() => setError('No se pudieron cargar las citas.'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleCancel = async (id) => {
    if (!window.confirm('¿Cancelar esta cita?')) return;
    setCancelling(id);
    try {
      const res = await appointmentService.update(accessToken, id, { status: 'cancelled' });
      setAppointments((prev) => prev.map((a) => (a.id === id ? res.data.data : a)));
    } catch (err) {
      setError(err.response?.data?.message ?? 'No se pudo cancelar la cita.');
    } finally {
      setCancelling(null);
    }
  };

  if (loading) return (
    <div className="loading-state">
      <span className="spinner" /><span>Cargando citas…</span>
    </div>
  );
  if (error) return <div className="alert alert-error" role="alert">{error}</div>;
  if (!appointments.length) return (
    <div className="empty-state">Aún no tienes citas. ¡Reserva tu primera!</div>
  );

  return (
    <div className="appointments-list">
      {appointments.map((a) => (
        <AppointmentCard
          key={a.id}
          appointment={a}
          onCancel={handleCancel}
          cancelling={cancelling === a.id}
        />
      ))}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'appointments', label: 'Mis citas'     },
  { id: 'book',         label: 'Reservar cita' },
];

export default function ClientDashboard() {
  const { accessToken } = useAuth();
  const [tab,        setTab]        = useState('appointments');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleBooked = () => {
    setRefreshKey((k) => k + 1);
    setTab('appointments');
  };

  return (
    <div className="page">
      <Navbar />
      <main className="container">
        <div className="dashboard-header">
          <h1 className="dashboard-title">Mi panel</h1>
        </div>

        <nav className="tabs" aria-label="Secciones del panel">
          {TABS.map((t) => (
            <button
              key={t.id}
              className="tab-btn"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section>
          {tab === 'appointments' && (
            <AppointmentsList accessToken={accessToken} refreshKey={refreshKey} />
          )}
          {tab === 'book' && (
            <BookingForm accessToken={accessToken} onBooked={handleBooked} />
          )}
        </section>
      </main>
    </div>
  );
}
