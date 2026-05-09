import { useState } from 'react';
import Navbar from '../components/Navbar';
import AppointmentsTab from '../components/admin/AppointmentsTab';
import UsersTab from '../components/admin/UsersTab';
import ServicesTab from '../components/admin/ServicesTab';

const TABS = [
  { id: 'appointments', label: 'Appointments' },
  { id: 'users',        label: 'Users'         },
  { id: 'services',     label: 'Services'      },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('appointments');

  return (
    <div>
      <Navbar />
      <h1>Admin dashboard</h1>

      <nav aria-label="Dashboard tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
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
    </div>
  );
}
