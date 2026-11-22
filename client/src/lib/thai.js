const MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const DAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

export function todayISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromISO(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** "21 พ.ย. 69" */
export function thaiShort(iso) {
  const d = typeof iso === 'string' ? fromISO(iso) : iso;
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${String((d.getFullYear() + 543) % 100).padStart(2, '0')}`;
}

/** "ศุกร์ 21 พ.ย." with วันนี้ / เมื่อวาน */
export function thaiDayHeading(iso) {
  const d = fromISO(iso);
  const today = fromISO(todayISO());
  const diff = Math.round((today - d) / 86400000);
  const base = `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
  if (diff === 0) return `วันนี้ · ${base}`;
  if (diff === 1) return `เมื่อวาน · ${base}`;
  return `${DAY[d.getDay()]} · ${base}`;
}

/** SQLite "2026-11-21 14:03:10" -> "21 พ.ย. 69 · 14:03" */
export function thaiStamp(sqlDateTime) {
  if (!sqlDateTime) return '';
  const [date, time = ''] = sqlDateTime.split(' ');
  return `${thaiShort(date)} · ${time.slice(0, 5)}`;
}

export function duration(minutes) {
  const m = Number(minutes) || 0;
  if (!m) return '';
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} นาที`;
  return r ? `${h} ชม. ${r} นาที` : `${h} ชม.`;
}

const nf = new Intl.NumberFormat('th-TH');
export const num = (n) => (n === null || n === undefined ? '—' : nf.format(n));

export function bahtShort(n) {
  if (!n) return '฿0';
  if (n >= 1e6) return `฿${(n / 1e6).toLocaleString('th-TH', { maximumFractionDigits: 2 })} ล้าน`;
  return `฿${nf.format(Math.round(n))}`;
}
