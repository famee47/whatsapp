import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { initSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const boot = async () => {
      const token = localStorage.getItem('nf_token');
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await authAPI.getMe();
        setUser(data);
        initSocket(token);
      } catch {
        localStorage.removeItem('nf_token');
        localStorage.removeItem('nf_user');
      } finally { setLoading(false); }
    };
    boot();
  }, []);

  const register = useCallback(async (email, password, username) => {
    const { data } = await authAPI.register({ email, password, username });
    localStorage.setItem('nf_token', data.token);
    setUser(data.user);
    initSocket(data.token);
    return data;
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem('nf_token', data.token);
    setUser(data.user);
    initSocket(data.token);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try { await authAPI.logout(); } catch {}
    disconnectSocket();
    localStorage.removeItem('nf_token');
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prev => ({ ...prev, ...updates }));
  }, []);

  return <AuthContext.Provider value={{ user, loading, register, login, logout, updateUser }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
};
