let authToken = '';

export function setAuthToken(token) {
  authToken = token || '';
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok && response.status !== 202) {
    const error = new Error(payload?.message || payload?.error || 'Request failed');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export function fetchAvailability(params) {
  const search = new URLSearchParams(params);
  return request(`/api/availability?${search.toString()}`);
}

export function fetchMeta() {
  return request('/api/meta');
}

export function startBooking(payload) {
  return request('/api/book/start', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function submitCaptcha(payload) {
  return request('/api/book/captcha', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function getCredential(userId = '') {
  const search = userId ? `?${new URLSearchParams({ userId }).toString()}` : '';
  return request(`/api/credentials${search}`);
}

export function saveCredential(userId, username, password) {
  const payload = { username, password };
  if (userId) {
    payload.userId = userId;
  }

  return request('/api/credentials', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export function deleteCredential(userId = '') {
  const payload = userId ? { userId } : {};

  return request('/api/credentials', {
    method: 'DELETE',
    body: JSON.stringify(payload)
  });
}
