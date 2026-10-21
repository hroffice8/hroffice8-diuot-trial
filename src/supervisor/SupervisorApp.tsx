import React, { useEffect, useMemo, useState } from 'react';
import { call, session } from '../lib/api';
import { monthLabel, prettyDate, prettyStamp } from '../lib/time';
import { SignIn } from '../components/SignIn';
import { Badge, Button, Card, ErrorText, Notice, Spinner, tableCls, tdCls, thCls, useAction } from '../components/ui';
import { ReviewPage } from './ReviewPage';

function Header({ email, onSignOut }: { email?: string; onSignOut?: () => void }) {
  return (
    <header className="no-print border-b-4 border-[#006a4e] bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-[#006a4e]">Daffodil International University · HR</div>
          <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">Holiday &amp; Overtime Duty Review <span className="ml-1 align-middle rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">TRIAL</span></h1>
        </div>
        {email && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">{email}</span>
            <Button variant="secondary" onClick={onSignOut}>Sign out</Button>
          </div>
        )}
      </div>
    </header>
  );
}

function Instructions({ info }: { info: any }) {
  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-slate-800">
        <h3 className="mb-2 font-bold text-[#006a4e]">📝 গুরুত্বপূর্ণ নির্দেশনা</h3>
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
          <li>আপনার অফিসিয়াল ইমেইল দিয়ে সাইন ইন করুন। আপনার অধীনস্থ কর্মীদের তালিকা দেখতে পাবেন।</li>
          <li>হলিডে/উইকেন্ড ডিউটি এবং ওভারটাইম ডিউটি সুপারিশ করার পর সংশ্লিষ্ট রিপোর্ট প্রিন্ট করতে হবে এবং কর্মী ও সুপারভাইজার উভয়ের স্বাক্ষর গ্রহণ করতে হবে।</li>
          <li>প্রিন্ট কপিতে উল্লেখিত তথ্য এবং অনলাইনে সাবমিট করা তথ্য যেন একই হয়—এটি নিশ্চিত করতে হবে।</li>
          <li>একই কর্মীর জন্য আবার সাবমিট করলে আগের এন্ট্রি আপডেট হবে (আগের সংস্করণ রেকর্ডে থাকবে)।</li>
        </ol>
        {info?.tutorialUrl && <a href={info.tutorialUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-[#006a4e] hover:underline">🎥 Video Tutorial (ভিডিও টিউটোরিয়াল দেখুন)</a>}
      </div>
      {info?.contactName && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <b>📌 বিশেষ দ্রষ্টব্য:</b> কোনো যোগ্য কর্মীর অ্যাটেনডেন্স পোর্টালে পাওয়া না গেলে, বা তালিকায় নাম না থাকলেও অনুমোদিত ওভারটাইম/হলিডে ডিউটি থাকলে যোগাযোগ করুন:
          <div className="mt-2 font-bold text-[#006a4e]">{info.contactName}, {info.contactTitle} — ফোন {info.contactPhone}{info.contactExt ? ` | এক্সটেনশন ${info.contactExt}` : ''}</div>
        </div>
      )}
    </div>
  );
}

export default function SupervisorApp() {
  const [email, setEmail] = useState(session.token('sup') ? session.email('sup') : '');
  const [info, setInfo] = useState<any>(null);
  const [months, setMonths] = useState<any[] | null>(null);
  const [monthKey, setMonthKey] = useState('');
  const [team, setTeam] = useState<any>(null);
  const [empId, setEmpId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const { busy, error, run, setError } = useAction();

  useEffect(() => { call('public.info').then(setInfo).catch(() => { }); }, []);

  const signOut = () => { session.clear('sup'); setEmail(''); setMonths(null); setTeam(null); setEmpId(null); };

  useEffect(() => {
    if (!email) return;
    run(async () => {
      try {
        const m = await call<any[]>('sup.months', {}, 'sup');
        setMonths(m);
        const wanted = new URLSearchParams(location.search).get('month') || '';
        const pick = m.find(x => x.monthKey === wanted) || m[0];
        if (pick) setMonthKey(pick.monthKey);
      } catch (e: any) { if (e.code === 'AUTH') signOut(); throw e; }
    });
  }, [email]);

  const loadTeam = () => run(async () => { setTeam(await call('sup.team', { monthKey }, 'sup')); });
  useEffect(() => { if (monthKey) loadTeam(); }, [monthKey]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (team?.team || []).filter((t: any) => !q || t.name.toLowerCase().includes(q) || t.empId.includes(q) || (t.department || '').toLowerCase().includes(q));
  }, [team, filter]);

  if (!email) {
    return (<><Header /><main className="mx-auto max-w-3xl px-4 py-8"><SignIn role="sup" onDone={e => setEmail(e)} intro={<Instructions info={info} />} /></main></>);
  }

  if (empId && monthKey) {
    return (<><Header email={email} onSignOut={signOut} />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <ReviewPage monthKey={monthKey} empId={empId} onBack={() => { setEmpId(null); loadTeam(); }} />
      </main></>);
  }

  const done = (team?.team || []).filter((t: any) => t.submitted).length;
  return (
    <>
      <Header email={email} onSignOut={signOut} />
      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
        <ErrorText error={error} />
        {months && !months.length && <Notice tone="amber" title="No month is open for review right now.">You will receive an email from HR when the next month opens.</Notice>}
        {months && months.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {months.map(m => <Button key={m.monthKey} variant={m.monthKey === monthKey ? 'primary' : 'secondary'} onClick={() => setMonthKey(m.monthKey)}>{m.label}</Button>)}
          </div>
        )}
        {busy && !team && <div className="py-16 text-center"><Spinner /></div>}
        {team && (
          <Card title={<>Your employees — {monthLabel(monthKey)}</>} actions={
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search name, ID, department"
              className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />}>
            <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
              <Badge tone={done === team.team.length && done > 0 ? 'green' : 'amber'}>{done} of {team.team.length} reviewed</Badge>
              {team.month.deadline && <span className="text-slate-600">Deadline: <b>{prettyDate(team.month.deadline)}</b></span>}
              {!team.canSubmit && <Badge tone="red">This month is closed — view only</Badge>}
            </div>
            {!team.team.length ? (
              <Notice tone="amber" title="No employees found for your email this month.">
                If you supervise employees with overtime or holiday approval, please contact HR so they can set you as their reviewer.
              </Notice>
            ) : (
              <div className="overflow-x-auto">
                <table className={tableCls}>
                  <thead><tr><th className={thCls}>Employee</th><th className={thCls}>Designation / Department</th><th className={thCls}>Status</th><th className={thCls}></th></tr></thead>
                  <tbody>
                    {shown.map((t: any) => (
                      <tr key={t.empId} className="hover:bg-slate-50">
                        <td className={tdCls}><div className="font-semibold text-slate-900">{t.name}</div><div className="text-xs text-slate-500">{t.empId}{t.role === 'delegate' && <> · on behalf of {t.reviewer}</>}</div></td>
                        <td className={tdCls}><div>{t.designation}</div><div className="text-xs text-slate-500">{t.department}</div></td>
                        <td className={tdCls}>
                          {t.submitted ? (<><Badge tone="green">Submitted</Badge><div className="mt-1 text-xs text-slate-500">{prettyStamp(t.submitted.at)} by {t.submitted.by}{Number(t.submitted.version) > 1 ? ` (v${t.submitted.version})` : ''}</div><div className="text-xs text-slate-500">OT {t.submitted.otHours} · Holiday/Weekend {t.submitted.holHours}</div></>)
                            : t.hasAttendance ? <Badge tone="amber">Pending</Badge> : <Badge tone="slate">No attendance found</Badge>}
                        </td>
                        <td className={tdCls + ' text-right'}>
                          {t.hasAttendance && <Button variant={t.submitted ? 'secondary' : 'primary'} onClick={() => { setError(null); setEmpId(t.empId); }}>{t.submitted ? (team.canSubmit ? 'View / update' : 'View') : 'Review'}</Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
        <Instructions info={info} />
      </main>
    </>
  );
}
