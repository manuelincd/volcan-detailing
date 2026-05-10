import { useState } from 'react';
import Navbar from '../components/Navbar';
import AppointmentsTab from '../components/admin/AppointmentsTab';
import UsersTab from '../components/admin/UsersTab';
import ServicesTab from '../components/admin/ServicesTab';

const TABS = [
  { id: 'appointments', label: 'Citas'      },
  { id: 'users',        label: 'Usuarios'   },
  { id: 'services',     label: 'Servicios'  },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('appointments');

  return (
    <div className="page">
      <Navbar />
      <main className="container">
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Panel de administración</h1>
            <p className="dashboard-subtitle">Administra citas, personal y servicios.</p>
          </div>
        </div>

        <nav className="tabs" aria-label="Secciones del panel">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className="tab-btn"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <section>
          {activeTab === 'appointments' && <AppointmentsTab />}
          {activeTab === 'users'        && <UsersTab />}
          {activeTab === 'services'     && <ServicesTab />}
        </section>
      </main>
    </div>
  );
}
