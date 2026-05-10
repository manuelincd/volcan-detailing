import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  admin:    'Administrador',
  employee: 'Empleado',
  client:   'Cliente',
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">VOLCÁN DETAILING</Link>

      <div className="navbar-actions">
        {user ? (
          <>
            <span className="navbar-user">{user.name}</span>
            <span className={`badge badge-${user.role}`}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/perfil')}
            >
              Mi perfil
            </button>
            <button className="btn btn-ghost btn-sm" onClick={logout}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn btn-ghost btn-sm">Iniciar sesión</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Reservar ahora</Link>
          </>
        )}
      </div>
    </nav>
  );
}
