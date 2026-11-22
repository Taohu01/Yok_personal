import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { CircleAlert, CircleCheck, Info, NotebookPen, Boxes } from 'lucide-react';
import { StoreProvider, useStore } from './lib/store.jsx';
import { thaiShort, todayISO } from './lib/thai.js';
import CardsPage from './pages/Cards.jsx';
import StockPage from './pages/Stock.jsx';

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

function NavItem({ to, icon: Icon, label, count }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'group relative flex items-center gap-3 py-2.5 pr-4 pl-5 font-semibold transition-colors',
          'lg:mr-0 lg:rounded-l-[10px]',
          'max-lg:rounded-t-[10px] max-lg:px-4',
          isActive
            ? "bg-page text-cover-deep"
            : "text-cover-ink/85 hover:bg-cover-2 hover:text-cover-ink",
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={19} strokeWidth={2} className={isActive ? "text-cover-deep" : "text-cover-mute group-hover:text-cover-ink"} />
          <span className="flex-1">{label}</span>
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

function Shell() {
  const { cards, imports, loadError } = useStore();
  const doing = cards ? cards.filter((c) => c.status === 'doing').length : null;
  const latestQty = imports?.[0] ? imports[0].qty.toLocaleString('th-TH') : null;

  return (
    <div className="app-shell min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="on-cover sticky top-0 z-30 bg-cover text-cover-ink lg:h-dvh lg:pt-7">
        <div className="flex items-center gap-3 px-5 pt-3 pb-3 lg:px-6 lg:pt-0 lg:pb-8">
          <Seal size={40} />
          <div className="leading-tight">
            <div className="font-stamp text-[19px] font-bold text-cover-ink">สมุดงาน</div>
            <div className="text-[13px] text-cover-mute">{thaiShort(todayISO())}</div>
          </div>
        </div>
        <nav aria-label="หน้าหลัก" className="flex gap-1 px-3 lg:flex-col lg:gap-1 lg:pr-0 lg:pl-3">
          <NavItem to="/cards" icon={NotebookPen} label="การ์ดงาน" count={doing} />
          <NavItem to="/stock" icon={Boxes} label="สต๊อกสินค้า" count={latestQty} />
        </nav>
        <p className="absolute right-6 bottom-6 left-6 hidden text-[13px] leading-relaxed text-cover-mute lg:block">
          บันทึกลงเครื่องนี้ในไฟล์ <span className="text-cover-ink">data/yok.db</span>
          <br />
          สำรองข้อมูลได้ด้วยการคัดลอกไฟล์นี้
        </p>
      </aside>

      <main className="min-w-0 px-4 pt-6 pb-16 sm:px-6 lg:px-9 lg:pt-8">
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
