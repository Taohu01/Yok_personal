import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CircleDashed,
  Clock3,
  PenLine,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
  FilterX,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { duration, thaiDayHeading, thaiShort, todayISO } from '../lib/thai.js';
import { PageHeader, SearchBox, Segmented } from '../components/ui.jsx';

const PRIORITY = {
  high: { label: 'สูง', cls: 'bg-cover text-cover-ink border-cover' },
  mid: { label: 'กลาง', cls: 'bg-white text-cover-deep border-cover-deep/45' },
  low: { label: 'ต่ำ', cls: 'bg-wash text-mute border-seam' },
};
const BASE_TAGS = ['สต๊อก', 'ราคา', 'โอนสินค้า', 'ลูกค้า', 'เอกสาร'];

const emptyDraft = () => ({
  title: '',
  detail: '',
  work_date: todayISO(),
  status: 'doing',
  priority: 'mid',
  minutes: 0,
  tags: [],
});

// ------------------------------------------------------------------ form
function TagInput({ value, onChange, suggestions }) {
  const [text, setText] = useState('');
  const add = (t) => {
    const v = t.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setText('');
  };
  const rest = suggestions.filter((s) => !value.includes(s)).slice(0, 10);
  return (
    <div>
      <div className="field flex min-h-[42px] flex-wrap items-center gap-1.5 py-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-md bg-wash px-2 py-0.5 text-sm">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="rounded text-faint hover:text-danger" aria-label={`ลบแท็ก ${t}`}>
              <X size={14} />
            </button>
          </span>
        ))}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => text && add(text)}
          placeholder={value.length ? '' : 'พิมพ์แล้วกด Enter เช่น สาขาโคราช'}
          className="min-w-32 flex-1 bg-transparent py-0.5 outline-none placeholder:text-faint"
          aria-label="เพิ่มแท็ก"
        />
      </div>
      {rest.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {rest.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-md border border-dashed border-seam px-2 py-0.5 text-sm text-mute hover:border-cover-deep hover:text-cover-deep">
              <Plus size={13} className="-ml-0.5 inline align-[-1px]" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CardForm({ initial, onSubmit, onCancel, submitLabel, suggestions, autoFocus }) {
  const [d, setD] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const hours = Math.floor(d.minutes / 60);
  const mins = d.minutes % 60;

  async function submit(e) {
    e.preventDefault();
    if (!d.title.trim()) {
      setError('ใส่หัวข้องานก่อนบันทึก');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSubmit(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e);
        if (e.key === 'Escape' && onCancel) onCancel();
      }}
      className="grid gap-4"
    >
      <div>
        <label className="label" htmlFor="card-title">
          ทำอะไร
        </label>
        <input
          id="card-title"
          autoFocus={autoFocus}
          value={d.title}
          onChange={(e) => set('title')(e.target.value)}
          className="field text-[16px] font-semibold placeholder:font-normal"
          placeholder="เช่น สรุปสต๊อกออฟฟิศ ส่งหัวหน้า"
          maxLength={200}
          aria-invalid={!!error && !d.title.trim()}
        />
      </div>
      <div>
        <label className="label" htmlFor="card-detail">
          รายละเอียด
        </label>
        <textarea
          id="card-detail"
          value={d.detail}
          onChange={(e) => set('detail')(e.target.value)}
          rows={3}
          className="field resize-y"
          placeholder="ทำไปถึงไหน ต้องตามต่ออะไร"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[auto_auto_auto_1fr]">
        <div>
          <label className="label" htmlFor="card-date">
            วันที่
          </label>
          <input id="card-date" type="date" value={d.work_date} onChange={(e) => set('work_date')(e.target.value)} className="field w-auto" required />
        </div>
        <div>
          <span className="label">สถานะ</span>
          <Segmented
            label="สถานะ"
            value={d.status}
            onChange={set('status')}
            options={[
              { value: 'doing', label: 'กำลังทำ', icon: CircleDashed },
              { value: 'done', label: 'เสร็จแล้ว', icon: Check },
            ]}
          />
        </div>
        <div>
          <span className="label">ความสำคัญ</span>
          <Segmented
            label="ความสำคัญ"
            value={d.priority}
            onChange={set('priority')}
            options={[
              { value: 'high', label: 'สูง' },
              { value: 'mid', label: 'กลาง' },
              { value: 'low', label: 'ต่ำ' },
            ]}
          />
        </div>
        <div>
          <span className="label">เวลาที่ใช้</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                max="999"
                inputMode="numeric"
                value={hours || ''}
                placeholder="0"
                onChange={(e) => set('minutes')(Math.max(0, Number(e.target.value) || 0) * 60 + mins)}
                className="field num w-16 text-right"
                aria-label="ชั่วโมง"
              />
              <span className="text-sm text-mute">ชม.</span>
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                max="59"
                inputMode="numeric"
                value={mins || ''}
                placeholder="0"
                onChange={(e) => set('minutes')(hours * 60 + Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
                className="field num w-16 text-right"
                aria-label="นาที"
              />
              <span className="text-sm text-mute">นาที</span>
            </label>
            {[15, 30, 60].map((m) => (
              <button key={m} type="button" onClick={() => set('minutes')(d.minutes + m)} className="rounded-md border border-seam bg-white px-2 py-1 text-sm text-mute hover:border-cover-deep hover:text-cover-deep">
                +{m === 60 ? '1 ชม.' : `${m}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <span className="label">หมวด / แท็ก</span>
        <TagInput value={d.tags} onChange={set('tags')} suggestions={suggestions} />
      </div>

      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <Check size={18} />
          {busy ? 'กำลังบันทึก…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            ยกเลิก
          </button>
        )}
        <span className="ml-auto hidden text-sm text-faint sm:inline">Ctrl + Enter เพื่อบันทึก</span>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ card
function WorkCard({ card, fresh, editing, onEdit, onCancelEdit, onSave, onToggle, onDelete, suggestions }) {
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef();
  useEffect(() => () => clearTimeout(timer.current), []);
  const done = card.status === 'done';
  const long = card.detail.length > 160 || card.detail.split('\n').length > 3;

  if (editing) {
    return (
      <article className="leaf p-5 ring-3 ring-gold md:col-span-2 2xl:col-span-3">
        <CardForm
          initial={{ ...card }}
          onSubmit={onSave}
          onCancel={onCancelEdit}
          submitLabel="บันทึกการแก้ไข"
          suggestions={suggestions}
          autoFocus
        />
      </article>
    );
  }

  return (
    <article className={['leaf flex flex-col gap-2.5 p-4', fresh ? 'printing card-print' : ''].join(' ')} aria-label={card.title}>
      <div className="flex items-center justify-between gap-3">
        <span className={['rounded-md border px-2 py-px text-[13px] font-semibold', PRIORITY[card.priority].cls].join(' ')}>
          สำคัญ{PRIORITY[card.priority].label}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={done}
          title={done ? 'กดเพื่อกลับเป็นกำลังทำ' : 'กดเมื่อทำเสร็จ'}
          className={[
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-semibold transition-colors',
            done
              ? 'border-ok/30 bg-ok-soft text-ok hover:border-ok'
              : 'border-warn/30 bg-gold-soft text-warn hover:border-warn',
          ].join(' ')}
        >
          {done ? <Check size={14} strokeWidth={2.6} /> : <CircleDashed size={14} />}
          {done ? 'เสร็จแล้ว' : 'กำลังทำ'}
        </button>
      </div>

      <h3 className={['text-[16px] leading-snug font-semibold text-pretty', done ? 'text-mute' : 'text-ink'].join(' ')}>{card.title}</h3>

      {card.detail && (
        <div>
          <p className={['text-[15px] whitespace-pre-line text-mute', !open && long ? 'line-clamp-3' : ''].join(' ')}>{card.detail}</p>
          {long && (
            <button type="button" onClick={() => setOpen(!open)} className="mt-1 text-sm font-semibold text-cover-deep underline">
              {open ? 'ย่อ' : 'อ่านต่อ'}
            </button>
          )}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-seam-soft pt-2.5 text-[13px] text-mute">
        {card.tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1">
            <Tag size={13} className="text-faint" />
            {t}
          </span>
        ))}
        {card.minutes > 0 && (
          <span className="num inline-flex items-center gap-1">
            <Clock3 size={13} className="text-faint" />
            {duration(card.minutes)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onEdit} className="btn btn-ghost min-h-8 px-2 py-1 text-[13px]" aria-label={`แก้ไข ${card.title}`}>
            <PenLine size={15} />
            แก้ไข
          </button>
          <span className="mx-1.5 h-5 w-px bg-seam" aria-hidden="true" />
          {confirming ? (
            <button
              type="button"
              autoFocus
              onClick={onDelete}
              onBlur={() => setConfirming(false)}
              className="btn min-h-8 bg-danger px-2.5 py-1 text-[13px] text-white"
            >
              ยืนยันลบ
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setConfirming(true);
                clearTimeout(timer.current);
                timer.current = setTimeout(() => setConfirming(false), 4000);
              }}
              className="btn btn-danger min-h-8 px-2 py-1"
              aria-label={`ลบ ${card.title}`}
              title="ลบการ์ด"
            >
              <Trash2 size={15} />
            </button>
          )}
        </span>
      </div>
    </article>
  );
}

// ------------------------------------------------------------------ page
export default function CardsPage() {
  const { cards, setCards, imports, toast } = useStore();
  const [composing, setComposing] = useState(() => new URLSearchParams(location.search).has('new'));
  const [editingId, setEditingId] = useState(null);
  const [freshId, setFreshId] = useState(null);
  const [status, setStatus] = useState('all');
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');

  const suggestions = useMemo(() => {
    const counts = new Map();
    for (const c of cards || []) for (const t of c.tags) counts.set(t, (counts.get(t) || 0) + 1);
    const used = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    const branches = (imports?.[0]?.branches || '')
      .split('·')
      .map((s) => s.split(' ลีโฟน ')[0].trim())
      .filter((s) => s && s.length <= 28);
    return [...new Set([...used, ...BASE_TAGS, ...branches])];
  }, [cards, imports]);

  const topTags = useMemo(() => {
    const counts = new Map();
    for (const c of cards || []) for (const t of c.tags) counts.set(t, (counts.get(t) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [cards]);

  const stats = useMemo(() => {
    const list = cards || [];
    const today = todayISO();
    const weekAgo = todayISO(new Date(Date.now() - 6 * 86400000));
    return {
      doing: list.filter((c) => c.status === 'doing').length,
      doneToday: list.filter((c) => c.status === 'done' && c.work_date === today).length,
      minToday: list.filter((c) => c.work_date === today).reduce((s, c) => s + c.minutes, 0),
      minWeek: list.filter((c) => c.work_date >= weekAgo && c.work_date <= today).reduce((s, c) => s + c.minutes, 0),
      done: list.filter((c) => c.status === 'done').length,
    };
  }, [cards]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (cards || []).filter(
      (c) =>
        (status === 'all' || c.status === status) &&
        (!tag || c.tags.includes(tag)) &&
        (!needle || `${c.title} ${c.detail} ${c.tags.join(' ')}`.toLowerCase().includes(needle)),
    );
  }, [cards, status, tag, q]);

  const days = useMemo(() => {
    const m = new Map();
    for (const c of filtered) {
      if (!m.has(c.work_date)) m.set(c.work_date, []);
      m.get(c.work_date).push(c);
    }
    return [...m.entries()];
  }, [filtered]);

  async function create(d) {
    const card = await api.createCard(d);
    setCards((list) => [card, ...(list || [])].sort((a, b) => (a.work_date < b.work_date ? 1 : a.work_date > b.work_date ? -1 : b.id - a.id)));
    setFreshId(card.id);
    setComposing(false);
    toast(`บันทึก "${card.title}" แล้ว`, 'ok');
  }

  async function save(id, d) {
    const card = await api.updateCard(id, d);
    setCards((list) => list.map((c) => (c.id === id ? card : c)).sort((a, b) => (a.work_date < b.work_date ? 1 : a.work_date > b.work_date ? -1 : b.id - a.id)));
    setEditingId(null);
    toast('แก้ไขการ์ดแล้ว', 'ok');
  }

  async function toggle(card) {
    const next = card.status === 'done' ? 'doing' : 'done';
    setCards((list) => list.map((c) => (c.id === card.id ? { ...c, status: next } : c)));
    try {
      await api.updateCard(card.id, { status: next });
    } catch (e) {
      setCards((list) => list.map((c) => (c.id === card.id ? { ...c, status: card.status } : c)));
      toast(e.message, 'error');
    }
  }

  async function remove(card) {
    try {
      await api.deleteCard(card.id);
      setCards((list) => list.filter((c) => c.id !== card.id));
      toast(`ลบ "${card.title}" แล้ว`);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const filtersOn = status !== 'all' || tag || q;

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader title="การ์ดงาน" stamp={thaiShort(todayISO())} sub="จดงานที่ทำไปแล้วและงานที่ยังค้าง เรียงตามวัน">
        {!composing && (
          <button type="button" className="btn btn-primary" onClick={() => setComposing(true)}>
            <Plus size={18} />
            จดงานใหม่
          </button>
        )}
      </PageHeader>

      <p className="num mb-5 flex flex-wrap gap-x-5 gap-y-1 border-y border-seam-page py-2.5 text-on-page-mute">
        <span>
          ค้าง <b className="font-semibold text-cover-deep">{stats.doing}</b>
        </span>
        <span>
          เสร็จวันนี้ <b className="font-semibold text-ink">{stats.doneToday}</b>
        </span>
        <span>
          วันนี้ <b className="font-semibold text-ink">{duration(stats.minToday) || '0 นาที'}</b>
        </span>
        <span>
          7 วัน <b className="font-semibold text-ink">{duration(stats.minWeek) || '0 นาที'}</b>
        </span>
      </p>

      {composing ? (
        <section className="leaf rise mb-6 p-5 ring-3 ring-gold" aria-label="จดงานใหม่">
          <CardForm initial={emptyDraft()} onSubmit={create} onCancel={() => setComposing(false)} submitLabel="บันทึกการ์ด" suggestions={suggestions} autoFocus />
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="leaf mb-6 flex w-full items-center gap-3 px-5 py-3.5 text-left text-faint transition-colors hover:border-cover-deep/50 hover:text-mute"
        >
          <PenLine size={18} className="text-cover-deep" />
          จดงานที่ทำวันนี้…
        </button>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented
          label="กรองตามสถานะ"
          value={status}
          onChange={setStatus}
          size="sm"
          options={[
            { value: 'all', label: 'ทั้งหมด', count: cards?.length ?? 0 },
            { value: 'doing', label: 'กำลังทำ', count: stats.doing },
            { value: 'done', label: 'เสร็จแล้ว', count: stats.done },
          ]}
        />
        {topTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="กรองตามแท็ก">
            {topTags.map((t) => (
              <button key={t} type="button" className="chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? '' : t)}>
                {t}
              </button>
            ))}
          </div>
        )}
        <div className="ml-auto w-full sm:w-auto">
          <SearchBox value={q} onChange={setQ} placeholder="ค้นหาการ์ด" icon={Search} />
        </div>
      </div>

      {cards === null ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="leaf h-40 animate-pulse bg-white/60" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="leaf flex flex-col items-start gap-3 px-6 py-10 sm:px-10">
          <span className="stamp text-[15px]">สมุดยังว่าง</span>
          <h2 className="font-stamp text-xl font-bold text-cover-deep">เริ่มจดงานแรกของวันนี้</h2>
          <p className="max-w-prose text-mute">
            ใส่หัวข้อ เช่น "นับสต๊อกสาขาโคราช" เลือกสถานะ ความสำคัญ เวลาที่ใช้ และแท็กสาขา การ์ดจะเรียงตามวันให้เอง กดป้ายสถานะบนการ์ดเพื่อเปลี่ยนเป็นเสร็จแล้ว
          </p>
          <button type="button" className="btn btn-primary mt-1" onClick={() => setComposing(true)}>
            <Plus size={18} />
            จดงานใหม่
          </button>
        </div>
      ) : days.length === 0 ? (
        <div className="leaf flex flex-wrap items-center gap-4 px-6 py-8">
          <FilterX size={22} className="text-cover-deep" />
          <p className="text-mute">ไม่มีการ์ดที่ตรงกับตัวกรองนี้</p>
          {filtersOn && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setStatus('all');
                setTag('');
                setQ('');
              }}
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-8">
          {days.map(([date, list]) => {
            const mins = list.reduce((s, c) => s + c.minutes, 0);
            return (
              <section key={date} aria-label={thaiDayHeading(date)}>
                <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-seam-page pb-2.5">
                  <h2 className="flex items-center gap-3 font-stamp text-[17px] font-bold text-cover-deep">
                    <span className="stamp text-[15px]">{thaiShort(date)}</span>
                    {thaiDayHeading(date).split(' · ')[0]}
                  </h2>
                  <span className="num text-sm text-on-page-mute">
                    {list.length} การ์ด{mins ? ` · ${duration(mins)}` : ''}
                  </span>
                </div>
                <div className="grid items-stretch gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {list.map((c) => (
                    <WorkCard
                      key={c.id}
                      card={c}
                      fresh={c.id === freshId}
                      editing={c.id === editingId}
                      onEdit={() => setEditingId(c.id)}
                      onCancelEdit={() => setEditingId(null)}
                      onSave={(d) => save(c.id, d)}
                      onToggle={() => toggle(c)}
                      onDelete={() => remove(c)}
                      suggestions={suggestions}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
