import { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../utils/validators';

export default function Login() {
  const { user, loading, login, validateMfa } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  // MFA challenge state
  const [mfaStep,    setMfaStep]    = useState(false);
  const [tempToken,  setTempToken]  = useState('');
  const [mfaCode,    setMfaCode]    = useState('');

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
      const result = await login(email, password);
      if (result.mfaRequired) {
        setTempToken(result.tempToken);
        setMfaStep(true);
        setSubmitting(false);
        return;
      }
      const destination = location.state?.from?.pathname ?? `/${result.role}`;
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

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedInUser = await validateMfa(tempToken, mfaCode);
      const destination = location.state?.from?.pathname ?? `/${loggedInUser.role}`;
      navigate(destination, { replace: true });
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'INVALID_MFA_TOKEN') {
        setError('Código incorrecto. Verifica tu aplicación de autenticación.');
      } else {
        // tempToken expired or other error — restart login
        setError('Sesión expirada. Inicia sesión de nuevo.');
        setMfaStep(false);
        setTempToken('');
        setMfaCode('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <Link to="/" className="auth-brand">VOLCÁN DETAILING</Link>

      <div className="card auth-card">
        {!mfaStep ? (
          <>
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
          </>
        ) : (
          <>
            <h1 className="auth-title">Verificación en dos pasos</h1>
            <p className="text-muted" style={{ marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              Ingresa el código de 6 dígitos de tu aplicación de autenticación.
            </p>

            {error && (
              <div className="alert alert-error" role="alert">{error}</div>
            )}

            <form onSubmit={handleMfaSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="mfa-code">Código de verificación</label>
                <input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="one-time-code"
                  placeholder="000000"
                  required
                  disabled={submitting}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full btn-submit"
                disabled={submitting || mfaCode.length !== 6}
              >
                {submitting ? (
                  <><span className="spinner" /> Verificando…</>
                ) : 'Verificar'}
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-full"
                style={{ marginTop: '0.5rem' }}
                onClick={() => { setMfaStep(false); setError(''); setMfaCode(''); }}
                disabled={submitting}
              >
                ← Volver
              </button>
            </form>
          </>
        )}
      </div>

      {!mfaStep && (
        <p className="auth-footer">
          ¿No tienes cuenta?{' '}
          <Link to="/register">Regístrate</Link>
        </p>
      )}
    </div>
  );
}
