// Small checks shared by the routes.

/** A real calendar date in YYYY-MM-DD ("2026-13-45" and "2026-02-30" are not). */
export function isDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? ''));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/**
 * An amount as people type it: "26,180", "฿1,000.50", " 300 ", 450.
 * '' / null / undefined -> null (no value). Anything else that is not a number throws.
 */
export function amount(v, label = 'ตัวเลข') {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw badInput(`${label} ไม่ใช่ตัวเลข`);
    return v;
  }
  const s = String(v).replace(/[,\s฿]/g, '').replace(/บาท$/, '');
  if (s === '' || s === '-') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw badInput(`${label} "${v}" ไม่ใช่ตัวเลข`);
  return n;
}

export function badInput(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}
