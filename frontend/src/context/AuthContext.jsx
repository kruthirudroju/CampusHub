import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('ch_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const login = useCallback((token, userData) => {
    localStorage.setItem('ch_token', token);
    localStorage.setItem('ch_user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ch_token');
    localStorage.removeItem('ch_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
