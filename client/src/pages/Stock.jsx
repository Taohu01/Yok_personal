import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  CircleCheck,
  CircleDashed,
  FileSpreadsheet,
  FileText,
  FileUp,
  Printer,
  Search,
  Sheet,
  Trash2,
  TriangleAlert,
  Upload,
  LoaderCircle,
  FilterX,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { bahtShort, num, thaiShort, thaiStamp, todayISO } from '../lib/thai.js';
import { PageHeader, SearchBox, Segmented, Strip } from '../components/ui.jsx';

const ACCEPT = '.xlsx,.xls,.csv,.pdf';
const COND = { new: 'มือ 1', used: 'มือ 2' };
const FILE_ICON = { excel: FileSpreadsheet, csv: Sheet, pdf: FileText };

// ------------------------------------------------------------------ upload
function useUpload(onDone) {
  const { toast, reloadImports } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const upload = useCallback(
    async (file) => {
      if (!file) return;
      if (!/\.(xlsx|xls|csv|pdf)$/i.test(file.name)) {
        setError(`"${file.name}" ไม่ใช่ไฟล์ที่รองรับ ใช้ได้เฉพาะ .xlsx .xls .csv และ .pdf`);
        return;
      }
      setBusy(true);
      setError('');
      try {
        const imp = await api.upload(file);
        await reloadImports();
        onDone(imp);
        const skipped = imp.skipped.length ? ` (ข้าม ${imp.skipped.length} บรรทัด)` : '';
        toast(`นำเข้า ${file.name} แล้ว · ${num(imp.qty)} เครื่อง${skipped}`, imp.skipped.length ? 'info' : 'ok');
      } catch (e) {
        setError(e.message);
        toast(e.message, 'error');
      } finally {
        setBusy(false);
      }
    },
    [onDone, reloadImports, toast],
  );
  return { upload, busy, error, setError };
}

function DropZone({ onFile, busy, error }) {
  const [over, setOver] = useState(false);
  const input = useRef();
  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          onFile(e.dataTransfer.files[0]);
        }}
        className={[
          'flex flex-col items-center gap-4 rounded-[10px] border-2 border-dashed px-6 py-12 text-center transition-colors',
          over ? 'border-cover-deep bg-gold-soft' : 'border-seam bg-leaf',
        ].join(' ')}
      >
        <span className="grid size-14 place-items-center rounded-full bg-cover text-gold">
          {busy ? <LoaderCircle size={26} className="animate-spin" /> : <FileUp size={26} />}
        </span>
        <div>
          <p className="font-stamp text-xl font-bold text-cover-deep">{busy ? 'กำลังอ่านไฟล์…' : 'ลากไฟล์รายงานสต๊อกมาวางที่นี่'}</p>
          <p className="mt-1 text-mute">Excel (.xlsx .xls), CSV หรือ PDF ที่ส่งออกจากระบบ</p>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => input.current.click()}>
          <Upload size={18} />
          เลือกไฟล์
        </button>
        <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => onFile(e.target.files[0])} />
      </div>
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-danger">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}

function FormatGuide() {
  return (
    <section className="leaf p-5 sm:p-6">
      <h2 className="font-stamp text-[17px] font-bold text-cover-deep">ไฟล์ที่อ่านได้</h2>
      <p className="mt-2 max-w-prose text-mute">
        รายงานสต็อกสินค้า (รวมตามรหัสสินค้า) ที่มีหัวตาราง
        <span className="text-ink"> ยี่ห้อ · รุ่น · ความจุ · ประเภทสินค้า · ประเภทสต๊อก · รหัสสินค้า · สี · Supplier · จำนวน · ราคาทุน · ราคาขาย · ราคาส่ง </span>
        แถวที่เว้นยี่ห้อและรุ่นไว้จะนับเป็นรุ่นเดียวกับแถวบน
      </p>
      <p className="mt-3 max-w-prose text-mute">
        ส่งออกเป็นแบบ <span className="text-ink">สต๊อกสินค้าออฟฟิศ</span>: ยี่ห้อ รุ่น ความจุ มือ 1/มือ 2 สี จำนวน ราคาขายปลีก ราคาขายส่ง พร้อมยอดรวม
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ tables
const COLS = [
  { key: 'brand', label: 'ยี่ห้อ' },
  { key: 'model', label: 'รุ่น' },
  { key: 'capacity', label: 'ความจุ' },
  { key: 'condition', label: 'ประเภท' },
  { key: 'color', label: 'สี' },
  { key: 'qty', label: 'จำนวน', num: true },
  { key: 'retail', label: 'ราคาปลีก', num: true },
  { key: 'wholesale', label: 'ราคาส่ง', num: true },
];
const collator = new Intl.Collator('th', { numeric: true });

function SortHead({ col, sort, setSort }) {
  const active = sort.key === col.key;
  const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={['px-0 py-0 font-semibold', col.num ? 'text-right' : 'text-left'].join(' ')}>
      <button
        type="button"
        onClick={() =>
          setSort(active && sort.dir === 'desc' ? { key: 'default' } : { key: col.key, dir: active ? 'desc' : col.num ? 'desc' : 'asc' })
        }
        className={['inline-flex w-full items-center gap-1 px-3 py-2.5 hover:bg-cover-2', col.num ? 'justify-end' : ''].join(' ')}
      >
        {col.label}
        <Icon size={13} className={active ? "text-gold" : "text-cover-mute/80"} />
      </button>
    </th>
  );
}

function PriceCell({ main, all }) {
  if (main === null) return <span className="text-faint">—</span>;
  return (
    <span className="inline-flex items-center justify-end gap-1.5">
      {all.length > 1 && (
        <span title={`มีหลายราคา: ${all.map(num).join(' / ')}`} className="rounded bg-gold-soft px-1.5 text-[12px] font-semibold text-gold-deep">
          +{all.length - 1}
        </span>
      )}
      {num(main)}
    </span>
  );
}

function SourceRows({ lines, rowsByLine }) {
  if (!rowsByLine) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-mute">
        <LoaderCircle size={16} className="animate-spin" /> กำลังโหลดบรรทัดต้นฉบับ…
      </div>
    );
  }
  const rows = lines.map((l) => rowsByLine.get(l)).filter(Boolean);
  return (
    <table className="w-full text-[14px]">
      <thead>
        <tr className="text-left text-mute">
          <th className="px-3 py-1.5 font-semibold">บรรทัด</th>
          <th className="px-3 py-1.5 font-semibold">รหัสสินค้า</th>
          <th className="px-3 py-1.5 font-semibold">Supplier</th>
          <th className="px-3 py-1.5 text-right font-semibold">จำนวน</th>
          <th className="px-3 py-1.5 text-right font-semibold">ทุน</th>
          <th className="px-3 py-1.5 text-right font-semibold">ขาย</th>
          <th className="px-3 py-1.5 text-right font-semibold">ส่ง</th>
        </tr>
      </thead>
      <tbody className="num">
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-seam-soft">
            <td className="px-3 py-1.5 text-faint">{r.line}</td>
            <td className="px-3 py-1.5">{r.sku || '—'}</td>
            <td className="px-3 py-1.5">{r.supplier || '—'}</td>
            <td className="px-3 py-1.5 text-right">{r.qty}</td>
            <td className="px-3 py-1.5 text-right">{num(r.cost)}</td>
            <td className="px-3 py-1.5 text-right">{num(r.retail)}</td>
            <td className="px-3 py-1.5 text-right">{num(r.wholesale)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DetailTable({ detail, fresh, importId }) {
  const [sort, setSort] = useState({ key: 'default' });
  const [open, setOpen] = useState(() => new Set());
  const [rowsByLine, setRowsByLine] = useState(null);

  useEffect(() => {
    setOpen(new Set());
    setRowsByLine(null);
  }, [importId]);

  const toggle = async (key) => {
    const next = new Set(open);
    next.has(key) ? next.delete(key) : next.add(key);
    setOpen(next);
    if (!rowsByLine) {
      const rows = await api.rows(importId);
      setRowsByLine(new Map(rows.map((r) => [r.line, r])));
    }
  };

  const sorted = useMemo(() => {
    if (sort.key === 'default') return detail;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...detail].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (x === null) return 1;
      if (y === null) return -1;
      return (typeof x === 'number' ? x - y : collator.compare(x, y)) * dir;
    });
  }, [detail, sort]);

  let running = 0;
  return (
    <>
    <ul className="divide-y divide-seam-soft sm:hidden">
      {sorted.map((d, i) => {
        const key = `${d.brand}|${d.model}|${d.capacity}|${d.condition}|${d.color}`;
        return (
          <li key={key} className={['flex items-start justify-between gap-3 px-4 py-3', fresh && i < 24 ? 'printing card-print' : ''].join(' ')}>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-cover-deep">{d.brand}</div>
              <div className="font-semibold">{d.model}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mute">
                {d.capacity && <span>{d.capacity}</span>}
                <span className={['rounded px-1.5 text-[12px] font-semibold', d.condition === 'used' ? 'bg-cover text-cover-ink' : 'bg-wash text-ink'].join(' ')}>{COND[d.condition]}</span>
                <span>{d.color || 'ไม่ระบุสี'}</span>
              </div>
            </div>
            <div className="num shrink-0 text-right">
              <div className="text-lg leading-tight font-bold">{d.qty}</div>
              <div className="text-sm">{num(d.retail)}</div>
              <div className="text-[13px] text-mute">ส่ง {num(d.wholesale)}</div>
            </div>
          </li>
        );
      })}
    </ul>
    <div className="hidden overflow-x-auto sm:block">
      <table className="num w-full min-w-[960px] border-collapse text-[15px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
        <thead className="sticky top-0 z-10 bg-cover text-cover-ink">
          <tr>
            <th scope="col" className="w-9">
              <span className="sr-only">ดูบรรทัดต้นฉบับ</span>
            </th>
            {COLS.map((c) => (
              <SortHead key={c.key} col={c} sort={sort} setSort={setSort} />
            ))}
            <th scope="col" className="px-3 py-2.5 text-right font-semibold" title="ยอดจำนวนสะสมตามลำดับในตาราง">
              ยอดสะสม
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d, i) => {
            running += d.qty;
            const key = `${d.brand}|${d.model}|${d.capacity}|${d.condition}|${d.color}`;
            const isOpen = open.has(key);
            const showBrand = sort.key !== 'default' || i === 0 || sorted[i - 1].brand !== d.brand;
            const animate = fresh && i < 24;
            return (
              <Fragment key={key}>
                <tr
                  className={[
                    'group border-b border-seam-soft transition-colors hover:bg-wash',
                    showBrand && i > 0 && sort.key === 'default' ? 'border-t border-t-seam' : '',
                    animate ? 'printing' : '',
                    isOpen ? 'bg-gold-soft/60' : '',
                  ].join(' ')}
                  style={animate ? { '--row': i } : undefined}
                >
                  <td className="py-1 pl-2" style={{ '--col': 0 }}>
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      aria-expanded={isOpen}
                      aria-label={`ดูบรรทัดต้นฉบับของ ${d.model} ${d.color}`}
                      className="grid size-7 place-items-center rounded-md text-faint hover:bg-wash-deep hover:text-cover-deep"
                    >
                      <ChevronRight size={16} className={['transition-transform', isOpen ? 'rotate-90 text-cover-deep' : ''].join(' ')} />
                    </button>
                  </td>
                  <td className="px-3 py-2 font-semibold text-cover-deep" style={{ '--col': 1 }}>
                    {showBrand ? d.brand : <span className="sr-only">{d.brand}</span>}
                  </td>
                  <td className="min-w-52 px-3 py-2 !whitespace-normal" style={{ '--col': 2 }}>{d.model}</td>
                  <td className="max-w-32 px-3 py-2 !whitespace-normal" style={{ '--col': 3 }}>{d.capacity || <span className="text-faint">—</span>}</td>
                  <td className="px-3 py-2" style={{ '--col': 4 }}>
                    <span className={['rounded px-2 py-px text-[13px] font-semibold whitespace-nowrap', d.condition === 'used' ? 'bg-cover text-cover-ink' : 'bg-wash text-ink'].join(' ')}>
                      {COND[d.condition]}
                    </span>
                  </td>
                  <td className="px-3 py-2" style={{ '--col': 5 }}>{d.color || <span className="text-faint">ไม่ระบุ</span>}</td>
                  <td className="px-3 py-2 text-right font-semibold" style={{ '--col': 6 }}>{d.qty}</td>
                  <td className="px-3 py-2 text-right" style={{ '--col': 7 }}><PriceCell main={d.retail} all={d.retailPrices} /></td>
                  <td className="px-3 py-2 text-right" style={{ '--col': 8 }}><PriceCell main={d.wholesale} all={d.wholesalePrices} /></td>
                  <td className="px-3 py-2 text-right font-semibold text-mute" style={{ '--col': 9 }}>{num(running)}</td>
                </tr>
                {isOpen && (
                  <tr className="bg-gold-soft/40">
                    <td />
                    <td colSpan={9} className="px-2 pt-1 pb-3">
                      <div className="rounded-lg border border-seam bg-white">
                        <SourceRows lines={d.lines} rowsByLine={rowsByLine} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

function ModelTable({ models, totals }) {
  return (
    <div className="overflow-x-auto">
      <table className="num w-full min-w-[560px] border-collapse text-[15px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
        <thead className="sticky top-0 z-10 bg-cover text-cover-ink">
          <tr>
            <th scope="col" className="px-4 py-2.5 text-left font-semibold">ยี่ห้อ</th>
            <th scope="col" className="px-4 py-2.5 text-left font-semibold">รุ่นสินค้า</th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">มือ 1 คงเหลือ</th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">มือ 2 คงเหลือ</th>
            <th scope="col" className="px-4 py-2.5 text-right font-semibold">รวมคงเหลือ</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m, i) => (
            <tr key={`${m.brand}|${m.model}`} className={['border-b border-seam-soft hover:bg-wash', i > 0 && models[i - 1].brand !== m.brand ? 'border-t border-t-seam' : ''].join(' ')}>
              <td className="px-4 py-2 font-semibold text-cover-deep">{i === 0 || models[i - 1].brand !== m.brand ? m.brand : ''}</td>
              <td className="px-4 py-2">{m.model}</td>
              <td className={['px-4 py-2 text-right', m.newQty ? '' : 'text-faint'].join(' ')}>{m.newQty}</td>
              <td className={['px-4 py-2 text-right', m.usedQty ? '' : 'text-faint'].join(' ')}>{m.usedQty}</td>
              <td className="px-4 py-2 text-right font-semibold">{m.qty}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-cover-deep bg-wash font-bold text-cover-deep">
            <td className="px-4 py-2.5" colSpan={2}>รวมทั้งหมด</td>
            <td className="px-4 py-2.5 text-right">{totals.newQty}</td>
            <td className="px-4 py-2.5 text-right">{totals.usedQty}</td>
            <td className="px-4 py-2.5 text-right">{totals.qty}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ print (PDF)
function PrintReport({ data }) {
  if (!data) return null;
  const { detail, totals, title } = data;
  return createPortal(
    <div className="print-only" aria-hidden="true">
      <h1 style={{ fontFamily: 'var(--font-stamp)', fontSize: 20, fontWeight: 700, color: '#005A9C', margin: '0 0 8px' }}>{title}</h1>
      <table style={{ marginBottom: 10, width: 'auto' }}>
        <tbody>
          <tr>
            {[['มือ 1 ทั้งหมด', totals.newQty], ['มือ 2 ทั้งหมด', totals.usedQty], ['รวมทั้งหมด', totals.qty]].map(([l, v]) => (
              <td key={l} style={{ padding: '4px 14px 4px 0' }}>
                {l} <b style={{ fontSize: 14 }}>{num(v)}</b>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <table>
        <thead>
          <tr>
            {['ยี่ห้อ', 'รุ่นสินค้า', 'ความจุ', 'ประเภท', 'สี', 'จำนวน', 'ราคาขายปลีก', 'ราคาขายส่ง'].map((h, i) => (
              <th key={h} style={{ padding: '5px 6px', textAlign: i >= 5 ? 'right' : 'left', border: '1px solid #C9D3D3' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {detail.map((d) => (
            <tr key={`${d.brand}|${d.model}|${d.capacity}|${d.condition}|${d.color}`} className={d.condition === 'used' ? 'used' : ''}>
              {[d.brand, d.model, d.capacity, COND[d.condition], d.color, num(d.qty), num(d.retail), num(d.wholesale)].map((v, i) => (
                <td key={i} style={{ padding: '3px 6px', textAlign: i >= 5 ? 'right' : 'left', border: '1px solid #DCE3E3', fontVariantNumeric: 'tabular-nums' }}>{v}</td>
              ))}
            </tr>
          ))}
          <tr>
            <td colSpan={5} style={{ padding: '5px 6px', fontWeight: 700, borderTop: '2px solid #005A9C' }}>รวมทั้งหมด</td>
            <td style={{ padding: '5px 6px', fontWeight: 700, textAlign: 'right', borderTop: '2px solid #005A9C' }}>{num(totals.qty)}</td>
            <td colSpan={2} style={{ borderTop: '2px solid #005A9C' }} />
          </tr>
        </tbody>
      </table>
      <p style={{ marginTop: 8, color: '#574d50' }}>หมายเหตุ: รวมจำนวนตามยี่ห้อ รุ่น ความจุ ประเภท และสี จากรายงานสต๊อกต้นฉบับ ราคาที่แสดงคือราคาของเครื่องส่วนใหญ่ในกลุ่ม</p>
    </div>,
    document.body,
  );
}

// ------------------------------------------------------------------ side column
function ImportHistory({ imports, selectedId, onSelect, onDeleted }) {
  const { toast, reloadImports } = useStore();
  const [confirm, setConfirm] = useState(null);
  return (
    <section aria-label="ประวัติการนำเข้า">
      <h2 className="mb-2.5 font-stamp text-[17px] font-bold text-cover-deep">ประวัติการนำเข้า</h2>
      <ul className="grid gap-2">
        {imports.map((imp) => {
          const Icon = FILE_ICON[imp.file_type] || FileText;
          const active = imp.id === selectedId;
          return (
            <li key={imp.id} className={['leaf flex items-center gap-1 p-1', active ? 'ring-3 ring-gold' : ''].join(' ')}>
              <button type="button" onClick={() => onSelect(imp.id)} aria-current={active} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-wash">
                <Icon size={20} className="shrink-0 text-cover-deep" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{imp.filename}</span>
                  <span className="num block text-[13px] text-mute">
                    {thaiStamp(imp.created_at)} · {num(imp.qty)} เครื่อง
                  </span>
                </span>
              </button>
              {confirm === imp.id ? (
                <button
                  type="button"
                  autoFocus
                  onBlur={() => setConfirm(null)}
                  onClick={async () => {
                    try {
                      await api.deleteImport(imp.id);
                      await reloadImports();
                      onDeleted(imp.id);
                      toast(`ลบการนำเข้า ${imp.filename} แล้ว`);
                    } catch (e) {
                      toast(e.message, 'error');
                    }
                  }}
                  className="btn mr-1 min-h-8 shrink-0 bg-danger px-2.5 py-1 text-[13px] text-white"
                >
                  ยืนยันลบ
                </button>
              ) : (
                <button type="button" onClick={() => setConfirm(imp.id)} className="btn btn-danger mr-1 ml-2 min-h-8 shrink-0 px-2 py-1" aria-label={`ลบการนำเข้า ${imp.filename}`}>
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function RecentWork() {
  const { cards } = useStore();
  const list = (cards || []).filter((c) => c.status === 'doing').slice(0, 4);
  return (
    <section aria-label="งานที่กำลังทำ">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="font-stamp text-[17px] font-bold text-cover-deep">งานที่กำลังทำ</h2>
        <Link to="/cards" className="shrink-0 text-sm font-semibold whitespace-nowrap text-cover-deep underline">
          ดูการ์ดทั้งหมด
        </Link>
      </div>
      {list.length === 0 ? (
        <p className="leaf px-4 py-3 text-mute">ไม่มีงานค้าง</p>
      ) : (
        <ul className="grid gap-2">
          {list.map((c) => (
            <li key={c.id} className="leaf grid gap-1 px-4 py-3">
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="stamp stamp-sm">{thaiShort(c.work_date)}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-warn">
                  <CircleDashed size={13} /> กำลังทำ
                </span>
              </div>
              <span className="font-semibold">{c.title}</span>
              {c.tags.length > 0 && <span className="text-[13px] text-mute">{c.tags.join(' · ')}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ page
export default function StockPage() {
  const { imports } = useStore();
  const [selectedId, setSelectedId] = useState(null);
  const [freshId, setFreshId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [condition, setCondition] = useState('all');
  const [brand, setBrand] = useState('all');
  const [q, setQ] = useState('');
  const [view, setView] = useState('detail');
  const [dragging, setDragging] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const fileInput = useRef();

  const onUploaded = useCallback((imp) => {
    setSelectedId(imp.id);
    setFreshId(imp.id);
    setCondition('all');
    setBrand('all');
    setQ('');
  }, []);
  const { upload, busy, error } = useUpload(onUploaded);

  const currentId = selectedId ?? imports?.[0]?.id ?? null;
  const filters = useMemo(() => ({ condition, brand, q: q.trim() }), [condition, brand, q]);

  useEffect(() => {
    if (!currentId) {
      setData(null);
      return;
    }
    let live = true;
    setLoading(true);
    const t = setTimeout(
      () =>
        api
          .summary(currentId, filters)
          .then((d) => live && setData(d))
          .catch(() => live && setData(null))
          .finally(() => live && setLoading(false)),
      filters.q ? 180 : 0,
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [currentId, filters]);

  useEffect(() => {
    if (!freshId) return;
    const t = setTimeout(() => setFreshId(null), 4500);
    return () => clearTimeout(t);
  }, [freshId]);

  const imp = data?.import;
  const filtered = condition !== 'all' || brand !== 'all' || !!q.trim();

  function printPdf() {
    const prev = document.title;
    document.title = data.title.replace(/\//g, '.');
    window.print();
    document.title = prev;
  }

  const pageDrop = {
    onDragEnter: (e) => {
      if (e.dataTransfer.types.includes('Files')) setDragging(true);
    },
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => {
      e.preventDefault();
      setDragging(false);
      upload(e.dataTransfer.files[0]);
    },
  };

  if (imports === null) {
    return <div className="leaf mx-auto h-64 max-w-[1440px] animate-pulse bg-white/60" aria-busy="true" />;
  }

  if (!imports.length) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <PageHeader title="สต๊อกสินค้า" sub="นำเข้ารายงานสต๊อกจากทุกสาขา ตรวจยอด แล้วส่งออกเป็นแบบสต๊อกสินค้าออฟฟิศ" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <DropZone onFile={upload} busy={busy} error={error} />
          <FormatGuide />
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-[1600px]" {...pageDrop}>
      {dragging && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-cover-deep/90 p-6 backdrop-blur-[2px]"
          onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={pageDrop.onDrop}
        >
          <div className="pointer-events-none flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gold px-12 py-10 text-center text-white">
            <FileUp size={40} className="text-gold" />
            <p className="font-stamp text-2xl font-bold">วางไฟล์เพื่อนำเข้า</p>
            <p className="text-cover-mute">.xlsx .xls .csv .pdf</p>
          </div>
        </div>
      )}

      <PageHeader
        title="สต๊อกสินค้า"
        stamp={imp ? thaiShort(imp.created_at.slice(0, 10)) : thaiShort(todayISO())}
        stampKey={imp?.id}
        sub={imp ? `${imp.filename} · อ่าน ${num(imp.rows)} บรรทัด` : 'กำลังโหลด…'}
      >
        <button type="button" className="btn btn-outline" disabled={busy} onClick={() => fileInput.current.click()}>
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Upload size={18} />}
          {busy ? 'กำลังอ่านไฟล์…' : 'นำเข้าไฟล์'}
        </button>
        <input ref={fileInput} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} onChange={(e) => (upload(e.target.files[0]), (e.target.value = ''))} />
        <div className="flex items-center gap-2" role="group" aria-label="ส่งออก">
          <a className={['btn btn-primary', !data ? 'pointer-events-none opacity-50' : ''].join(' ')} href={data ? api.exportUrl(currentId, 'xlsx', filters) : undefined} download>
            <FileSpreadsheet size={18} />
            Export Excel
          </a>
          <a className={['btn btn-outline', !data ? 'pointer-events-none opacity-50' : ''].join(' ')} href={data ? api.exportUrl(currentId, 'csv', filters) : undefined} download>
            CSV
          </a>
          <button type="button" className="btn btn-outline" disabled={!data} onClick={printPdf} title="เปิดหน้าพิมพ์ เลือก บันทึกเป็น PDF">
            <Printer size={17} />
            PDF
          </button>
        </div>
      </PageHeader>

      {error && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-3 text-danger">
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      {data && (
        <Strip
          cells={[
            { label: filtered ? 'มือ 1 (ตามตัวกรอง)' : 'มือ 1 ทั้งหมด', value: num(data.totals.newQty) },
            { label: filtered ? 'มือ 2 (ตามตัวกรอง)' : 'มือ 2 ทั้งหมด', value: num(data.totals.usedQty) },
            { label: filtered ? 'รวม (ตามตัวกรอง)' : 'รวมทั้งหมด', value: num(data.totals.qty), tone: 'cover' },
            { label: 'มูลค่าตามราคาปลีก', value: bahtShort(data.totals.retailValue) },
          ]}
          verdict={
            imp.skipped.length === 0 ? (
              <>
                <CircleCheck size={22} className="shrink-0 text-ok" />
                <span>
                  <span className="block font-semibold text-ok">ยอดตรงกับไฟล์ต้นฉบับ</span>
                  <span className="num text-sm text-pretty text-mute">
                    อ่านครบ {num(imp.rows)}/{num(imp.line_count)} บรรทัด ·{' '}
                    <span className="whitespace-nowrap">รวม {num(imp.qty)} เครื่อง</span>
                  </span>
                </span>
              </>
            ) : (
              <>
                <TriangleAlert size={22} className="shrink-0 text-warn" />
                <span className="min-w-0">
                  <span className="block font-semibold text-warn">ข้าม {imp.skipped.length} บรรทัดที่อ่านไม่ได้</span>
                  <button type="button" className="text-sm font-semibold text-cover-deep underline" onClick={() => setShowSkipped(!showSkipped)}>
                    {showSkipped ? 'ซ่อนรายการ' : 'ดูว่าบรรทัดไหน'}
                  </button>
                </span>
              </>
            )
          }
        />
      )}

      {showSkipped && imp?.skipped.length > 0 && (
        <ul className="leaf mb-5 grid gap-1 px-5 py-3 text-[14px]">
          {imp.skipped.map((s) => (
            <li key={s.line} className="num">
              <span className="font-semibold text-cover-deep">บรรทัด {s.line}</span> · {s.reason} · <span className="text-mute">{s.text}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-6 3xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="leaf min-w-0 overflow-hidden" aria-label="ตารางสต๊อก" aria-busy={loading}>
          <div className="flex flex-wrap items-center gap-3 border-b border-seam-soft px-4 py-3">
            <Segmented
              label="มุมมอง"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: 'detail', label: 'แยกตามสี' },
                { value: 'model', label: 'สรุปตามรุ่น' },
              ]}
            />
            <Segmented
              label="ประเภท"
              size="sm"
              value={condition}
              onChange={setCondition}
              options={[
                { value: 'all', label: 'ทั้งหมด' },
                { value: 'new', label: 'มือ 1', count: data?.all.newQty },
                { value: 'used', label: 'มือ 2', count: data?.all.usedQty },
              ]}
            />
            <label className="flex items-center gap-2 text-sm text-mute">
              ยี่ห้อ
              <select value={brand} onChange={(e) => setBrand(e.target.value)} className="field w-auto py-1.5 pr-8 text-[15px] text-ink">
                <option value="all">ทุกยี่ห้อ</option>
                {(data?.brandsAll || data?.brands || []).map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <div className="w-full sm:ml-auto sm:w-auto">
              <SearchBox value={q} onChange={setQ} placeholder="ค้นหารุ่น สี รหัส" icon={Search} />
            </div>
          </div>

          {data && data.detail.length === 0 ? (
            <div className="flex flex-wrap items-center gap-4 px-6 py-10">
              <FilterX size={22} className="text-cover-deep" />
              <p className="text-mute">ไม่มีสินค้าที่ตรงกับตัวกรองนี้</p>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setCondition('all');
                  setBrand('all');
                  setQ('');
                }}
              >
                ล้างตัวกรอง
              </button>
            </div>
          ) : data ? (
            <div className={['transition-opacity', loading ? 'opacity-60' : ''].join(' ')}>
              {view === 'detail' ? (
                <DetailTable detail={data.detail} fresh={freshId === currentId} importId={currentId} />
              ) : (
                <ModelTable models={data.models} totals={data.totals} />
              )}
              <div className="num flex flex-wrap justify-between gap-2 border-t-2 border-cover-deep bg-wash px-4 py-2.5 font-bold text-cover-deep">
                <span>
                  รวมทั้งหมด {num(view === 'detail' ? data.totals.lines : data.totals.models)} {view === 'detail' ? 'รายการ' : 'รุ่น'}
                </span>
                <span>{num(data.totals.qty)} เครื่อง</span>
              </div>
            </div>
          ) : (
            <div className="h-80 animate-pulse bg-white/60" />
          )}
        </section>

        <aside className="grid min-w-0 content-start gap-7 md:grid-cols-2 3xl:grid-cols-1">
          <ImportHistory
            imports={imports}
            selectedId={currentId}
            onSelect={(id) => {
              setSelectedId(id);
              setBrand('all');
            }}
            onDeleted={(id) => id === currentId && setSelectedId(null)}
          />
          <RecentWork />
        </aside>
      </div>

      <PrintReport data={data} />
    </div>
  );
}
