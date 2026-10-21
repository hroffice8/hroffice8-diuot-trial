import React, { useMemo, useState } from 'react';
import { call } from '../lib/api';
import { readApprovalsTemplate, APPROVAL_TEMPLATE_COLUMNS, ApprovalInput } from '../lib/imports';
import { writeXlsx, downloadBlob } from '../lib/xlsx';
import { WEEKDAYS } from '../lib/approvalText.js';
import { prettyDate, prettyStamp } from '../lib/time';
import { Badge, Button, Card, ErrorText, Field, FilePick, Input, Modal, Notice, Select, Spinner, TextArea, cx, tableCls, tdCls, thCls, useAction, useToast } from '../components/ui';
import { can, go, Perms, useLoad } from './AdminApp';

const PRESETS: [string, Partial<any>][] = [
  ['Evening & all off day', { dailyOtCap: '2', weekendDuty: true, holidayDuty: true }],
  ['Evening & only Friday (weekend)', { dailyOtCap: '2', weekendDuty: true, holidayDuty: false }],
  ['Only evening (workday OT)', { dailyOtCap: '2', weekendDuty: false, holidayDuty: false }],
  ['Only Friday (weekend)', { dailyOtCap: '0', weekendDuty: true, holidayDuty: false }],
  ['All off days (weekend + holiday)', { dailyOtCap: '0', weekendDuty: true, holidayDuty: true }]
];

const summary = (a: any) => [
  a.dailyOtCap && a.dailyOtCap !== '0:00' ? `OT ${a.dailyOtCap}/day` : 'No workday OT',
  a.otWeekdays?.length ? `on ${a.otWeekdays.map((d: string) => d.slice(0, 3)).join(', ')}` : '',
  a.otDaysPerWeek ? `max ${a.otDaysPerWeek} days/week` : '', a.monthlyOtCap ? `max ${a.monthlyOtCap}/month` : ''
].filter(Boolean).join(' · ');

export function ApprovalsPage({ perms, empId }: { perms: Perms; empId?: string }) {
  const list = useLoad<any[]>('approvals.list', {}, []);
  const [q, setQ] = useState(empId || '');
  const [src, setSrc] = useState<'all' | 'HR' | 'Maintenance'>('all');
  const [onlyActive, setOnlyActive] = useState(true);
  const [edit, setEdit] = useState<any>(null);
  const [bulk, setBulk] = useState<{ rows: ApprovalInput[]; check: any } | null>(null);
  const [limit, setLimit] = useState(150);
  const a = useAction();
  const toast = useToast();
  const canEdit = can(perms, 'approvals', 'edit');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list.data || []).filter(x => (!onlyActive || x.active) && (src === 'all' || x.source === src) &&
      (!s || x.empId.includes(s) || x.name.toLowerCase().includes(s) || (x.department || '').toLowerCase().includes(s) || (x.notes || '').toLowerCase().includes(s)))
      .sort((x, y) => (x.empId === y.empId ? (x.createdAt < y.createdAt ? 1 : -1) : x.empId < y.empId ? -1 : 1));
  }, [list.data, q, src, onlyActive]);

  const template = async () => downloadBlob(await writeXlsx([{ name: 'Approvals', columns: APPROVAL_TEMPLATE_COLUMNS.map(h => ({ header: h, width: Math.max(12, Math.min(28, h.length)) })),
    rows: [['710000081', '', '', '2', '', '', '', 'YES', 'YES', '8', 'NO', 'Memo HR/2026/15', 'Evening & all off day'],
      ['710000212', '', '', '2', '', 'Saturday, Wednesday, Thursday', '', 'YES', 'NO', '8', 'NO', '', 'OT only 3 named days'],
      ['710002300', '2026-06-15', '2026-07-15', '3', '', '', '', 'YES', 'YES', '8', 'NO', '', 'Seasonal 3H'],
      ['710001397', '', '', '4', '90', '', '', 'YES', 'YES', '8', 'NO', '', 'Special: 4H a day, 90H a month']] }]), 'Approvals template.xlsx');

  const exportAll = async () => downloadBlob(await writeXlsx([{ name: 'Approvals', columns: ['Employee ID', 'Name', 'Department', 'Valid From', 'Valid To', 'Daily OT Cap', 'Monthly OT Cap', 'OT Weekdays', 'OT Days per Week', 'Weekend Duty', 'Holiday Duty', 'Holiday Max Hours', 'Security Bonus', 'Source', 'Month', 'Reference', 'Notes', 'Active', 'Created', 'Created By'].map(h => ({ header: h, width: 14 })),
    rows: rows.map(x => [x.empId, x.name, x.department, x.validFrom, x.validTo, x.dailyOtCap, x.monthlyOtCap, (x.otWeekdays || []).join(', '), x.otDaysPerWeek, x.weekendDuty ? 'YES' : 'NO', x.holidayDuty ? 'YES' : 'NO', x.holidayMaxHours, x.securityBonus ? 'YES' : 'NO', x.source, x.month, x.reference, x.notes, x.active ? 'YES' : 'NO', x.createdAt, x.createdBy]) }]), 'Approvals.xlsx');

  const pickBulk = (f: File[]) => a.run(async () => {
    const rows = await readApprovalsTemplate(f[0]);
    const local = rows.filter(r => r.problems?.length).map(r => ({ row: r.sourceRow, empId: r.empId, message: r.problems!.join('; ') }));
    const check = await call('approvals.import', { rows, dryRun: true }, 'admin');
    setBulk({ rows, check: { ...check, errors: [...local, ...check.errors] } });
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-extrabold text-slate-900">Approvals</h1>
          <p className="text-sm text-slate-500">What each employee is approved for. An employee is “eligible” in a month when an active approval covers that month.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportAll}>⬇ Export</Button>
          {canEdit && <Button onClick={() => setEdit({ weekendDuty: true, holidayDuty: true, dailyOtCap: '2', holidayMaxHours: '8', empId: empId || '' })}>+ Add approval</Button>}
        </div>
      </div>
      <ErrorText error={list.error || a.error} />
      {canEdit && (
        <Card title="Bulk upload" actions={<Button variant="ghost" onClick={template}>Download the template</Button>}>
          <p className="mb-3 text-sm text-slate-600">Fill the template (one row per approval) and upload it. Every row is checked first; nothing is saved if a row has a problem. Uploaded rows are <b>added</b> — to change an existing approval, edit it below or deactivate it.</p>
          <FilePick accept=".xlsx,.csv" onFiles={pickBulk} label="Choose the filled approvals template" disabled={a.busy} />
        </Card>
      )}
      <Card title={`${rows.length} approval(s)`} actions={<>
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search ID, name, department, notes" className="!w-64 !py-1.5" />
        <Select value={src} onChange={e => setSrc(e.target.value as any)} className="!w-40 !py-1.5"><option value="all">All sources</option><option value="HR">HR approvals</option><option value="Maintenance">Maintenance (monthly)</option></Select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} /> Active only</label></>}>
        {list.busy && !list.data ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead><tr>{['Employee', 'Valid', 'Workday OT', 'Weekend', 'Holiday', 'Source', 'Notes', ''].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
              <tbody>{rows.slice(0, limit).map(x => (
                <tr key={x.approvalId} className={cx('hover:bg-slate-50', !x.active && 'opacity-50')}>
                  <td className={tdCls}><div className="font-semibold">{x.name || '(unknown)'}</div><div className="text-xs text-slate-500">{x.empId} · {x.department}</div></td>
                  <td className={tdCls + ' whitespace-nowrap text-xs'}>{x.validFrom || x.validTo ? `${x.validFrom ? prettyDate(x.validFrom) : '…'} – ${x.validTo ? prettyDate(x.validTo) : '…'}` : 'Ongoing'}</td>
                  <td className={tdCls + ' text-xs'}>{summary(x)}{x.securityBonus && <div><Badge tone="purple">+ special-schedule hours</Badge></div>}</td>
                  <td className={tdCls}>{x.weekendDuty ? <Badge tone="green">Yes</Badge> : <Badge>No</Badge>}</td>
                  <td className={tdCls}>{x.holidayDuty ? <Badge tone="green">Yes{x.holidayMaxHours && x.holidayMaxHours !== '8:00' ? ` (max ${x.holidayMaxHours})` : ''}</Badge> : <Badge>No</Badge>}</td>
                  <td className={tdCls + ' text-xs'}>{x.source}{x.month ? ` ${x.month}` : ''}<div className="text-slate-500">{prettyStamp(x.createdAt)}</div></td>
                  <td className={tdCls + ' max-w-xs text-xs'}>{x.notes}{x.reference && <div className="text-slate-500">{x.reference}</div>}</td>
                  <td className={tdCls + ' whitespace-nowrap text-right'}>
                    {canEdit && <Button variant="ghost" onClick={() => setEdit(x)}>Edit</Button>}
                    {canEdit && <Button variant="ghost" onClick={() => a.run(async () => { await call('approvals.save', { ...x, active: !x.active }, 'admin'); list.reload(); toast(x.active ? 'Approval deactivated.' : 'Approval restored.'); })}>{x.active ? 'Deactivate' : 'Restore'}</Button>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {rows.length > limit && <div className="mt-3 text-center"><Button variant="secondary" onClick={() => setLimit(l => l + 300)}>Show more</Button></div>}
          </div>
        )}
      </Card>
      {edit && <ApprovalForm value={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); list.reload(); toast('Approval saved.'); }} />}
      {bulk && (
        <Modal wide title="Check the uploaded approvals" onClose={() => setBulk(null)}
          footer={<><Button variant="secondary" onClick={() => setBulk(null)}>Cancel</Button><Button disabled={bulk.check.errors.length > 0} loading={a.busy} onClick={() => a.run(async () => {
            const r = await call('approvals.import', { rows: bulk.rows }, 'admin'); setBulk(null); list.reload(); toast(`${r.saved} approvals added.`);
          })}>Add {bulk.check.valid} approvals</Button></>}>
          {bulk.check.errors.length ? (
            <Notice tone="red" title={`${bulk.check.errors.length} row(s) need fixing — nothing will be saved until they are fixed`}>
              <div className="max-h-72 overflow-auto">{bulk.check.errors.map((e: any, i: number) => <div key={i}>Row {e.row} ({e.empId}): {e.message}</div>)}</div>
            </Notice>
          ) : <Notice tone="green">All {bulk.check.valid} rows look fine.</Notice>}
        </Modal>
      )}
    </div>
  );
}

function ApprovalForm({ value, onClose, onSaved }: { value: any; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<any>({
    approvalId: value.approvalId || '', empId: value.empId || '', validFrom: value.validFrom || '', validTo: value.validTo || '',
    dailyOtCap: value.dailyOtCap ?? '2', monthlyOtCap: value.monthlyOtCap || '', otWeekdays: value.otWeekdays || [], otDaysPerWeek: value.otDaysPerWeek || '',
    weekendDuty: value.weekendDuty ?? true, holidayDuty: value.holidayDuty ?? true, holidayMaxHours: value.holidayMaxHours || '8', securityBonus: !!value.securityBonus,
    source: value.source || 'HR', month: value.month || '', reference: value.reference || '', notes: value.notes || '', active: value.active ?? true
  });
  const a = useAction();
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  return (
    <Modal wide title={f.approvalId ? `Edit approval — ${value.name || f.empId}` : 'Add approval'} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={a.busy} onClick={() => a.run(async () => { await call('approvals.save', f, 'admin'); onSaved(); })}>Save approval</Button></>}>
      <div className="space-y-4">
        {!f.approvalId && <div className="flex flex-wrap gap-2">{PRESETS.map(([l, p]) => <Button key={l} variant="secondary" onClick={() => setF((x: any) => ({ ...x, ...p }))}>{l}</Button>)}</div>}
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Employee ID"><Input value={f.empId} disabled={!!f.approvalId} onChange={e => set('empId', e.target.value.trim())} /></Field>
          <Field label="Valid from" hint="Blank = no start date"><Input type="date" value={f.validFrom} onChange={e => set('validFrom', e.target.value)} /></Field>
          <Field label="Valid to" hint="Blank = ongoing. Use dates for seasonal approvals."><Input type="date" value={f.validTo} onChange={e => set('validTo', e.target.value)} /></Field>
          <Field label="Workday OT per day (hours)" hint="0 = no evening OT. e.g. 1, 1:30, 2, 3, 4"><Input value={f.dailyOtCap} onChange={e => set('dailyOtCap', e.target.value)} /></Field>
          <Field label="Monthly OT limit (hours)" hint="Blank = no limit (e.g. 90)"><Input value={f.monthlyOtCap} onChange={e => set('monthlyOtCap', e.target.value)} /></Field>
          <Field label="OT days per week" hint="Blank = no limit (e.g. 3 for “alternative OT”)"><Input value={f.otDaysPerWeek} onChange={e => set('otDaysPerWeek', e.target.value)} /></Field>
        </div>
        <Field label="OT only on these weekdays" hint="Leave all unticked for every working day">
          <div className="flex flex-wrap gap-3">{WEEKDAYS.map((d: string) => (
            <label key={d} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={f.otWeekdays.includes(d)} onChange={e => set('otWeekdays', e.target.checked ? [...f.otWeekdays, d] : f.otWeekdays.filter((x: string) => x !== d))} />{d}</label>
          ))}</div>
        </Field>
        <div className="grid gap-4 md:grid-cols-4">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4" checked={f.weekendDuty} onChange={e => set('weekendDuty', e.target.checked)} />Weekend duty</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4" checked={f.holidayDuty} onChange={e => set('holidayDuty', e.target.checked)} />Holiday duty</label>
          <Field label="Max hours per weekend/holiday day"><Input value={f.holidayMaxHours} onChange={e => set('holidayMaxHours', e.target.value)} /></Field>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4" checked={f.securityBonus} onChange={e => set('securityBonus', e.target.checked)} />Security: add the hours a special shift is shorter than 8</label>
        </div>
        <p className="text-xs text-slate-500">Without holiday duty, a holiday that falls on the employee’s weekend is still counted when weekend duty is ticked.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Reference" hint="e.g. memo number or email date"><Input value={f.reference} onChange={e => set('reference', e.target.value)} /></Field>
          <Field label="Notes"><TextArea value={f.notes} onChange={e => set('notes', e.target.value)} /></Field>
        </div>
        <ErrorText error={a.error} />
      </div>
    </Modal>
  );
}
