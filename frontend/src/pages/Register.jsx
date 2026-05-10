import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';
import { validateEmail, validatePassword } from '../utils/validators';

const EMPTY_FORM   = { name: '', email: '', password: '', confirmPassword: '', phone: '' };
const EMPTY_ERRORS = { name: '', email: '', password: '', confirmPassword: '', phone: '', form: '' };

const PHONE_RE = /^\+?[\d\s\-()\\.]{7,20}$/;

export default function Register() {
  const navigate = useNavigate();
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [errors,     setErrors]     = useState(EMPTY_ERRORS);
  const [submitting, setSubmitting] = useState(false);

  const setField = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const next = { ...EMPTY_ERRORS };
    let valid = true;

    if (form.name.trim().length < 2) {
      next.name = 'El nombre debe tener al menos 2 caracteres.';
      valid = false;
    }
    if (!validateEmail(form.email)) {
      next.email = 'Ingresa un correo electrónico válido.';
      valid = false;
    }
    if (!validatePassword(form.password)) {
      next.password = 'Debe tener al menos 8 caracteres, una mayúscula, un número y un carácter especial.';
      valid = false;
    }
    if (form.password !== form.confirmPassword) {
      next.confirmPassword = 'Las contraseñas no coinciden.';
      valid = false;
    }
    if (form.phone && !PHONE_RE.test(form.phone)) {
      next.phone = 'Ingresa un número telefónico válido.';
      valid = false;
    }

    setErrors(next);
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors(EMPTY_ERRORS);

    if (!validate()) return;

    setSubmitting(true);
    try {
      await authService.register({
        name:     form.name.trim(),
        email:    form.email,
        password: form.password,
        ...(form.phone ? { phone: form.phone } : {}),
      });
      navigate('/login', { state: { message: '¡Cuenta creada! Ya puedes iniciar sesión.' } });
    } catch {
      setErrors((prev) => ({ ...prev, form: 'El registro falló. Intenta de nuevo.' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <Link to="/" className="auth-brand">VOLCÁN DETAILING</Link>

      <div className="card auth-card">
        <h1 className="auth-title">Crear una cuenta</h1>

        {errors.form && (
          <div className="alert alert-error" role="alert">{errors.form}</div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="reg-name">Nombre completo</label>
            <input
              id="reg-name"
              type="text"
              value={form.name}
              onChange={setField('name')}
              autoComplete="name"
              placeholder="María García"
              required
              disabled={submitting}
              aria-describedby={errors.name ? 'name-error' : undefined}
            />
            {errors.name && <span id="name-error" className="field-error" role="alert">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Correo electrónico</label>
            <input
              id="reg-email"
              type="email"
              value={form.email}
              onChange={setField('email')}
              autoComplete="email"
              placeholder="tú@ejemplo.com"
              required
              disabled={submitting}
              aria-describedby={errors.email ? 'email-error' : undefined}
            />
            {errors.email && <span id="email-error" className="field-error" role="alert">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Contraseña</label>
            <input
              id="reg-password"
              type="password"
              value={form.password}
              onChange={setField('password')}
              autoComplete="new-password"
              placeholder="••••••••"
              required
              disabled={submitting}
              aria-describedby={errors.password ? 'password-error' : undefined}
            />
            {errors.password && <span id="password-error" className="field-error" role="alert">{errors.password}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="reg-confirm">Confirmar contraseña</label>
            <input
              id="reg-confirm"
              type="password"
              value={form.confirmPassword}
              onChange={setField('confirmPassword')}
              autoComplete="new-password"
              placeholder="••••••••"
              required
              disabled={submitting}
              aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
            />
            {errors.confirmPassword && (
              <span id="confirm-error" className="field-error" role="alert">{errors.confirmPassword}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="reg-phone">
              Teléfono <span className="text-muted label-opt">(opcional)</span>
            </label>
            <input
              id="reg-phone"
              type="tel"
              value={form.phone}
              onChange={setField('phone')}
              autoComplete="tel"
              placeholder="+52 312 000 0000"
              disabled={submitting}
              aria-describedby={errors.phone ? 'phone-error' : undefined}
            />
            {errors.phone && <span id="phone-error" className="field-error" role="alert">{errors.phone}</span>}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-submit"
            disabled={submitting}
          >
            {submitting ? (
              <><span className="spinner" /> Creando cuenta…</>
            ) : 'Crear cuenta'}
          </button>
        </form>
      </div>

      <p className="auth-footer">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login">Inicia sesión</Link>
      </p>
    </div>
  );
}
