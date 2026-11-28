import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FileSpreadsheet,
  FileText,
  FileUp,
  ImagePlus,
  LoaderCircle,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { num, thaiDayHeading, thaiShort, todayISO } from '../lib/thai.js';
import { PageHeader, Strip } from '../components/ui.jsx';

const isPdf = (f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
const isImage = (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(f.name);
const SLIP_ACCEPT = 'image/*,.heic,.heif,.pdf';

/** A typed amount: "27,180" and "฿1,000" count as numbers; empty or junk counts as 0. */
const toNum = (v) => {
  const n = Number(String(v ?? '').replace(/[,\s฿]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const baht = (n) => (n === null || n === undefined ? '—' : n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const qtyText = (n) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 });

// open/closed days survive a reload; storage may be unavailable
const OPEN_KEY = 'yok.sales.openDays';
function readOpen() {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeOpen(v) {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify(v));
  } catch {
    /* fine */
  }
}

// ------------------------------------------------------------------ small parts
/** Shows the date the Thai way; a click opens the browser's calendar. */
function DateField({ value, onChange, label }) {
  const input = useRef();
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => {
          try {
            input.current.showPicker();
          } catch {
            input.current.focus();
          }
        }}
        aria-label={`${label}: ${value ? thaiShort(value) : 'ยังไม่ระบุ'} (กดเพื่อเปลี่ยน)`}
        className="field num inline-flex w-auto items-center gap-2 whitespace-nowrap"
      >
        {value ? thaiShort(value) : 'เลือกวันที่'}
        <CalendarDays size={16} className="text-faint" />
      </button>
      <input
        ref={input}
        type="date"
        value={value}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="pointer-events-none absolute inset-0 opacity-0"
      />
    </span>
  );
}

function SlipThumb({ slip, onOpen, size = 'sm' }) {
  const cls = size === 'sm' ? 'size-10' : 'size-24';
  return (
    <button
      type="button"
      onClick={onOpen}
      title={slip.file_name}
      aria-label={`ดูสลิป ${slip.file_name}`}
      className={[cls, 'grid shrink-0 place-items-center overflow-hidden rounded-md border border-seam bg-white transition-colors hover:border-cover-deep'].join(' ')}
    >
      {slip.image ? (
        <img src={slip.url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <FileText size={size === 'sm' ? 18 : 28} className="text-cover-deep" />
      )}
    </button>
  );
}

function AttachSlip({ sale, onChange, compact }) {
  const { toast } = useStore();
  const input = useRef();
  const [busy, setBusy] = useState(false);
  async function attach(files) {
    if (!files.length) return;
    setBusy(true);
    try {
      onChange(await api.addSlips(sale.id, files));
      toast(`แนบสลิป ${files.length} ไฟล์กับ ${sale.receipt_no || 'บิลนี้'} แล้ว`, 'ok');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => input.current.click()}
        disabled={busy}
        aria-label={`แนบสลิปให้ ${sale.receipt_no || 'บิลนี้'}`}
        className={
          compact
            ? 'grid size-10 shrink-0 place-items-center rounded-md border border-dashed border-cover-deep/50 text-cover-deep hover:bg-cover/10'
            : 'btn btn-outline min-h-9 py-1 text-[14px]'
        }
      >
        {busy ? <LoaderCircle size={17} className="animate-spin" /> : <ImagePlus size={17} />}
        {!compact && 'แนบสลิป'}
      </button>
      <input ref={input} type="file" accept={SLIP_ACCEPT} multiple className="sr-only" tabIndex={-1} onChange={(e) => (attach([...e.target.files]), (e.target.value = ''))} />
    </>
  );
}

function Flags({ sale }) {
  return (
    <span className="flex flex-wrap gap-1">
      {!sale.slips.length && <span className="rounded-full bg-gold-soft px-2 text-[12px] font-semibold whitespace-nowrap text-gold-deep">ยังไม่มีสลิป</span>}
      {(sale.issues.length > 0 || sale.net === null) && (
        <span className="rounded-full bg-danger-soft px-2 text-[12px] font-semibold whitespace-nowrap text-danger" title={sale.issues.join(' · ')}>
          ตรวจข้อมูล
        </span>
      )}
      {sale.slipTotal !== null && sale.net !== null && Math.abs(sale.slipTotal - sale.net) > 0.5 && (
        <span className="rounded-full bg-danger-soft px-2 text-[12px] font-semibold whitespace-nowrap text-danger">
          สลิป{sale.slipTotal < sale.net ? 'ขาด' : 'เกิน'} {baht(Math.abs(sale.slipTotal - sale.net))}
        </span>
      )}
    </span>
  );
}

// ------------------------------------------------------------------ slip viewer
function Lightbox({ slips, index, onClose, onIndex }) {
  const slip = slips[index];
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && index < slips.length - 1) onIndex(index + 1);
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [index, slips.length, onClose, onIndex]);
  if (!slip) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`สลิป ${slip.file_name}`} className="fixed inset-0 z-50 grid grid-rows-[auto_1fr] bg-[rgb(8_24_38/0.92)] p-4 text-white" onClick={onClose}>
      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <span className="min-w-0 flex-1 truncate">
          {slip.file_name}
          {slip.amount !== null && <span className="num text-gold"> · {baht(slip.amount)} บาท</span>}
          {slips.length > 1 && <span className="num text-cover-mute"> · {index + 1}/{slips.length}</span>}
        </span>
        <a href={slip.url} target="_blank" rel="noreferrer" className="rounded-md px-3 py-1.5 text-sm font-semibold hover:bg-white/10">
          เปิดไฟล์
        </a>
        <button type="button" onClick={onClose} aria-label="ปิด" className="grid size-10 place-items-center rounded-md hover:bg-white/10">
          <X size={22} />
        </button>
      </div>
      <div className="relative grid min-h-0 place-items-center" onClick={(e) => e.stopPropagation()}>
        {slip.image ? (
          <img src={slip.url} alt={`สลิป ${slip.file_name}`} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
        ) : (
          <a href={slip.url} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-3 rounded-xl bg-white/10 px-10 py-8 hover:bg-white/15">
            <FileText size={44} className="text-gold" />
            เปิด {slip.file_name}
          </a>
        )}
        {index > 0 && (
          <button type="button" onClick={() => onIndex(index - 1)} aria-label="สลิปก่อนหน้า" className="absolute left-0 grid size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            <ChevronLeft size={26} />
          </button>
        )}
        {index < slips.length - 1 && (
          <button type="button" onClick={() => onIndex(index + 1)} aria-label="สลิปถัดไป" className="absolute right-0 grid size-12 place-items-center rounded-full bg-white/10 hover:bg-white/20">
            <ChevronRight size={26} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ------------------------------------------------------------------ editing
const blankItem = () => ({ name: '', sku: '', imei: '', qty: 1, price: '', discount: 0, amount: '' });

function SaleForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [f, setF] = useState(() => ({
    receipt_no: initial?.receipt_no || '',
    sale_date: initial?.sale_date || todayISO(),
    buyer: initial?.buyer || '',
    discount: initial?.discount ?? 0,
    net: initial?.net ?? '',
    items: initial?.items?.length ? initial.items.map((i) => ({ ...i, price: i.price ?? '', amount: i.amount ?? '' })) : [blankItem()],
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setItem = (i, k, v) =>
    setF((x) => {
      const items = x.items.map((it, n) => {
        if (n !== i) return it;
        const next = { ...it, [k]: v };
        // keep the line amount in step while typing qty / price / discount
        if (k !== 'amount' && k !== 'name' && String(next.price).trim() !== '') next.amount = Math.round(((toNum(next.qty) || 1) * toNum(next.price) - toNum(next.discount)) * 100) / 100;
        return next;
      });
      return { ...x, items };
    });
  const itemsSum = f.items.reduce((t, i) => t + toNum(i.amount), 0);
  const itemDisc = f.items.reduce((t, i) => t + toNum(i.discount), 0);
  const billDisc = Math.max(0, toNum(f.discount) - itemDisc);
  const expected = Math.round((itemsSum - billDisc) * 100) / 100;
  const mismatch = String(f.net).trim() !== '' && itemsSum > 0 && Math.abs(expected - toNum(f.net)) > 0.5;

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await onSubmit({ ...f, items: f.items.filter((i) => String(i.name).trim()) });
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_auto_1.3fr_130px_150px]">
        <label>
          <span className="label">เลขที่ใบเสร็จ</span>
          <input className="field num" value={f.receipt_no} onChange={(e) => set('receipt_no', e.target.value)} />
        </label>
        <div>
          <span className="label">วันที่ขาย</span>
          <DateField label="วันที่ขาย" value={f.sale_date} onChange={(v) => set('sale_date', v)} />
        </div>
        <label>
          <span className="label">ชื่อผู้ซื้อ</span>
          <input className="field" value={f.buyer} onChange={(e) => set('buyer', e.target.value)} />
        </label>
        <label>
          <span className="label">ส่วนลดรวม</span>
          <input className="field num text-right" inputMode="decimal" value={f.discount} onChange={(e) => set('discount', e.target.value)} />
        </label>
        <label>
          <span className="label">ยอดสุทธิ</span>
          <input className="field num text-right font-semibold" inputMode="decimal" value={f.net} onChange={(e) => set('net', e.target.value)} required />
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-seam bg-white">
        <table className="w-full min-w-[720px] text-[14px]">
          <thead className="bg-wash text-left text-[13px] text-mute">
            <tr>
              <th className="px-2 py-1.5 font-semibold">รายการสินค้า</th>
              <th className="w-20 px-2 py-1.5 text-right font-semibold">จำนวน</th>
              <th className="w-28 px-2 py-1.5 text-right font-semibold">ราคา/หน่วย</th>
              <th className="w-24 px-2 py-1.5 text-right font-semibold">ส่วนลด</th>
              <th className="w-28 px-2 py-1.5 text-right font-semibold">จำนวนเงิน</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {f.items.map((it, i) => (
              <tr key={i} className="border-t border-seam-soft">
                <td className="px-2 py-1">
                  <input className="field py-1" value={it.name} onChange={(e) => setItem(i, 'name', e.target.value)} aria-label={`ชื่อสินค้า แถว ${i + 1}`} placeholder="ชื่อสินค้า" />
                </td>
                {['qty', 'price', 'discount', 'amount'].map((k) => (
                  <td key={k} className="px-2 py-1">
                    <input className="field num py-1 text-right" inputMode="decimal" value={it[k]} onChange={(e) => setItem(i, k, e.target.value)} aria-label={`${k} แถว ${i + 1}`} />
                  </td>
                ))}
                <td className="px-1">
                  <button type="button" className="btn btn-ghost min-h-8 px-1.5 py-1" onClick={() => set('items', f.items.filter((_, n) => n !== i))} aria-label={`ลบแถว ${i + 1}`}>
                    <X size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-3 border-t border-seam-soft px-2 py-2">
          <button type="button" className="btn btn-ghost min-h-8 py-1 text-[14px]" onClick={() => set('items', [...f.items, blankItem()])}>
            <Plus size={16} />
            เพิ่มรายการ
          </button>
          <span className="num ml-auto text-sm text-mute">
            รวมรายการ {baht(itemsSum)}
            {billDisc > 0 && ` · หักส่วนลดท้ายบิล ${baht(billDisc)} = ${baht(expected)}`}
          </span>
          {mismatch && (
            <button type="button" className="text-sm font-semibold text-cover-deep underline" onClick={() => set('net', expected)}>
              ใช้ {baht(expected)} เป็นยอดสุทธิ
            </button>
          )}
        </div>
      </div>

      {error && <p role="alert" className="text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} />}
          {submitLabel}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          ยกเลิก
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ one receipt, opened
function SaleDetail({ sale, onChange, onDeleted, onView, onMoved }) {
  const { toast } = useStore();
  const [editing, setEditing] = useState(sale.issues.length > 0 || sale.net === null);
  const [confirm, setConfirm] = useState(false);

  const patchSlip = async (slip, value) => {
    try {
      onChange(await api.updateSlip(slip.id, { amount: value === '' ? null : value }));
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="grid gap-5 border-t border-seam-soft bg-wash/60 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0" aria-label={`รายละเอียด ${sale.receipt_no}`}>
        {sale.issues.length > 0 && (
          <p className="mb-3 flex items-start gap-2 rounded-lg border border-warn/30 bg-gold-soft px-3 py-2 text-[14px] text-warn">
            <TriangleAlert size={17} className="mt-0.5 shrink-0" />
            <span>อ่านใบเสร็จได้ไม่ครบ: {sale.issues.join(' · ')} ตรวจแล้วกดบันทึก</span>
          </p>
        )}
        {editing ? (
          <SaleForm
            initial={sale}
            submitLabel="บันทึก"
            onCancel={() => setEditing(false)}
            onSubmit={async (f) => {
              onChange(await api.updateSale(sale.id, f));
              setEditing(false);
              if (f.sale_date !== sale.sale_date) {
                // the bill now belongs to another day: open that day so it does not seem to vanish
                onMoved?.(f.sale_date);
                toast(`ย้าย ${f.receipt_no || 'บิลนี้'} ไปวันที่ ${thaiShort(f.sale_date)} แล้ว`, 'ok');
              } else toast(`บันทึก ${f.receipt_no || 'บิลนี้'} แล้ว`, 'ok');
            }}
          />
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-seam bg-white">
              <table className="w-full min-w-[620px] text-[14px]">
                <thead className="bg-wash text-left text-[13px] text-mute">
                  <tr>
                    <th className="w-10 px-3 py-1.5 text-center font-semibold">#</th>
                    <th className="px-3 py-1.5 font-semibold">รายการสินค้า</th>
                    <th className="w-16 px-3 py-1.5 text-right font-semibold">จำนวน</th>
                    <th className="w-28 px-3 py-1.5 text-right font-semibold">ราคา/หน่วย</th>
                    <th className="w-24 px-3 py-1.5 text-right font-semibold">ส่วนลด</th>
                    <th className="w-28 px-3 py-1.5 text-right font-semibold">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((i) => (
                    <tr key={i.id} className="border-t border-seam-soft align-top">
                      <td className="num px-3 py-1.5 text-center text-mute">{i.line}</td>
                      <td className="px-3 py-1.5">
                        {i.name}
                        {(i.sku || i.imei) && (
                          <span className="num block text-[13px] text-mute">
                            {[i.sku, i.imei && `IMEI ${i.imei}`].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </td>
                      <td className="num px-3 py-1.5 text-right">{qtyText(i.qty)}</td>
                      <td className="num px-3 py-1.5 text-right">{baht(i.price)}</td>
                      <td className="num px-3 py-1.5 text-right">{i.discount ? baht(i.discount) : <span className="text-faint">—</span>}</td>
                      <td className="num px-3 py-1.5 text-right">{baht(i.amount)}</td>
                    </tr>
                  ))}
                  {!sale.items.length && (
                    <tr>
                      <td colSpan={6} className="px-3 py-3 text-mute">ไม่มีรายการสินค้า กด "แก้ไข" เพื่อเพิ่ม</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="num border-t-2 border-seam text-right">
                  <tr>
                    <td colSpan={5} className="px-3 py-1 text-mute">ส่วนลดรวม</td>
                    <td className="px-3 py-1">{baht(sale.discount)}</td>
                  </tr>
                  <tr className="font-bold text-cover-deep">
                    <td colSpan={5} className="px-3 py-1.5">ยอดสุทธิ</td>
                    <td className="px-3 py-1.5">{baht(sale.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-outline min-h-9 py-1 text-[14px]" onClick={() => setEditing(true)}>
                <Pencil size={15} />
                แก้ไข
              </button>
              {sale.pdf_url && (
                <a className="btn btn-ghost min-h-9 py-1 text-[14px]" href={sale.pdf_url} target="_blank" rel="noreferrer">
                  <FileText size={15} />
                  เปิดใบเสร็จ
                </a>
              )}
              <span className="flex-1" />
              {confirm ? (
                <>
                  <span className="text-danger">ลบบิลนี้และสลิปทั้งหมด?</span>
                  <button
                    type="button"
                    className="btn btn-danger min-h-9 py-1"
                    onClick={async () => {
                      try {
                        await api.deleteSale(sale.id);
                        onDeleted(sale.id);
                        toast(`ลบ ${sale.receipt_no || 'บิล'} แล้ว`);
                      } catch (e) {
                        toast(e.message, 'error');
                      }
                    }}
                  >
                    ลบเลย
                  </button>
                  <button type="button" className="btn btn-ghost min-h-9 py-1" onClick={() => setConfirm(false)}>
                    ไม่ลบ
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn-ghost min-h-9 py-1 text-[14px]" onClick={() => setConfirm(true)}>
                  <Trash2 size={15} />
                  ลบบิล
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <aside aria-label="สลิปโอนเงิน" className="grid content-start gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-cover-deep">สลิปโอนเงิน</h3>
          <AttachSlip sale={sale} onChange={onChange} />
        </div>
        {sale.slips.length === 0 ? (
          <p className="rounded-lg border border-dashed border-seam bg-white/70 px-3 py-4 text-center text-[14px] text-mute">ยังไม่มีสลิป ลากรูปสลิปมาวางที่บิลนี้ หรือกด "แนบสลิป"</p>
        ) : (
          <ul className="grid gap-2">
            {sale.slips.map((sl, i) => (
              <li key={sl.id} className="flex items-center gap-3 rounded-lg border border-seam bg-white p-2">
                <SlipThumb slip={sl} size="lg" onOpen={() => onView(sale.slips, i)} />
                <div className="grid min-w-0 flex-1 gap-1.5">
                  <span className="truncate text-[13px] text-mute" title={sl.file_name}>{sl.file_name}</span>
                  <label className="flex items-center gap-2 text-[13px] whitespace-nowrap text-mute">
                    ยอดในสลิป
                    <input
                      className="field num w-24 py-1 text-right text-[14px]"
                      inputMode="decimal"
                      defaultValue={sl.amount ?? ''}
                      placeholder="ไม่ระบุ"
                      onBlur={(e) => String(e.target.value) !== String(sl.amount ?? '') && patchSlip(sl, e.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost min-h-8 self-start px-1.5 py-1"
                  aria-label={`ลบสลิป ${sl.file_name}`}
                  onClick={async () => {
                    try {
                      onChange(await api.deleteSlip(sl.id));
                    } catch (e) {
                      toast(e.message, 'error');
                    }
                  }}
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {sale.slipTotal !== null && (
          <p className="num text-[14px]">
            สลิปรวม {baht(sale.slipTotal)} · ยอดสุทธิ {baht(sale.net)}{' '}
            {Math.abs(sale.slipTotal - (sale.net || 0)) <= 0.5 ? <span className="font-semibold text-ok">ตรงกัน</span> : <span className="font-semibold text-danger">ไม่ตรง</span>}
          </p>
        )}
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ a day
function DaySection({ day, isToday, open, onToggle, fresh, onChange, onDeleted, onView, onPrint, onSlipDrop, onMoved }) {
  const [openRows, setOpenRows] = useState(() => new Set());
  const [over, setOver] = useState(null);
  const t = day.totals;
  const toggleRow = (id) =>
    setOpenRows((o) => {
      const n = new Set(o);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const rowDrop = (s) => ({
    onDragOver: (e) => {
      if (!e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.stopPropagation();
      setOver(s.id);
    },
    onDragLeave: () => setOver(null),
    onDrop: (e) => {
      const files = [...e.dataTransfer.files];
      setOver(null);
      if (files.some(isPdf)) return; // a receipt (new bill): let the page handle it
      e.preventDefault();
      e.stopPropagation();
      setOver(null);
      onSlipDrop(s, files);
    },
  });

  return (
    <section className="leaf overflow-hidden" aria-label={`ยอดขาย ${thaiDayHeading(day.date)}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:px-4">
        <button type="button" onClick={onToggle} aria-expanded={open} className="group flex min-w-0 grow basis-full flex-wrap items-center gap-x-3 gap-y-1 text-left lg:basis-0">
          <ChevronRight size={20} className={['shrink-0 text-mute transition-transform group-hover:text-ink', open ? 'rotate-90' : ''].join(' ')} />
          <span className="stamp text-[15px]">{thaiDayHeading(day.date)}</span>
          <span className="num text-sm text-mute">
            {num(t.bills)} บิล · {qtyText(t.qty)} ชิ้น
            {t.noSlip > 0 && <span className="text-gold-deep"> · ไม่มีสลิป {t.noSlip}</span>}
          </span>
        </button>
        <span className="num text-right max-lg:mr-auto max-lg:pl-8 max-lg:text-left">
          <span className="block text-[12px] text-mute">ยอดสุทธิ</span>
          <span className="text-[20px] leading-tight font-bold text-cover-deep">฿{baht(t.net)}</span>
        </span>
        <span className="flex items-center gap-1.5" role="group" aria-label={`ส่งออก ${thaiShort(day.date)}`}>
          <a className="btn btn-primary min-h-9 px-3 py-1 text-[14px]" href={api.dayExportUrl(day.date, 'xlsx')} download>
            <FileSpreadsheet size={16} />
            Excel
          </a>
          <a className="btn btn-outline min-h-9 px-3 py-1 text-[14px]" href={api.dayExportUrl(day.date, 'csv')} download>
            CSV
          </a>
          <button type="button" className="btn btn-outline min-h-9 px-3 py-1 text-[14px]" onClick={() => onPrint(day)} title="เปิดหน้าพิมพ์ เลือก บันทึกเป็น PDF">
            <Printer size={15} />
            PDF
          </button>
        </span>
      </div>

      {open && (
        <>
          <div className="hidden overflow-x-auto border-t border-seam-soft md:block">
            <table className="w-full min-w-[900px] text-[15px]">
              <thead className="bg-wash text-left text-sm text-mute">
                <tr>
                  <th className="w-10" aria-label="เปิดรายละเอียด" />
                  <th className="w-16 px-2 py-2 font-semibold">เวลา</th>
                  <th className="px-3 py-2 font-semibold">ใบเสร็จ / ผู้ซื้อ</th>
                  <th className="px-3 py-2 font-semibold">รายการ</th>
                  <th className="w-28 px-3 py-2 text-right font-semibold">ส่วนลด</th>
                  <th className="w-32 px-3 py-2 text-right font-semibold">ยอดสุทธิ</th>
                  <th className="w-[190px] px-3 py-2 font-semibold">สลิป</th>
                </tr>
              </thead>
              <tbody>
                {day.sales.map((s, i) => {
                  const isOpen = openRows.has(s.id);
                  return (
                    <Fragment key={s.id}>
                      <tr
                        {...rowDrop(s)}
                        style={{ '--row': i }}
                        className={['border-t border-seam-soft align-top', fresh.has(s.id) ? 'printing' : '', over === s.id ? 'bg-gold-soft' : isOpen ? 'bg-wash/60' : 'hover:bg-wash/40'].join(' ')}
                      >
                        <td className="py-2.5 pl-2">
                          <button
                            type="button"
                            onClick={() => toggleRow(s.id)}
                            aria-expanded={isOpen}
                            aria-label={isOpen ? `ซ่อน ${s.receipt_no}` : `ดูรายละเอียด ${s.receipt_no}`}
                            className="grid size-8 place-items-center rounded-md text-mute hover:bg-wash-deep hover:text-ink"
                          >
                            <ChevronRight size={18} className={['transition-transform', isOpen ? 'rotate-90' : ''].join(' ')} />
                          </button>
                        </td>
                        <td className="num px-2 py-3 text-mute">{s.time}</td>
                        <td className="px-3 py-2.5">
                          <button type="button" onClick={() => toggleRow(s.id)} className="num text-left font-semibold whitespace-nowrap text-cover-deep hover:underline">
                            {s.receipt_no || 'ไม่มีเลขที่'}
                          </button>
                          <span className="block text-[14px]">{s.buyer || <span className="text-faint">ไม่ระบุผู้ซื้อ</span>}</span>
                          <Flags sale={s} />
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="line-clamp-2 text-[14px]" title={s.items.map((x) => `${x.name} ×${x.qty}`).join('\n')}>
                            {s.items.length ? s.items.map((x) => (x.qty > 1 ? `${x.name} ×${qtyText(x.qty)}` : x.name)).join(', ') : <span className="text-faint">—</span>}
                          </span>
                          <span className="num text-[13px] text-mute">{qtyText(s.qty)} ชิ้น</span>
                        </td>
                        <td className="num px-3 py-3 text-right">{s.discount ? baht(s.discount) : <span className="text-faint">—</span>}</td>
                        <td className="num px-3 py-3 text-right font-bold">{baht(s.net)}</td>
                        <td className="px-3 py-2">
                          <span className="flex flex-wrap items-center gap-1.5">
                            {s.slips.slice(0, 3).map((sl, n) => (
                              <SlipThumb key={sl.id} slip={sl} onOpen={() => onView(s.slips, n)} />
                            ))}
                            {s.slips.length > 3 && <span className="num text-sm text-mute">+{s.slips.length - 3}</span>}
                            <AttachSlip sale={s} onChange={onChange} compact />
                          </span>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <SaleDetail sale={s} onChange={onChange} onDeleted={onDeleted} onView={onView} onMoved={onMoved} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="border-t border-seam-soft md:hidden">
            {day.sales.map((s) => (
              <li key={s.id} {...rowDrop(s)} className={['border-t border-seam-soft first:border-t-0', fresh.has(s.id) ? 'printing card-print' : '', over === s.id ? 'bg-gold-soft' : ''].join(' ')}>
                <div className="grid gap-2 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <button type="button" onClick={() => toggleRow(s.id)} className="num font-semibold text-cover-deep underline">
                        {s.receipt_no || 'ไม่มีเลขที่'}
                      </button>
                      <span className="num text-sm text-mute"> · {s.time}</span>
                      <span className="block">{s.buyer || <span className="text-faint">ไม่ระบุผู้ซื้อ</span>}</span>
                    </div>
                    <span className="num text-right font-bold text-cover-deep">฿{baht(s.net)}</span>
                  </div>
                  <span className="line-clamp-2 text-[14px] text-mute">{s.items.map((x) => x.name).join(', ')}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {s.slips.map((sl, n) => (
                      <SlipThumb key={sl.id} slip={sl} onOpen={() => onView(s.slips, n)} />
                    ))}
                    <AttachSlip sale={s} onChange={onChange} compact />
                    <Flags sale={s} />
                  </div>
                </div>
                {openRows.has(s.id) && <SaleDetail sale={s} onChange={onChange} onDeleted={onDeleted} onView={onView} onMoved={onMoved} />}
              </li>
            ))}
          </ul>

          <div className="num flex flex-wrap justify-between gap-2 border-t-2 border-cover-deep bg-wash px-4 py-2.5 font-bold text-cover-deep">
            <span>
              รวม {num(t.bills)} บิล · {qtyText(t.qty)} ชิ้น
              {t.discount > 0 && <span className="font-semibold text-mute"> · ส่วนลด {baht(t.discount)}</span>}
            </span>
            <span>ยอดสุทธิ ฿{baht(t.net)}</span>
          </div>
        </>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ print (PDF)
function PrintDay({ day }) {
  if (!day) return null;
  const t = day.totals;
  const H = ['#', 'เวลา', 'เลขที่ใบเสร็จ', 'ชื่อผู้ซื้อ', 'รายการสินค้า', 'จำนวน', 'ราคา/หน่วย', 'ส่วนลด', 'จำนวนเงิน', 'ยอดสุทธิ', 'สลิป'];
  const cell = (i) => ({ padding: '3px 6px', textAlign: i >= 5 && i <= 9 ? 'right' : 'left', border: '1px solid #DCE3E3', verticalAlign: 'top', fontVariantNumeric: 'tabular-nums' });
  const be = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${Number(y) + 543}`;
  };
  return createPortal(
    <div className="print-only" style={{ fontFamily: 'Anuphan, Tahoma, sans-serif', color: '#1D1416' }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#005A9C', margin: '0 0 6px' }}>สรุปยอดขายประจำวันที่ {be(day.date)}</h1>
      <p style={{ margin: '0 0 10px', fontSize: 12 }}>
        จำนวนบิล <b>{t.bills}</b> · จำนวนชิ้น <b>{qtyText(t.qty)}</b> · ส่วนลดรวม <b>{baht(t.discount)}</b> · <span style={{ background: '#FFCC00', padding: '1px 6px' }}>ยอดสุทธิรวม <b>{baht(t.net)}</b></span>
      </p>
      <table>
        <thead>
          <tr>
            {H.map((h, i) => (
              <th key={h} style={{ padding: '5px 6px', textAlign: i >= 5 && i <= 9 ? 'right' : 'left', border: '1px solid #C9D3D3' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {day.sales.map((s, n) => {
            const itemDisc = s.items.reduce((x, i) => x + (i.discount || 0), 0);
            const billDisc = Math.round((s.discount - itemDisc) * 100) / 100;
            const lines = [...s.items.map((i) => ({ name: i.imei ? `${i.name} (${i.imei})` : i.name, qty: qtyText(i.qty), price: baht(i.price), disc: i.discount ? baht(i.discount) : '', amount: baht(i.amount) }))];
            if (billDisc > 0.005) lines.push({ name: 'ส่วนลดท้ายบิล', qty: '', price: '', disc: baht(billDisc), amount: baht(-billDisc) });
            if (!lines.length) lines.push({ name: '(ไม่มีรายการ)', qty: '', price: '', disc: '', amount: baht(s.net) });
            return lines.map((l, i) => (
              <tr key={`${s.id}-${i}`} style={{ background: n % 2 ? '#F4F7F7' : undefined }}>
                {[i ? '' : n + 1, i ? '' : s.time, i ? '' : s.receipt_no, i ? '' : s.buyer, l.name, l.qty, l.price, l.disc, l.amount, i ? '' : baht(s.net), i ? '' : s.slips.length ? `${s.slips.length} รูป` : 'ไม่มีสลิป'].map((v, c) => (
                  <td key={c} style={{ ...cell(c), fontWeight: c === 9 ? 700 : 400 }}>{v}</td>
                ))}
              </tr>
            ));
          })}
          <tr style={{ fontWeight: 700, color: '#005A9C' }}>
            <td colSpan={5} style={{ ...cell(0), borderTop: '2px solid #005A9C' }}>รวม {t.bills} บิล</td>
            <td style={{ ...cell(5), borderTop: '2px solid #005A9C' }}>{qtyText(t.qty)}</td>
            <td style={{ ...cell(6), borderTop: '2px solid #005A9C' }} />
            <td style={{ ...cell(7), borderTop: '2px solid #005A9C' }}>{baht(t.discount)}</td>
            <td style={{ ...cell(8), borderTop: '2px solid #005A9C' }}>{baht(t.net)}</td>
            <td style={{ ...cell(9), borderTop: '2px solid #005A9C' }}>{baht(t.net)}</td>
            <td style={{ ...cell(10), borderTop: '2px solid #005A9C' }}>{t.noSlip ? `ไม่มีสลิป ${t.noSlip}` : 'ครบ'}</td>
          </tr>
        </tbody>
      </table>
    </div>,
    document.body,
  );
}

// ------------------------------------------------------------------ page
export default function SalesPage() {
  const { toast, reloadSalesToday } = useStore();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [openDays, setOpenDays] = useState(readOpen);
  const [fresh, setFresh] = useState(() => new Set());
  const [viewer, setViewer] = useState(null);
  const [printDay, setPrintDay] = useState(null);
  const input = useRef();

  const load = useCallback(async () => {
    try {
      const d = await api.sales();
      setData(d);
      return d;
    } catch (e) {
      toast(e.message, 'error');
      return null;
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!fresh.size) return;
    const t = setTimeout(() => setFresh(new Set()), 4000);
    return () => clearTimeout(t);
  }, [fresh]);

  useEffect(() => {
    if (!printDay) return;
    const prev = document.title;
    document.title = `สรุปยอดขาย ${printDay.date}`;
    const t = setTimeout(() => {
      window.print();
      document.title = prev;
      setPrintDay(null);
    }, 50);
    return () => clearTimeout(t);
  }, [printDay]);

  const today = data?.today || todayISO();
  const isOpen = (date) => openDays[date] ?? date === today;
  const toggleDay = (date) => {
    const next = { ...openDays, [date]: !isOpen(date) };
    setOpenDays(next);
    writeOpen(next);
  };

  const refresh = useCallback(async (freshIds) => {
    await load();
    if (freshIds?.length) setFresh(new Set(freshIds));
    reloadSalesToday();
  }, [load, reloadSalesToday]);

  // keep the edited receipt where it is; reload totals and day order quietly
  const replace = useCallback(() => {
    load();
    reloadSalesToday();
  }, [load, reloadSalesToday]);

  async function attachTo(sale, images) {
    try {
      await api.addSlips(sale.id, images);
      toast(`แนบสลิป ${images.length} ไฟล์กับ ${sale.receipt_no || 'บิลล่าสุด'} แล้ว`, 'ok');
      refresh([sale.id]);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function onFiles(list) {
    const files = [...list];
    const pdfs = files.filter(isPdf);
    const images = files.filter((f) => !isPdf(f) && isImage(f));
    if (!pdfs.length && !images.length) {
      toast('ใช้ได้เฉพาะใบเสร็จ (.pdf) และรูปสลิป (.jpg .png .webp .heic)', 'error');
      return;
    }
    if (!pdfs.length) {
      // slips alone go to the newest receipt still waiting for one
      const waiting = (data?.days || []).flatMap((d) => d.sales).filter((s) => !s.slips.length).sort((a, b) => b.id - a.id)[0];
      if (!waiting) {
        toast('ไม่มีบิลที่รอสลิป วางใบเสร็จ PDF พร้อมสลิป หรือกดปุ่มแนบสลิปที่บิล', 'error');
        return;
      }
      attachTo(waiting, images);
      return;
    }
    setBusy(true);
    try {
      const r = await api.uploadSales(files);
      const parts = [];
      for (const s of r.created) parts.push(`${s.receipt_no || 'บิลใหม่'} ฿${baht(s.net)}`);
      if (r.slips) parts.push(`แนบสลิป ${r.slips} รูป`);
      if (r.unattached) parts.push(`สลิป ${r.unattached} รูปยังไม่ได้แนบ (วางหลายใบเสร็จพร้อมกัน) กดแนบที่บิลเอง`);
      if (r.duplicates.length) parts.push(`ข้าม ${r.duplicates.join(', ')} ที่มีอยู่แล้ว`);
      const needCheck = r.created.filter((s) => s.issues.length || s.net === null).length;
      if (needCheck) parts.push(`${needCheck} บิลอ่านได้ไม่ครบ กดเปิดเพื่อตรวจ`);
      toast(`เพิ่ม ${parts.join(' · ')}`, needCheck || r.unattached ? 'info' : 'ok');
      const dates = [...new Set(r.created.map((s) => s.sale_date))];
      if (dates.length) {
        const next = { ...openDays };
        for (const d of dates) next[d] = true;
        setOpenDays(next);
        writeOpen(next);
      }
      refresh(r.created.map((s) => s.id));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const pageDrop = {
    onDragEnter: (e) => e.dataTransfer.types.includes('Files') && setDragging(true),
    onDragOver: (e) => e.preventDefault(),
    onDrop: (e) => {
      e.preventDefault();
      setDragging(false);
      onFiles(e.dataTransfer.files);
    },
  };

  const todayData = data?.days.find((d) => d.date === today);
  const tt = todayData?.totals;

  return (
    <div className="relative mx-auto max-w-[1600px]" {...pageDrop}>
      {dragging && (
        <div
          className="fixed inset-0 z-40 grid place-items-center bg-cover-deep/90 p-6 backdrop-blur-[2px]"
          onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
          onDragOver={(e) => e.preventDefault()}
          /* no onDrop here: the drop bubbles to the page, which handles it once (a handler here too uploaded every file twice) */
        >
          <div className="pointer-events-none flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-gold px-12 py-10 text-center text-white">
            <FileUp size={40} className="text-gold" />
            <p className="font-stamp text-2xl font-bold">วางใบเสร็จกับสลิป</p>
            <p className="max-w-sm text-cover-mute">ใบเสร็จ 1 ใบ (.pdf) พร้อมรูปสลิปของบิลนั้น หรือวางสลิปอย่างเดียวเพื่อแนบกับบิลล่าสุดที่ยังไม่มีสลิป</p>
          </div>
        </div>
      )}

      <PageHeader title="สรุปยอดรายวัน" stamp={thaiShort(today)} sub="ใบเสร็จ + สลิปโอนเงิน · รวมยอดขายทุกวัน">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => input.current.click()}>
          {busy ? <LoaderCircle size={18} className="animate-spin" /> : <FileUp size={18} />}
          {busy ? 'กำลังอ่านใบเสร็จ…' : 'เพิ่มบิล'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setAdding(true)} disabled={adding}>
          <Plus size={18} />
          กรอกเอง
        </button>
        <input ref={input} type="file" accept={`.pdf,${SLIP_ACCEPT}`} multiple className="sr-only" tabIndex={-1} onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />
      </PageHeader>

      {adding && (
        <section className="leaf rise mb-5 p-4" aria-label="กรอกบิลเอง">
          <h2 className="mb-3 font-stamp text-[17px] font-bold text-cover-deep">กรอกบิลเอง</h2>
          <SaleForm
            submitLabel="เพิ่มบิล"
            onCancel={() => setAdding(false)}
            onSubmit={async (f) => {
              const s = await api.createSale(f);
              setAdding(false);
              toast(`เพิ่ม ${s.receipt_no || 'บิล'} ฿${baht(s.net)} แล้ว`, 'ok');
              refresh([s.id]);
            }}
          />
        </section>
      )}

      {data && (
        <Strip
          cells={[
            { label: 'บิลวันนี้', value: num(tt?.bills || 0) },
            { label: 'ขายวันนี้ (ชิ้น)', value: qtyText(tt?.qty || 0) },
            { label: 'ส่วนลดวันนี้', value: baht(tt?.discount || 0) },
            { label: 'ยอดสุทธิวันนี้', value: `฿${baht(tt?.net || 0)}`, tone: 'cover' },
          ]}
          verdict={
            !tt ? (
              <span className="text-mute">วันนี้ยังไม่มีบิล ลากใบเสร็จกับสลิปมาวางได้เลย</span>
            ) : tt.issues > 0 ? (
              <>
                <TriangleAlert size={22} className="shrink-0 text-danger" />
                <span className="font-semibold text-danger">{tt.issues} บิลอ่านได้ไม่ครบ เปิดบิลเพื่อตรวจ</span>
              </>
            ) : tt.noSlip > 0 ? (
              <>
                <TriangleAlert size={22} className="shrink-0 text-warn" />
                <span>
                  <span className="block font-semibold text-warn">อีก {tt.noSlip} บิลยังไม่มีสลิป</span>
                  <span className="text-sm text-mute">ลากรูปสลิปมาวางที่บิลนั้น</span>
                </span>
              </>
            ) : (
              <>
                <CircleCheck size={22} className="shrink-0 text-ok" />
                <span className="font-semibold text-ok">ทุกบิลวันนี้มีสลิปครบ</span>
              </>
            )
          }
        />
      )}

      {!data ? (
        <div className="leaf h-64 animate-pulse bg-white/60" aria-busy="true" />
      ) : data.days.length === 0 ? (
        <button
          type="button"
          onClick={() => input.current.click()}
          className="flex w-full flex-col items-center gap-4 rounded-[10px] border-2 border-dashed border-seam bg-leaf px-6 py-14 text-center transition-colors hover:border-cover-deep"
        >
          <span className="grid size-14 place-items-center rounded-full bg-cover text-gold">
            <ReceiptText size={26} />
          </span>
          <span>
            <span className="block font-stamp text-xl font-bold text-cover-deep">ลากใบเสร็จ (PDF) กับสลิปโอนเงินมาวางที่นี่</span>
            <span className="mt-1 block text-mute">วาง 1 ใบเสร็จพร้อมรูปสลิปของบิลนั้น ระบบอ่านเลขที่ ผู้ซื้อ รายการ ส่วนลด และยอดสุทธิให้เอง</span>
          </span>
        </button>
      ) : (
        <div className="grid gap-4">
          {data.days.map((d) => (
            <DaySection
              key={d.date}
              day={d}
              isToday={d.date === today}
              open={isOpen(d.date)}
              onToggle={() => toggleDay(d.date)}
              fresh={fresh}
              onChange={replace}
              onDeleted={replace}
              onView={(slips, index) => setViewer({ slips, index })}
              onPrint={setPrintDay}
              onMoved={(date) => {
                const next = { ...openDays, [date]: true };
                setOpenDays(next);
                writeOpen(next);
              }}
              onSlipDrop={(sale, files) => {
                const images = files.filter((f) => isImage(f) || isPdf(f));
                if (images.length) attachTo(sale, images);
              }}
            />
          ))}
        </div>
      )}

      {viewer && <Lightbox slips={viewer.slips} index={viewer.index} onClose={() => setViewer(null)} onIndex={(index) => setViewer((v) => ({ ...v, index }))} />}
      <PrintDay day={printDay} />
    </div>
  );
}
