import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
export function Button({ variant = 'primary', loading, className, children, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; loading?: boolean }) {
  const v: Record<BtnVariant, string> = {
    primary: 'bg-[#006a4e] text-white hover:bg-[#00543e] border-transparent',
    success: 'bg-green-600 text-white hover:bg-green-700 border-transparent',
    secondary: 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50',
    danger: 'bg-white text-red-700 border-red-300 hover:bg-red-50',
    ghost: 'bg-transparent text-[#006a4e] border-transparent hover:bg-emerald-50'
  };
  return (
    <button {...rest} disabled={rest.disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed', v[variant], className)}>
      {loading && <Spinner small />}{children}
    </button>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return <span className={cx('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', small ? 'h-4 w-4' : 'h-8 w-8 text-[#006a4e]')} />;
}

export function Card({ title, actions, children, className }: { title?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 className="text-base font-bold text-slate-800">{title}</h2>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#006a4e] focus:ring-2 focus:ring-[#006a4e]/20 disabled:bg-slate-100';

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(inputCls, 'min-h-[70px]', props.className)} />;
}

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'purple';
const toneCls: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  amber: 'bg-amber-50 text-amber-800 border-amber-200',
  red: 'bg-red-50 text-red-800 border-red-200',
  blue: 'bg-sky-50 text-sky-800 border-sky-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  purple: 'bg-violet-50 text-violet-800 border-violet-200'
};

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold', toneCls[tone])}>{children}</span>;
}

export function Notice({ tone = 'blue', title, children }: { tone?: Tone; title?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className={cx('rounded-lg border px-4 py-3 text-sm', toneCls[tone])}>
      {title && <div className="font-bold">{title}</div>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
    </div>
  );
}

export function ErrorText({ error }: { error?: string | null }) {
  if (!error) return null;
  return <div className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>;
}

export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={cx('w-full rounded-xl bg-white shadow-2xl', wide ? 'max-w-5xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="rounded px-2 text-xl leading-none text-slate-500 hover:bg-slate-100" aria-label="Close">×</button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: React.ReactNode }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="no-print mb-4 flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cx('-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-semibold', value === t.id ? 'border-[#006a4e] text-[#006a4e]' : 'border-transparent text-slate-500 hover:text-slate-800')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: 'green' | 'amber' | 'red' }) {
  const c = tone === 'amber' ? 'text-amber-700' : tone === 'red' ? 'text-red-700' : 'text-[#006a4e]';
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cx('mt-1 text-2xl font-extrabold', c)}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function FilePick({ accept, multiple, onFiles, label, disabled }: { accept: string; multiple?: boolean; onFiles: (f: File[]) => void; label: string; disabled?: boolean }) {
  const [drag, setDrag] = useState(false);
  return (
    <label onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); if (!disabled) onFiles(Array.from(e.dataTransfer.files)); }}
      className={cx('flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition',
        drag ? 'border-[#006a4e] bg-emerald-50' : 'border-slate-300 bg-slate-50 hover:border-[#006a4e]', disabled && 'pointer-events-none opacity-50')}>
      <span className="font-semibold text-slate-700">{label}</span>
      <span className="mt-1 text-xs text-slate-500">Click to choose, or drop the file here</span>
      <input type="file" className="hidden" accept={accept} multiple={multiple} disabled={disabled}
        onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) onFiles(f); }} />
    </label>
  );
}

/* ---------- Toasts ---------- */
type ToastItem = { id: number; text: string; tone: 'green' | 'red' };
const ToastCtx = createContext<(text: string, tone?: 'green' | 'red') => void>(() => { });
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: 'green' | 'red' = 'green') => {
    const id = Date.now() + Math.random();
    setItems(i => [...i, { id, text, tone }]);
    setTimeout(() => setItems(i => i.filter(x => x.id !== id)), tone === 'red' ? 8000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print fixed bottom-4 right-4 z-[60] flex max-w-sm flex-col gap-2">
        {items.map(t => (
          <div key={t.id} className={cx('whitespace-pre-line rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg', t.tone === 'red' ? 'bg-red-600' : 'bg-[#006a4e]')}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/** Small hook: run an async action with loading + error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true); setError(null);
    try { return await fn(); } catch (e: any) { setError(e?.message || String(e)); return undefined; } finally { setBusy(false); }
  }, []);
  return { busy, error, setError, run };
}

export const tableCls = 'min-w-full text-sm';
export const thCls = 'whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600';
export const tdCls = 'border-b border-slate-100 px-3 py-2 align-top';
export { cx };
