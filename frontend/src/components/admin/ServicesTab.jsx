import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { serviceService } from '../../services/serviceService';

const EMPTY_FORM = { name: '', description: '', durationMinutes: '', price: '' };

export default function ServicesTab() {
  const { accessToken } = useAuth();
  const [services,    setServices]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [editing,     setEditing]     = useState(null);  // service object being edited, or null for create
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [formError,   setFormError]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [removing,    setRemoving]    = useState(null);  // id in flight

  const load = useCallback(() => {
    setLoading(true);
    serviceService.list()
      .then((res) => setServices(res.data.data))
      .catch(() => setError('Failed to load services.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (svc) => {
    setEditing(svc);
    setForm({
      name:            svc.name,
      description:     svc.description ?? '',
      durationMinutes: String(svc.durationMinutes),
      price:           String(svc.price),
    });
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditing(null); };

  const setField = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    const payload = {
      name:            form.name.trim(),
      description:     form.description.trim() || undefined,
      durationMinutes: parseInt(form.durationMinutes, 10),
      price:           parseFloat(form.price),
      ...(editing && { isActive: editing.isActive }),
    };

    try {
      if (editing) {
        await serviceService.update(accessToken, editing.id, payload);
      } else {
        await serviceService.create(accessToken, payload);
      }
      closeForm();
      load();
    } catch (err) {
      const msg = err.response?.data?.message;
      setFormError(msg ?? 'Failed to save service.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (svc) => {
    if (!window.confirm(`Deactivate "${svc.name}"?`)) return;
    setRemoving(svc.id);
    try {
      const res = await serviceService.remove(accessToken, svc.id);
      setServices((prev) => prev.map((s) => (s.id === svc.id ? res.data.data : s)));
    } catch (err) {
      setError(err.response?.data?.message ?? 'Failed to deactivate service.');
    } finally {
      setRemoving(null);
    }
  };

  if (loading) return <p>Loading services…</p>;
  if (error)   return <p role="alert">{error}</p>;

  return (
    <div>
      {!showForm && (
        <button onClick={openCreate}>+ New service</button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit}>
          <h3>{editing ? `Edit — ${editing.name}` : 'New service'}</h3>
          {formError && <p role="alert">{formError}</p>}

          <label>Name
            <input value={form.name} onChange={setField('name')} required />
          </label>
          <label>Description
            <textarea value={form.description} onChange={setField('description')} rows={3} />
          </label>
          <label>Duration (minutes)
            <input
              type="number" min="1" max="1440"
              value={form.durationMinutes}
              onChange={setField('durationMinutes')}
              required
            />
          </label>
          <label>Price ($)
            <input
              type="number" min="0.01" step="0.01"
              value={form.price}
              onChange={setField('price')}
              required
            />
          </label>

          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create'}
          </button>
          <button type="button" onClick={closeForm} disabled={submitting}>
            Cancel
          </button>
        </form>
      )}

      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Duration</th>
            <th>Price</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {services.map((svc) => (
            <tr key={svc.id}>
              <td>{svc.name}</td>
              <td>{svc.description ?? '—'}</td>
              <td>{svc.durationMinutes} min</td>
              <td>${Number(svc.price).toFixed(2)}</td>
              <td>{svc.isActive ? 'Active' : 'Inactive'}</td>
              <td>
                <button onClick={() => openEdit(svc)}>Edit</button>
                {svc.isActive && (
                  <button
                    onClick={() => handleRemove(svc)}
                    disabled={removing === svc.id}
                  >
                    {removing === svc.id ? 'Deactivating…' : 'Deactivate'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
