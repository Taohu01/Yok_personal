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

const norm = (s) => String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Every colour each product code comes in, longest first ("glacier blue" before "blue"). */
export function colorsBySku(rows) {
  const m = new Map();
  for (const r of rows) {
    const c = norm(titleColor(r.color));
    if (!c) continue;
    const k = r.sku.toUpperCase();
    (m.get(k) || m.set(k, new Set()).get(k)).add(c);
  }
  return new Map([...m].map(([k, set]) => [k, [...set].sort((a, b) => b.length - a.length)]));
}

/** The colour an IMEI-list model line ends with ("… 128GB Glacier Blue"), among that code's colours. */
function unitColor(unit, colors) {
  const n = norm(unit.name);
  return colors.find((c) => n === c || n.endsWith(` ${c}`)) ?? null;
}

/**
 * `imeis`: the import's IMEI rows, so a search for an IMEI finds its product.
 * Only the colour line that holds the matching unit is kept, not every colour of that code.
 */
export function filterRows(rows, { condition, brand, q } = {}, imeis = []) {
  const needle = (q || '').trim().toLowerCase();
  const hits = new Map();
  if (needle) {
    for (const u of imeis) {
      if (!u.imei.toLowerCase().includes(needle)) continue;
      const k = u.sku.toUpperCase();
      (hits.get(k) || hits.set(k, []).get(k)).push(u);
    }
  }
  const colors = hits.size ? colorsBySku(rows) : new Map();
  const imeiHit = (r) => {
    const units = hits.get(r.sku.toUpperCase());
    if (!units) return false;
    const list = colors.get(r.sku.toUpperCase()) || [];
    if (list.length <= 1) return true;
    return units.some((u) => {
      const c = unitColor(u, list);
      return c === null || c === norm(titleColor(r.color));
    });
  };
  return rows.filter(
    (r) =>
      (!condition || condition === 'all' || r.condition === condition) &&
      (!brand || brand === 'all' || r.brand === brand) &&
      (!needle || `${r.brand} ${r.model} ${r.capacity} ${r.color} ${r.sku}`.toLowerCase().includes(needle) || imeiHit(r)),
  );
}

/**
 * Gives each summary line its units from the IMEI list, matched by product code.
 * One code can hold several colours; then the colour in the IMEI list's model line decides.
 * Also reports codes whose unit count differs between the two files.
 */
/**
 * `colors`: colours per code from ALL stock rows (colorsBySku). Pass it when `summary` is
 * filtered, so a hidden colour's units do not slide onto the colour that is still shown.
 */
export function attachImeis(summary, imeis, colors) {
  const bySku = new Map();
  for (const u of imeis) {
    const k = u.sku.toUpperCase();
    (bySku.get(k) || bySku.set(k, []).get(k)).push(u);
  }
  const items = [...summary.detail, ...summary.accessories];
  if (!colors) {
    colors = new Map();
    for (const d of items) {
      const k = d.sku.toUpperCase();
      const c = norm(d.color);
      if (!c) continue;
      const list = colors.get(k) || [];
      if (!list.includes(c)) list.push(c);
      colors.set(k, list.sort((a, b) => b.length - a.length));
    }
  }
  // units whose model line names none of the code's colours go to the code's first line
  const firstLine = new Map();
  for (const d of items) if (!firstLine.has(d.sku.toUpperCase())) firstLine.set(d.sku.toUpperCase(), d);
  for (const d of items) {
    const k = d.sku.toUpperCase();
    const units = bySku.get(k) || [];
    const list = colors.get(k) || [];
    const mine = list.length <= 1
      ? units
      : units.filter((u) => {
          const c = unitColor(u, list);
          return c === null ? firstLine.get(k) === d : c === norm(d.color);
        });
    d.imeis = mine.map((u) => ({
      imei: u.imei,
      name: u.name,
      retail: u.retail,
      wholesale: u.wholesale,
      note: u.note,
    }));
  }
  const check = { units: imeis.length, matched: 0, diff: [], missing: [], extra: [] };
  const stockSkus = new Set(items.map((d) => d.sku.toUpperCase()));
  for (const d of items) {
    check.matched += d.imeis.length;
    if (!d.imeis.length) check.missing.push({ sku: d.sku, model: d.model, color: d.color, qty: d.qty });
    else if (d.imeis.length !== d.qty) check.diff.push({ sku: d.sku, model: d.model, color: d.color, qty: d.qty, imeis: d.imeis.length });
  }
  for (const [sku, units] of bySku) if (!stockSkus.has(sku)) check.extra.push({ sku: units[0].sku, name: units[0].name, imeis: units.length });
  return check;
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
