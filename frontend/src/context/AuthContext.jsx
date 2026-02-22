import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [owner, setOwner] = useState(null);
  const [tokens, setTokens] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ownerExists, setOwnerExists] = useState(null);

  // Initialize API instance with auth
  const api = axios.create({
    baseURL: '/api',
  });

  // Add token to requests
  api.interceptors.request.use((config) => {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  });

  // Helper: SHA-256 hash -> hex (used for local password overrides)
  const hashPasswordHex = async (password) => {
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Local login: establishes an offline session for the given email
  const localLogin = (email) => {
    const normalized = email.trim().toLowerCase();
    localStorage.setItem('access_token', 'offline_token');
    localStorage.setItem('refresh_token', '');
    localStorage.setItem('offline_session', JSON.stringify({ email: normalized, created_at: Date.now() }));
    setOwner({ email: normalized, offline: true });
    setTokens({ access: 'offline_token', refresh: '' });
    return { offline: true, owner: { email: normalized } };
  };


  // ✅ Auto-login on app reopen if token valid
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedAccessToken = localStorage.getItem('access_token');
        const storedRefreshToken = localStorage.getItem('refresh_token');

        // If offline, try to restore an offline session if present
        if (!navigator.onLine) {
          const offlineSession = JSON.parse(localStorage.getItem('offline_session') || 'null');
          if (offlineSession && offlineSession.email) {
            setOwner({ email: offlineSession.email, offline: true });
            setTokens({ access: 'offline_token', refresh: '' });
          } else {
            // No offline session available - remain unauthenticated
            setOwner(null);
            setTokens(null);
          }

          // We cannot reliably check owner_exists while offline, so stop loading
          setLoading(false);
          return;
        }

        // Online: check owner existence and try to validate stored tokens
        const checkResponse = await api.get('/auth/check_owner/');
        setOwnerExists(checkResponse.data.owner_exists);

        // If tokens exist, verify they're still valid
        if (storedAccessToken) {
          const meResponse = await api.get('/auth/me/', {
            headers: { Authorization: `Bearer ${storedAccessToken}` },
          });
          setOwner(meResponse.data);
          setTokens({
            access: storedAccessToken,
            refresh: storedRefreshToken,
          });
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        // Clear invalid tokens
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setOwner(null);
        setTokens(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Register (one-time)
  const register = async (email, password, passwordConfirm, firstName = '', lastName = '') => {
    try {
      setError(null);
      const response = await api.post('/auth/register/', {
        email,
        password,
        password_confirm: passwordConfirm,
        first_name: firstName,
        last_name: lastName,
      });

      // Store tokens
      localStorage.setItem('access_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);

      setOwner(response.data.owner);
      setTokens(response.data.tokens);
      setOwnerExists(true);

      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.email?.[0] || 
                      err.response?.data?.detail || 
                      'Registration failed';
      setError(errorMsg);
      throw err;
    }
  };

  // Login
  const login = async (email, password) => {
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      // If offline, attempt local override first
      if (!navigator.onLine) {
        const pwHash = await hashPasswordHex(password);
        const stored = JSON.parse(localStorage.getItem('offline_passwords') || '{}');
        const entry = stored[normalizedEmail];
        if (entry && entry.hash === pwHash) {
          // establish an offline session
          return localLogin(normalizedEmail);
        }

        const errorMsg = 'Offline login failed: no local credentials found.';
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      // Online: prefer server login, but fallback to local override if server rejects credentials
      try {
        const response = await api.post('/auth/login/', { email: normalizedEmail, password });
        // Store tokens
        localStorage.setItem('access_token', response.data.tokens.access);
        localStorage.setItem('refresh_token', response.data.tokens.refresh);

        setOwner(response.data.owner);
        setTokens(response.data.tokens);

        return response.data;
      } catch (err) {
        // Attempt fallback to local override
        const pwHash = await hashPasswordHex(password);
        const stored = JSON.parse(localStorage.getItem('offline_passwords') || '{}');
        const entry = stored[normalizedEmail];
        if (entry && entry.hash === pwHash) {
          return localLogin(normalizedEmail);
        }

        const errorMsg = err.response?.data?.detail || err.response?.data?.non_field_errors?.[0] || 'Login failed';
        setError(errorMsg);
        throw err;
      }
    } catch (err) {
      throw err;
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    // clear offline session as well
    localStorage.removeItem('offline_session');
    setOwner(null);
    setTokens(null);
    setError(null);
  };

  // Request password reset
  const passwordResetRequest = async (email) => {
    try {
      setError(null);

      const response = await api.post('/auth/password_reset_request/', {
        email: email,   // ✅ MUST be "email"
      });

      return response.data;
    } catch (err) {
      const errorMsg =
        err.response?.data?.email?.[0] ||
        err.response?.data?.detail ||
        'Failed to request password reset';
      setError(errorMsg);
      throw err;
    }
  };


  // Confirm password reset
  const passwordResetConfirm = async (token, password) => {
    try {
      setError(null);
      const response = await api.post('/auth/password_reset_confirm/', {
        token,
        new_password: password,
      });

      // Store tokens (auto-login after reset)
      localStorage.setItem('access_token', response.data.tokens.access);
      localStorage.setItem('refresh_token', response.data.tokens.refresh);

      setOwner(response.data.owner);
      setTokens(response.data.tokens);

      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.token?.[0] ||
                      err.response?.data?.new_password?.[0] ||
                      'Failed to reset password';
      setError(errorMsg);
      throw err;
    }
  };

  const value = {
    owner,
    tokens,
    loading,
    error,
    ownerExists,
    auth: owner,
    setError,
    register,
    login,
    logout,
    passwordResetRequest,
    passwordResetConfirm,
    isAuthenticated: !!owner && !!tokens,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
