import React, { useEffect, useState } from 'react';
import { call } from '../lib/api';
import { Button, Card, ErrorText, Input, Select, Spinner, tableCls, tdCls, thCls, useAction, useToast } from '../components/ui';
import { can, Perms, useLoad } from './AdminApp';

const RULE_TYPES = ['Starts With', 'Contains', 'Exact', 'Grade Contains', 'Salary <', 'Default'];

export function SettingsPage({ perms }: { perms: Perms }) {
  const canEdit = can(perms, 'settings', 'edit');
  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-extrabold text-slate-900">Rates &amp; settings</h1></div>
      <Rates canEdit={canEdit} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Signatories canEdit={canEdit} />
        <General canEdit={canEdit} />
      </div>
    </div>
  );
}

function Rates({ canEdit }: { canEdit: boolean }) {
  const r = useLoad<any[]>('rates.get', {}, []);
  const [rules, setRules] = useState<any[]>([]);
  const [tryIt, setTryIt] = useState({ designation: '', grade: '', salary: '' });
  const a = useAction();
  const toast = useToast();
  useEffect(() => { if (r.data) setRules(r.data.map(x => ({ ...x }))); }, [r.data]);
  const upd = (i: number, k: string, v: any) => setRules(rs => rs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const move = (i: number, d: number) => setRules(rs => { const c = rs.slice(); const [x] = c.splice(i, 1); c.splice(i + d, 0, x); return c; });

  const match = (() => {
    const d = tryIt.designation.trim().toLowerCase(), g = tryIt.grade.trim().toLowerCase(), s = Number(tryIt.salary.replace(/,/g, '')) || 0;
    if (!d && !g && !s) return null;
    return rules.find(x => {
      const v = String(x.value || '').trim().toLowerCase();
      switch (x.type) {
        case 'Starts With': return d.startsWith(v);
        case 'Contains': return d.includes(v);
        case 'Exact': return d === v;
        case 'Grade Contains': return g.includes(v);
        case 'Salary <': return s > 0 && s < Number(v);
        default: return x.type === 'Default';
      }
    });
  })();

  return (
    <Card title="Holiday and OT rates" actions={canEdit && <><Button variant="secondary" onClick={() => setRules(rs => [...rs.slice(0, -1), { type: 'Contains', value: '', holidayRate: 0, otRate: 0 }, ...rs.slice(-1)])}>+ Add rule</Button>
      <Button loading={a.busy} onClick={() => a.run(async () => { await call('rates.save', { rules }, 'admin'); toast('Rates saved.'); r.reload(); })}>Save rates</Button></>}>
      <p className="mb-3 text-sm text-slate-600">Rules are checked from top to bottom against the employee’s designation, grade and gross salary; the <b>first match</b> gives the rate. Keep “Default” last. A rate set on an employee (Employees page) overrides these rules.</p>
      <ErrorText error={r.error || a.error} />
      {r.busy && !r.data ? <Spinner /> : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="max-h-[60vh] overflow-auto lg:col-span-2">
            <table className={tableCls}>
              <thead><tr>{['#', 'Rule', 'Value', 'Holiday ৳/day', 'OT ৳/hour', ''].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
              <tbody>{rules.map((x, i) => (
                <tr key={i} className={match === x ? 'bg-emerald-50' : ''}>
                  <td className={tdCls + ' text-xs text-slate-500'}>{i + 1}</td>
                  <td className={tdCls}><Select value={x.type} disabled={!canEdit} onChange={e => upd(i, 'type', e.target.value)} className="!py-1">{RULE_TYPES.map(t => <option key={t}>{t}</option>)}</Select></td>
                  <td className={tdCls}><Input value={x.value} disabled={!canEdit || x.type === 'Default'} onChange={e => upd(i, 'value', e.target.value)} className="!py-1" /></td>
                  <td className={tdCls}><Input value={x.holidayRate} disabled={!canEdit} onChange={e => upd(i, 'holidayRate', e.target.value)} className="!w-24 !py-1" /></td>
                  <td className={tdCls}><Input value={x.otRate} disabled={!canEdit} onChange={e => upd(i, 'otRate', e.target.value)} className="!w-20 !py-1" /></td>
                  <td className={tdCls + ' whitespace-nowrap'}>{canEdit && <>
                    <button className="px-1 text-slate-500" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                    <button className="px-1 text-slate-500" disabled={i === rules.length - 1} onClick={() => move(i, 1)}>↓</button>
                    <button className="px-1 text-red-600" onClick={() => setRules(rs => rs.filter((_, j) => j !== i))}>✕</button></>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="font-bold">Try a designation</div>
            <Input placeholder="Designation, e.g. Sr. Accounts Officer" value={tryIt.designation} onChange={e => setTryIt({ ...tryIt, designation: e.target.value })} />
            <Input placeholder="Grade, e.g. Grade-11 Admin-2024" value={tryIt.grade} onChange={e => setTryIt({ ...tryIt, grade: e.target.value })} />
            <Input placeholder="Gross salary" value={tryIt.salary} onChange={e => setTryIt({ ...tryIt, salary: e.target.value })} />
            {match && <div className="text-sm">Rule <b>{rules.indexOf(match) + 1}</b> ({match.type} {match.value}): holiday <b>৳{match.holidayRate}</b>/day, OT <b>৳{match.otRate}</b>/hour</div>}
          </div>
        </div>
      )}
    </Card>
  );
}

function Signatories({ canEdit }: { canEdit: boolean }) {
  const s = useLoad<any[]>('signatories.get', {}, []);
  const [list, setList] = useState<any[]>([]);
  const a = useAction();
  const toast = useToast();
  useEffect(() => { if (s.data) setList(s.data.map(x => ({ ...x }))); }, [s.data]);
  return (
    <Card title="Bill signatories" actions={canEdit && <Button loading={a.busy} onClick={() => a.run(async () => { await call('signatories.save', { signatories: list }, 'admin'); toast('Signatories saved.'); })}>Save</Button>}>
      <p className="mb-3 text-sm text-slate-600">Printed at the bottom of the Accounts bill, left to right.</p>
      <ErrorText error={s.error || a.error} />
      <div className="space-y-2">
        {list.map((x, i) => (
          <div key={i} className="flex gap-2">
            <Input value={x.name} disabled={!canEdit} onChange={e => setList(l => l.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} placeholder="Name" />
            <Input value={x.title} disabled={!canEdit} onChange={e => setList(l => l.map((y, j) => (j === i ? { ...y, title: e.target.value } : y)))} placeholder="Title" />
            {canEdit && <button className="px-2 text-red-600" onClick={() => setList(l => l.filter((_, j) => j !== i))}>✕</button>}
          </div>
        ))}
        {canEdit && <Button variant="ghost" onClick={() => setList(l => [...l, { name: '', title: '' }])}>+ Add signatory</Button>}
      </div>
    </Card>
  );
}

function General({ canEdit }: { canEdit: boolean }) {
  const s = useLoad<any[]>('settings.get', {}, []);
  const [vals, setVals] = useState<Record<string, string>>({});
  const a = useAction();
  const toast = useToast();
  useEffect(() => { if (s.data) setVals(Object.fromEntries(s.data.map(x => [x.key, x.value]))); }, [s.data]);
  const labels: Record<string, string> = {
    orgName: 'Organisation name', orgAddress: 'Address', portalUrl: 'Review portal address (used in emails)', tutorialUrl: 'Tutorial video link', contactName: 'HR contact name',
    contactTitle: 'HR contact title', contactPhone: 'HR contact phone', contactExt: 'HR contact extension', allowedEmailDomains: 'Allowed email domains', otpMinutes: 'Sign-in code valid (minutes)',
    sessionHours: 'Sign-in lasts (hours)', defaultShiftIn: 'Normal shift start', defaultShiftOut: 'Normal shift end', taskWordLimit: 'Task description word limit', autoReminderDays: 'Automatic reminders (days before deadline)'
  };
  return (
    <Card title="General settings" actions={canEdit && <Button loading={a.busy} onClick={() => a.run(async () => { await call('settings.save', { settings: Object.entries(vals).map(([key, value]) => ({ key, value })) }, 'admin'); toast('Settings saved.'); s.reload(); })}>Save</Button>}>
      <ErrorText error={s.error || a.error} />
      {s.busy && !s.data ? <Spinner /> : (
        <div className="space-y-3">
          {(s.data || []).map(x => (
            <label key={x.key} className="block">
              <span className="block text-sm font-semibold text-slate-700">{labels[x.key] || x.key}</span>
              <Input value={vals[x.key] ?? ''} disabled={!canEdit} onChange={e => setVals(v => ({ ...v, [x.key]: e.target.value }))} />
              {x.notes && <span className="text-xs text-slate-500">{x.notes}</span>}
            </label>
          ))}
        </div>
      )}
    </Card>
  );
}
