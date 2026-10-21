import React, { useEffect, useState } from 'react';
import { call } from '../../lib/api';
import { fmtHours, prettyDate } from '../../lib/time';
import { Badge, Button, Card, ErrorText, Field, Input, Notice, Spinner, tableCls, tdCls, thCls, useAction, useToast } from '../../components/ui';
import { useLoad } from '../AdminApp';

const toMin = (t: string) => { const m = (t || '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const shiftOf = (d: any) => { const a = toMin(d.in), b = toMin(d.out); return a !== null && b !== null && b > a ? b - a : null; };

export function ScheduleTab({ month, canEdit }: { month: any; canEdit: boolean }) {
  const sched = useLoad<any[]>('schedule.get', { monthKey: month.monthKey }, [month.monthKey]);
  const [days, setDays] = useState<any[]>([]);
  const [range, setRange] = useState({ from: '', to: '', in: '09:00', out: '15:30', note: 'Ramadan' });
  const [dirty, setDirty] = useState(false);
  const a = useAction();
  const toast = useToast();
  useEffect(() => { if (sched.data) { setDays(sched.data.map(d => ({ ...d }))); setDirty(false); } }, [sched.data]);

  const upd = (i: number, patch: any) => { setDays(ds => ds.map((d, j) => (j === i ? { ...d, ...patch } : d))); setDirty(true); };
  const applyRange = () => {
    if (!range.from || !range.to) return;
    setDays(ds => ds.map(d => (d.date >= range.from && d.date <= range.to ? { ...d, in: range.in, out: range.out, note: range.note } : d)));
    setDirty(true);
  };
  const resetAll = () => { setDays(ds => ds.map(d => ({ ...d, in: '08:00', out: '16:00', note: '' }))); setDirty(true); };
  const save = () => a.run(async () => {
    const bad = days.find(d => !shiftOf(d));
    if (bad) throw new Error(`Check the times on ${prettyDate(bad.date)}.`);
    await call('schedule.save', { monthKey: month.monthKey, days: days.map(d => ({ date: d.date, in: d.in, out: d.out, shiftHours: fmtHours(shiftOf(d) || 480), note: d.note })) }, 'admin');
    toast('Office schedule saved.'); sched.reload();
  });

  if (sched.busy && !sched.data) return <div className="py-10 text-center"><Spinner /></div>;
  const special = days.filter(d => (shiftOf(d) || 480) < 480).length;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card title="Office schedule for each day" className="lg:col-span-2" actions={canEdit && <Button loading={a.busy} disabled={!dirty} onClick={save}>Save schedule</Button>}>
        <ErrorText error={sched.error || a.error} />
        <p className="mb-3 text-sm text-slate-600">The shift length decides OT (worked − shift, after at least shift + 1 hour) and what counts as a <b>full weekend/holiday day</b> (working the whole shift = 1 day = 8 hours on the bill). It applies to everyone.</p>
        <div className="max-h-[65vh] overflow-auto">
          <table className={tableCls}>
            <thead><tr><th className={thCls}>Date</th><th className={thCls}>In</th><th className={thCls}>Out</th><th className={thCls}>Shift</th><th className={thCls}>Note</th></tr></thead>
            <tbody>
              {days.map((d, i) => {
                const sh = shiftOf(d);
                return (
                  <tr key={d.date} className={sh !== null && sh < 480 ? 'bg-amber-50' : ''}>
                    <td className={tdCls}><b>{prettyDate(d.date)}</b> <span className="text-xs text-slate-500">{d.weekday}</span></td>
                    <td className={tdCls}><Input type="time" value={d.in} disabled={!canEdit} onChange={e => upd(i, { in: e.target.value })} className="!w-28 !py-1" /></td>
                    <td className={tdCls}><Input type="time" value={d.out} disabled={!canEdit} onChange={e => upd(i, { out: e.target.value })} className="!w-28 !py-1" /></td>
                    <td className={tdCls}>{sh ? <Badge tone={sh < 480 ? 'amber' : 'slate'}>{fmtHours(sh)} h</Badge> : <Badge tone="red">invalid</Badge>}</td>
                    <td className={tdCls}><Input value={d.note || ''} disabled={!canEdit} onChange={e => upd(i, { note: e.target.value })} className="!py-1" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="space-y-5">
        {canEdit && (
          <Card title="Set a special schedule for a range">
            <div className="grid grid-cols-2 gap-3">
              <Field label="From"><Input type="date" value={range.from} min={`${month.monthKey}-01`} max={`${month.monthKey}-31`} onChange={e => setRange({ ...range, from: e.target.value })} /></Field>
              <Field label="To"><Input type="date" value={range.to} min={`${month.monthKey}-01`} max={`${month.monthKey}-31`} onChange={e => setRange({ ...range, to: e.target.value })} /></Field>
              <Field label="In"><Input type="time" value={range.in} onChange={e => setRange({ ...range, in: e.target.value })} /></Field>
              <Field label="Out"><Input type="time" value={range.out} onChange={e => setRange({ ...range, out: e.target.value })} /></Field>
              <Field label="Note" className="col-span-2"><Input value={range.note} onChange={e => setRange({ ...range, note: e.target.value })} /></Field>
            </div>
            <div className="mt-3 flex gap-2"><Button variant="secondary" onClick={applyRange}>Apply to range</Button><Button variant="ghost" onClick={resetAll}>Reset all to 8:00–16:00</Button></div>
            <p className="mt-2 text-xs text-slate-500">Then press “Save schedule”.</p>
          </Card>
        )}
        <Notice tone={special ? 'amber' : 'slate'} title={`${special} special-schedule day(s)`}>
          On these days security staff get their usual daily OT plus the hours the shift is shorter than 8 (for example 3:00 + 1:30 = 4:30 with a 6:30 shift), if their approval has the “security bonus” ticked.
        </Notice>
      </div>
    </div>
  );
}
