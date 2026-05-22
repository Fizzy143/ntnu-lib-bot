async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok && response.status !== 202) {
    throw new Error(payload?.message || payload?.error || 'Request failed');
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
