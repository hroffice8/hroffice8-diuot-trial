import React, { useState } from 'react';
import { call, fileToBase64 } from '../../lib/api';
import { readMaintenanceList, MaintenanceRow } from '../../lib/imports';
import { mapDutyCategory } from '../../lib/approvalText.js';
import { writeXlsx, downloadBlob } from '../../lib/xlsx';
import { monthLabel, prettyDate } from '../../lib/time';
import { Badge, Button, Card, ErrorText, FilePick, Input, Notice, Select, Spinner, tableCls, tdCls, thCls, useAction, useToast } from '../../components/ui';
import { useLoad } from '../AdminApp';

const CATEGORIES = ['Evening & all off day', 'Evening & only Friday', 'Only evening', 'Only Friday', 'All off day'];

export function MaintenanceTab({ month, canEdit }: { month: any; canEdit: boolean }) {
  const current = useLoad<any[]>('approvals.list', {}, [month.monthKey]);
  const [rows, setRows] = useState<(MaintenanceRow & { include: boolean })[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const parse = useAction();
  const save = useAction();
  const toast = useToast();
  const existing = (current.data || []).filter(a => a.source === 'Maintenance' && a.month === month.monthKey);

  const pick = (f: File[]) => parse.run(async () => {
    const r = await readMaintenanceList(f[0], month.monthKey);
    setFile(f[0]);
    setRows(r.map(x => ({ ...x, include: x.level !== 'error' || !!mapDutyCategory(x.category) })));
  });

  const setRow = (i: number, patch: Partial<MaintenanceRow & { include: boolean }>) => setRows(rs => rs!.map((r, j) => {
    if (j !== i) return r;
    const n = { ...r, ...patch };
    if (patch.category !== undefined) {
      const c = mapDutyCategory(patch.category);
      if (c) { n.weekendDuty = c.weekendDuty; n.holidayDuty = c.holidayDuty; n.dailyOtCap = c.otAllowed ? (r.dailyOtCap && r.dailyOtCap !== '0' ? r.dailyOtCap : '3') : '0'; n.level = 'ok'; n.messages = []; n.include = true; }
    }
    return n;
  }));

  const included = (rows || []).filter(r => r.include);
  const blocking = included.filter(r => !mapDutyCategory(r.category) || !/^\d{5,}$/.test(r.empId));

  const submit = () => save.run(async () => {
    const payload = included.map(r => ({
      empId: r.empId, sourceRow: r.sourceRow, dailyOtCap: r.dailyOtCap || '0', weekendDuty: r.weekendDuty, holidayDuty: r.holidayDuty,
      validFrom: r.validFrom, validTo: r.validTo, otWeekdays: r.otWeekdays, holidayMaxHours: '8', notes: [r.category, r.hours, r.remarks].filter(Boolean).join(' · ')
    }));
    const res = await call('maintenance.import', { monthKey: month.monthKey, rows: payload, fileBase64: file ? await fileToBase64(file) : '', fileName: file?.name || '', mimeType: file?.type }, 'admin');
    if (res.errors?.length) throw new Error('Not saved. Please fix:\n' + res.errors.map((e: any) => `Row ${e.row} (${e.empId}): ${e.message}`).join('\n'));
    toast(`${res.saved} Maintenance approvals saved for ${monthLabel(month.monthKey)}${res.replaced ? ` (replaced ${res.replaced} earlier ones)` : ''}.`);
    setRows(null); setFile(null); current.reload();
  });

  const template = async () => downloadBlob(await writeXlsx([{ name: 'Maintenance list', columns: [
    { header: 'ID', width: 12 }, { header: 'Name', width: 28 }, { header: 'Category', width: 26 }, { header: 'Hours', width: 9 }, { header: 'Valid From', width: 12 }, { header: 'Valid To', width: 12 }, { header: 'Remarks', width: 30 }],
    rows: [['710000336', 'Example name', 'Evening & all off day', '3 Hours', '', '', ''], ['', '', 'Categories: ' + CATEGORIES.join(' / '), '', '', '', 'Leave dates blank for the whole month']] }]), `Maintenance list template ${month.monthKey}.xlsx`);

  return (
    <div className="space-y-5">
      {canEdit && (
        <Card title={`Upload the Maintenance section’s list for ${monthLabel(month.monthKey)}`} actions={<Button variant="ghost" onClick={template}>Download a template for Maintenance</Button>}>
          <p className="mb-3 text-sm text-slate-600">Upload the spreadsheet as Maintenance sends it. You will see how each row was read before anything is saved. Saving replaces any earlier Maintenance list for this month; the file itself is kept in Drive.</p>
          <FilePick accept=".xlsx,.csv" onFiles={pick} label="Choose the Maintenance spreadsheet" disabled={save.busy} />
          {parse.busy && <div className="mt-2"><Spinner small /></div>}
          <ErrorText error={parse.error} />
        </Card>
      )}
      {rows && (
        <Card title={`Check ${rows.length} rows`} actions={<>
          <Button variant="secondary" onClick={() => { setRows(null); setFile(null); }}>Cancel</Button>
          <Button loading={save.busy} disabled={!included.length || blocking.length > 0} onClick={submit}>Save {included.length} approvals</Button></>}>
          <div className="mb-3 flex flex-wrap gap-2 text-sm">
            <Badge tone="green">{rows.filter(r => r.level === 'ok').length} fine</Badge>
            <Badge tone="amber">{rows.filter(r => r.level === 'check').length} to check</Badge>
            <Badge tone="red">{rows.filter(r => r.level === 'error').length} need a decision</Badge>
            {blocking.length > 0 && <span className="text-red-700">Choose a category (or untick) for the red rows to continue.</span>}
          </div>
          <ErrorText error={save.error} />
          <div className="max-h-[60vh] overflow-auto">
            <table className={tableCls}>
              <thead><tr>{['Use', 'Row', 'ID / Name', 'Category', 'OT h/day', 'Weekend', 'Holiday', 'Valid', 'Notes'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.level === 'error' ? 'bg-red-50' : r.level === 'check' ? 'bg-amber-50' : ''}>
                    <td className={tdCls}><input type="checkbox" checked={r.include} onChange={e => setRow(i, { include: e.target.checked })} /></td>
                    <td className={tdCls + ' text-xs text-slate-500'}>{r.sourceRow}</td>
                    <td className={tdCls}><div className="font-semibold">{r.empId}</div><div className="text-xs text-slate-500">{r.name}</div></td>
                    <td className={tdCls}>
                      <Select value={CATEGORIES.find(c => c.toLowerCase() === r.category.toLowerCase()) || ''} onChange={e => setRow(i, { category: e.target.value })} className="!py-1 text-xs">
                        <option value="">{r.category ? `“${r.category}” — choose…` : 'Choose…'}</option>
                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </Select>
                    </td>
                    <td className={tdCls}><Input value={r.dailyOtCap} onChange={e => setRow(i, { dailyOtCap: e.target.value })} className="!w-16 !py-1 text-center" /></td>
                    <td className={tdCls}>{r.weekendDuty ? 'Yes' : 'No'}</td>
                    <td className={tdCls}>{r.holidayDuty ? 'Yes' : 'No'}</td>
                    <td className={tdCls + ' whitespace-nowrap text-xs'}>
                      <Input type="date" value={r.validFrom} onChange={e => setRow(i, { validFrom: e.target.value })} className="!w-36 !py-0.5 text-xs" />
                      <Input type="date" value={r.validTo} onChange={e => setRow(i, { validTo: e.target.value })} className="mt-1 !w-36 !py-0.5 text-xs" />
                    </td>
                    <td className={tdCls + ' text-xs'}>{r.messages.map(m => <div key={m}>{m}</div>)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Card title={`Saved Maintenance approvals for ${monthLabel(month.monthKey)} (${existing.length})`}>
        {current.busy && !current.data ? <Spinner /> : !existing.length ? <p className="text-sm text-slate-500">None yet.</p> : (
          <div className="max-h-[50vh] overflow-auto">
            <table className={tableCls}>
              <thead><tr>{['ID', 'Name', 'OT h/day', 'Weekend', 'Holiday', 'Valid', 'Notes'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
              <tbody>{existing.map(a => (
                <tr key={a.approvalId}><td className={tdCls}>{a.empId}</td><td className={tdCls}>{a.name}</td><td className={tdCls}>{a.dailyOtCap}</td><td className={tdCls}>{a.weekendDuty ? 'Yes' : 'No'}</td><td className={tdCls}>{a.holidayDuty ? 'Yes' : 'No'}</td>
                  <td className={tdCls + ' whitespace-nowrap text-xs'}>{prettyDate(a.validFrom)} – {prettyDate(a.validTo)}</td><td className={tdCls + ' text-xs'}>{a.notes}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <div className="mt-3"><Notice tone="slate">For the month, a Maintenance approval takes priority over the employee’s regular HR approval.</Notice></div>
      </Card>
    </div>
  );
}
