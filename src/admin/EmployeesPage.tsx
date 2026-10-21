import React, { useMemo, useState } from 'react';
import { call } from '../lib/api';
import { readGrades, readHrisEmployees } from '../lib/imports';
import { prettyStamp } from '../lib/time';
import { Badge, Button, Card, ErrorText, Field, FilePick, Input, Modal, Notice, Select, Spinner, tableCls, tdCls, thCls, useAction, useToast } from '../components/ui';
import { can, go, Perms, useLoad } from './AdminApp';

export function EmployeesPage({ perms }: { perms: Perms }) {
  const emps = useLoad<any[]>('employees.list', {}, []);
  const dels = useLoad<any[]>('delegates.list', {}, []);
  const [q, setQ] = useState('');
  const [show, setShow] = useState<'all' | 'approved' | 'noReviewer' | 'notInHris'>('approved');
  const [edit, setEdit] = useState<any>(null);
  const [hris, setHris] = useState<{ rows: any[]; diff: any } | null>(null);
  const [grades, setGrades] = useState<{ rows: any[]; diff: any } | null>(null);
  const [addMissing, setAddMissing] = useState(true);
  const [limit, setLimit] = useState(100);
  const a = useAction();
  const toast = useToast();
  const canEdit = can(perms, 'employees', 'edit');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (emps.data || []).filter(e => {
      if (show === 'approved' && !e.approvals) return false;
      if (show === 'noReviewer' && (e.reviewer || !e.approvals)) return false;
      if (show === 'notInHris' && e.inLatestHris !== 'NO') return false;
      return !s || e.name.toLowerCase().includes(s) || e.empId.includes(s) || (e.department || '').toLowerCase().includes(s) || (e.reviewer || '').includes(s);
    });
  }, [emps.data, q, show]);
  const counts = useMemo(() => ({
    all: emps.data?.length || 0, approved: (emps.data || []).filter(e => e.approvals).length,
    noReviewer: (emps.data || []).filter(e => e.approvals && !e.reviewer).length, notInHris: (emps.data || []).filter(e => e.inLatestHris === 'NO').length
  }), [emps.data]);

  const pickHris = (f: File[]) => a.run(async () => {
    const rows = await readHrisEmployees(f[0]);
    setHris({ rows, diff: await call('employees.importHris', { rows, dryRun: true }, 'admin') });
  });
  const pickGrades = (f: File[]) => a.run(async () => {
    const rows = await readGrades(f[0]);
    setGrades({ rows, diff: await call('employees.importGrades', { rows, dryRun: true }, 'admin') });
  });

  return (
    <div className="space-y-5">
      <div><h1 className="text-2xl font-extrabold text-slate-900">Employees &amp; reviewers</h1>
        <p className="text-sm text-slate-500">The reviewer of each employee is their HRIS supervisor, unless you set an override. Delegates can submit on a supervisor’s behalf.</p></div>
      <ErrorText error={emps.error || a.error} />
      {canEdit && (
        <div className="grid gap-5 md:grid-cols-2">
          <Card title="Update from HRIS">
            <p className="mb-3 text-sm text-slate-600">Upload the <b>Employee common info</b> Excel from HRIS. Only ID, name, designation, department, type, category and supervisor are kept — no phone numbers, birthdays or other personal data.</p>
            <FilePick accept=".xlsx,.csv" onFiles={pickHris} label="Choose the HRIS employee file" disabled={a.busy} />
          </Card>
          <Card title="Update grades &amp; gross salary">
            <p className="mb-3 text-sm text-slate-600">Upload a sheet with <b>ID No</b>, <b>Grade</b> and <b>Gross Salary</b> columns (like your “Grade and Salary Info” tab). Used for rates.</p>
            <FilePick accept=".xlsx,.csv" onFiles={pickGrades} label="Choose the grade & salary file" disabled={a.busy} />
          </Card>
        </div>
      )}
      {a.busy && <div className="text-center"><Spinner /></div>}

      <Card title="Employees" actions={<>
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, ID, department, email" className="!w-72 !py-1.5" />
        {canEdit && <Button variant="secondary" onClick={() => setEdit({ isNew: true })}>+ Add employee</Button>}</>}>
        <div className="mb-3 flex flex-wrap gap-2">
          {([['approved', 'With approval'], ['noReviewer', 'Approved, no reviewer'], ['notInHris', 'Not in latest HRIS file'], ['all', 'Everyone']] as const).map(([k, l]) => (
            <Button key={k} variant={show === k ? 'primary' : 'secondary'} onClick={() => { setShow(k); setLimit(100); }}>{l} ({(counts as any)[k]})</Button>
          ))}
        </div>
        {emps.busy && !emps.data ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead><tr>{['Employee', 'Designation / Department', 'Grade / Salary', 'Reviewer', 'Approvals', ''].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
              <tbody>{list.slice(0, limit).map(e => (
                <tr key={e.empId} className="hover:bg-slate-50">
                  <td className={tdCls}><div className="font-semibold">{e.name}</div><div className="text-xs text-slate-500">{e.empId} · {e.employeeType}{e.inLatestHris === 'NO' && <> · <span className="text-red-600">not in latest HRIS</span></>}</div></td>
                  <td className={tdCls}><div>{e.designation}</div><div className="text-xs text-slate-500">{e.department}</div></td>
                  <td className={tdCls + ' text-xs'}>{e.grade || '—'}<br />{e.grossSalary ? `৳ ${Number(e.grossSalary).toLocaleString('en-IN')}` : ''}{(e.holidayRateOverride || e.otRateOverride) && <div><Badge tone="purple">rate override</Badge></div>}</td>
                  <td className={tdCls + ' text-xs'}>
                    {e.reviewer ? <div className="font-semibold">{e.reviewer}</div> : <Badge tone="red">none</Badge>}
                    {e.reviewerOverrideEmail && <div className="text-amber-700">override (HRIS: {e.supervisorEmail || '—'})</div>}
                    {!e.reviewerOverrideEmail && e.supervisorName && <div className="text-slate-500">{e.supervisorName}</div>}
                    {e.delegates.length > 0 && <div className="text-sky-700">delegate: {e.delegates.join(', ')}</div>}
                  </td>
                  <td className={tdCls}><button className="text-sky-700 hover:underline" onClick={() => go('approvals/' + e.empId)}>{e.approvals ? `${e.approvals} active` : 'none'}</button></td>
                  <td className={tdCls + ' text-right'}>{canEdit && <Button variant="ghost" onClick={() => setEdit(e)}>Edit</Button>}</td>
                </tr>
              ))}</tbody>
            </table>
            {list.length > limit && <div className="mt-3 text-center"><Button variant="secondary" onClick={() => setLimit(l => l + 200)}>Show more ({list.length - limit} more)</Button></div>}
          </div>
        )}
      </Card>

      <Delegates perms={perms} dels={dels} onChanged={() => { dels.reload(); emps.reload(); }} />

      {edit && <EditEmployee emp={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); emps.reload(); toast('Saved.'); }} />}
      {hris && (
        <Modal wide title="Changes from the HRIS file" onClose={() => setHris(null)}
          footer={<><Button variant="secondary" onClick={() => setHris(null)}>Cancel</Button><Button loading={a.busy} onClick={() => a.run(async () => {
            await call('employees.importHris', { rows: hris.rows }, 'admin'); setHris(null); emps.reload(); toast('Employee list updated from HRIS.');
          })}>Apply changes</Button></>}>
          <div className="space-y-4 text-sm">
            <p>The file has <b>{hris.rows.length}</b> employees. <b>{hris.diff.added}</b> new, <b>{hris.diff.changed.length}</b> changed, <b>{hris.diff.missing.length}</b> in the list but not in this file.</p>
            {hris.diff.changed.length > 0 && <div><div className="mb-1 font-bold">Changed</div><div className="max-h-56 overflow-auto rounded border border-slate-200">
              <table className={tableCls}><tbody>{hris.diff.changed.map((c: any) => (
                <tr key={c.empId}><td className={tdCls}>{c.empId}</td><td className={tdCls}>{c.name}</td><td className={tdCls + ' text-xs'}>{Object.entries(c.diff).map(([k, v]: any) => <div key={k}><b>{k}</b>: {v.from || '—'} → {v.to}</div>)}</td></tr>
              ))}</tbody></table></div></div>}
            {hris.diff.missing.filter((m: any) => m.hasApproval).length > 0 && <Notice tone="amber" title="Employees with an approval who are not in this HRIS file (resigned or moved?)">
              {hris.diff.missing.filter((m: any) => m.hasApproval).map((m: any) => <div key={m.empId}>{m.empId} {m.name}</div>)}
              <div className="mt-1">They stay in the list (marked “not in latest HRIS”). Check whether their approvals should end.</div>
            </Notice>}
            {hris.diff.added > 0 && <details><summary className="cursor-pointer font-bold">New employees ({hris.diff.added})</summary><div className="mt-2 max-h-40 overflow-auto text-xs">{hris.diff.addedList.map((x: any) => <div key={x.empId}>{x.empId} {x.name} — {x.department}</div>)}</div></details>}
            <ErrorText error={a.error} />
          </div>
        </Modal>
      )}
      {grades && (
        <Modal title="Grades & salary" onClose={() => setGrades(null)}
          footer={<><Button variant="secondary" onClick={() => setGrades(null)}>Cancel</Button><Button disabled={!grades.diff.updated && !(addMissing && grades.diff.unknown.length)} loading={a.busy} onClick={() => a.run(async () => {
            const r = await call('employees.importGrades', { rows: grades.rows, addMissing }, 'admin'); setGrades(null); emps.reload(); toast(`Grades and salaries updated${r.added ? `; ${r.added} employees added` : ''}.`);
          })}>Save</Button></>}>
          <div className="space-y-2 text-sm"><p>{grades.rows.length} rows read. <b>{grades.diff.updated}</b> employees will be updated.</p>
            {grades.diff.unknown.length > 0 && <Notice tone="amber">{grades.diff.unknown.length} IDs are not in the employee list: {grades.diff.unknown.slice(0, 30).join(', ')}{grades.diff.unknown.length > 30 ? '…' : ''}
              <label className="mt-2 flex items-center gap-2 font-semibold"><input type="checkbox" checked={addMissing} onChange={e => setAddMissing(e.target.checked)} /> Add them to the employee list using the name, designation and department in this file</label>
              <div className="mt-1 text-xs">They will have no reviewer until you set one (they are usually not in the HRIS employee export).</div></Notice>}
            <ErrorText error={a.error} /></div>
        </Modal>
      )}
    </div>
  );
}

function EditEmployee({ emp, onClose, onSaved }: { emp: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({
    empId: emp.empId || '', name: emp.name || '', designation: emp.designation || '', department: emp.department || '', employeeType: emp.employeeType || '',
    grade: emp.grade || '', grossSalary: emp.grossSalary || '', supervisorName: emp.supervisorName || '', supervisorEmail: emp.supervisorEmail || '',
    reviewerOverrideEmail: emp.reviewerOverrideEmail || '', holidayRateOverride: emp.holidayRateOverride || '', otRateOverride: emp.otRateOverride || '', workArea: emp.workArea || ''
  });
  const a = useAction();
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal wide title={emp.isNew ? 'Add employee' : `${emp.name} (${emp.empId})`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={a.busy} onClick={() => a.run(async () => { await call('employees.update', f, 'admin'); onSaved(); })}>Save</Button></>}>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Employee ID"><Input value={f.empId} disabled={!emp.isNew} onChange={set('empId')} /></Field>
        <Field label="Name"><Input value={f.name} onChange={set('name')} /></Field>
        <Field label="Designation"><Input value={f.designation} onChange={set('designation')} /></Field>
        <Field label="Department"><Input value={f.department} onChange={set('department')} /></Field>
        <Field label="Employee type"><Select value={f.employeeType} onChange={set('employeeType')}><option value=""></option><option>Admin</option><option>Below Officer</option><option>Academic</option></Select></Field>
        <Field label="Grade"><Input value={f.grade} onChange={set('grade')} /></Field>
        <Field label="Gross salary"><Input value={f.grossSalary} onChange={set('grossSalary')} /></Field>
        <Field label="Work area"><Input value={f.workArea} onChange={set('workArea')} /></Field>
        <Field label="HRIS supervisor" hint="Comes from the HRIS upload"><Input value={f.supervisorName} onChange={set('supervisorName')} /></Field>
        <Field label="HRIS supervisor email"><Input value={f.supervisorEmail} onChange={set('supervisorEmail')} /></Field>
        <Field label="Reviewer override email" hint="Use when the HRIS supervisor is missing, wrong or bounces. Leave blank to use the HRIS supervisor." className="md:col-span-2">
          <Input value={f.reviewerOverrideEmail} onChange={set('reviewerOverrideEmail')} placeholder="name@daffodilvarsity.edu.bd" />
        </Field>
        <Field label="Holiday rate override (BDT/day)" hint="Blank = use the rate rules"><Input value={f.holidayRateOverride} onChange={set('holidayRateOverride')} /></Field>
        <Field label="OT rate override (BDT/hour)" hint="Blank = use the rate rules"><Input value={f.otRateOverride} onChange={set('otRateOverride')} /></Field>
      </div>
      <div className="mt-3"><ErrorText error={a.error} /></div>
    </Modal>
  );
}

function Delegates({ perms, dels, onChanged }: { perms: Perms; dels: any; onChanged: () => void }) {
  const [f, setF] = useState({ supervisorEmail: '', delegateEmail: '', note: '' });
  const a = useAction();
  const canEdit = can(perms, 'employees', 'edit');
  return (
    <Card title="Delegates (submit on behalf of a supervisor)">
      <p className="mb-3 text-sm text-slate-600">A delegate can review all employees of that supervisor. Submissions say “by delegate on behalf of supervisor”, and the supervisor gets a copy of the confirmation.</p>
      {canEdit && (
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <Input placeholder="Supervisor email" value={f.supervisorEmail} onChange={e => setF({ ...f, supervisorEmail: e.target.value })} />
          <Input placeholder="Delegate email" value={f.delegateEmail} onChange={e => setF({ ...f, delegateEmail: e.target.value })} />
          <Input placeholder="Note (optional)" value={f.note} onChange={e => setF({ ...f, note: e.target.value })} />
          <Button loading={a.busy} onClick={() => a.run(async () => { await call('delegates.save', f, 'admin'); setF({ supervisorEmail: '', delegateEmail: '', note: '' }); onChanged(); })}>Add delegate</Button>
        </div>
      )}
      <ErrorText error={a.error || dels.error} />
      {dels.busy && !dels.data ? <Spinner /> : !dels.data?.length ? <p className="text-sm text-slate-500">No delegates yet.</p> : (
        <table className={tableCls}>
          <thead><tr>{['Supervisor', 'Delegate', 'Note', 'Added', 'Status', ''].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>{dels.data.map((d: any) => (
            <tr key={d.supervisorEmail + d.delegateEmail}>
              <td className={tdCls}>{d.supervisorEmail}</td><td className={tdCls}>{d.delegateEmail}</td><td className={tdCls + ' text-xs'}>{d.note}</td>
              <td className={tdCls + ' text-xs'}>{prettyStamp(d.addedAt)}<div className="text-slate-500">{d.addedBy}</div></td>
              <td className={tdCls}>{d.active ? <Badge tone="green">active</Badge> : <Badge>stopped</Badge>}</td>
              <td className={tdCls + ' text-right'}>{canEdit && <Button variant={d.active ? 'danger' : 'secondary'} onClick={() => a.run(async () => { await call('delegates.save', { ...d, active: !d.active }, 'admin'); onChanged(); })}>{d.active ? 'Stop' : 'Restore'}</Button>}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </Card>
  );
}
