import { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { serviceService } from '../services/serviceService';
import Navbar from '../components/Navbar';

export default function Landing() {
  const { user, loading } = useAuth();
  const [services,        setServices]        = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  useEffect(() => {
    serviceService.list()
      .then((res) => setServices(res.data.data))
      .catch(() => {})
      .finally(() => setServicesLoading(false));
  }, []);

  if (!loading && user) return <Navigate to={`/${user.role}`} replace />;
  if (loading) return null;

  return (
    <div>
      <Navbar />

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-content">
          <p className="hero-eyebrow">Colima, México · Est. 2020</p>
          <h1 className="hero-title">
            VOLCÁN<br />
            <span className="hero-title-accent">DETAILING</span>
          </h1>
          <p className="hero-subtitle">
            Cuidado premium para tu auto que va más allá de la superficie.
            Diseñado para quienes exigen la perfección.
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn btn-primary btn-lg">
              Reservar cita
            </Link>
            <Link to="/login" className="btn btn-ghost btn-lg">
              Iniciar sesión
            </Link>
          </div>
        </div>
        <span className="hero-scroll-hint">Desplázate para ver más</span>
      </section>

      <div className="section-divider" />

      {/* ── Servicios ── */}
      <section className="landing-section">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-eyebrow">Lo que ofrecemos</p>
            <h2 className="section-title">NUESTROS SERVICIOS</h2>
          </div>

          {servicesLoading ? (
            <div className="loading-state loading-state-center">
              <span className="spinner" />
              <span>Cargando servicios…</span>
            </div>
          ) : services.length === 0 ? (
            <p className="empty-state">Servicios próximamente.</p>
          ) : (
            <div className="services-grid">
              {services.filter((s) => s.isActive).map((svc) => (
                <div key={svc.id} className="card service-card">
                  <h3 className="service-card-name">{svc.name}</h3>
                  <p className="service-card-desc">
                    {svc.description ?? 'Un servicio de detailing profesional para tu auto.'}
                  </p>
                  <div className="service-card-footer">
                    <span className="service-card-price">
                      Desde ${Math.min(...Object.values(svc.prices).map(Number))} MXN
                    </span>
                    <span className="service-card-duration">{svc.durationMinutes} min</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Categorías de vehículo ── */}
      <section className="landing-section">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-eyebrow">Precios según tu vehículo</p>
            <h2 className="section-title">¿QUÉ CATEGORÍA ES MI VEHÍCULO?</h2>
          </div>

          <div className="vehicle-category-grid">
            {/* Sedán */}
            <div
              className="vehicle-category-card"
              style={{ borderTop: '3px solid #d4a843' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(212,168,67,0.18)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
            >
              <div className="vehicle-category-header">
                <div className="vehicle-category-meta">
                  <p className="vehicle-category-name">Sedán / Hatchback</p>
                  <span className="vehicle-category-tier" style={{ color: '#d4a843' }}>Precio base</span>
                </div>
              </div>
              <ul className="vehicle-list">
                <li>Nissan Versa</li>
                <li>Nissan March</li>
                <li>Chevrolet Aveo</li>
                <li>Volkswagen Vento</li>
                <li>Volkswagen Polo</li>
                <li>Toyota Corolla</li>
                <li>Honda Civic</li>
                <li>Kia Rio</li>
                <li>Hyundai Grand i10</li>
                <li>Seat Ibiza</li>
                <li>Chevrolet Spark</li>
                <li>Renault Kwid</li>
                <li>Nissan Sentra</li>
              </ul>
            </div>

            {/* SUV */}
            <div
              className="vehicle-category-card"
              style={{ borderTop: '3px solid #e09a4a' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(224,154,74,0.18)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
            >
              <div className="vehicle-category-header">
                <div className="vehicle-category-meta">
                  <p className="vehicle-category-name">SUV / Camioneta</p>
                  <span className="vehicle-category-tier" style={{ color: '#e09a4a' }}>Precio medio</span>
                </div>
              </div>
              <ul className="vehicle-list">
                <li>Nissan X-Trail</li>
                <li>Nissan Kicks</li>
                <li>Chevrolet Equinox</li>
                <li>Toyota RAV4</li>
                <li>Honda CR-V</li>
                <li>Kia Sportage</li>
                <li>Hyundai Tucson</li>
                <li>Volkswagen Tiguan</li>
                <li>Ford Territory</li>
                <li>Jeep Compass</li>
                <li>Mazda CX-5</li>
                <li>Toyota Hilux (cabina sencilla)</li>
                <li>Nissan NP300 (cabina sencilla)</li>
              </ul>
            </div>

            {/* Van */}
            <div
              className="vehicle-category-card"
              style={{ borderTop: '3px solid #d0573c' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 8px 32px rgba(208,87,60,0.18)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = ''; }}
            >
              <div className="vehicle-category-header">
                <div className="vehicle-category-meta">
                  <p className="vehicle-category-name">Van / Pickup doble</p>
                  <span className="vehicle-category-tier" style={{ color: '#d0573c' }}>Precio mayor</span>
                </div>
              </div>
              <ul className="vehicle-list">
                <li>Toyota Hiace</li>
                <li>Nissan Urvan</li>
                <li>Chevrolet Express</li>
                <li>Ford Transit</li>
                <li>Toyota Land Cruiser</li>
                <li>Ford F-150</li>
                <li>Chevrolet Silverado</li>
                <li>Ram 1500</li>
                <li>Toyota Tundra</li>
                <li>Nissan Frontier (doble cabina)</li>
                <li>Toyota Hilux (doble cabina)</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── Por qué elegirnos ── */}
      <section className="landing-section landing-section-alt">
        <div className="section-inner">
          <div className="section-header">
            <p className="section-eyebrow">Por qué elegirnos</p>
            <h2 className="section-title">EL ESTÁNDAR VOLCÁN</h2>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <span className="feature-icon">⬡</span>
              <h3 className="feature-title">Solo Productos Premium</h3>
              <p className="feature-desc">
                Usamos recubrimientos cerámicos, compuestos de corrección de pintura
                y soluciones de detailing interior de grado profesional.
              </p>
            </div>

            <div className="feature-card">
              <span className="feature-icon">◈</span>
              <h3 className="feature-title">Equipo Experto</h3>
              <p className="feature-desc">
                Cada técnico está capacitado en las últimas técnicas de detailing.
                Tu vehículo recibe el trato que merece, siempre.
              </p>
            </div>

            <div className="feature-card">
              <span className="feature-icon">◆</span>
              <h3 className="feature-title">Resultados Garantizados</h3>
              <p className="feature-desc">
                Respaldamos cada servicio que entregamos. Si no quedas satisfecho,
                lo corregimos sin preguntas.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* ── CTA ── */}
      <section className="landing-cta">
        <div className="section-inner">
          <h2 className="section-title">¿LISTO PARA RESERVAR?</h2>
          <p className="landing-cta-desc">
            Reserva tu cita en línea en menos de dos minutos.
          </p>
          <Link to="/register" className="btn btn-primary btn-lg">
            Comenzar
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-inner">
          <Link to="/" className="footer-brand">VOLCÁN DETAILING</Link>
          <div className="footer-meta">
            <p className="footer-location">Colima, Colima · México</p>
            <p className="footer-copy">
              © {new Date().getFullYear()} Volcán Detailing. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
