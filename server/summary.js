// Groups imported stock rows into the office summary.
// Detail line = ยี่ห้อ + รุ่น + ความจุ + มือ 1/มือ 2 + สี; quantities are summed.
// A line's price is the price carried by most units; other prices are listed in `prices`.

const collator = new Intl.Collator('th', { numeric: true, sensitivity: 'base' });
const cmp = (a, b) => collator.compare(a ?? '', b ?? '');

function capacityRank(c) {
  // "12/256GB" -> 256, "1TB" -> 1024, "64 GB 128GB" -> 64
  const s = String(c).toUpperCase();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(TB|GB)(?!.*\/)/) || s.match(/(\d+(?:\.\d+)?)\s*(TB|GB)/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  return Number(m[1]) * (m[2] === 'TB' ? 1024 : 1);
}

function titleColor(c) {
  if (!c) return '';
  return c === c.toUpperCase() && /[A-Z]/.test(c) && !c.startsWith('(')
    ? c.toLowerCase().replace(/\b\w/g, (x) => x.toUpperCase())
    : c;
}

function mainPrice(weights) {
  let best = null;
  for (const [price, units] of weights) {
    if (!best || units > best[1] || (units === best[1] && price > best[0])) best = [price, units];
  }
  return best ? best[0] : null;
}

export function filterRows(rows, { condition, brand, q } = {}) {
  const needle = (q || '').trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!condition || condition === 'all' || r.condition === condition) &&
      (!brand || brand === 'all' || r.brand === brand) &&
      (!needle || `${r.brand} ${r.model} ${r.capacity} ${r.color} ${r.sku}`.toLowerCase().includes(needle)),
  );
}

export function summarize(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = [r.brand, r.model.toUpperCase(), r.capacity.toUpperCase(), r.condition, r.color.toLowerCase()].join('\u0001');
    let g = groups.get(key);
    if (!g) {
      g = {
        brand: r.brand,
        model: r.model,
        capacity: r.capacity,
        condition: r.condition,
        color: titleColor(r.color),
        qty: 0,
        retailW: new Map(),
        wholesaleW: new Map(),
        lines: [],
      };
      groups.set(key, g);
    }
    g.qty += r.qty;
    g.lines.push(r.line);
    if (r.retail) g.retailW.set(r.retail, (g.retailW.get(r.retail) || 0) + r.qty);
    if (r.wholesale) g.wholesaleW.set(r.wholesale, (g.wholesaleW.get(r.wholesale) || 0) + r.qty);
  }

  const detail = [...groups.values()]
    .map((g) => ({
      brand: g.brand,
      model: g.model,
      capacity: g.capacity,
      condition: g.condition,
      color: g.color,
      qty: g.qty,
      retail: mainPrice(g.retailW),
      wholesale: mainPrice(g.wholesaleW),
      retailPrices: [...g.retailW.keys()].sort((a, b) => a - b),
      wholesalePrices: [...g.wholesaleW.keys()].sort((a, b) => a - b),
      lines: g.lines,
    }))
    .sort(
      (a, b) =>
        cmp(a.brand, b.brand) ||
        cmp(a.model, b.model) ||
        capacityRank(a.capacity) - capacityRank(b.capacity) ||
        cmp(a.capacity, b.capacity) ||
        (a.condition === b.condition ? 0 : a.condition === 'new' ? -1 : 1) ||
        cmp(a.color, b.color),
    );

  // Per brand + model, like the office sheet (มือ 1 / มือ 2 / รวม).
  const byModel = new Map();
  for (const d of detail) {
    const key = `${d.brand}\u0001${d.model.toUpperCase()}`;
    const m = byModel.get(key) || { brand: d.brand, model: d.model, newQty: 0, usedQty: 0, qty: 0 };
    if (d.condition === 'new') m.newQty += d.qty;
    else m.usedQty += d.qty;
    m.qty += d.qty;
    byModel.set(key, m);
  }
  const models = [...byModel.values()].sort((a, b) => cmp(a.brand, b.brand) || cmp(a.model, b.model));

  const totals = { newQty: 0, usedQty: 0, qty: 0, retailValue: 0, lines: detail.length, models: models.length };
  for (const d of detail) {
    if (d.condition === 'new') totals.newQty += d.qty;
    else totals.usedQty += d.qty;
    totals.qty += d.qty;
  }
  for (const r of rows) totals.retailValue += (r.retail || 0) * r.qty;

  const brands = [...new Set(rows.map((r) => r.brand))].sort(cmp);
  return { detail, models, totals, brands };
}
