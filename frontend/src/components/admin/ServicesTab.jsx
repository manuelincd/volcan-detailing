import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { serviceService } from '../../services/serviceService';

const EMPTY_FORM = { name: '', description: '', durationMinutes: '', price: '' };

export default function ServicesTab() {
  const { accessToken } = useAuth();
  const [services,   setServices]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [editing,    setEditing]    = useState(null);
  const [showForm,   setShowForm]   = useState(false);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [formError,  setFormError]  = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removing,   setRemoving]   = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    serviceService.list()
      .then((res) => setServices(res.data.data))
      .catch(() => setError('No se pudieron cargar los servicios.'))
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
      setFormError(err.response?.data?.message ?? 'No se pudo guardar el servicio.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (svc) => {
    if (!window.confirm(`¿Desactivar "${svc.name}"?`)) return;
    setRemoving(svc.id);
    try {
      const res = await serviceService.remove(accessToken, svc.id);
      setServices((prev) => prev.map((s) => (s.id === svc.id ? res.data.data : s)));
    } catch (err) {
      setError(err.response?.data?.message ?? 'No se pudo desactivar el servicio.');
    } finally {
      setRemoving(null);
    }
  };

  if (loading) return (
    <div className="loading-state">
      <span className="spinner" /><span>Cargando servicios…</span>
    </div>
  );
  if (error) return <div className="alert alert-error" role="alert">{error}</div>;

  return (
    <div>
      {!showForm && (
        <div className="tab-toolbar">
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            + Nuevo servicio
          </button>
        </div>
      )}

      {showForm && (
        <div className="panel">
          <h3 className="panel-title">
            {editing ? `Editar — ${editing.name}` : 'Nuevo servicio'}
          </h3>
          {formError && <div className="alert alert-error" role="alert">{formError}</div>}

          <form onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="svc-name">Nombre</label>
              <input
                id="svc-name"
                value={form.name}
                onChange={setField('name')}
                placeholder="ej. Lavado interior completo"
                required
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="svc-desc">
                Descripción <span className="text-muted label-opt">(opcional)</span>
              </label>
              <textarea
                id="svc-desc"
                value={form.description}
                onChange={setField('description')}
                rows={3}
                placeholder="Qué incluye este servicio…"
                disabled={submitting}
              />
            </div>

            <div className="form-2col">
              <div className="form-group">
                <label htmlFor="svc-duration">Duración (minutos)</label>
                <input
                  id="svc-duration"
                  type="number"
                  min="1"
                  max="1440"
                  value={form.durationMinutes}
                  onChange={setField('durationMinutes')}
                  placeholder="60"
                  required
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="svc-price">Precio (MXN)</label>
                <input
                  id="svc-price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.price}
                  onChange={setField('price')}
                  placeholder="0.00"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="panel-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closeForm}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                {submitting
                  ? <><span className="spinner" /> Guardando…</>
                  : editing ? 'Guardar cambios' : 'Crear servicio'}
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
              <th>Descripción</th>
              <th>Duración</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {services.map((svc) => (
              <tr key={svc.id}>
                <td className="td-primary">{svc.name}</td>
                <td className="td-desc">
                  <span className="line-clamp-2">{svc.description ?? '—'}</span>
                </td>
                <td>{svc.durationMinutes} min</td>
                <td className="td-accent">${Number(svc.price).toFixed(2)} MXN</td>
                <td>
                  <span className={svc.isActive ? 'badge badge-active' : 'badge badge-inactive'}>
                    {svc.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="table-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => openEdit(svc)}
                    >
                      Editar
                    </button>
                    {svc.isActive && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleRemove(svc)}
                        disabled={removing === svc.id}
                      >
                        {removing === svc.id
                          ? <><span className="spinner" /> Desactivando…</>
                          : 'Desactivar'}
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
