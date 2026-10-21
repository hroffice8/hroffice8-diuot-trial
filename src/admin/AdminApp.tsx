import React, { useEffect, useState } from 'react';
import { call, session } from '../lib/api';
import { SignIn } from '../components/SignIn';
import { Button, Spinner, cx } from '../components/ui';
import { MonthsPage } from './MonthsPage';
import { MonthPage } from './MonthPage';
import { EmployeesPage } from './EmployeesPage';
import { ApprovalsPage } from './ApprovalsPage';
import { SettingsPage } from './SettingsPage';
import { AccessPage } from './AccessPage';
import { AuditPage } from './AuditPage';

export type Perms = Record<string, 'none' | 'view' | 'edit'>;
export const can = (p: Perms | null, area: string, level: 'view' | 'edit' = 'view') =>
  !!p && (level === 'view' ? p[area] === 'view' || p[area] === 'edit' : p[area] === 'edit');

type Page = { name: 'months' } | { name: 'month'; key: string } | { name: 'employees' } | { name: 'approvals'; empId?: string } | { name: 'settings' } | { name: 'access' } | { name: 'audit' };

function readHash(): Page {
  const h = location.hash.replace(/^#\/admin\/?/, '');
  const [a, b] = h.split('/');
  if (a === 'month' && b) return { name: 'month', key: b };
  if (a === 'approvals') return { name: 'approvals', empId: b };
  if (['employees', 'settings', 'access', 'audit'].includes(a)) return { name: a } as Page;
  return { name: 'months' };
}

export function go(path: string) { location.hash = '#/admin/' + path; }

export default function AdminApp() {
  const [me, setMe] = useState<{ email: string; perms: Perms; owner: boolean } | null>(null);
  const [checking, setChecking] = useState(!!session.token('admin'));
  const [page, setPage] = useState<Page>(readHash());

  useEffect(() => { const f = () => setPage(readHash()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  useEffect(() => {
    if (!session.token('admin')) return;
    call('admin.me', {}, 'admin').then(setMe).catch(() => session.clear('admin')).finally(() => setChecking(false));
  }, []);

  const signOut = () => { session.clear('admin'); setMe(null); };

  if (checking) return <div className="py-24 text-center"><Spinner /></div>;
  if (!me) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-12">
        <div className="mb-6 text-center"><div className="text-xs font-bold uppercase tracking-widest text-[#006a4e]">DIU HR</div><h1 className="text-2xl font-extrabold">Overtime Admin <span className="rounded bg-amber-100 px-2 py-0.5 align-middle text-xs text-amber-800">TRIAL</span></h1></div>
        <SignIn role="admin" onDone={async () => { setChecking(true); try { setMe(await call('admin.me', {}, 'admin')); } finally { setChecking(false); } }} />
      </div>
    );
  }

  const nav: [string, string, string][] = [
    ['months', 'Months', 'months'], ['employees', 'Employees & reviewers', 'employees'], ['approvals', 'Approvals', 'approvals'],
    ['settings', 'Rates & settings', 'settings'], ['access', 'Access', 'access'], ['audit', 'Activity log', 'audit']
  ];
  const active = page.name === 'month' ? 'months' : page.name;
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#006a4e] text-sm font-black text-white">OT</div>
            <div><div className="text-sm font-extrabold leading-tight">DIU Overtime Admin <span className="rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">TRIAL</span></div><div className="text-xs text-slate-500">{me.email}{me.owner ? ' · owner' : ''}</div></div>
          </div>
          <nav className="flex flex-wrap gap-1">
            {nav.filter(n => can(me.perms, n[2])).map(([id, label]) => (
              <button key={id} onClick={() => go(id)} className={cx('rounded-lg px-3 py-1.5 text-sm font-semibold', active === id ? 'bg-[#006a4e] text-white' : 'text-slate-600 hover:bg-slate-100')}>{label}</button>
            ))}
          </nav>
          <Button variant="secondary" onClick={signOut}>Sign out</Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        {page.name === 'months' && <MonthsPage perms={me.perms} />}
        {page.name === 'month' && <MonthPage monthKey={page.key} perms={me.perms} />}
        {page.name === 'employees' && <EmployeesPage perms={me.perms} />}
        {page.name === 'approvals' && <ApprovalsPage perms={me.perms} empId={page.empId} />}
        {page.name === 'settings' && <SettingsPage perms={me.perms} />}
        {page.name === 'access' && <AccessPage perms={me.perms} owner={me.owner} />}
        {page.name === 'audit' && <AuditPage />}
      </main>
    </div>
  );
}

/** Loads data with an action name; returns data, reload, busy and error. */
export function useLoad<T = any>(action: string, params: any, deps: any[]) {
  const [data, setData] = useState<T | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setBusy(true); setError(null);
    try { setData(await call<T>(action, params, 'admin')); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  useEffect(() => { load(); }, deps);
  return { data, setData, reload: load, busy, error };
}
