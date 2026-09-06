import { useAuthStore } from '@/store/authStore';

const BASE = import.meta.env.VITE_API_URL || '';

async function tryRefresh() {
  const resp = await fetch(`${BASE}/api/auth/token/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!resp.ok) {
    useAuthStore.getState().logout();
    return null;
  }
  const data = await resp.json();
  useAuthStore.getState().setAccessToken(data.access);
  return data.access;
}

async function authRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const access = useAuthStore.getState().accessToken;
  if (access) headers['Authorization'] = `Bearer ${access}`;

  let resp = await fetch(`${BASE}/api${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (resp.status === 401 && path !== '/auth/token' && path !== '/auth/token/refresh') {
    const newAccess = await tryRefresh();
    if (newAccess) {
      resp = await fetch(`${BASE}/api${path}`, {
        ...options,
        credentials: 'include',
        headers: { ...headers, Authorization: `Bearer ${newAccess}` },
      });
    } else {
      useAuthStore.getState().logout();
    }
  }
  return resp;
}

export const authService = {
  login: async (email, password) => {
    const resp = await fetch(`${BASE}/api/auth/token`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.detail || 'Login fallido');
    }
    const data = await resp.json();
    useAuthStore.getState().loginSuccess({ access: data.access, user: data.user });
    return data.user;
  },
  logout: async () => {
    try {
      const access = useAuthStore.getState().accessToken;
      await fetch(`${BASE}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(access ? { Authorization: `Bearer ${access}` } : {}),
        },
        body: JSON.stringify({}),
      });
    } catch (_) {
      // ignore
    }
    useAuthStore.getState().logout();
  },
  me: () => authRequest('/auth/me').then((r) => r.json()),
};
