import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointmentService }  from '../services/appointmentService';
import { availabilityService } from '../services/availabilityService';
import { serviceService }      from '../services/serviceService';
import AppointmentCard from '../components/AppointmentCard';
import Navbar from '../components/Navbar';
import { localToday, localMaxDate, formatDate, toDateString } from '../utils/dateHelpers';

const VEHICLE_TYPES = ['Sedán/Hatchback', 'SUV', 'Camioneta', 'Van', 'Motocicleta', 'Pickup doble', 'Otro'];

const VEHICLE_PRICE_KEY = {
  'Sedán/Hatchback': 'sedan',
  'SUV':             'suv',
  'Camioneta':       'suv',
  'Van':             'van',
  'Motocicleta':     'sedan',
  'Pickup doble':    'van',
};

const MAX_DAYS = 30;
const EMPTY_FORM = { serviceId: '', date: '', timeSlot: '', vehicleType: '', notes: '' };

const STATUS_LABELS = {
  pending:     'Pendiente',
  confirmed:   'Confirmada',
  in_progress: 'En proceso',
  completed:   'Completada',
  cancelled:   'Cancelada',
};

const UPCOMING_STATUSES = new Set(['pending', 'confirmed', 'in_progress']);

const VEHICLE_CATEGORIES = [
  {
    id:     'sedan',
    name:   'Sedán / Hatchback',
    tier:   'Precio base',
    color:  '#d4a843',
    types:  ['Sedán/Hatchback', 'Motocicleta'],
    models: ['Nissan Versa', 'Chevrolet Aveo', 'Volkswagen Vento', 'Honda Civic'],
  },
  {
    id:     'suv',
    name:   'SUV / Camioneta',
    tier:   'Precio medio',
    color:  '#e09a4a',
    types:  ['SUV', 'Camioneta'],
    models: ['Nissan X-Trail', 'Toyota RAV4', 'Kia Sportage', 'Volkswagen Tiguan'],
  },
  {
    id:     'van',
    name:   'Van / Pickup doble',
    tier:   'Precio mayor',
    color:  '#d0573c',
    types:  ['Van', 'Pickup doble'],
    models: ['Toyota Hiace', 'Nissan Urvan', 'Ford F-150', 'Ram 1500'],
  },
];

// ─── Welcome banner ────────────────────────────────────────────────────────────

function WelcomeBanner({ user, appointments, loading, onBookNow }) {
  const today = localToday();

  const nextAppointment = loading ? null : (
    appointments
      .filter((a) => UPCOMING_STATUSES.has(a.status) && toDateString(a.date) >= today)
      .sort((a, b) => {
        const da = toDateString(a.date) + a.timeSlot;
        const db = toDateString(b.date) + b.timeSlot;
        return da < db ? -1 : da > db ? 1 : 0;
      })[0] ?? null
  );

  return (
    <div className="welcome-banner">
      <h2 className="welcome-heading">
        Bienvenido, <span className="text-accent">{user?.name}</span>
      </h2>
      {loading ? (
        <div className="loading-state loading-state-sm">
          <span className="spinner" /><span>Cargando…</span>
        </div>
      ) : nextAppointment ? (
        <div className="next-appointment-row">
          <p className="next-appointment-text">
            Tu próxima cita:{' '}
            <strong>{nextAppointment.service?.name}</strong>
            {' el '}
            <strong>{formatDate(nextAppointment.date)}</strong>
            {' a las '}
            <strong>{nextAppointment.timeSlot}</strong>
          </p>
          <span className={`badge badge-${nextAppointment.status}`}>
            {STATUS_LABELS[nextAppointment.status] ?? nextAppointment.status}
          </span>
        </div>
      ) : (
        <div className="next-appointment-row">
          <p className="next-appointment-text">
            No tienes citas próximas. ¡Agenda una ahora!
          </p>
          <button className="btn btn-primary btn-sm" onClick={onBookNow}>
            Reservar cita
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Packages section ─────────────────────────────────────────────────────────

function PackagesSection({ onSelectService }) {
  const [services, setServices] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    serviceService.list()
      .then((res) => setServices(res.data.data.filter((s) => s.isActive)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="loading-state loading-state-sm packages-loading">
      <span className="spinner" /><span>Cargando paquetes…</span>
    </div>
  );
  if (!services.length) return null;

  return (
    <div className="packages-section">
      <h2 className="section-heading">Nuestros paquetes</h2>
      <div className="packages-scroll">
        {services.map((svc) => {
          const minPrice = Math.min(...Object.values(svc.prices).map(Number));
          return (
            <div key={svc.id} className="package-card">
              <p className="package-card-name">{svc.name}</p>
              <p className="package-card-duration">{svc.durationMinutes} min</p>
              <p className="package-card-price">Desde ${minPrice.toFixed(0)} MXN</p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onSelectService(svc.id)}
              >
                Agendar
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Vehicle categories section ────────────────────────────────────────────────

function VehicleCategoriesSection({ appointments }) {
  const lastVehicleType = [...appointments]
    .sort((a, b) => {
      const da = toDateString(a.date) + a.timeSlot;
      const db = toDateString(b.date) + b.timeSlot;
      return db < da ? -1 : db > da ? 1 : 0;
    })[0]?.vehicleType ?? null;

  const highlightedId = lastVehicleType
    ? (VEHICLE_CATEGORIES.find((c) => c.types.includes(lastVehicleType))?.id ?? null)
    : null;

  return (
    <div className="vehicle-categories-section">
      <h2 className="section-heading">Categorías de vehículo</h2>
      <div className="vehicle-categories-compact">
        {VEHICLE_CATEGORIES.map((cat) => {
          const highlighted = cat.id === highlightedId;
          return (
            <div
              key={cat.id}
              className={`vehicle-category-card vehicle-category-card--compact${highlighted ? ' vehicle-category-card--highlighted' : ''}`}
              style={{ borderTop: `3px solid ${cat.color}` }}
            >
              <div className="vehicle-category-header">
                <div className="vehicle-category-meta">
                  <p className="vehicle-category-name">{cat.name}</p>
                  <div className="vehicle-category-tier-row">
                    <span className="vehicle-category-tier" style={{ color: cat.color }}>
                      {cat.tier}
                    </span>
                    {highlighted && (
                      <span className="badge badge-admin">Tu vehículo</span>
                    )}
                  </div>
                </div>
              </div>
              <ul className="vehicle-list">
                {cat.models.map((m) => <li key={m}>{m}</li>)}
                <li className="vehicle-list-more">y más…</li>
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Booking form ─────────────────────────────────────────────────────────────

function BookingForm({ accessToken, onBooked, selectedServiceId }) {
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

  useEffect(() => {
    if (selectedServiceId != null) {
      setForm((f) => ({ ...f, serviceId: String(selectedServiceId) }));
    }
  }, [selectedServiceId]);

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
                {s.name} — {s.durationMinutes} min
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

        {form.serviceId && form.vehicleType && (() => {
          const svc = services.find((s) => s.id === parseInt(form.serviceId, 10));
          const priceKey = VEHICLE_PRICE_KEY[form.vehicleType] ?? 'sedan';
          const price = svc?.prices?.[priceKey];
          return price != null ? (
            <div className="alert alert-success" role="status" style={{ marginBottom: '1rem' }}>
              Precio estimado: <strong>${Number(price).toFixed(0)} MXN</strong>
            </div>
          ) : null;
        })()}

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

function AppointmentsList({ appointments, loading, error, onCancel, cancelling }) {
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
          onCancel={onCancel}
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
  const { user, accessToken } = useAuth();
  const [tab,               setTab]               = useState('appointments');
  const [selectedServiceId, setSelectedServiceId] = useState(null);
  const [refreshKey,        setRefreshKey]        = useState(0);

  const [appointments, setAppointments] = useState([]);
  const [apptLoading,  setApptLoading]  = useState(true);
  const [apptError,    setApptError]    = useState('');
  const [cancelling,   setCancelling]   = useState(null);

  const loadAppointments = useCallback(() => {
    setApptLoading(true);
    appointmentService.list(accessToken)
      .then((res) => setAppointments(res.data.data))
      .catch(() => setApptError('No se pudieron cargar las citas.'))
      .finally(() => setApptLoading(false));
  }, [accessToken]);

  useEffect(() => { loadAppointments(); }, [loadAppointments, refreshKey]);

  const handleCancel = async (id) => {
    if (!window.confirm('¿Cancelar esta cita?')) return;
    setCancelling(id);
    try {
      const res = await appointmentService.update(accessToken, id, { status: 'cancelled' });
      setAppointments((prev) => prev.map((a) => (a.id === id ? res.data.data : a)));
    } catch (err) {
      setApptError(err.response?.data?.message ?? 'No se pudo cancelar la cita.');
    } finally {
      setCancelling(null);
    }
  };

  const handleBooked = () => {
    setRefreshKey((k) => k + 1);
    setSelectedServiceId(null);
    setTab('appointments');
  };

  const handleSelectService = (serviceId) => {
    setSelectedServiceId(serviceId);
    setTab('book');
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
            <>
              <WelcomeBanner
                user={user}
                appointments={appointments}
                loading={apptLoading}
                onBookNow={() => { setSelectedServiceId(null); setTab('book'); }}
              />
              <PackagesSection onSelectService={handleSelectService} />
              <VehicleCategoriesSection appointments={appointments} />
              <h2 className="section-heading section-heading--appointments">Mis citas</h2>
              <AppointmentsList
                appointments={appointments}
                loading={apptLoading}
                error={apptError}
                onCancel={handleCancel}
                cancelling={cancelling}
              />
            </>
          )}
          {tab === 'book' && (
            <BookingForm
              accessToken={accessToken}
              onBooked={handleBooked}
              selectedServiceId={selectedServiceId}
            />
          )}
        </section>
      </main>
    </div>
  );
}
