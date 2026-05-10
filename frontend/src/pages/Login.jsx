import { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../utils/validators';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    const destination = location.state?.from?.pathname ?? `/${user.role}`;
    return <Navigate to={destination} replace />;
  }

  const successMessage = location.state?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      const destination = location.state?.from?.pathname ?? `/${loggedInUser.role}`;
      navigate(destination, { replace: true });
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'RATE_LIMIT_EXCEEDED') {
        setError('Demasiados intentos. Espera 15 minutos e intenta de nuevo.');
      } else {
        setError('Correo electrónico o contraseña incorrectos.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <Link to="/" className="auth-brand">VOLCÁN DETAILING</Link>

      <div className="card auth-card">
        <h1 className="auth-title">Iniciar sesión</h1>

        {successMessage && (
          <div className="alert alert-success" role="status">{successMessage}</div>
        )}
        {error && (
          <div className="alert alert-error" role="alert">{error}</div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="tú@ejemplo.com"
              required
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-submit"
            disabled={submitting}
          >
            {submitting ? (
              <><span className="spinner" /> Iniciando sesión…</>
            ) : 'Iniciar sesión'}
          </button>
        </form>
      </div>

      <p className="auth-footer">
        ¿No tienes cuenta?{' '}
        <Link to="/register">Regístrate</Link>
      </p>
    </div>
  );
}
