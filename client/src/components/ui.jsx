import { useId } from 'react';

export function PageHeader({ title, sub, stamp, stampKey, children }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <h1 className="font-stamp text-[26px] leading-tight font-bold text-balance text-cover-deep sm:text-[28px]">{title}</h1>
          {stamp && (
            <span key={stampKey} className="stamp stamp-in text-[15px]">
              {stamp}
            </span>
          )}
        </div>
        {sub && <p className="mt-1.5 text-on-page-mute">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </header>
  );
}

/** The ledger strip: one row of labelled figures, last cell may carry a verdict. */
export function Strip({ cells, verdict }) {
  return (
    <section className="leaf mb-5 grid grid-cols-2 overflow-hidden sm:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.5fr)]">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={[
            'px-5 py-3.5',
            'border-seam-soft max-sm:[&:nth-child(odd)]:border-r sm:border-r',
            i >= 2 ? 'max-sm:border-t' : '',
            i === cells.length - 1 && !verdict ? 'sm:border-r-0' : '',
          ].join(' ')}
        >
          <div className="text-sm text-mute">{c.label}</div>
          <div className={['num text-[24px] leading-tight font-semibold', c.tone === 'cover' ? 'text-cover-deep' : 'text-ink'].join(' ')}>
            {c.value}
          </div>
        </div>
      ))}
      {verdict && (
        <div className="col-span-full flex items-center gap-3 border-t border-seam-soft px-5 py-3.5 xl:col-span-1 xl:border-t-0">
          {verdict}
        </div>
      )}
    </section>
  );
}

/** Radio-group segmented control. */
export function Segmented({ label, value, onChange, options, size = 'md' }) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-seam bg-white p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <label
            key={o.value}
            className={[
              'relative flex cursor-pointer items-center gap-1.5 rounded-md font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cover-deep',
              size === 'sm' ? 'px-2.5 py-1 text-sm' : 'px-3.5 py-1.5',
              active ? 'bg-cover text-cover-ink' : 'text-mute hover:bg-wash hover:text-ink',
            ].join(' ')}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={active}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.icon && <o.icon size={15} />}
            {o.label}
            {o.count !== undefined && (
              <span className={['num text-[13px]', active ? 'text-cover-mute' : 'text-faint'].join(' ')}>{o.count}</span>
            )}
          </label>
        );
      })}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder, icon: Icon }) {
  return (
    <label className="relative block w-full sm:w-64">
      <span className="sr-only">{placeholder}</span>
      {Icon && <Icon size={17} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />}
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field py-1.5 pl-9"
      />
    </label>
  );
}
