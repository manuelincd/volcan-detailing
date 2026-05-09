import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Usage:
 *   <ProtectedRoute roles={['admin', 'employee']}>
 *     <SomePage />
 *   </ProtectedRoute>
 *
 * Behaviour:
 *   - While session is restoring   → renders nothing (prevents flash-redirect)
 *   - Not authenticated            → /login  (with `from` in state so login can redirect back)
 *   - Authenticated, wrong role    → /unauthorized
 *   - Authenticated, correct role  → renders children
 */
export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
