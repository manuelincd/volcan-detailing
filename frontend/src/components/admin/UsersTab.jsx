import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { userService } from '../../services/userService';

const ROLE_LABELS = { admin: 'Admin', employee: 'Employee', client: 'Client' };

const INITIAL_FORM = { email: '', password: '', name: '', phone: '' };

export default function UsersTab() {
  const { accessToken, user: self } = useAuth();
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState(INITIAL_FORM);
  const [formError,   setFormError]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [deactivating, setDeactivating] = useState(null); // id in flight

  const load = useCallback(() => {
    setLoading(true);
    userService.list(accessToken)
      .then((res) => setUsers(res.data.data))
      .catch(() => setError('Failed to load users.'))
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
      const msg = err.response?.data?.message;
      setFormError(msg ?? 'Failed to create employee.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this user?')) return;
    setDeactivating(id);
    try {
      const res = await userService.deactivate(accessToken, id);
      setUsers((prev) => prev.map((u) => (u.id === id ? res.data.data : u)));
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to deactivate user.');
    } finally {
      setDeactivating(null);
    }
  };

  if (loading) return <p>Loading users…</p>;
  if (error)   return <p role="alert">{error}</p>;

  return (
    <div>
      <button onClick={() => { setShowForm((v) => !v); setFormError(''); }}>
        {showForm ? 'Cancel' : '+ New employee'}
      </button>

      {showForm && (
        <form onSubmit={handleCreate}>
          <h3>Create employee</h3>
          {formError && <p role="alert">{formError}</p>}

          <label>Name
            <input value={form.name} onChange={setField('name')} required />
          </label>
          <label>Email
            <input type="email" value={form.email} onChange={setField('email')} required />
          </label>
          <label>Password
            <input type="password" value={form.password} onChange={setField('password')} required />
          </label>
          <label>Phone (optional)
            <input type="tel" value={form.phone} onChange={setField('phone')} />
          </label>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.phone ?? '—'}</td>
              <td>{ROLE_LABELS[u.role] ?? u.role}</td>
              <td>{u.isActive ? 'Active' : 'Inactive'}</td>
              <td>
                {u.isActive && u.id !== self?.id ? (
                  <button
                    onClick={() => handleDeactivate(u.id)}
                    disabled={deactivating === u.id}
                  >
                    {deactivating === u.id ? 'Deactivating…' : 'Deactivate'}
                  </button>
                ) : (
                  <span>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
