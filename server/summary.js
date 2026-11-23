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

/** สายชาร์จ/อะแดปเตอร์ and similar go to their own table after the devices. */
export function isAccessory(category) {
  return /สายชาร์จ|อะแดปเตอร์|adapter|cable/i.test(category || '');
}

export function summarize(rows) {
  const groups = new Map();
  for (const r of rows) {
    // The product code (รหัสสินค้า) is the identity; names are not trusted to match.
    // One code can hold several colours, so colour stays part of the key.
    const key = r.sku
      ? ['sku', r.sku.toUpperCase(), r.color.toLowerCase()].join('\u0001')
      : ['name', r.brand, r.model.toUpperCase(), r.capacity.toUpperCase(), r.condition, r.color.toLowerCase()].join('\u0001');
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        sku: r.sku,
        category: r.category,
        accessory: isAccessory(r.category),
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

  const items = [...groups.values()]
    .map((g) => ({
      key: g.key,
      sku: g.sku,
      category: g.category,
      accessory: g.accessory,
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
        cmp(a.color, b.color) ||
        cmp(a.sku, b.sku),
    );
  const detail = items.filter((d) => !d.accessory);
  const accessories = items.filter((d) => d.accessory);

  // Per brand + model, like the office sheet (มือ 1 / มือ 2 / รวม).
  const byModel = new Map();
  for (const d of items) {
    const key = `${d.brand}\u0001${d.model.toUpperCase()}`;
    const m = byModel.get(key) || { brand: d.brand, model: d.model, newQty: 0, usedQty: 0, qty: 0 };
    if (d.condition === 'new') m.newQty += d.qty;
    else m.usedQty += d.qty;
    m.qty += d.qty;
    byModel.set(key, m);
  }
  const models = [...byModel.values()].sort((a, b) => cmp(a.brand, b.brand) || cmp(a.model, b.model));

  const totals = {
    newQty: 0, usedQty: 0, qty: 0, retailValue: 0,
    deviceQty: 0, accessoryQty: 0,
    lines: items.length, deviceLines: detail.length, accessoryLines: accessories.length,
    models: models.length,
  };
  for (const d of items) {
    if (d.condition === 'new') totals.newQty += d.qty;
    else totals.usedQty += d.qty;
    totals.qty += d.qty;
    if (d.accessory) totals.accessoryQty += d.qty;
    else totals.deviceQty += d.qty;
  }
  for (const r of rows) totals.retailValue += (r.retail || 0) * r.qty;

  const brands = [...new Set(rows.map((r) => r.brand))].sort(cmp);
  return { detail, accessories, models, totals, brands };
}
