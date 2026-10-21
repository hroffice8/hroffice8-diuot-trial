import React, { useState } from 'react';
import { call } from '../lib/api';
import { monthLabel, prettyDate, prettyStamp } from '../lib/time';
import { Badge, Button, Card, ErrorText, Field, Input, Modal, Select, Spinner, tableCls, tdCls, thCls, useAction } from '../components/ui';
import { can, go, Perms, useLoad } from './AdminApp';

export const statusBadge = (s: string) => {
  const map: Record<string, ['green' | 'amber' | 'blue' | 'slate' | 'purple', string]> = {
    DRAFT: ['slate', 'Preparing'], REVIEW: ['amber', 'Open for review'], CLOSED: ['blue', 'Closed — bill ready'], DISBURSED: ['green', 'Disbursed (locked)']
  };
  const [tone, label] = map[s] || ['slate', s];
  return <Badge tone={tone}>{label}</Badge>;
};

export function MonthsPage({ perms }: { perms: Perms }) {
  const months = useLoad<any[]>('months.list', {}, []);
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold text-slate-900">Months</h1><p className="text-sm text-slate-500">Each month has its own spreadsheet. Open a month, upload attendance, then open it for supervisors.</p></div>
        {can(perms, 'months', 'edit') && <Button onClick={() => setOpen(true)}>+ Open a new month</Button>}
      </div>
      <ErrorText error={months.error} />
      <Card>
        {months.busy && !months.data ? <div className="py-10 text-center"><Spinner /></div> : !months.data?.length ? (
          <div className="py-10 text-center text-slate-500">No months yet. Click “Open a new month” to start.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead><tr><th className={thCls}>Month</th><th className={thCls}>Status</th><th className={thCls}>Deadline</th><th className={thCls}>Rules</th><th className={thCls}>Files</th><th className={thCls}></th></tr></thead>
              <tbody>
                {months.data.map(m => (
                  <tr key={m.monthKey} className="hover:bg-slate-50">
                    <td className={tdCls}><button className="font-bold text-[#006a4e] hover:underline" onClick={() => go('month/' + m.monthKey)}>{m.label}</button><div className="text-xs text-slate-500">opened {prettyStamp(m.createdAt)}</div></td>
                    <td className={tdCls}>{statusBadge(m.status)}</td>
                    <td className={tdCls}>{m.deadline ? prettyDate(m.deadline) : '—'}</td>
                    <td className={tdCls + ' text-xs text-slate-600'}>{m.lateRule === 'DISQUALIFY' ? 'Late days: no OT' : 'Late days count'}<br />{m.lowestMode === 'DAY' ? 'Lowest figure per day' : 'Lowest figure per month'}</td>
                    <td className={tdCls + ' text-xs'}>
                      <a href={m.fileUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">Month spreadsheet</a>
                      {m.archiveUrl && <><br /><a href={m.archiveUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">Locked copy</a></>}
                    </td>
                    <td className={tdCls + ' text-right'}><Button variant="secondary" onClick={() => go('month/' + m.monthKey)}>Open</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {open && <NewMonth onClose={() => setOpen(false)} onDone={k => { setOpen(false); go('month/' + k); }} />}
    </div>
  );
}

function NewMonth({ onClose, onDone }: { onClose: () => void; onDone: (k: string) => void }) {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [key, setKey] = useState(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
  const [deadline, setDeadline] = useState('');
  const [lateRule, setLateRule] = useState('COUNT');
  const [lowestMode, setLowestMode] = useState('MONTH');
  const a = useAction();
  return (
    <Modal title="Open a new month" onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={a.busy} onClick={() => a.run(async () => { await call('months.create', { monthKey: key, deadline, lateRule, lowestMode }, 'admin'); onDone(key); })}>Create {monthLabel(key)}</Button></>}>
      <div className="space-y-4">
        <Field label="Month"><Input type="month" value={key} onChange={e => setKey(e.target.value)} /></Field>
        <Field label="Supervisor deadline" hint="Shown in emails. Automatic reminders go out before it."><Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></Field>
        <Field label="Late days">
          <Select value={lateRule} onChange={e => setLateRule(e.target.value)}>
            <option value="COUNT">Count late days (late days still earn OT)</option>
            <option value="DISQUALIFY">Late days get no OT (working days only)</option>
          </Select>
        </Field>
        <Field label="Lowest-figure rule" hint="How supervisor figures are compared with attendance.">
          <Select value={lowestMode} onChange={e => setLowestMode(e.target.value)}>
            <option value="MONTH">Month totals (same as the old spreadsheet)</option>
            <option value="DAY">Day by day</option>
          </Select>
        </Field>
        <p className="text-sm text-slate-500">A new spreadsheet “OT {monthLabel(key)} (trial)” is created with a normal 8:00–16:00 schedule for every day. You can change special days afterwards.</p>
        <ErrorText error={a.error} />
      </div>
    </Modal>
  );
}
