import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, Info, NotebookPen, Boxes, ReceiptText, RefreshCw, Truck } from 'lucide-react';
import { StoreProvider, useStore } from './lib/store.jsx';
import { thaiShort, todayISO } from './lib/thai.js';
import CardsPage from './pages/Cards.jsx';
import StockPage from './pages/Stock.jsx';
import SalesPage from './pages/Sales.jsx';
import TrackingPage from './pages/Tracking.jsx';

function Seal({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="none" stroke="#FFCC00" strokeWidth="2" />
      <circle cx="32" cy="32" r="24.5" fill="none" stroke="#FFCC00" strokeWidth="0.9" strokeDasharray="1.6 2.4" />
      <path
        d="M22.5 23.5h8.5v17M31 31h6.5a4.5 4.5 0 0 1 4.5 4.5V40.5M22.5 40.5H42"
        fill="none"
        stroke="#FFCC00"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** `short`: the label on phones, where four full names do not fit across the screen. */
function NavItem({ to, icon: Icon, label, short = label, count }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-3 py-2.5 pr-4 pl-5 font-semibold transition-colors',
          'lg:mr-0 lg:rounded-l-[10px]',
          'max-lg:shrink-0 max-lg:rounded-t-[10px] max-lg:px-4 max-sm:gap-2 max-sm:px-3 whitespace-nowrap',
          isActive
            ? "bg-page text-cover-deep"
            : "text-cover-ink/85 hover:bg-cover-2 hover:text-cover-ink",
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={19} strokeWidth={2} className={isActive ? "text-cover-deep" : "text-cover-mute group-hover:text-cover-ink"} />
          <span className="flex-1">
            <span className="sm:hidden">{short}</span>
            <span className="max-sm:hidden">{label}</span>
          </span>
          {count !== undefined && count !== null && (
            <span
              className={[
                'num min-w-7 rounded-full px-2 text-center text-sm font-semibold',
                isActive ? "bg-gold text-ink" : "bg-cover-3 text-cover-mute",
              ].join(' ')}
            >
              {count}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function Toasts() {
  const { toasts } = useStore();
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => {
        const Icon = t.tone === 'error' ? CircleAlert : t.tone === 'ok' ? CircleCheck : Info;
        return (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="rise pointer-events-auto flex items-start gap-3 rounded-[10px] bg-cover px-4 py-3 text-cover-ink shadow-[0_12px_30px_-12px_rgb(0_40_70/0.6)]"
          >
            <Icon size={19} className={t.tone === "error" ? "mt-0.5 shrink-0 text-[#ffb8c4]" : "mt-0.5 shrink-0 text-gold"} />
            <span className="text-[15px] leading-snug">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * A tab left open across an update keeps running the old page. Compare the build the
 * server has with the one this tab loaded (on focus and every minute) and offer a refresh.
 */
function UpdateBanner() {
  const [stale, setStale] = useState(false);
  const loaded = useRef(null);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const { build } = await (await fetch('/api/version', { cache: 'no-store' })).json();
        if (!alive || !build) return;
        if (loaded.current === null) loaded.current = build;
        else if (build !== loaded.current) setStale(true);
      } catch {
        /* server restarting; try again later */
      }
    };
    check();
    const t = setInterval(check, 60000);
    const onFocus = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
  if (!stale) return null;
  return (
    <div role="status" className="rise sticky top-0 z-40 mb-5 flex flex-wrap items-center gap-3 rounded-[10px] bg-gold px-4 py-2.5 text-ink shadow-leaf">
      <RefreshCw size={18} className="shrink-0" />
      <span className="flex-1 font-semibold">สมุดงานมีเวอร์ชันใหม่ หน้านี้ยังเป็นของเก่า</span>
      <button type="button" className="btn min-h-9 bg-cover px-4 py-1 text-cover-ink hover:bg-cover-2" onClick={() => window.location.reload()}>
        รีเฟรชเลย
      </button>
    </div>
  );
}

function Shell() {
  const { pathname } = useLocation();
  // on a phone the menu scrolls sideways; keep the current page's tab in view
  useEffect(() => {
    const show = () => document.querySelector('nav[aria-label="หน้าหลัก"] a[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    show();
    document.fonts?.ready.then(show); // Thai web fonts widen the tabs once they load
  }, [pathname]);
  const { cards, imports, salesToday, loadError } = useStore();
  const doing = cards ? cards.filter((c) => c.status === 'doing').length : null;
  const latestQty = imports?.[0] ? imports[0].qty.toLocaleString('th-TH') : null;

  return (
    <div className="app-shell min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="on-cover sticky top-0 z-30 bg-cover text-cover-ink lg:flex lg:h-dvh lg:flex-col lg:overflow-y-auto lg:pt-7">
        <div className="flex items-center gap-3 px-5 pt-3 pb-3 lg:px-6 lg:pt-0 lg:pb-8">
          <Seal size={40} />
          <div className="leading-tight">
            <div className="font-stamp text-[19px] font-bold text-cover-ink">สมุดงาน</div>
            <div className="text-[13px] text-cover-mute">{thaiShort(todayISO())}</div>
          </div>
        </div>
        <nav aria-label="หน้าหลัก" className="flex gap-1 overflow-x-auto px-3 [scrollbar-width:none] lg:flex-col lg:gap-1 lg:overflow-visible lg:pr-0 lg:pl-3">
          <NavItem to="/cards" icon={NotebookPen} label="การ์ดงาน" short="การ์ด" count={doing} />
          <NavItem to="/stock" icon={Boxes} label="สต๊อกสินค้า" short="สต๊อก" count={latestQty} />
          <NavItem to="/sales" icon={ReceiptText} label="สรุปยอดรายวัน" short="ยอดขาย" count={salesToday?.bills || null} />
          <NavItem to="/tracking" icon={Truck} label="ติดตามสินค้า" short="ติดตาม" />
        </nav>
        <p className="mx-6 mt-auto hidden pt-8 pb-6 text-[13px] leading-relaxed text-cover-mute lg:block">
          บันทึกลงเครื่องนี้ในไฟล์ <span className="text-cover-ink">data/yok.db</span>
          <br />
          สำรองข้อมูลได้ด้วยการคัดลอกไฟล์นี้
        </p>
      </aside>

      <main className="min-w-0 px-4 pt-6 pb-16 sm:px-6 lg:px-9 lg:pt-8">
        <UpdateBanner />
        {loadError && (
          <div role="alert" className="mb-5 flex items-center gap-3 rounded-[10px] border border-danger/30 bg-danger-soft px-4 py-3 text-danger">
            <CircleAlert size={19} className="shrink-0" />
            <span>{loadError}</span>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Navigate to="/cards" replace />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/stock" element={<StockPage />} />
          <Route path="/sales" element={<SalesPage />} />
          <Route path="/tracking" element={<TrackingPage />} />
          <Route path="*" element={<Navigate to="/cards" replace />} />
        </Routes>
      </main>
      <Toasts />
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
