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
  /** Stock report(s) and/or an IMEI list; an IMEI list alone attaches to `importId`. */
  upload: (files, importId) => {
    const fd = new FormData();
    for (const f of [].concat(files)) fd.append('files', f);
    if (importId) fd.append('importId', String(importId));
    return request('/api/imports', { method: 'POST', body: fd });
  },
  deleteImport: (id) => request(`/api/imports/${id}`, { method: 'DELETE' }),
  summary: (id, filters) => request(`/api/imports/${id}/summary${qs(filters)}`),
  rows: (id) => request(`/api/imports/${id}/rows`),
  exportUrl: (id, fmt, filters) => `/api/imports/${id}/export.${fmt}${qs(filters)}`,

  // สรุปยอดรายวัน
  sales: () => request('/api/sales'),
  salesToday: () => request('/api/sales/today'),
  uploadSales: (files) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    return request('/api/sales', { method: 'POST', body: fd });
  },
  createSale: (body) => request('/api/sales/manual', { method: 'POST', body: JSON.stringify(body) }),
  updateSale: (id, patch) => request(`/api/sales/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteSale: (id) => request(`/api/sales/${id}`, { method: 'DELETE' }),
  addSlips: (id, files) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    return request(`/api/sales/${id}/slips`, { method: 'POST', body: fd });
  },
  updateSlip: (id, patch) => request(`/api/slips/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteSlip: (id) => request(`/api/slips/${id}`, { method: 'DELETE' }),
  dayExportUrl: (date, fmt) => `/api/sales/day/${date}/export.${fmt}`,

  // ติดตามสินค้า
  tracking: () => request('/api/tracking'),
  uploadTrackInvoices: (files) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    return request('/api/tracking/invoices', { method: 'POST', body: fd });
  },
  deleteTrackInvoice: (id) => request(`/api/tracking/invoices/${id}`, { method: 'DELETE' }),
  unshipInvoice: (id) => request(`/api/tracking/invoices/${id}/unship`, { method: 'POST' }),
  ship: (body) => request('/api/tracking/ship', { method: 'POST', body: JSON.stringify(body) }),
  addTrackParcels: (id, trackings) => request(`/api/tracking/shipments/${id}/parcels`, { method: 'POST', body: JSON.stringify({ trackings }) }),
  deleteTrackParcel: (id) => request(`/api/tracking/parcels/${id}`, { method: 'DELETE' }),
  unship: (id) => request(`/api/tracking/shipments/${id}/unship`, { method: 'POST' }),
  setParcelState: (id, state) => request(`/api/tracking/parcels/${id}`, { method: 'PATCH', body: JSON.stringify({ state }) }),
  setShipmentState: (id, state) => request(`/api/tracking/shipments/${id}/state`, { method: 'POST', body: JSON.stringify({ state }) }),
};
