import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Unauthorized() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const goHome = () => {
    if (user) navigate(`/${user.role}`, { replace: true });
    else navigate('/login', { replace: true });
  };

  return (
    <div className="auth-page">
      <Link to="/" className="auth-brand">VOLCÁN DETAILING</Link>
      <div className="card auth-card unauthorized-card">
        <p className="text-muted unauthorized-code">403</p>
        <h1 className="auth-title">Acceso denegado</h1>
        <p className="text-secondary text-sm unauthorized-desc">
          No tienes permiso para ver esta página.
        </p>
        <button className="btn btn-primary btn-full" onClick={goHome}>
          Ir a mi panel
        </button>
      </div>
    </div>
  );
}
