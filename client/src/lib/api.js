async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      ...options,
      headers: options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new Error('ติดต่อเซิร์ฟเวอร์ไม่ได้ ตรวจว่ารัน npm run dev อยู่หรือไม่');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `เกิดข้อผิดพลาด (${res.status})`);
  return data;
}

const qs = (params) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) if (v && v !== 'all') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  cards: () => request('/api/cards'),
  createCard: (card) => request('/api/cards', { method: 'POST', body: JSON.stringify(card) }),
  updateCard: (id, patch) => request(`/api/cards/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteCard: (id) => request(`/api/cards/${id}`, { method: 'DELETE' }),

  imports: () => request('/api/imports'),
  upload: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/api/imports', { method: 'POST', body: fd });
  },
  deleteImport: (id) => request(`/api/imports/${id}`, { method: 'DELETE' }),
  summary: (id, filters) => request(`/api/imports/${id}/summary${qs(filters)}`),
  rows: (id) => request(`/api/imports/${id}/rows`),
  exportUrl: (id, fmt, filters) => `/api/imports/${id}/export.${fmt}${qs(filters)}`,
};
