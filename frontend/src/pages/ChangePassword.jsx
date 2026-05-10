import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { validatePassword } from '../utils/validators';

const EMPTY_PW_FORM   = { currentPassword: '', newPassword: '', confirmPassword: '' };
const EMPTY_PW_ERRORS = { currentPassword: '', newPassword: '', confirmPassword: '', form: '' };

const ROLE_HOME = { admin: '/admin', employee: '/employee', client: '/client' };

// ─── Change Password Section ──────────────────────────────────────────────────

function ChangePasswordSection({ accessToken }) {
  const [form,       setForm]       = useState(EMPTY_PW_FORM);
  const [errors,     setErrors]     = useState(EMPTY_PW_ERRORS);
  const [submitting, setSubmitting] = useState(false);
  const [success,    setSuccess]    = useState(false);

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const next = { ...EMPTY_PW_ERRORS };
    let valid = true;
    if (!form.currentPassword) {
      next.currentPassword = 'Ingresa tu contraseña actual.';
      valid = false;
    }
    if (!validatePassword(form.newPassword)) {
      next.newPassword = 'Debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial.';
      valid = false;
    }
    if (form.newPassword !== form.confirmPassword) {
      next.confirmPassword = 'Las contraseñas no coinciden.';
      valid = false;
    }
    setErrors(next);
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors(EMPTY_PW_ERRORS);
    setSuccess(false);
    if (!validate()) return;
    setSubmitting(true);
    try {
      await authService.changePassword(accessToken, form.currentPassword, form.newPassword);
      setForm(EMPTY_PW_FORM);
      setSuccess(true);
    } catch (err) {
      const code = err?.response?.data?.code;
      if (code === 'INVALID_CREDENTIALS') {
        setErrors((prev) => ({ ...prev, form: 'No se pudo actualizar la contraseña. Verifica tus datos.' }));
      } else {
        setErrors((prev) => ({ ...prev, form: 'Ocurrió un error. Intenta de nuevo.' }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem' }}>Cambiar contraseña</h2>

      {success && (
        <div className="alert alert-success" role="status">Contraseña actualizada correctamente.</div>
      )}
      {errors.form && (
        <div className="alert alert-error" role="alert">{errors.form}</div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="cp-current">Contraseña actual</label>
          <input id="cp-current" type="password" value={form.currentPassword}
            onChange={setField('currentPassword')} autoComplete="current-password"
            placeholder="••••••••" required disabled={submitting}
            aria-describedby={errors.currentPassword ? 'cp-current-err' : undefined} />
          {errors.currentPassword && (
            <span id="cp-current-err" className="field-error" role="alert">{errors.currentPassword}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="cp-new">Nueva contraseña</label>
          <input id="cp-new" type="password" value={form.newPassword}
            onChange={setField('newPassword')} autoComplete="new-password"
            placeholder="••••••••" required disabled={submitting}
            aria-describedby={errors.newPassword ? 'cp-new-err' : undefined} />
          {errors.newPassword && (
            <span id="cp-new-err" className="field-error" role="alert">{errors.newPassword}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="cp-confirm">Confirmar nueva contraseña</label>
          <input id="cp-confirm" type="password" value={form.confirmPassword}
            onChange={setField('confirmPassword')} autoComplete="new-password"
            placeholder="••••••••" required disabled={submitting}
            aria-describedby={errors.confirmPassword ? 'cp-confirm-err' : undefined} />
          {errors.confirmPassword && (
            <span id="cp-confirm-err" className="field-error" role="alert">{errors.confirmPassword}</span>
          )}
        </div>

        <button type="submit" className="btn btn-primary btn-submit" disabled={submitting}>
          {submitting ? <><span className="spinner" /> Actualizando…</> : 'Actualizar contraseña'}
        </button>
      </form>
    </div>
  );
}

// ─── MFA Section ─────────────────────────────────────────────────────────────

function MfaSection({ accessToken, mfaEnabled, onMfaChange }) {
  const [step,        setStep]        = useState('idle'); // idle | setup | disabling
  const [qrCodeUrl,   setQrCodeUrl]   = useState('');
  const [secret,      setSecret]      = useState('');
  const [mfaToken,    setMfaToken]    = useState('');
  const [mfaPassword, setMfaPassword] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  const reset = () => {
    setStep('idle');
    setQrCodeUrl('');
    setSecret('');
    setMfaToken('');
    setMfaPassword('');
    setError('');
    setSuccess('');
  };

  const startSetup = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const { data } = await authService.mfaSetup(accessToken);
      setQrCodeUrl(data.data.qrCodeUrl);
      setSecret(data.data.secret);
      setStep('setup');
    } catch {
      setError('No se pudo iniciar la configuración. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async (e) => {
    e.preventDefault();
    if (mfaToken.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      await authService.mfaVerifySetup(accessToken, mfaToken);
      onMfaChange(true);
      setSuccess('Autenticación de dos factores activada correctamente.');
      reset();
    } catch (err) {
      const code = err?.response?.data?.code;
      setError(code === 'INVALID_MFA_TOKEN'
        ? 'Código incorrecto. Verifica tu aplicación de autenticación.'
        : 'Ocurrió un error. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.mfaDisable(accessToken, mfaPassword);
      onMfaChange(false);
      setSuccess('Autenticación de dos factores desactivada.');
      reset();
    } catch (err) {
      const code = err?.response?.data?.code;
      setError(code === 'INVALID_CREDENTIALS'
        ? 'Contraseña incorrecta.'
        : 'Ocurrió un error. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Autenticación de dos factores (2FA)
      </h2>
      <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1.25rem' }}>
        {mfaEnabled
          ? 'Tu cuenta está protegida con autenticación de dos factores.'
          : 'Agrega una capa extra de seguridad con una aplicación como Google Authenticator.'}
      </p>

      {success && <div className="alert alert-success" role="status">{success}</div>}
      {error   && <div className="alert alert-error"   role="alert">{error}</div>}

      {step === 'idle' && (
        mfaEnabled ? (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setStep('disabling'); setError(''); setSuccess(''); }}
            disabled={loading}
          >
            Desactivar MFA
          </button>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={startSetup}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> Cargando…</> : 'Activar autenticación de dos factores'}
          </button>
        )
      )}

      {step === 'setup' && (
        <form onSubmit={handleVerifySetup} noValidate>
          <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            Escanea este código QR con Google Authenticator u otra aplicación TOTP.
          </p>
          {qrCodeUrl && (
            <img
              src={qrCodeUrl}
              alt="QR code para Google Authenticator"
              style={{ display: 'block', width: 180, height: 180, marginBottom: '0.75rem', borderRadius: 8 }}
            />
          )}
          <details style={{ marginBottom: '1rem' }}>
            <summary style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
              ¿No puedes escanear? Ingresa la clave manualmente
            </summary>
            <code style={{ display: 'block', marginTop: '0.4rem', fontSize: '0.8rem', wordBreak: 'break-all',
              background: 'var(--color-bg-elevated)', padding: '0.5rem', borderRadius: 4 }}>
              {secret}
            </code>
          </details>

          <div className="form-group">
            <label htmlFor="mfa-setup-token">Código de verificación (6 dígitos)</label>
            <input
              id="mfa-setup-token"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={mfaToken}
              onChange={(e) => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoComplete="one-time-code"
              placeholder="000000"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary btn-sm"
              disabled={loading || mfaToken.length !== 6}>
              {loading ? <><span className="spinner" /> Verificando…</> : 'Activar'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={loading}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {step === 'disabling' && (
        <form onSubmit={handleDisable} noValidate>
          <div className="form-group">
            <label htmlFor="mfa-disable-pw">Confirma tu contraseña para desactivar MFA</label>
            <input
              id="mfa-disable-pw"
              type="password"
              value={mfaPassword}
              onChange={(e) => setMfaPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary btn-sm"
              disabled={loading || !mfaPassword}>
              {loading ? <><span className="spinner" /> Desactivando…</> : 'Confirmar'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={loading}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Profile Page ─────────────────────────────────────────────────────────────

export default function Profile() {
  const { user, accessToken, updateUser } = useAuth();
  const home = ROLE_HOME[user?.role] ?? '/';

  const [mfaEnabled, setMfaEnabled] = useState(user?.mfaEnabled ?? false);

  const handleMfaChange = (enabled) => {
    setMfaEnabled(enabled);
    updateUser({ mfaEnabled: enabled });
  };

  return (
    <div className="auth-page" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
      <Link to={home} className="auth-brand">VOLCÁN DETAILING</Link>

      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <h1 className="auth-title" style={{ marginBottom: '1.5rem' }}>Mi perfil</h1>

        <ChangePasswordSection accessToken={accessToken} />
        <MfaSection accessToken={accessToken} mfaEnabled={mfaEnabled} onMfaChange={handleMfaChange} />
      </div>

      <p className="auth-footer" style={{ marginTop: '1.5rem' }}>
        <Link to={home}>← Volver al inicio</Link>
      </p>
    </div>
  );
}
