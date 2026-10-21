import React, { useEffect, useMemo, useState } from 'react';
import { call, fileToBase64 } from '../lib/api';
import { fmtHours, monthLabel, parseHours, prettyDate, prettyStamp, tidyHours, wordCount } from '../lib/time';
import { Badge, Button, Card, ErrorText, Input, Modal, Notice, Spinner, Stat, TextArea, cx, useAction } from '../components/ui';

interface DayState { selected: boolean; hours: string; task: string; file?: File | null; keepFileUrl?: string }

const typeBadge = (d: any) => d.type === 'HOLIDAY' ? <Badge tone="purple">{d.status}</Badge> : d.type === 'WEEKEND' ? <Badge tone="blue">Weekend</Badge> : <span className="text-xs text-slate-600">{d.status}</span>;

/** Quick-pick values for a working day: 1 hour, up to 2 hours, up to the cap. */
function tiers(d: any): number[] {
  const out: number[] = [];
  if (d.maxMin >= 60) out.push(60);
  if (d.maxMin > 60) out.push(Math.min(d.maxMin, 120));
  if (d.maxMin > 120) out.push(Math.min(d.maxMin, d.capMin || d.maxMin));
  return [...new Set(out)];
}

export function ReviewPage({ monthKey, empId, onBack, adminView }: { monthKey: string; empId: string; onBack: () => void; adminView?: boolean }) {
  const [data, setData] = useState<any>(null);
  const [state, setState] = useState<Record<string, DayState>>({});
  const [workArea, setWorkArea] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<any>(null);
  const load = useAction();
  const submit = useAction();

  useEffect(() => {
    load.run(async () => {
      const r = await call(adminView ? 'review.view' : 'sup.employee', { monthKey, empId }, adminView ? 'admin' : 'sup');
      setData(r);
      setWorkArea(r.employee.workArea || '');
      const s: Record<string, DayState> = {};
      r.days.forEach((d: any) => {
        s[d.date] = d.previous
          ? { selected: true, hours: d.previous.hours, task: d.previous.task || '', keepFileUrl: d.previous.fileUrl || '' }
          : { selected: false, hours: '', task: '' };
      });
      setState(s);
    });
  }, [monthKey, empId]);

  const days: any[] = data?.days || [];
  const readOnly = !data?.canSubmit;
  const set = (date: string, patch: Partial<DayState>) => setState(s => ({ ...s, [date]: { ...s[date], ...patch } }));

  const problems = useMemo(() => {
    const p: Record<string, string> = {};
    days.forEach(d => {
      const s = state[d.date];
      if (!s?.selected) return;
      const m = parseHours(s.hours);
      if (m === null) p[d.date] = 'Enter hours as h:mm (for example 2:00)';
      else if (m < 60) p[d.date] = 'Minimum is 1:00';
      else if (m > d.maxMin + 5) p[d.date] = `Punch data allows at most ${fmtHours(d.maxMin)}`;
      else if (d.type !== 'WORKDAY' && !s.task.trim()) p[d.date] = 'Write what the employee worked on';
      else if (d.type !== 'WORKDAY' && wordCount(s.task) > (data?.wordLimit || 200)) p[d.date] = `Keep the task within ${data?.wordLimit || 200} words`;
      else if (s.file && s.file.size > 10 * 1024 * 1024) p[d.date] = 'File is larger than 10 MB';
    });
    return p;
  }, [state, days]);

  const totals = useMemo(() => {
    const t = { otDays: 0, ot: 0, holDays: 0, hol: 0 };
    days.forEach(d => {
      const s = state[d.date];
      if (!s?.selected) return;
      const m = parseHours(s.hours) || 0;
      if (d.type === 'WORKDAY') { t.otDays++; t.ot += m; } else { t.holDays++; t.hol += m; }
    });
    return t;
  }, [state, days]);

  const warnings = useMemo(() => {
    const w: string[] = [];
    const a = data?.approval;
    if (a?.monthlyOtCapMin && totals.ot > a.monthlyOtCapMin) w.push(`Total OT ${fmtHours(totals.ot)} is above the monthly limit of ${fmtHours(a.monthlyOtCapMin)}.`);
    if (a?.otDaysPerWeek) {
      const per: Record<string, number> = {};
      days.forEach(d => {
        if (d.type !== 'WORKDAY' || !state[d.date]?.selected) return;
        const dt = new Date(d.date + 'T00:00:00'); dt.setDate(dt.getDate() - ((dt.getDay() + 1) % 7));
        const k = dt.toISOString().slice(0, 10); per[k] = (per[k] || 0) + 1;
      });
      Object.entries(per).forEach(([k, n]) => { if (n > a.otDaysPerWeek) w.push(`Week starting ${prettyDate(k)}: ${n} OT days selected, approval allows ${a.otDaysPerWeek}.`); });
    }
    return w;
  }, [totals, state, days, data]);

  const selectedCount = totals.otDays + totals.holDays;
  const canSend = !readOnly && selectedCount > 0 && !Object.keys(problems).length && !warnings.length;

  const doSubmit = () => submit.run(async () => {
    const payload = [];
    for (const d of days) {
      const s = state[d.date];
      if (!s?.selected) continue;
      const item: any = { date: d.date, hours: tidyHours(s.hours), task: s.task.trim(), keepFileUrl: s.keepFileUrl || '' };
      if (s.file) { item.fileBase64 = await fileToBase64(s.file); item.fileName = s.file.name; item.mimeType = s.file.type; }
      payload.push(item);
    }
    const r = await call('sup.submit', { monthKey, empId, days: payload, workArea }, 'sup');
    setConfirm(false);
    setDone(r);
  });

  if (load.busy && !data) return <div className="py-20 text-center"><Spinner /></div>;
  if (load.error) return <div className="space-y-4"><ErrorText error={load.error} /><Button variant="secondary" onClick={onBack}>← Back</Button></div>;
  if (!data) return null;
  const emp = data.employee;

  if (done) {
    return (
      <Card>
        <div className="py-10 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl text-green-700">✔</div>
          <h2 className="text-2xl font-extrabold text-slate-900">Review recorded</h2>
          <p className="mt-2 text-slate-600">{emp.name} ({emp.empId}) — {monthLabel(monthKey)}</p>
          <p className="mt-1 text-slate-600">Overtime {done.totals.otDays} days, {done.totals.otHours} h · Weekend/Holiday {done.totals.holDays} days, {done.totals.holHours} h</p>
          {done.replaced && <div className="mx-auto mt-4 max-w-lg"><Notice tone="amber">This updated the earlier review by {done.replaced.by} ({prettyStamp(done.replaced.at)}). The earlier version is kept in the history.</Notice></div>}
          <p className="mt-4 text-sm text-slate-500">A confirmation email has been sent. Please print the report, sign it with the employee, and send it to HR.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="secondary" onClick={() => window.print()}>🖨 Print report</Button>
            <Button onClick={onBack}>Back to my employees</Button>
          </div>
        </div>
        <PrintReport data={data} state={state} totals={totals} monthKey={monthKey} workArea={workArea} />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>← Back to {adminView ? 'list' : 'my employees'}</Button>
        <div className="text-sm text-slate-500">{monthLabel(monthKey)}{data.month.deadline ? ` · Deadline ${prettyDate(data.month.deadline)}` : ''}</div>
      </div>

      <div className="no-print grid grid-cols-2 gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm sm:grid-cols-4">
        <div><div className="text-xs font-bold uppercase text-slate-500">ID</div><div className="font-bold text-[#006a4e]">{emp.empId}</div></div>
        <div><div className="text-xs font-bold uppercase text-slate-500">Name</div><div className="font-bold">{emp.name}</div></div>
        <div><div className="text-xs font-bold uppercase text-slate-500">Designation</div><div className="font-bold">{emp.designation}</div></div>
        <div><div className="text-xs font-bold uppercase text-slate-500">Department</div><div className="font-bold">{emp.department}</div></div>
        <div className="col-span-2 sm:col-span-4"><span className="text-xs font-bold uppercase text-slate-500">Approved by management: </span>{data.approvalText}</div>
      </div>

      {data.submitted && !readOnly && (
        <div className="no-print"><Notice tone="amber" title="You are updating an earlier review">
          Submitted by {data.submitted.by}{data.submitted.onBehalfOf ? ` (on behalf of ${data.submitted.onBehalfOf})` : ''} on {prettyStamp(data.submitted.at)}. Its days are filled in below.
          Submitting again replaces it; the earlier version is kept in the history.
        </Notice></div>
      )}
      {data.yourRole === 'delegate' && !readOnly && <div className="no-print"><Notice tone="blue">You are submitting on behalf of {emp.reviewer}. They will receive a copy of the confirmation.</Notice></div>}
      {readOnly && !adminView && <div className="no-print"><Notice tone="slate">This month is closed. The review is shown for reference only.</Notice></div>}

      <Card className="no-print" title="Attendance and duty" actions={<span className="text-xs font-semibold text-[#006a4e]">২ ও ৩ ঘণ্টার বক্স এন্ট্রির সুবিধার্থে দেওয়া হয়েছে — Actual OT কম হলে সময় Edit করুন</span>}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[#006a4e] text-left text-xs uppercase text-white">
                <th className="px-3 py-2">Date</th><th className="px-3 py-2">Sch</th><th className="px-3 py-2">In / Out</th><th className="px-3 py-2">Worked</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 w-[360px]">Recommend</th>
              </tr>
            </thead>
            <tbody>
              {days.map(d => {
                const s = state[d.date] || { selected: false, hours: '', task: '' };
                const off = d.type !== 'WORKDAY';
                const usable = d.allowed && d.maxMin >= 60;
                return (
                  <tr key={d.date} className={cx('border-b border-slate-100 align-top', off && 'bg-sky-50/40', s.selected && 'bg-emerald-50/70')}>
                    <td className="whitespace-nowrap px-3 py-2"><div className="font-semibold">{prettyDate(d.date)}</div><div className="text-xs text-slate-500">{d.weekday}{d.special && <> · <span className="font-semibold text-amber-700">{d.shift} h shift</span></>}</div></td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{d.schIn ? `${d.schIn.slice(0, 5)}–${d.schOut.slice(0, 5)}` : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2">{d.chkIn ? d.chkIn.slice(0, 5) : '—'} / {d.chkOut ? d.chkOut.slice(0, 5) : '—'}</td>
                    <td className="px-3 py-2">{d.worked}</td>
                    <td className="px-3 py-2">{typeBadge(d)}{d.holidayOnWeekend && <div className="mt-1 text-xs text-sky-700">Falls on weekend</div>}</td>
                    <td className="px-3 py-2">
                      {!usable ? (
                        <span className="text-xs text-slate-400">{d.reason || (d.maxMin < 60 ? 'Less than 1 hour supported by punches' : '')}</span>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            {!off && tiers(d).map((t, i) => (
                              <button key={t} type="button" disabled={readOnly}
                                onClick={() => set(d.date, s.selected && parseHours(s.hours) === t ? { selected: false } : { selected: true, hours: fmtHours(t) })}
                                className={cx('rounded-md border px-2.5 py-1 text-xs font-bold', s.selected && parseHours(s.hours) === t ? 'border-[#006a4e] bg-[#006a4e] text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-[#006a4e]')}>
                                {i === 0 ? '1:00' : fmtHours(t)}
                              </button>
                            ))}
                            {off && (
                              <label className="flex items-center gap-2 text-xs font-semibold">
                                <input type="checkbox" className="h-4 w-4 accent-[#006a4e]" disabled={readOnly} checked={s.selected}
                                  onChange={e => set(d.date, { selected: e.target.checked, hours: s.hours || fmtHours(Math.min(d.maxMin, d.capMin)) })} />
                                Duty done
                              </label>
                            )}
                            {s.selected && (
                              <Input value={s.hours} disabled={readOnly} onChange={e => set(d.date, { hours: e.target.value.replace(/[^0-9:.]/g, '') })}
                                onBlur={e => set(d.date, { hours: tidyHours(e.target.value) })} className="!w-20 !py-1 text-center font-bold" />
                            )}
                            <span className="text-xs text-slate-400">max {fmtHours(d.maxMin)}{off && d.special ? ` (= full day)` : ''}</span>
                          </div>
                          {s.selected && off && (
                            <div className="space-y-1">
                              <TextArea value={s.task} disabled={readOnly} onChange={e => set(d.date, { task: e.target.value })}
                                placeholder="What did the employee work on? (required)" className="!min-h-[56px] text-xs" />
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span>{wordCount(s.task)}/{data.wordLimit} words</span>
                                {!readOnly && <label className="cursor-pointer font-semibold text-[#006a4e] hover:underline">
                                  {s.file ? `📎 ${s.file.name}` : s.keepFileUrl ? 'Replace file' : '📎 Attach proof (optional)'}
                                  <input type="file" className="hidden" accept=".pdf,image/*" onChange={e => set(d.date, { file: (e.target.files || [])[0] || null })} />
                                </label>}
                                {s.keepFileUrl && !s.file && <a href={s.keepFileUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">current file</a>}
                              </div>
                            </div>
                          )}
                          {problems[d.date] && <div className="text-xs font-semibold text-red-600">{problems[d.date]}</div>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="no-print grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="OT duty days" value={totals.otDays} />
        <Stat label="Total OT hours" value={fmtHours(totals.ot)} />
        <Stat label="Weekend/Holiday days" value={totals.holDays} />
        <Stat label="Weekend/Holiday hours" value={fmtHours(totals.hol)} sub="Max 8 h a day (special-schedule shift = full day)" />
      </div>

      {!readOnly && (
        <Card className="no-print">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Work area / location (optional)</span>
              <Input value={workArea} onChange={e => setWorkArea(e.target.value)} placeholder="e.g. Knowledge Tower, 5th floor" />
            </label>
            <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-3 text-sm text-slate-800">
              <b className="text-red-700">গুরুত্বপূর্ণ নোট:</b> যেকোনো হলিডে বা ওভারটাইম ডিউটি বিলের ক্ষেত্রে উপস্থিতির পাঞ্চ বাধ্যতামূলক। সুপারভাইজারের রিকমেন্ডেশন অবশ্যই ম্যানেজমেন্ট প্রদত্ত অনুমোদনের সঙ্গে সামঞ্জস্যপূর্ণ হতে হবে।
            </div>
          </div>
          {warnings.length > 0 && <div className="mt-4"><Notice tone="red" title="Please fix before submitting">{warnings.map(w => <div key={w}>{w}</div>)}</Notice></div>}
          <ErrorText error={submit.error} />
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
            <span className="text-sm text-slate-500">{selectedCount ? `${selectedCount} day(s) selected` : 'Select the days the employee did extra duty'}</span>
            <Button variant="secondary" onClick={() => window.print()} disabled={!selectedCount}>🖨 Print report</Button>
            <Button onClick={() => setConfirm(true)} disabled={!canSend}>{data.submitted ? 'Update review' : 'Submit review'}</Button>
          </div>
        </Card>
      )}

      <PrintReport data={data} state={state} totals={totals} monthKey={monthKey} workArea={workArea} />

      {confirm && (
        <Modal title={data.submitted ? 'Update this review?' : 'Submit this review?'} onClose={() => setConfirm(false)}
          footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button loading={submit.busy} onClick={doSubmit}>Yes, submit</Button></>}>
          <div className="space-y-3 text-sm">
            <p><b>{emp.name}</b> ({emp.empId}) — {monthLabel(monthKey)}</p>
            <p>Overtime: <b>{totals.otDays}</b> days, <b>{fmtHours(totals.ot)}</b> hours<br />Weekend/Holiday: <b>{totals.holDays}</b> days, <b>{fmtHours(totals.hol)}</b> hours</p>
            {data.submitted && <Notice tone="amber">This will replace the review submitted by {data.submitted.by} on {prettyStamp(data.submitted.at)}. The earlier version stays in the history.</Notice>}
            <p className="text-slate-500">Make sure the printed and signed copy shows the same figures.</p>
            <ErrorText error={submit.error} />
          </div>
        </Modal>
      )}
    </div>
  );
}

/** Low-ink A4 page for signatures. Hidden on screen, shown when printing. */
function PrintReport({ data, state, totals, monthKey, workArea }: any) {
  const emp = data.employee;
  const rows = data.days.filter((d: any) => state[d.date]?.selected);
  return (
    <div className="print-only">
      <div className="text-center">
        <div className="text-lg font-bold">Daffodil International University</div>
        <div className="text-base font-bold">Holiday and Overtime Duty Review — {monthLabel(monthKey)}</div>
      </div>
      <table className="mt-3 w-full text-sm"><tbody>
        <tr><td><b>ID:</b> {emp.empId}</td><td><b>Name:</b> {emp.name}</td></tr>
        <tr><td><b>Designation:</b> {emp.designation}</td><td><b>Department:</b> {emp.department}</td></tr>
        <tr><td colSpan={2}><b>Approval:</b> {data.approvalText}{workArea ? <> · <b>Work area:</b> {workArea}</> : null}</td></tr>
      </tbody></table>
      <table className="print-table mt-3 w-full text-sm">
        <thead><tr><th>Date</th><th>Day</th><th>In</th><th>Out</th><th>Type</th><th>Hours</th><th>Task</th></tr></thead>
        <tbody>
          {rows.map((d: any) => (
            <tr key={d.date}><td>{prettyDate(d.date)}</td><td>{d.weekday.slice(0, 3)}</td><td>{(d.chkIn || '').slice(0, 5)}</td><td>{(d.chkOut || '').slice(0, 5)}</td>
              <td>{d.type === 'WORKDAY' ? 'Overtime' : d.type === 'WEEKEND' ? 'Weekend' : 'Holiday'}</td><td>{tidyHours(state[d.date].hours)}</td><td>{state[d.date].task}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-sm"><b>Overtime:</b> {totals.otDays} days, {fmtHours(totals.ot)} hours &nbsp; | &nbsp; <b>Weekend/Holiday:</b> {totals.holDays} days, {fmtHours(totals.hol)} hours</p>
      <div className="mt-20 flex justify-between text-sm">
        <div className="w-56 border-t border-black pt-1 text-center font-bold">Signature of Employee</div>
        <div className="w-72 border-t border-black pt-1 font-bold">Signature of Supervisor<div className="mt-5 font-normal">Name / ID: ______________________</div><div className="mt-4 font-normal">Date: __________________________</div></div>
      </div>
    </div>
  );
}
