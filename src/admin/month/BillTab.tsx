import React, { useMemo, useState } from 'react';
import { call } from '../../lib/api';
import { daysInMonth, monthLabel, prettyStamp, taka } from '../../lib/time';
import { writeXlsx, downloadBlob, WriteSheet } from '../../lib/xlsx';
import { Badge, Button, Card, ErrorText, Input, Modal, Notice, Spinner, Stat, tableCls, tdCls, thCls, useAction, useToast } from '../../components/ui';
import { can, Perms, useLoad } from '../AdminApp';

const EXC_LABEL: Record<string, [string, 'red' | 'amber' | 'slate' | 'blue']> = {
  NOT_REVIEWED: ['Eligible, not reviewed yet', 'amber'], NO_REVIEWER: ['No reviewer email', 'red'], NOT_ELIGIBLE: ['Reviewed but no approval (left out)', 'red'],
  NO_ATTENDANCE: ['Reviewed but no attendance', 'red'], NO_ATTENDANCE_INFO: ['Eligible but no attendance', 'slate'], REDUCED: ['Supervisor figure reduced', 'blue'],
  NO_RATE: ['No rate found', 'red'], MONTHLY_CAP: ['Monthly OT limit applied', 'blue'], NOT_IN_EMPLOYEE_LIST: ['Not in employee list', 'amber']
};

export function BillTab({ month, perms, onChanged }: { month: any; perms: Perms; onChanged: () => void }) {
  const bill = useLoad<any>('bill.get', { monthKey: month.monthKey }, [month.monthKey, month.status]);
  const [q, setQ] = useState('');
  const [openExc, setOpenExc] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'close' | 'disburse' | null>(null);
  const a = useAction();
  const toast = useToast();
  const canEdit = can(perms, 'bill', 'edit');

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (bill.data?.rows || []).filter((r: any) => !s || r.Name.toLowerCase().includes(s) || r.EmpID.includes(s) || (r.Department || '').toLowerCase().includes(s));
  }, [bill.data, q]);
  const excGroups = useMemo(() => {
    const g: Record<string, any[]> = {};
    (bill.data?.exceptions || []).forEach((e: any) => (g[e.type] = g[e.type] || []).push(e));
    return g;
  }, [bill.data]);

  if (bill.busy && !bill.data) return <div className="py-10 text-center"><Spinner /><div className="mt-2 text-sm text-slate-500">Calculating…</div></div>;
  if (bill.error) return <ErrorText error={bill.error} />;
  const d = bill.data;
  const t = d.totals;

  const doClose = () => a.run(async () => { await call('bill.close', { monthKey: month.monthKey }, 'admin'); toast('Month closed. The bill is frozen.'); setConfirm(null); onChanged(); bill.reload(); });
  const doDisburse = () => a.run(async () => { await call('bill.disburse', { monthKey: month.monthKey }, 'admin'); toast('Marked as disbursed. A locked copy was saved.'); setConfirm(null); onChanged(); });

  return (
    <div className="space-y-5">
      <style>{'@media print { @page { size: A4 landscape; margin: 8mm; } }'}</style>
      <div className="no-print">
        {d.frozen ? <Notice tone="green" title={`Final bill — frozen when the month was closed${month.closedAt ? ` (${prettyStamp(month.closedAt)})` : ''}.`}>Later changes to approvals, rates or attendance do not change it.</Notice>
          : <Notice tone="amber" title="Live preview — not final yet.">Figures update as supervisors submit. Close the month to freeze the bill.</Notice>}
      </div>
      <div className="no-print grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Employees in bill" value={t.employees} />
        <Stat label="Holiday bill" value={`৳ ${taka(t.holiday)}`} />
        <Stat label="OT bill" value={`৳ ${taka(t.ot)}`} />
        <Stat label="Total" value={`৳ ${taka(t.total)}`} sub={t.inWords} />
      </div>
      <Card className="no-print" title="Actions" actions={<>
        <Button variant="secondary" onClick={() => downloadBill(d, month)}>⬇ Excel (Accounts + Detailed)</Button>
        <Button variant="secondary" onClick={() => window.print()}>🖨 Print Accounts bill</Button>
        {canEdit && month.status === 'REVIEW' && <Button onClick={() => setConfirm('close')}>Close month &amp; freeze bill</Button>}
        {canEdit && month.status === 'CLOSED' && <Button variant="success" onClick={() => setConfirm('disburse')}>Mark as disbursed</Button>}</>}>
        <p className="text-sm text-slate-600">Only employees who are <b>eligible</b> (have an approval) <b>and reviewed</b> by their supervisor are in the bill. For each, the lower of supervisor and attendance figures is paid
          ({month.lowestMode === 'DAY' ? 'compared day by day' : 'compared on month totals'}). Holiday and OT amounts are rounded to whole Taka per employee.</p>
      </Card>

      {Object.keys(excGroups).length > 0 && (
        <Card className="no-print" title="Things to check">
          <div className="flex flex-wrap gap-2">
            {Object.entries(excGroups).map(([k, v]) => (
              <button key={k} onClick={() => setOpenExc(openExc === k ? null : k)}><Badge tone={(EXC_LABEL[k] || [k, 'slate'])[1]}>{(EXC_LABEL[k] || [k])[0]}: {v.length}</Badge></button>
            ))}
          </div>
          {openExc && (
            <div className="mt-3 max-h-72 overflow-auto rounded border border-slate-200">
              <table className={tableCls}><tbody>{excGroups[openExc].map((e: any, i: number) => (
                <tr key={i}><td className={tdCls}>{e.empId}</td><td className={tdCls}>{e.name}</td><td className={tdCls + ' text-xs'}>{e.message}</td></tr>
              ))}</tbody></table>
            </div>
          )}
        </Card>
      )}

      <Card className="no-print" title={`Bill — ${monthLabel(month.monthKey)}`} actions={<Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="!w-56 !py-1.5" />}>
        <div className="max-h-[70vh] overflow-auto">
          <table className={tableCls}>
            <thead className="sticky top-0"><tr>{['SL', 'ID', 'Name', 'Department', 'Hol. days', 'Hol. hours', 'Rate', 'Holiday ৳', 'OT att.', 'OT sup.', 'OT final', 'Rate', 'OT ৳', 'Total ৳', 'Reviewed by'].map((h, i) => <th key={i} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r: any) => (
              <tr key={r.EmpID} className="hover:bg-slate-50">
                <td className={tdCls}>{r.SL}</td><td className={tdCls}>{r.EmpID}</td><td className={tdCls}><div className="font-semibold">{r.Name}</div><div className="text-xs text-slate-500">{r.Designation}</div></td>
                <td className={tdCls + ' text-xs'}>{r.Department}</td><td className={tdCls}>{r.HolDaysFinal}</td><td className={tdCls}>{r.HolHoursFinal}</td><td className={tdCls}>{r.HolidayRate}</td>
                <td className={tdCls + ' text-right'}>{taka(r.HolidayBill)}</td><td className={tdCls}>{r.OtHoursAttendance}</td><td className={tdCls}>{r.OtHoursSupervisor}</td><td className={tdCls + ' font-semibold'}>{r.OtHoursFinal}</td>
                <td className={tdCls}>{r.OtRate}</td><td className={tdCls + ' text-right'}>{taka(r.OtBill)}</td><td className={tdCls + ' text-right font-bold'}>{taka(r.Total)}</td>
                <td className={tdCls + ' text-xs'}>{r.ReviewedBy}{r.OnBehalfOf ? <div className="text-slate-500">for {r.OnBehalfOf}</div> : null}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>

      <PrintAccounts d={d} month={month} />

      {confirm === 'close' && (
        <Modal title="Close the month and freeze the bill?" onClose={() => setConfirm(null)}
          footer={<><Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button loading={a.busy} onClick={doClose}>Close month</Button></>}>
          <div className="space-y-3 text-sm">
            <p>Supervisors will no longer be able to submit. The bill for <b>{t.employees}</b> employees, total <b>৳ {taka(t.total)}</b>, is saved into the month spreadsheet (tabs “Bill”, “Accounts Bill” and “Bill Notes”).</p>
            {excGroups.NOT_REVIEWED && <Notice tone="amber">{excGroups.NOT_REVIEWED.length} eligible employee(s) have not been reviewed and will not be paid.</Notice>}
            <p className="text-slate-500">You can reopen later if needed; the reason is logged.</p>
            <ErrorText error={a.error} />
          </div>
        </Modal>
      )}
      {confirm === 'disburse' && (
        <Modal title="Mark as disbursed?" onClose={() => setConfirm(null)}
          footer={<><Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button><Button variant="success" loading={a.busy} onClick={doDisburse}>Yes, disbursed</Button></>}>
          <div className="space-y-3 text-sm">
            <p>A copy of the month spreadsheet is saved in the “Disbursed (locked copies)” folder and both files are locked in Google Drive. After this nothing in {month.label} can be changed.</p>
            <ErrorText error={a.error} />
          </div>
        </Modal>
      )}
    </div>
  );
}

function header(d: any, month: any) {
  const last = daysInMonth(month.monthKey);
  return [d.org?.name || 'Daffodil International University', d.org?.address || '', `Monthly Holiday and Overtime Bill For the Month of ${monthLabel(month.monthKey)}`,
    `(From 01 ${monthLabel(month.monthKey)} to ${last} ${monthLabel(month.monthKey)})`];
}

/** Places signatory names across the 14 columns so they do not crowd the narrow first columns. */
function spread(v: string[]) {
  const pos = [2, 4, 7, 10, 12, 13].slice(0, v.length);
  const row: string[] = Array(14).fill('');
  v.forEach((x, i) => { row[pos[i] ?? i] = x; });
  return row;
}

async function downloadBill(d: any, month: any) {
  const t = d.totals;
  const sig = d.signatories || [];
  const accounts: WriteSheet = {
    name: 'Accounts Bill', title: [...header(d, month), `Date: ${new Date().toISOString().slice(0, 10)}`], landscape: true, fitWidth: true,
    columns: [{ header: 'SL', width: 5 }, { header: 'ID No', width: 11 }, { header: 'Name', width: 26 }, { header: 'Designation', width: 20 }, { header: 'Department', width: 24 },
      { header: 'Holiday Days (Final)', width: 9 }, { header: 'Holiday Duty Hours (Final)', width: 10, format: 'text' }, { header: 'Holiday rate (BDT)', width: 9 },
      { header: 'Holiday Bill Amount (BDT)', width: 11, format: 'money' }, { header: 'OT Hours (Final)', width: 9, format: 'text' }, { header: 'OT Rate per hrs (BDT)', width: 8 },
      { header: 'OT Bill Amount (BDT)', width: 11, format: 'money' }, { header: 'Total Amount (BDT)', width: 12, format: 'money' }, { header: 'Remarks', width: 14 }],
    rows: d.rows.map((r: any) => [r.SL, r.EmpID, r.Name, r.Designation, r.Department, r.HolDaysFinal, r.HolHoursFinal, r.HolidayRate, r.HolidayBill, r.OtHoursFinal, r.OtRate, r.OtBill, r.Total, r.Remarks || '']),
    totalRow: ['', '', '', '', '', '', '', 'Total =', t.holiday, '', '', t.ot, t.total, ''],
    footer: [[`In Words: ${t.inWords}`], [], [], spread(sig.map((s: any) => s.name)), spread(sig.map((s: any) => s.title))]
  };
  const detailed: WriteSheet = {
    name: 'Detailed Bill', title: header(d, month), landscape: true, fitWidth: true,
    columns: ['SL', 'ID No', 'Name', 'Designation', 'Department', 'Grade', 'Gross Salary', 'Holiday Duty Days (Attendance)', 'Holiday Duty Hours (Attendance)', 'Holiday Multiplier',
      'Holiday Days (By Supervisor)', 'Holiday Duty Hours (By Supervisor)', 'Holiday Days (Final)', 'Holiday Duty Hours (Final)', 'Holiday rate (BDT)', 'Holiday Bill Amount (BDT)',
      'OT Hours (Attendance)', 'Daily OT cap', 'OT Hours (By Supervisor)', 'OT Hours (Final)', 'OT Rate per hrs (BDT)', 'OT Bill Amount (BDT)', 'Total Amount (BDT)', 'Reviewed by', 'On behalf of', 'Submitted', 'Rate rule', 'Remarks']
      .map((h, i) => ({ header: h, width: [5, 11, 24, 18, 22, 16][i] || 11, format: /Amount|Gross/.test(h) ? 'money' as const : /Hours|Multiplier|cap/.test(h) ? 'text' as const : undefined })),
    rows: d.rows.map((r: any) => [r.SL, r.EmpID, r.Name, r.Designation, r.Department, r.Grade, Number(String(r.GrossSalary).replace(/,/g, '')) || r.GrossSalary, r.HolDaysAttendance, r.HolHoursAttendance, r.HolidayMultiplier,
      r.HolDaysSupervisor, r.HolHoursSupervisor, r.HolDaysFinal, r.HolHoursFinal, r.HolidayRate, r.HolidayBill, r.OtHoursAttendance, r.OtDailyCap, r.OtHoursSupervisor, r.OtHoursFinal, r.OtRate, r.OtBill, r.Total,
      r.ReviewedBy, r.OnBehalfOf, r.SubmittedAt, r.RateRule, r.Remarks]),
    totalRow: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Total =', t.holiday, '', '', '', '', '', t.ot, t.total]
  };
  const notes: WriteSheet = {
    name: 'Things to check', columns: [{ header: 'Type', width: 26 }, { header: 'ID', width: 11 }, { header: 'Name', width: 26 }, { header: 'Details', width: 80 }],
    rows: (d.exceptions || []).map((e: any) => [(EXC_LABEL[e.type] || [e.type])[0], e.empId, e.name, e.message])
  };
  downloadBlob(await writeXlsx([accounts, detailed, notes]), `Holiday & Overtime Bill ${monthLabel(month.monthKey)}${d.frozen ? '' : ' (preview)'}.xlsx`);
}

function PrintAccounts({ d, month }: { d: any; month: any }) {
  const t = d.totals;
  const h = header(d, month);
  return (
    <div className="print-only text-[8pt]">
      <div className="text-center"><div className="text-[12pt] font-bold">{h[0]}</div><div>{h[1]}</div><div className="font-bold">{h[2]}</div><div>{h[3]}</div></div>
      {!d.frozen && <div className="text-center font-bold">PREVIEW — NOT FINAL</div>}
      <table className="print-table mt-2 w-full">
        <thead><tr>{['SL', 'ID No', 'Name', 'Designation', 'Department', 'Hol. Days', 'Hol. Hours', 'Hol. Rate', 'Holiday Bill', 'OT Hours', 'OT Rate', 'OT Bill', 'Total', 'Remarks'].map(x => <th key={x}>{x}</th>)}</tr></thead>
        <tbody>{d.rows.map((r: any) => (
          <tr key={r.EmpID}><td>{r.SL}</td><td>{r.EmpID}</td><td>{r.Name}</td><td>{r.Designation}</td><td>{r.Department}</td><td>{r.HolDaysFinal}</td><td>{r.HolHoursFinal}</td><td>{r.HolidayRate}</td>
            <td className="text-right">{taka(r.HolidayBill)}</td><td>{r.OtHoursFinal}</td><td>{r.OtRate}</td><td className="text-right">{taka(r.OtBill)}</td><td className="text-right">{taka(r.Total)}</td><td>{r.Remarks}</td></tr>
        ))}
          <tr className="font-bold"><td colSpan={8} className="text-right">Total =</td><td className="text-right">{taka(t.holiday)}</td><td colSpan={2}></td><td className="text-right">{taka(t.ot)}</td><td className="text-right">{taka(t.total)}</td><td></td></tr>
        </tbody>
      </table>
      <p className="mt-2 font-bold">In Words: {t.inWords}</p>
      <div className="mt-16 flex justify-between gap-4">{(d.signatories || []).map((s: any) => <div key={s.name} className="flex-1 border-t border-black pt-1 text-center"><div className="font-bold">{s.name}</div><div>{s.title}</div></div>)}</div>
    </div>
  );
}
