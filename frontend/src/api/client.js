// Falls back to a relative '/api' path when VITE_API_BASE isn't set.
// That's the correct default for local dev (Vite proxies /api to the
// backend — see vite.config.js) and for production if frontend+backend
// share an origin behind Nginx. Only set VITE_API_BASE if the frontend
// is deployed on a different origin than the backend.
const BASE = `${import.meta.env.VITE_API_BASE ?? ''}/api`;

// These endpoints return 401 for reasons OTHER than an expired/invalid
// session (wrong password, wrong/expired OTP, blocked account) — a
// redirect there would kick the user out of the login screen they're
// actively using, or mask a "you're blocked" message they need to see.
const AUTH_FLOW_ENDPOINTS = [
  '/admin/login',
  '/admin/login/verify-otp',
  '/admin/unlock',
  '/student/request-otp',
  '/student/verify-otp',
  '/student/access-requests',
];

// If a 401 comes back on a real session-bound request (not the login
// flow itself), the token is missing/expired — bounce to the matching
// login screen instead of leaving a raw error on the page.
function redirectToLoginIfSessionExpired(path, status) {
  if (status !== 401 || AUTH_FLOW_ENDPOINTS.includes(path)) return;

  if (path.startsWith('/admin') && !window.location.pathname.startsWith('/admin/login')) {
    window.location.href = '/admin/login';
  } else if (path.startsWith('/student') && !window.location.pathname.startsWith('/student/login')) {
    window.location.href = '/student/login';
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
    ...options,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : await res.blob();

  if (!res.ok) {
    redirectToLoginIfSessionExpired(path, res.status);

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
      redirectToLoginIfSessionExpired(path, res.status);
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