import React, { useState } from 'react';
import { call } from '../lib/api';
import { prettyDate, prettyStamp } from '../lib/time';
import { Button, Card, ErrorText, Field, Input, Modal, Notice, Select, Spinner, Stat, Tabs, TextArea, useAction, useToast } from '../components/ui';
import { can, go, Perms, useLoad } from './AdminApp';
import { statusBadge } from './MonthsPage';
import { AttendanceTab } from './month/AttendanceTab';
import { ScheduleTab } from './month/ScheduleTab';
import { MaintenanceTab } from './month/MaintenanceTab';
import { ProgressTab } from './month/ProgressTab';
import { BillTab } from './month/BillTab';

type Tab = 'overview' | 'attendance' | 'schedule' | 'maintenance' | 'progress' | 'bill';

export function MonthPage({ monthKey, perms }: { monthKey: string; perms: Perms }) {
  const months = useLoad<any[]>('months.list', {}, [monthKey]);
  const [tab, setTab] = useState<Tab>('overview');
  const month = months.data?.find(m => m.monthKey === monthKey);
  if (months.busy && !months.data) return <div className="py-20 text-center"><Spinner /></div>;
  if (months.error) return <ErrorText error={months.error} />;
  if (!month) return <Notice tone="red">Month not found.</Notice>;
  const editable = month.status === 'DRAFT' || month.status === 'REVIEW';
  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' }, { id: 'attendance', label: 'Attendance' }, { id: 'schedule', label: 'Office schedule' },
    { id: 'maintenance', label: 'Maintenance list' }, { id: 'progress', label: 'Supervisors & emails' }, { id: 'bill', label: 'Bill' }
  ];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <button className="text-sm text-slate-500 hover:underline" onClick={() => go('months')}>← All months</button>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-extrabold text-slate-900">{month.label} {statusBadge(month.status)}</h1>
        </div>
        <a href={month.fileUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-sky-700 hover:underline">Open month spreadsheet ↗</a>
      </div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'overview' && <Overview month={month} perms={perms} onChanged={months.reload} goTab={setTab} />}
      {tab === 'attendance' && <AttendanceTab month={month} canEdit={editable && can(perms, 'months', 'edit')} />}
      {tab === 'schedule' && <ScheduleTab month={month} canEdit={editable && can(perms, 'months', 'edit')} />}
      {tab === 'maintenance' && <MaintenanceTab month={month} canEdit={editable && can(perms, 'approvals', 'edit')} />}
      {tab === 'progress' && <ProgressTab month={month} perms={perms} />}
      {tab === 'bill' && <BillTab month={month} perms={perms} onChanged={months.reload} />}
    </div>
  );
}

function Overview({ month, perms, onChanged, goTab }: { month: any; perms: Perms; onChanged: () => void; goTab: (t: Tab) => void }) {
  const summary = useLoad<any>('attendance.summary', { monthKey: month.monthKey }, [month.monthKey, month.status]);
  const progress = useLoad<any>('progress.get', { monthKey: month.monthKey }, [month.monthKey]);
  const [deadline, setDeadline] = useState(month.deadline || '');
  const [lateRule, setLateRule] = useState(month.lateRule);
  const [lowestMode, setLowestMode] = useState(month.lowestMode);
  const [reopen, setReopen] = useState(false);
  const [reason, setReason] = useState('');
  const a = useAction();
  const toast = useToast();
  const canEdit = can(perms, 'months', 'edit');
  const editable = month.status === 'DRAFT' || month.status === 'REVIEW';
  const changed = deadline !== (month.deadline || '') || lateRule !== month.lateRule || lowestMode !== month.lowestMode;

  const setStatus = (status: string, extra: any = {}) => a.run(async () => {
    await call('months.setStatus', { monthKey: month.monthKey, status, ...extra }, 'admin');
    toast(status === 'REVIEW' ? 'The month is open for supervisors.' : 'Status changed.');
    setReopen(false); onChanged();
  });

  const steps: [boolean | null, string, React.ReactNode][] = [
    [!!summary.data?.rows, 'Attendance uploaded', summary.data?.rows ? `${summary.data.rows.toLocaleString()} rows, ${summary.data.employees} employees` : <button className="font-semibold text-sky-700 hover:underline" onClick={() => goTab('attendance')}>Upload the HRIS files</button>],
    [null, 'Office schedule checked', <button className="font-semibold text-sky-700 hover:underline" onClick={() => goTab('schedule')}>Review special shifts (e.g. Ramadan)</button>],
    [null, 'Maintenance list uploaded', <button className="font-semibold text-sky-700 hover:underline" onClick={() => goTab('maintenance')}>Upload this month’s list</button>],
    [month.status !== 'DRAFT', 'Opened for supervisors', month.status === 'DRAFT' ? 'Use the button on the right when ready' : 'Supervisors can submit'],
    [month.status === 'CLOSED' || month.status === 'DISBURSED', 'Bill closed', <button className="font-semibold text-sky-700 hover:underline" onClick={() => goTab('bill')}>Go to the bill</button>],
    [month.status === 'DISBURSED', 'Disbursed and locked', month.disbursedAt ? prettyStamp(month.disbursedAt) : '']
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Attendance rows" value={summary.data ? summary.data.rows.toLocaleString() : '…'} />
          <Stat label="Employees in attendance" value={summary.data ? summary.data.employees : '…'} />
          <Stat label="Eligible employees" value={progress.data ? progress.data.total : '…'} />
          <Stat label="Reviewed" value={progress.data ? `${progress.data.done}` : '…'} tone={progress.data && progress.data.done < progress.data.total ? 'amber' : 'green'} sub={progress.data ? `of ${progress.data.total}` : ''} />
        </div>
        <Card title="Checklist">
          <ol className="space-y-3">
            {steps.map(([ok, label, detail], i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ok ? 'bg-emerald-600 text-white' : ok === null ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'}`}>{ok ? '✓' : ok === null ? '•' : i + 1}</span>
                <div><div className="font-semibold text-slate-800">{label}</div><div className="text-sm text-slate-500">{detail}</div></div>
              </li>
            ))}
          </ol>
        </Card>
        {summary.data?.holidays?.length > 0 && (
          <Card title="Holidays in the HRIS data">
            <ul className="space-y-1 text-sm">{summary.data.holidays.map((h: any) => <li key={h.date}><b>{prettyDate(h.date)}</b> ({h.weekday}) — {h.status}{h.weekday === 'Friday' ? <span className="ml-2 text-xs text-sky-700">falls on the weekend: weekend-duty staff are counted too</span> : null}</li>)}</ul>
          </Card>
        )}
      </div>
      <div className="space-y-5">
        <Card title="Status">
          <div className="space-y-3">
            <div>{statusBadge(month.status)}</div>
            {canEdit && month.status === 'DRAFT' && <Button className="w-full" loading={a.busy} onClick={() => setStatus('REVIEW')}>Open for supervisors</Button>}
            {canEdit && month.status === 'REVIEW' && <Button variant="secondary" className="w-full" loading={a.busy} onClick={() => setStatus('DRAFT')}>Pause (back to preparing)</Button>}
            {canEdit && month.status === 'CLOSED' && <Button variant="danger" className="w-full" onClick={() => setReopen(true)}>Reopen for changes</Button>}
            <p className="text-xs text-slate-500">Supervisors can only submit while the month is “Open for review”. Close it from the Bill tab.</p>
            <ErrorText error={a.error} />
          </div>
        </Card>
        <Card title="Month settings">
          <div className="space-y-3">
            <Field label="Supervisor deadline"><Input type="date" value={deadline} disabled={!canEdit || !editable} onChange={e => setDeadline(e.target.value)} /></Field>
            <Field label="Late days" hint="Applies to working days only, never to weekend/holiday duty.">
              <Select value={lateRule} disabled={!canEdit || !editable} onChange={e => setLateRule(e.target.value)}>
                <option value="COUNT">Count late days</option><option value="DISQUALIFY">Late days get no OT</option>
              </Select>
            </Field>
            <Field label="Lowest-figure rule">
              <Select value={lowestMode} disabled={!canEdit || !editable} onChange={e => setLowestMode(e.target.value)}>
                <option value="MONTH">Month totals (old method)</option><option value="DAY">Day by day</option>
              </Select>
            </Field>
            {canEdit && editable && <Button disabled={!changed} loading={a.busy} onClick={() => a.run(async () => { await call('months.update', { monthKey: month.monthKey, deadline, lateRule, lowestMode }, 'admin'); toast('Saved.'); onChanged(); })}>Save settings</Button>}
          </div>
        </Card>
      </div>
      {reopen && (
        <Modal title="Reopen this month?" onClose={() => setReopen(false)}
          footer={<><Button variant="secondary" onClick={() => setReopen(false)}>Cancel</Button><Button variant="danger" disabled={!reason.trim()} loading={a.busy} onClick={() => setStatus('REVIEW', { reason })}>Reopen</Button></>}>
          <p className="mb-3 text-sm text-slate-600">Supervisors will be able to submit again, and the bill will need to be closed again. The reason is kept in the activity log.</p>
          <Field label="Reason"><TextArea value={reason} onChange={e => setReason(e.target.value)} /></Field>
          <ErrorText error={a.error} />
        </Modal>
      )}
    </div>
  );
}
