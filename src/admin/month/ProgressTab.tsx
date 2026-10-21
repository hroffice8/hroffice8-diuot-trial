import React, { useMemo, useState } from 'react';
import { call } from '../../lib/api';
import { prettyStamp } from '../../lib/time';
import { Badge, Button, Card, ErrorText, Modal, Notice, Spinner, Stat, tableCls, tdCls, thCls, useAction, useToast } from '../../components/ui';
import { can, go, Perms, useLoad } from '../AdminApp';
import { ReviewPage } from '../../supervisor/ReviewPage';

export function ProgressTab({ month, perms }: { month: any; perms: Perms }) {
  const prog = useLoad<any>('progress.get', { monthKey: month.monthKey }, [month.monthKey]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [mail, setMail] = useState<null | { type: 'invite' | 'reminder'; onlyTo: string[] }>(null);
  const [bounces, setBounces] = useState<any[] | null>(null);
  const [view, setView] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const b = useAction();
  const canMail = can(perms, 'mail', 'edit') && month.status === 'REVIEW';

  const list = useMemo(() => (prog.data?.reviewers || []).filter((g: any) => filter === 'all' || (filter === 'done' ? g.done === g.total : g.done < g.total)), [prog.data, filter]);
  const pickedList = Object.keys(picked).filter(k => picked[k]);

  if (view) return <ReviewPage adminView monthKey={month.monthKey} empId={view} onBack={() => setView(null)} />;
  if (prog.busy && !prog.data) return <div className="py-10 text-center"><Spinner /></div>;
  const d = prog.data;
  return (
    <div className="space-y-5">
      <ErrorText error={prog.error} />
      {d && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Reviewed" value={`${d.done} / ${d.total}`} tone={d.done < d.total ? 'amber' : 'green'} />
          <Stat label="Reviewers" value={d.reviewers.length} />
          <Stat label="Reviewers finished" value={d.reviewers.filter((g: any) => g.done === g.total).length} />
          <Stat label="No reviewer email" value={d.noReviewer.length} tone={d.noReviewer.length ? 'red' : 'green'} />
        </div>
      )}
      <Card title="Emails" actions={<>
        <Button variant="secondary" loading={b.busy} onClick={() => b.run(async () => setBounces((await call('mail.bounces', {}, 'admin')).bounced))}>Check bounced emails</Button>
        {canMail && <Button variant="secondary" onClick={() => setMail({ type: 'reminder', onlyTo: pickedList })}>Send reminders{pickedList.length ? ` (${pickedList.length} selected)` : ''}</Button>}
        {canMail && <Button onClick={() => setMail({ type: 'invite', onlyTo: pickedList })}>Send invitations{pickedList.length ? ` (${pickedList.length} selected)` : ''}</Button>}</>}>
        <p className="text-sm text-slate-600">Each reviewer gets one personal email listing only their own employees, with the portal link and the deadline. Delegates get a copy. Reminders go only to reviewers with employees still pending, and are also sent automatically a few days before the deadline (see Settings).
          {month.status !== 'REVIEW' && <b> Emails can be sent while the month is open for review.</b>}</p>
        <ErrorText error={b.error} />
        {bounces && (
          <div className="mt-3">{!bounces.length ? <Notice tone="green">No bounced emails in the last 14 days.</Notice> : (
            <Notice tone="red" title={`${bounces.length} address(es) could not be delivered`}>
              {bounces.map(x => <div key={x.email}>{x.email} — {x.at}{x.employees ? ` · reviewer for ${x.employees} employee(s)` : ''}</div>)}
              <div className="mt-2">Fix the address in <button className="font-bold underline" onClick={() => go('employees')}>Employees &amp; reviewers</button> (set a reviewer override), then resend to that person.</div>
            </Notice>)}</div>
        )}
      </Card>

      {d?.noReviewer.length > 0 && (
        <Card title={`Eligible employees with no reviewer email (${d.noReviewer.length})`}>
          <p className="mb-2 text-sm text-slate-600">Nobody can review these employees until you set a reviewer in <button className="font-semibold text-sky-700 hover:underline" onClick={() => go('employees')}>Employees &amp; reviewers</button>.</p>
          <div className="flex flex-wrap gap-2">{d.noReviewer.map((e: any) => <Badge key={e.empId} tone={e.submitted ? 'green' : 'red'}>{e.empId} {e.name}</Badge>)}</div>
        </Card>
      )}

      <Card title="Progress by reviewer" actions={
        <div className="flex gap-1">{(['all', 'pending', 'done'] as const).map(f => <Button key={f} variant={filter === f ? 'primary' : 'secondary'} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f === 'pending' ? 'Still pending' : 'Finished'}</Button>)}</div>}>
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead><tr><th className={thCls}></th><th className={thCls}>Reviewer</th><th className={thCls}>Delegates</th><th className={thCls}>Progress</th><th className={thCls}>Last email</th><th className={thCls}></th></tr></thead>
            <tbody>
              {list.map((g: any) => (
                <React.Fragment key={g.reviewer}>
                  <tr className="hover:bg-slate-50">
                    <td className={tdCls}><input type="checkbox" checked={!!picked[g.reviewer]} onChange={e => setPicked(p => ({ ...p, [g.reviewer]: e.target.checked }))} /></td>
                    <td className={tdCls}><div className="font-semibold">{g.reviewer}</div><div className="text-xs text-slate-500">{g.supervisorName}</div></td>
                    <td className={tdCls + ' text-xs'}>{g.delegates.join(', ') || '—'}</td>
                    <td className={tdCls}><Badge tone={g.done === g.total ? 'green' : g.done ? 'amber' : 'red'}>{g.done} / {g.total}</Badge></td>
                    <td className={tdCls + ' text-xs'}>{g.lastEmail ? <>{g.lastEmail.type} · {prettyStamp(g.lastEmail.at)} {g.lastEmail.status !== 'SENT' && <Badge tone="red">{g.lastEmail.status}</Badge>}</> : '—'}</td>
                    <td className={tdCls + ' text-right'}><Button variant="ghost" onClick={() => setOpen(o => ({ ...o, [g.reviewer]: !o[g.reviewer] }))}>{open[g.reviewer] ? 'Hide' : 'Employees'}</Button></td>
                  </tr>
                  {open[g.reviewer] && (
                    <tr><td colSpan={6} className="bg-slate-50 px-6 py-3">
                      <table className="w-full text-xs"><tbody>{g.employees.map((e: any) => (
                        <tr key={e.empId}><td className="py-1 pr-3">{e.empId}</td><td className="pr-3 font-semibold">{e.name}</td><td className="pr-3 text-slate-500">{e.department}</td>
                          <td className="pr-3">{e.submitted ? <Badge tone="green">by {e.submittedBy} · {prettyStamp(e.submittedAt)}</Badge> : e.hasAttendance ? <Badge tone="amber">pending</Badge> : <Badge tone="slate">no attendance</Badge>}</td>
                          <td>{e.hasAttendance && <button className="font-semibold text-sky-700 hover:underline" onClick={() => setView(e.empId)}>view</button>}</td></tr>
                      ))}</tbody></table>
                    </td></tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {mail && <MailModal month={month} type={mail.type} onlyTo={mail.onlyTo} onClose={() => setMail(null)} onSent={() => { setMail(null); setPicked({}); prog.reload(); }} />}
    </div>
  );
}

function MailModal({ month, type, onlyTo, onClose, onSent }: { month: any; type: 'invite' | 'reminder'; onlyTo: string[]; onClose: () => void; onSent: () => void }) {
  const plan = useLoad<any>('mail.preview', { monthKey: month.monthKey, type, onlyTo }, []);
  const a = useAction();
  const toast = useToast();
  const n = plan.data?.recipients.length || 0;
  return (
    <Modal wide title={type === 'invite' ? 'Send invitations' : 'Send reminders'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!n} loading={a.busy} onClick={() => a.run(async () => {
        const r = await call('mail.send', { monthKey: month.monthKey, type, onlyTo }, 'admin');
        toast(`${r.sent} email(s) sent.${r.failed.length ? ` ${r.failed.length} failed.` : ''}`, r.failed.length ? 'red' : 'green'); onSent();
      })}>Send {n} email(s)</Button></>}>
      {plan.busy ? <Spinner /> : plan.error ? <ErrorText error={plan.error} /> : (
        <div className="space-y-3 text-sm">
          <p><b>{n}</b> reviewer(s){onlyTo.length ? ' (only the ones you selected)' : ''}. Google allows <b>{plan.data.quota}</b> more emails today.</p>
          {!n && <Notice tone="amber">Nobody to email{type === 'reminder' ? ' — everyone has finished.' : '.'}</Notice>}
          {plan.data.noReviewer.length > 0 && <Notice tone="red">{plan.data.noReviewer.length} eligible employee(s) have no reviewer email and are not included.</Notice>}
          {n > 0 && (<>
            <div className="max-h-40 overflow-auto rounded border border-slate-200 p-2 text-xs">{plan.data.recipients.map((r: any) => <div key={r.to}>{r.to}{r.cc.length ? ` (cc ${r.cc.join(', ')})` : ''} — {r.employees.length} employee(s)</div>)}</div>
            <div className="text-xs font-bold uppercase text-slate-500">Example: email to {plan.data.recipients[0].to}</div>
            <iframe title="Email preview" srcDoc={plan.data.sampleHtml} className="h-[420px] w-full rounded border border-slate-200 bg-white" />
          </>)}
          <ErrorText error={a.error} />
        </div>
      )}
    </Modal>
  );
}
