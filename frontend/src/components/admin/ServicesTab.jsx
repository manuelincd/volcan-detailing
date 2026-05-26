import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { serviceService } from '../../services/serviceService';

const EMPTY_FORM = {
  name: '', description: '', durationMinutes: '',
  priceSedan: '', priceSuv: '', priceVan: '',
};

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
  const [removing,     setRemoving]     = useState(null);
  const [reactivating, setReactivating] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    serviceService.listAll(accessToken)
      .then((res) => setServices(res.data.data))
      .catch(() => setError('No se pudieron cargar los servicios.'))
      .finally(() => setLoading(false));
  }, [accessToken]);

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
      priceSedan:      String(svc.prices?.sedan ?? ''),
      priceSuv:        String(svc.prices?.suv   ?? ''),
      priceVan:        String(svc.prices?.van   ?? ''),
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
      prices: {
        sedan: parseFloat(form.priceSedan),
        suv:   parseFloat(form.priceSuv),
        van:   parseFloat(form.priceVan),
      },
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

  const handleReactivate = async (svc) => {
    setReactivating(svc.id);
    try {
      const payload = {
        name:            svc.name,
        description:     svc.description ?? undefined,
        durationMinutes: svc.durationMinutes,
        prices:          { sedan: svc.prices.sedan, suv: svc.prices.suv, van: svc.prices.van },
        isActive:        true,
      };
      const res = await serviceService.update(accessToken, svc.id, payload);
      setServices((prev) => prev.map((s) => (s.id === svc.id ? res.data.data : s)));
    } catch (err) {
      setError(err.response?.data?.message ?? 'No se pudo reactivar el servicio.');
    } finally {
      setReactivating(null);
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
                style={{ maxWidth: 160 }}
              />
            </div>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'var(--color-text-secondary)',
                marginBottom: '0.5rem',
              }}>
                Precios por tipo de vehículo (MXN)
              </legend>
              <div className="form-3col">
                <div className="form-group">
                  <label htmlFor="svc-price-sedan">Sedán / Hatchback</label>
                  <input
                    id="svc-price-sedan"
                    type="number"
                    min="0.01"
                    step="1"
                    value={form.priceSedan}
                    onChange={setField('priceSedan')}
                    placeholder="120"
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="svc-price-suv">SUV / Camioneta</label>
                  <input
                    id="svc-price-suv"
                    type="number"
                    min="0.01"
                    step="1"
                    value={form.priceSuv}
                    onChange={setField('priceSuv')}
                    placeholder="160"
                    required
                    disabled={submitting}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="svc-price-van">Van / Pickup</label>
                  <input
                    id="svc-price-van"
                    type="number"
                    min="0.01"
                    step="1"
                    value={form.priceVan}
                    onChange={setField('priceVan')}
                    placeholder="200"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
            </fieldset>

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
              <th>Precios</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {services.map((svc) => {
              const vals = svc.prices ? Object.values(svc.prices).map(Number) : [];
              const minP = vals.length ? Math.min(...vals) : 0;
              const maxP = vals.length ? Math.max(...vals) : 0;
              return (
                <tr key={svc.id} className={svc.isActive ? '' : 'tr-inactive'}>
                  <td className="td-primary">{svc.name}</td>
                  <td className="td-desc">
                    <span className="line-clamp-2">{svc.description ?? '—'}</span>
                  </td>
                  <td>{svc.durationMinutes} min</td>
                  <td className="td-accent">
                    ${minP} — ${maxP} MXN
                  </td>
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
                      {svc.isActive ? (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemove(svc)}
                          disabled={removing === svc.id}
                        >
                          {removing === svc.id
                            ? <><span className="spinner" /> Desactivando…</>
                            : 'Desactivar'}
                        </button>
                      ) : (
                        <button
                          className="btn btn-sm btn-reactivate"
                          onClick={() => handleReactivate(svc)}
                          disabled={reactivating === svc.id}
                        >
                          {reactivating === svc.id
                            ? <><span className="spinner" /> Reactivando…</>
                            : 'Reactivar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
