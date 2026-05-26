import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';

const ROLE_LABELS = {
  admin:    'Administrador',
  employee: 'Empleado',
  client:   'Cliente',
};

const INITIAL_FORM = { email: '', password: '', name: '', phone: '' };

export default function UsersTab() {
  const { accessToken, user: self } = useAuth();
  const [users,        setUsers]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState(INITIAL_FORM);
  const [formError,    setFormError]    = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [deactivating,  setDeactivating]  = useState(null);
  const [reactivating,  setReactivating]  = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    userService.list(accessToken)
      .then((res) => setUsers(res.data.data))
      .catch(() => setError('No se pudieron cargar los usuarios.'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const setField = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await userService.create(accessToken, form);
      setForm(INITIAL_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message ?? 'No se pudo crear el empleado.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('¿Desactivar este usuario?')) return;
    setDeactivating(id);
    try {
      const res = await userService.deactivate(accessToken, id);
      setUsers((prev) => prev.map((u) => (u.id === id ? res.data.data : u)));
    } catch (err) {
      setError(err.response?.data?.message ?? 'No se pudo desactivar el usuario.');
    } finally {
      setDeactivating(null);
    }
  };

  const handleReactivate = async (user) => {
    setReactivating(user.id);
    try {
      const res = await userService.update(accessToken, user.id, { name: user.name, isActive: true });
      setUsers((prev) => prev.map((u) => (u.id === user.id ? res.data.data : u)));
    } catch (err) {
      setError(err.response?.data?.message ?? 'No se pudo reactivar el usuario.');
    } finally {
      setReactivating(null);
    }
  };

  if (loading) return (
    <div className="loading-state">
      <span className="spinner" /><span>Cargando usuarios…</span>
    </div>
  );
  if (error) return <div className="alert alert-error" role="alert">{error}</div>;

  return (
    <div>
      <div className="tab-toolbar">
        <button
          className={showForm ? 'btn btn-ghost btn-sm' : 'btn btn-primary btn-sm'}
          onClick={() => { setShowForm((v) => !v); setFormError(''); }}
        >
          {showForm ? 'Cancelar' : '+ Nuevo empleado'}
        </button>
      </div>

      {showForm && (
        <div className="panel">
          <h3 className="panel-title">Crear empleado</h3>
          {formError && <div className="alert alert-error" role="alert">{formError}</div>}

          <form onSubmit={handleCreate} noValidate>
            <div className="form-group">
              <label htmlFor="emp-name">Nombre completo</label>
              <input
                id="emp-name"
                value={form.name}
                onChange={setField('name')}
                placeholder="Nombre del empleado"
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="emp-email">Correo electrónico</label>
              <input
                id="emp-email"
                type="email"
                value={form.email}
                onChange={setField('email')}
                placeholder="empleado@volcan.com"
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="emp-password">Contraseña</label>
              <input
                id="emp-password"
                type="password"
                value={form.password}
                onChange={setField('password')}
                placeholder="••••••••"
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="emp-phone">
                Teléfono <span className="text-muted label-opt">(opcional)</span>
              </label>
              <input
                id="emp-phone"
                type="tel"
                value={form.phone}
                onChange={setField('phone')}
                placeholder="+52 312 000 0000"
                disabled={submitting}
              />
            </div>

            <div className="panel-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => { setShowForm(false); setFormError(''); }}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                {submitting ? <><span className="spinner" /> Creando…</> : 'Crear empleado'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Teléfono</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.isActive ? '' : 'tr-inactive'}>
                <td className="td-primary">{u.name}</td>
                <td>{u.email}</td>
                <td>{u.phone ?? '—'}</td>
                <td>
                  <span className={`badge badge-${u.role}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td>
                  <span className={u.isActive ? 'badge badge-active' : 'badge badge-inactive'}>
                    {u.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    {u.isActive ? (
                      u.id !== self?.id && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeactivate(u.id)}
                          disabled={deactivating === u.id}
                        >
                          {deactivating === u.id
                            ? <><span className="spinner" /> Desactivando…</>
                            : 'Desactivar'}
                        </button>
                      )
                    ) : (
                      <button
                        className="btn btn-sm btn-reactivate"
                        onClick={() => handleReactivate(u)}
                        disabled={reactivating === u.id}
                      >
                        {reactivating === u.id
                          ? <><span className="spinner" /> Reactivando…</>
                          : 'Reactivar'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
