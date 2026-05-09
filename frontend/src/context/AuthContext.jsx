import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authService } from '../services/authService';
import { setRefresher } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  // true while the initial session-restore attempt is in flight;
  // ProtectedRoute renders nothing until this resolves to prevent
  // a flash-redirect to /login on every page refresh
  const [loading, setLoading]         = useState(true);

  const login = useCallback(async (email, password) => {
    const { data } = await authService.login(email, password);
    setUser(data.data.user);
    setAccessToken(data.data.accessToken);
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await authService.logout(); } catch { /* cookie cleared server-side regardless */ }
    setUser(null);
    setAccessToken(null);
  }, []);

  const refreshToken = useCallback(async () => {
    const { data } = await authService.refresh();
    setUser(data.data.user);
    setAccessToken(data.data.accessToken);
    return data.data.accessToken;
  }, []);

  // Register refreshToken with the Axios interceptor so it can silently
  // retry requests that fail with TOKEN_EXPIRED
  useEffect(() => {
    setRefresher(refreshToken);
  }, [refreshToken]);

  // Attempt to restore the session from the HttpOnly refresh-token cookie.
  // Runs once on mount; on failure the user stays null (not logged in).
  useEffect(() => {
    refreshToken()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
