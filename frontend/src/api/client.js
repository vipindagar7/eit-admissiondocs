// Falls back to a relative '/api' path when VITE_API_BASE isn't set.
// That's the correct default for local dev (Vite proxies /api to the
// backend — see vite.config.js) and for production if frontend+backend
// share an origin behind Nginx. Only set VITE_API_BASE if the frontend
// is deployed on a different origin than the backend.
const BASE = `${import.meta.env.VITE_API_BASE ?? ''}/api`;

// These admin endpoints return 401 for reasons OTHER than an
// expired/invalid session (wrong password, wrong OTP) — a redirect there
// would kick the user out of the login screen they're actively using.
const ADMIN_AUTH_FLOW_ENDPOINTS = ['/admin/login', '/admin/login/verify-otp', '/admin/unlock'];

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.blob();

  if (!res.ok) {
    if (
      res.status === 401 &&
      path.startsWith('/admin') &&
      !ADMIN_AUTH_FLOW_ENDPOINTS.includes(path) &&
      !window.location.pathname.startsWith('/admin/login')
    ) {
      window.location.href = '/admin/login';
    }

    const message = isJson ? data?.error || 'Request failed' : 'Request failed';
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) =>
    request(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),
  // For file downloads, where we need the raw Response to read headers/blob.
  async download(path) {
    const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
    if (!res.ok) {
      if (res.status === 401 && path.startsWith('/admin') && !window.location.pathname.startsWith('/admin/login')) {
        window.location.href = '/admin/login';
      }
      throw new Error('Download failed');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="(.+)"/);
    return { blob, filename: match ? match[1] : 'document' };
  },
  // For inline preview — img/iframe src can point straight at this URL;
  // the browser sends cookies automatically for same-origin requests.
  previewUrl(path) {
    return `${BASE}${path}`;
  },
};