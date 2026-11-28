import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  FileText,
  FileUp,
  LoaderCircle,
  MousePointerClick,
  ScanBarcode,
  Search,
  Trash2,
  Truck,
  Undo2,
  X,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { num, thaiShort, todayISO } from '../lib/thai.js';
import { PageHeader, SearchBox, Segmented, Strip } from '../components/ui.jsx';

const STATE = {
  new: { label: 'ยังไม่ได้ดู', cls: 'bg-wash-deep text-mute' },
  none: { label: 'ยังไม่มีเลขพัสดุ', cls: 'bg-wash-deep text-mute' },
  moving: { label: 'กำลังส่ง', cls: 'bg-cover/10 text-cover-deep' },
  delivered: { label: 'ถึงแล้ว', cls: 'bg-ok-soft text-ok' },
  problem: { label: 'มีปัญหา', cls: 'bg-danger-soft text-danger' },
  returned: { label: 'ตีกลับ', cls: 'bg-danger-soft text-danger' },
};

const Badge = ({ state }) => {
  const s = STATE[state] || STATE.none;
  return <span className={['inline-block rounded-full px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap', s.cls].join(' ')}>{s.label}</span>;
};

/** "2026-11-29 14:30:00" -> "29 พ.ย. 69 · 14:30" */
const stamp = (t) => (t ? `${thaiShort(t.slice(0, 10))}${t.length > 10 ? ` · ${t.slice(11, 16)}` : ''}` : '');

// ------------------------------------------------------------------ J&T tracking page
// J&T's public page takes up to 10 numbers from ?waybillNo=a,b,c and searches them right away.
// It then shows a slide puzzle, which the person solves; the status seen there is set below by hand.
const JT_PAGE = 'https://www.jtexpress.co.th/service/track';
const JT_MAX = 10;
const jtUrl = (codes) => `${JT_PAGE}?waybillNo=${codes.slice(0, JT_MAX).map(encodeURIComponent).join(',')}`;
function chunk(list, n = JT_MAX) {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

/** Opens J&T's page with the numbers filled in; more than 10 numbers become one link per 10. */
function JtLinks({ codes, label, primary }) {
  const groups = chunk([...new Set(codes)]);
  if (!groups.length) return null;
  const cls = primary ? 'btn btn-primary' : 'btn btn-outline min-h-9 py-1 text-[14px]';
  return groups.map((g, i) => (
    <a key={g[0]} href={jtUrl(g)} target="_blank" rel="noreferrer" className={cls} title={g.join(', ')}>
      <ExternalLink size={primary ? 18 : 16} />
      {label}
      {groups.length > 1 ? ` ชุด ${i + 1}` : ''} <span className="num">({g.length})</span>
    </a>
  ));
}

const PICK = ['new', 'moving', 'delivered', 'problem', 'returned'];

/** Status picker that looks like the badge. */
function StatePick({ value, onChange, label }) {
  const v = PICK.includes(value) ? value : 'new';
  const [busy, setBusy] = useState(false);
  return (
    <select
      value={v}
      aria-label={label}
      disabled={busy}
      onChange={async (e) => {
        setBusy(true);
        try {
          await onChange(e.target.value);
        } catch {
          /* toast already shown */
        } finally {
          setBusy(false);
        }
      }}
      className={['cursor-pointer rounded-full border-0 py-0.5 pr-7 pl-2.5 text-[13px] font-semibold', STATE[v].cls].join(' ')}
    >
      {PICK.map((k) => (
        <option key={k} value={k}>
          {STATE[k].label}
        </option>
      ))}
    </select>
  );
}

// ------------------------------------------------------------------ invoices
function Items({ items, hit }) {
  if (!items.length) return <p className="px-3 py-2 text-mute">ไม่มีรายการสินค้า</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] text-[14px]">
        <thead className="text-left text-[13px] text-mute">
          <tr>
            <th className="w-10 px-3 py-1.5 text-center font-semibold">#</th>
            <th className="px-3 py-1.5 font-semibold">รหัสสินค้า</th>
            <th className="px-3 py-1.5 font-semibold">รายการ</th>
            <th className="px-3 py-1.5 font-semibold">IMEI / Serial</th>
            <th className="w-20 px-3 py-1.5 text-right font-semibold">จำนวน</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id} className={['border-t border-seam-soft', hit && hit(i) ? 'bg-gold-soft' : ''].join(' ')}>
              <td className="num px-3 py-1.5 text-center text-mute">{i.line}</td>
              <td className="num px-3 py-1.5">{i.sku}</td>
              <td className="px-3 py-1.5">{i.description}</td>
              <td className="num px-3 py-1.5">{i.imei || <span className="text-faint">—</span>}</td>
              <td className="num px-3 py-1.5 text-right whitespace-nowrap">
                {num(i.qty)} <span className="text-mute">{i.unit}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoiceRow({ v, hit, actions, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  return (
    <li className="border-t border-seam-soft first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="group flex min-w-0 items-center gap-2 text-left">
          <ChevronRight size={17} className={['shrink-0 text-mute transition-transform group-hover:text-ink', open ? 'rotate-90' : ''].join(' ')} />
          <span className="num font-semibold text-cover-deep">{v.inv_no}</span>
        </button>
        <span className="num text-sm text-mute">
          {v.inv_date ? thaiShort(v.inv_date) : 'ไม่มีวันที่'}
          {v.inv_time && ` · ${v.inv_time.slice(0, 5)}`}
        </span>
        <span className="text-sm">
          <span className="text-mute">พนักงานขาย</span> {v.salesman || '—'}
        </span>
        <span className="num text-sm">
          <span className="text-mute">อ้างอิง</span> {v.ref_no || '—'}
        </span>
        <span className="num text-sm text-mute">{num(v.qty)} ชิ้น</span>
        <span className="ml-auto flex items-center gap-1">{actions}</span>
      </div>
      {open && (
        <div className="mx-4 mb-3 rounded-lg border border-seam bg-white">
          <Items items={v.items} hit={hit} />
        </div>
      )}
    </li>
  );
}

function ConfirmButton({ label, confirmLabel, icon: Icon, onConfirm, title }) {
  const [ask, setAsk] = useState(false);
  const t = useRef();
  useEffect(() => () => clearTimeout(t.current), []);
  return ask ? (
    <button type="button" autoFocus onBlur={() => setAsk(false)} onClick={onConfirm} className="btn min-h-8 bg-danger px-2.5 py-1 text-[13px] text-white">
      {confirmLabel}
    </button>
  ) : (
    <button
      type="button"
      title={title}
      onClick={() => {
        setAsk(true);
        clearTimeout(t.current);
        t.current = setTimeout(() => setAsk(false), 4000);
      }}
      className="btn btn-ghost min-h-8 px-2 py-1 text-[13px]"
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

// ------------------------------------------------------------------ tracking entry
function TrackingInput({ onSubmit, placeholder, compact }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className={compact ? 'flex flex-wrap items-center gap-2' : 'flex w-full flex-wrap items-center gap-2 sm:w-auto'}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!value.trim() || busy) return;
        setBusy(true);
        setError('');
        try {
          await onSubmit(value);
          setValue('');
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
        <ScanBarcode size={16} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
        <input
          value={value}
          onChange={(e) => (setValue(e.target.value), setError(''))}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={!!error}
          className="field num py-1.5 pl-8 text-[14px] placeholder:font-normal"
          disabled={busy}
        />
      </span>
      <button type="submit" className={compact ? 'btn btn-outline min-h-9 py-1 text-[14px]' : 'btn btn-primary min-h-9 py-1 text-[14px]'} disabled={busy || !value.trim()}>
        {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
        {compact ? 'เพิ่ม' : 'บันทึกเลขพัสดุ'}
      </button>
      {error && <p role="alert" className="basis-full text-[13px] text-danger">{error}</p>}
    </form>
  );
}

function ParcelLine({ p, onState, onDelete }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-seam bg-white px-3 py-2">
      <a
        href={jtUrl([p.tracking])}
        target="_blank"
        rel="noreferrer"
        title="เปิดหน้าติดตามของ J&T (กรอกเลขไว้ให้แล้ว)"
        className="num inline-flex items-center gap-1 font-semibold tracking-wide text-cover-deep underline"
      >
        {p.tracking}
        <ExternalLink size={13} />
      </a>
      <StatePick value={p.state} onChange={onState} label={`สถานะของ ${p.tracking}`} />
      {p.checked_at && p.state !== 'new' && <span className="num text-[13px] text-mute">อัปเดต {stamp(p.checked_at)}</span>}
      <button type="button" className="ml-auto rounded p-1 text-faint hover:bg-danger-soft hover:text-danger" onClick={onDelete} aria-label={`ลบเลข ${p.tracking}`}>
        <X size={15} />
      </button>
    </li>
  );
}

// ------------------------------------------------------------------ page
export default function TrackingPage() {
  const { toast } = useStore();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const [show, setShow] = useState('active');
  const [dragging, setDragging] = useState(false);
  const input = useRef();

  useEffect(() => {
    api.tracking().then(setData, (e) => toast(e.message, 'error'));
  }, [toast]);

  async function importFiles(list) {
    const files = [...list].filter((f) => /\.pdf$/i.test(f.name));
    if (!files.length) return toast('ใบ Inv ต้องเป็นไฟล์ PDF', 'error');
    setBusy('upload');
    try {
      const r = await api.uploadTrackInvoices(files);
      setData(r.view);
      const parts = [];
      if (r.added.length) parts.push(`เพิ่มใบ Inv ${r.added.length} ใบ`);
      if (r.duplicates.length) parts.push(`ข้าม ${r.duplicates.length} ใบที่มีอยู่แล้ว`);
      if (r.errors.length) parts.push(`อ่านไม่ได้ ${r.errors.map((e) => e.filename).join(', ')}`);
      toast(parts.join(' · '), r.errors.length ? 'error' : 'ok');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy('');
    }
  }

  const act = async (fn, ok) => {
    try {
      const r = await fn();
      setData(r.view || r);
      if (ok) toast(ok, 'ok');
    } catch (e) {
      toast(e.message, 'error');
      throw e;
    }
  };

  const needle = q.trim().toLowerCase();
  const itemHit = useCallback((i) => !!needle && `${i.sku} ${i.imei} ${i.description}`.toLowerCase().includes(needle), [needle]);
  const invoiceMatch = useCallback(
    (v) => !needle || `${v.inv_no} ${v.ref_no} ${v.customer_name} ${v.customer_no} ${v.salesman}`.toLowerCase().includes(needle) || v.items.some(itemHit),
    [needle, itemHit],
  );

  const pending = useMemo(() => (data?.pending || []).map((g) => ({ ...g, shown: g.invoices.filter(invoiceMatch) })).filter((g) => g.shown.length), [data, invoiceMatch]);
  const shipments = useMemo(
    () =>
      (data?.shipments || []).filter((s) => {
        if (show === 'active' && s.state === 'delivered') return false;
        if (show === 'done' && s.state !== 'delivered') return false;
        if (!needle) return true;
        return s.parcels.some((p) => p.tracking.toLowerCase().includes(needle)) || s.invoices.some(invoiceMatch);
      }),
    [data, show, needle, invoiceMatch],
  );

  const counts = useMemo(() => {
    const s = data?.shipments || [];
    return {
      waitingInv: (data?.pending || []).reduce((n, g) => n + g.invoices.length, 0),
      waitingCust: (data?.pending || []).length,
      moving: s.filter((x) => x.state === 'moving' || x.state === 'none').length,
      delivered: s.filter((x) => x.state === 'delivered').length,
      problem: s.filter((x) => x.state === 'problem').length,
      notLooked: s.flatMap((x) => x.parcels).filter((p) => p.state === 'new' || p.state === 'none').length,
    };
  }, [data]);

  // numbers still on the way: what the J&T button opens
  const openCodes = useMemo(
    () => (data?.shipments || []).flatMap((s) => s.parcels).filter((p) => p.state !== 'delivered' && p.state !== 'returned').map((p) => p.tracking),
    [data],
  );
  const lastSet = useMemo(() => {
    const times = (data?.shipments || []).flatMap((s) => s.parcels.filter((p) => p.state !== 'new').map((p) => p.checked_at)).filter(Boolean).sort();
    return times.at(-1) || '';
  }, [data]);

  const pageDrop = {
    onDragEnter: (e) => e.dataTransfer.types.includes('Files') && setDragging(true),
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => {
      e.preventDefault();
      setDragging(false);
      importFiles(e.dataTransfer.files);
    },
  };

  return (
    <div className="relative mx-auto max-w-[1400px]" {...pageDrop}>
      {dragging && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-cover-deep/90 p-6 backdrop-blur-[2px]"
          onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
          onDragOver={(e) => e.preventDefault()}
          /* no onDrop here: the drop bubbles to the page, which handles it once */
        >
          <div className="pointer-events-none flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gold px-12 py-10 text-center text-white">
            <FileUp size={40} className="text-gold" />
            <p className="font-stamp text-2xl font-bold">วางใบ Inv (PDF)</p>
            <p className="text-cover-mute">ใบโอนสินค้าออกระหว่างสาขา วางหลายไฟล์พร้อมกันได้</p>
          </div>
        </div>
      )}

      <PageHeader title="ติดตามสินค้า" stamp={thaiShort(todayISO())} sub="ใบโอนสินค้า → เลขพัสดุ J&T → สถานะการส่ง">
        <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => input.current.click()}>
          {busy === 'upload' ? <LoaderCircle size={18} className="animate-spin" /> : <FileText size={18} />}
          {busy === 'upload' ? 'กำลังอ่านใบ Inv…' : 'นำเข้าใบ Inv'}
        </button>
        <JtLinks codes={openCodes} label="เปิดเว็บ J&T" />
        <input ref={input} type="file" accept=".pdf" multiple className="sr-only" tabIndex={-1} onChange={(e) => (importFiles(e.target.files), (e.target.value = ''))} />
      </PageHeader>

      {data && (
        <Strip
          cells={[
            { label: 'รอเลขพัสดุ', value: `${num(counts.waitingInv)} ใบ` },
            { label: 'กำลังส่ง', value: num(counts.moving), tone: 'cover' },
            { label: 'ถึงแล้ว', value: num(counts.delivered) },
            { label: 'มีปัญหา / ตีกลับ', value: num(counts.problem) },
          ]}
          verdict={
            counts.problem ? (
              <>
                <CircleAlert size={22} className="shrink-0 text-danger" />
                <span className="font-semibold text-danger">มีพัสดุมีปัญหา / ตีกลับ {counts.problem} รอบส่ง</span>
              </>
            ) : counts.notLooked ? (
              <>
                <MousePointerClick size={22} className="shrink-0 text-warn" />
                <span>
                  <span className="block font-semibold text-warn">ยังไม่ได้ดูสถานะ {num(counts.notLooked)} เลข</span>
                  <span className="text-sm text-mute">กด "เปิดเว็บ J&T" → เลื่อนจิ๊กซอว์ → กลับมาเลือกสถานะ</span>
                </span>
              </>
            ) : (
              <>
                <CircleCheck size={22} className="shrink-0 text-ok" />
                <span>
                  <span className="block font-semibold text-ok">อัปเดตสถานะครบทุกเลข</span>
                  <span className="num text-sm text-mute">{lastSet ? `ล่าสุด ${stamp(lastSet)}` : ''}</span>
                </span>
              </>
            )
          }
        />
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented
          label="รอบส่ง"
          size="sm"
          value={show}
          onChange={setShow}
          options={[
            { value: 'active', label: 'ยังไม่ถึง', count: counts.moving + counts.problem },
            { value: 'done', label: 'ถึงแล้ว', count: counts.delivered },
            { value: 'all', label: 'ทั้งหมด' },
          ]}
        />
        <div className="w-full sm:ml-auto sm:w-auto">
          <SearchBox value={q} onChange={setQ} placeholder="ค้นหาสาขา Inv เลขพัสดุ IMEI" icon={Search} />
        </div>
      </div>

      {!data ? (
        <div className="leaf h-64 animate-pulse bg-white/60" aria-busy="true" />
      ) : !data.pending.length && !data.shipments.length ? (
        <button type="button" onClick={() => input.current.click()} className="flex w-full flex-col items-center gap-4 rounded-[10px] border-2 border-dashed border-seam bg-leaf px-6 py-14 text-center hover:border-cover-deep">
          <span className="grid size-14 place-items-center rounded-full bg-cover text-gold">
            <Truck size={26} />
          </span>
          <span>
            <span className="block font-stamp text-xl font-bold text-cover-deep">ลากใบ Inv (PDF) มาวางที่นี่</span>
            <span className="mt-1 block text-mute">ระบบอ่าน Customer No., Customer Name, พนักงานขาย, เลขอ้างอิง, Inv. No., วันที่และเวลา และสินค้าทุกชิ้นให้เอง แล้วรวมไว้ใต้ชื่อสาขา</span>
          </span>
        </button>
      ) : (
        <div className="grid gap-8">
          {pending.length > 0 && (
            <section aria-label="รอเลขพัสดุ">
              <h2 className="mb-3 flex items-center gap-3 font-stamp text-[18px] font-bold text-cover-deep">
                รอเลขพัสดุ
                <span className="num text-sm font-normal text-on-page-mute">
                  {num(counts.waitingCust)} สาขา · {num(counts.waitingInv)} ใบ
                </span>
              </h2>
              <div className="grid gap-4">
                {pending.map((g) => (
                  <article key={g.key} className="leaf overflow-hidden">
                    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-seam-soft bg-gold-soft/40 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[18px] leading-tight font-bold">{g.customer_name || 'ไม่ระบุสาขา'}</h3>
                        <span className="num text-sm text-mute">
                          {g.customer_no && <span className="mr-2 rounded bg-white px-1.5 font-semibold text-cover-deep">{g.customer_no}</span>}
                          {num(g.invoices.length)} ใบ · {num(g.qty)} ชิ้น
                        </span>
                      </div>
                      <TrackingInput
                        placeholder="เลขพัสดุ J&T (ยิงหลายเลขได้)"
                        onSubmit={(value) =>
                          act(() => api.ship({ customer_no: g.customer_no, customer_name: g.customer_name, trackings: value }), `บันทึกเลขพัสดุของ ${g.customer_name} แล้ว ${g.invoices.length} ใบ`)
                        }
                      />
                    </header>
                    <ul>
                      {g.shown.map((v) => (
                        <InvoiceRow
                          key={v.id}
                          v={v}
                          hit={itemHit}
                          defaultOpen={!!needle && v.items.some(itemHit)}
                          actions={<ConfirmButton label="ลบ" confirmLabel="ยืนยันลบใบนี้" icon={Trash2} title="ลบใบ Inv นี้" onConfirm={() => act(() => api.deleteTrackInvoice(v.id), `ลบ ${v.inv_no} แล้ว`)} />}
                        />
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section aria-label="รอบส่ง">
            <h2 className="mb-3 font-stamp text-[18px] font-bold text-cover-deep">รอบส่ง</h2>
            {shipments.length === 0 ? (
              <p className="leaf px-5 py-6 text-mute">{needle ? 'ไม่มีรอบส่งที่ตรงกับคำค้น' : show === 'done' ? 'ยังไม่มีรอบส่งที่ถึงแล้ว' : 'ไม่มีรอบส่งที่กำลังส่ง'}</p>
            ) : (
              <div className="grid gap-4">
                {shipments.map((s) => (
                  <article key={s.id} className="leaf overflow-hidden">
                    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-seam-soft px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="flex flex-wrap items-center gap-2 text-[18px] leading-tight font-bold">
                          {s.customer_name || 'ไม่ระบุสาขา'}
                          <Badge state={s.state} />
                        </h3>
                        <span className="num text-sm text-mute">
                          {s.customer_no && <span className="mr-2 rounded bg-wash px-1.5 font-semibold text-cover-deep">{s.customer_no}</span>}
                          ส่งเมื่อ {stamp(s.created_at)} · {num(s.invoices.length)} ใบ · {num(s.qty)} ชิ้น
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <JtLinks codes={s.parcels.map((p) => p.tracking)} label="ดูใน J&T" />
                        {s.parcels.length > 0 && s.state !== 'delivered' && (
                          <button
                            type="button"
                            className="btn btn-outline min-h-9 border-ok/40 py-1 text-[14px] text-ok"
                            onClick={() => act(() => api.setShipmentState(s.id, 'delivered'), `${s.customer_name} ถึงครบแล้ว`).catch(() => {})}
                          >
                            <CheckCheck size={16} />
                            ถึงครบแล้ว
                          </button>
                        )}
                      </div>
                      <ConfirmButton
                        label="ยกเลิกรอบส่ง"
                        confirmLabel="ยืนยันยกเลิก"
                        icon={Undo2}
                        title="ใบ Inv ในรอบนี้จะกลับไปรอเลขพัสดุ"
                        onConfirm={() => act(() => api.unship(s.id), 'ยกเลิกรอบส่งแล้ว ใบ Inv กลับไปรอเลขพัสดุ')}
                      />
                    </header>
                    <div className="grid gap-2 border-b border-seam-soft px-4 py-3">
                      {s.parcels.length > 0 && (
                        <ul className="grid gap-2">
                          {s.parcels.map((p) => (
                            <ParcelLine
                              key={p.id}
                              p={p}
                              onState={(state) => act(() => api.setParcelState(p.id, state))}
                              onDelete={() => act(() => api.deleteTrackParcel(p.id), `ลบเลข ${p.tracking} แล้ว`).catch(() => {})}
                            />
                          ))}
                        </ul>
                      )}
                      <TrackingInput compact placeholder="เพิ่มเลขพัสดุ (กล่องถัดไป)" onSubmit={(value) => act(() => api.addTrackParcels(s.id, value), 'เพิ่มเลขพัสดุแล้ว')} />
                    </div>
                    <ul>
                      {s.invoices.filter(invoiceMatch).map((v) => (
                        <InvoiceRow
                          key={v.id}
                          v={v}
                          hit={itemHit}
                          defaultOpen={!!needle && v.items.some(itemHit)}
                          actions={
                            <ConfirmButton label="เอาออก" confirmLabel="ย้ายกลับไปรอเลข" icon={Undo2} title="ย้ายใบนี้กลับไปรอเลขพัสดุ" onConfirm={() => act(() => api.unshipInvoice(v.id), `${v.inv_no} กลับไปรอเลขพัสดุแล้ว`)} />
                          }
                        />
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
