import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { setRefresher } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading]         = useState(true);
  const navigate                      = useNavigate();

  const login = useCallback(async (email, password) => {
    const { data } = await authService.login(email, password);
    const payload = data.data;

    if (payload.mfaRequired) {
      return { mfaRequired: true, tempToken: payload.tempToken };
    }

    setUser(payload.user);
    setAccessToken(payload.accessToken);
    return payload.user;
  }, []);

  // Completes a login that required MFA; called after the user submits their TOTP code
  const validateMfa = useCallback(async (tempToken, token) => {
    const { data } = await authService.mfaValidate(tempToken, token);
    setUser(data.data.user);
    setAccessToken(data.data.accessToken);
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await authService.logout(); } catch { /* cookie cleared server-side regardless */ }
    setUser(null);
    setAccessToken(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  const refreshToken = useCallback(async () => {
    const { data } = await authService.refresh();
    setUser(data.data.user);
    setAccessToken(data.data.accessToken);
    return data.data.accessToken;
  }, []);

  // Patch local user state (e.g. after MFA enable/disable) without a full refresh
  const updateUser = useCallback((updates) => {
    setUser((prev) => prev ? { ...prev, ...updates } : prev);
  }, []);

  useEffect(() => {
    setRefresher(refreshToken);
  }, [refreshToken]);

  useEffect(() => {
    refreshToken()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, login, validateMfa, logout, refreshToken, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
