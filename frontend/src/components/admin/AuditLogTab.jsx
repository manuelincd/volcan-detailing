import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const TYPE_META = {
  auth_failure: { label: 'Login fallido',    badgeClass: 'badge-cancelled'   },
  rate_limit:   { label: 'Rate limit',       badgeClass: 'badge-employee'    },
  status_change:{ label: 'Cambio de estado', badgeClass: 'badge-admin'       },
};

function buildDetail(type, data) {
  if (type === 'auth_failure')
    return `Intento fallido: ${data.email} desde ${data.ip}`;
  if (type === 'rate_limit')
    return `IP bloqueada: ${data.ip} intentó con ${data.email ?? '—'}`;
  if (type === 'status_change')
    return `Cita #${data.appointmentId}: ${data.fromStatus} → ${data.toStatus} por usuario ${data.changedByUserId} (${data.role})`;
  return JSON.stringify(data);
}

function formatTs(ts) {
  return new Date(ts).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function AuditLogTab() {
  const { accessToken } = useAuth();
  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const intervalRef = useRef(null);

  const load = useCallback(() => {
    api.get('/admin/audit-log', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => { setEntries(res.data.data); setError(''); })
      .catch(() => setError('No se pudo cargar el registro de actividad.'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  return (
    <div>
      <div className="tab-header">
        <h2 className="section-heading">Registro de actividad</h2>
        <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error && <div className="alert alert-error" role="alert">{error}</div>}

      {loading && !entries.length ? (
        <div className="loading-state">
          <span className="spinner" /><span>Cargando…</span>
        </div>
      ) : entries.length === 0 ? (
        <p className="empty-state">Sin actividad registrada</p>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha/Hora</th>
                <th>Tipo</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) => {
                const meta = TYPE_META[entry.type] ?? { label: entry.type, badgeClass: '' };
                return (
                  <tr key={i}>
                    <td className="text-nowrap">{formatTs(entry.ts)}</td>
                    <td><span className={`badge ${meta.badgeClass}`}>{meta.label}</span></td>
                    <td>{buildDetail(entry.type, entry.data)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="audit-log-note">
        El historial se persiste en base de datos. Se muestran los últimos 100 eventos.
      </p>
    </div>
  );
}
