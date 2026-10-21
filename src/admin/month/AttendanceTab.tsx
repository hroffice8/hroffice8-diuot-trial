import React, { useState } from 'react';
import { call } from '../../lib/api';
import { readHrisAttendance, readIndividualReportPdf, readLegacyReviews, AttendanceFile, IndividualReport } from '../../lib/imports';
import { monthLabel, prettyDate } from '../../lib/time';
import { Badge, Button, Card, ErrorText, FilePick, Modal, Notice, Spinner, tableCls, tdCls, thCls, useAction, useToast } from '../../components/ui';
import { useLoad } from '../AdminApp';

export function AttendanceTab({ month, canEdit }: { month: any; canEdit: boolean }) {
  const summary = useLoad<any>('attendance.summary', { monthKey: month.monthKey }, [month.monthKey]);
  const [files, setFiles] = useState<AttendanceFile[]>([]);
  const [progress, setProgress] = useState<string>('');
  const [report, setReport] = useState<IndividualReport | null>(null);
  const parse = useAction();
  const upload = useAction();
  const pdf = useAction();
  const toast = useToast();

  const pick = (list: File[]) => parse.run(async () => {
    const out: AttendanceFile[] = [];
    for (const f of list) out.push(await readHrisAttendance(f));
    setFiles(out);
  });

  const thisMonth = files.flatMap(f => f.rows.filter(r => r.date.slice(0, 7) === month.monthKey));
  const otherMonths = files.flatMap(f => Object.keys(f.months)).filter(k => k !== month.monthKey);

  const send = () => upload.run(async () => {
    const size = 3000, chunks = Math.ceil(thisMonth.length / size);
    let last: any = null;
    for (let i = 0; i < chunks; i++) {
      setProgress(`Uploading ${Math.min((i + 1) * size, thisMonth.length).toLocaleString()} of ${thisMonth.length.toLocaleString()} rows…`);
      last = await call('attendance.import', { monthKey: month.monthKey, rows: thisMonth.slice(i * size, (i + 1) * size), mode: 'replace', source: 'HRIS', chunkIndex: i, chunkCount: chunks }, 'admin');
    }
    setProgress('');
    setFiles([]);
    toast(`Attendance saved: ${last.summary.rows.toLocaleString()} rows, ${last.summary.employees} employees.`);
    summary.reload();
  });

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        {canEdit && (
          <Card title="1. Upload the HRIS attendance files">
            <p className="mb-3 text-sm text-slate-600">
              In HRIS go to <b>Payroll → Overtime Sheet</b>, download the Excel for each employee type (Admin and Below Officer) for {monthLabel(month.monthKey)}, and upload both files here together.
              Nothing needs to be copied or combined by hand. Uploading again replaces the earlier HRIS upload (days added from individual reports are kept).
            </p>
            <FilePick accept=".xlsx,.csv" multiple onFiles={pick} label="Choose the HRIS Excel files (you can select both)" disabled={upload.busy} />
            {parse.busy && <div className="mt-3 text-sm text-slate-500"><Spinner small /> Reading files…</div>}
            <ErrorText error={parse.error} />
            {files.length > 0 && (
              <div className="mt-4 space-y-3">
                <table className={tableCls}>
                  <thead><tr><th className={thCls}>File</th><th className={thCls}>Rows</th><th className={thCls}>Employees</th><th className={thCls}>Months in file</th></tr></thead>
                  <tbody>{files.map(f => (
                    <tr key={f.fileName}><td className={tdCls}>{f.fileName}</td><td className={tdCls}>{f.rows.length.toLocaleString()}</td><td className={tdCls}>{f.employees}</td>
                      <td className={tdCls}>{Object.entries(f.months).map(([k, n]) => <Badge key={k} tone={k === month.monthKey ? 'green' : 'red'}>{monthLabel(k)}: {n}</Badge>)}</td></tr>
                  ))}</tbody>
                </table>
                {otherMonths.length > 0 && <Notice tone="amber">Rows from other months will be left out. Only {monthLabel(month.monthKey)} is saved here.</Notice>}
                {!thisMonth.length ? <Notice tone="red">These files have no rows for {monthLabel(month.monthKey)}.</Notice> : (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button loading={upload.busy} onClick={send}>Save {thisMonth.length.toLocaleString()} rows to {monthLabel(month.monthKey)}</Button>
                    <Button variant="secondary" onClick={() => setFiles([])} disabled={upload.busy}>Cancel</Button>
                    <span className="text-sm text-slate-500">{progress}</span>
                  </div>
                )}
                <ErrorText error={upload.error} />
              </div>
            )}
          </Card>
        )}
        {canEdit && (
          <Card title="2. Add an individual attendance report (optional)">
            <p className="mb-3 text-sm text-slate-600">For an employee who is missing from the HRIS files, upload their <b>Individual Attendance Report</b> PDF from HRIS. Only the days in {monthLabel(month.monthKey)} are used; they replace that employee’s existing days if any.</p>
            <FilePick accept=".pdf" onFiles={f => pdf.run(async () => setReport(await readIndividualReportPdf(f[0])))} label="Choose the Individual Attendance Report PDF" />
            {pdf.busy && <div className="mt-3 text-sm text-slate-500"><Spinner small /> Reading the PDF…</div>}
            <ErrorText error={pdf.error} />
          </Card>
        )}
        {canEdit && <LegacyImport month={month} />}
        {!canEdit && <Notice tone="slate">Attendance can only be changed while the month is being prepared or open for review.</Notice>}
      </div>
      <Card title="Saved attendance">
        {summary.busy && !summary.data ? <Spinner /> : summary.data && (
          <div className="space-y-2 text-sm">
            <div><b>{summary.data.rows.toLocaleString()}</b> rows · <b>{summary.data.employees}</b> employees</div>
            {Object.entries(summary.data.bySource || {}).map(([k, v]: any) => <div key={k} className="flex justify-between"><span>{k}</span><b>{v.toLocaleString()}</b></div>)}
            {!summary.data.rows && <p className="text-slate-500">Nothing uploaded yet.</p>}
          </div>
        )}
      </Card>
      {report && <IndividualPreview month={month} report={report} onClose={() => setReport(null)} onSaved={() => { setReport(null); summary.reload(); }} />}
    </div>
  );
}

function IndividualPreview({ month, report, onClose, onSaved }: { month: any; report: IndividualReport; onClose: () => void; onSaved: () => void }) {
  const rows = report.rows.filter(r => r.date.slice(0, 7) === month.monthKey);
  const existing = useLoad<any[]>('attendance.employee', { monthKey: month.monthKey, empId: report.empId }, [report.empId]);
  const a = useAction();
  const toast = useToast();
  return (
    <Modal wide title={`${report.name} (${report.empId}) — individual report`} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!rows.length} loading={a.busy} onClick={() => a.run(async () => {
          await call('attendance.addEmployee', { monthKey: month.monthKey, rows, source: 'Individual report' }, 'admin');
          toast(`${rows.length} days saved for ${report.name}.`); onSaved();
        })}>Save {rows.length} days</Button></>}>
      <div className="space-y-3 text-sm">
        <p>{report.designation} · {report.department}. The PDF has {report.rows.length} days; <b>{rows.length}</b> are in {monthLabel(month.monthKey)}.</p>
        {existing.data && existing.data.length > 0 && <Notice tone="amber">This employee already has {existing.data.length} days in this month. Days in the PDF replace the same dates.</Notice>}
        <div className="max-h-[50vh] overflow-auto">
          <table className={tableCls}>
            <thead><tr>{['Date', 'Sch In', 'Sch Out', 'Check In', 'Check Out', 'Status'].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
            <tbody>{rows.map(r => <tr key={r.date}><td className={tdCls}>{prettyDate(r.date)}</td><td className={tdCls}>{r.schIn}</td><td className={tdCls}>{r.schOut}</td><td className={tdCls}>{r.chkIn}</td><td className={tdCls}>{r.chkOut}</td><td className={tdCls}>{r.status}</td></tr>)}</tbody>
          </table>
        </div>
        <ErrorText error={a.error} />
      </div>
    </Modal>
  );
}

/** Trial only: load the reviews made in the old portal so the new bill can be compared with the old one. */
function LegacyImport({ month }: { month: any }) {
  const [res, setRes] = useState<any>(null);
  const [prog, setProg] = useState('');
  const a = useAction();
  const toast = useToast();
  const pick = (f: File[]) => a.run(async () => {
    const rows = await readLegacyReviews(f[0]);
    const total = { imported: 0, skipped: [] as any[], trimmedDays: 0, droppedDays: 0 };
    for (let i = 0; i < rows.length; i += 80) {
      setProg(`Importing ${Math.min(i + 80, rows.length)} of ${rows.length}…`);
      const r = await call('review.importLegacy', { monthKey: month.monthKey, rows: rows.slice(i, i + 80) }, 'admin');
      total.imported += r.imported; total.skipped.push(...r.skipped); total.trimmedDays += r.trimmedDays; total.droppedDays += r.droppedDays;
    }
    setProg(''); setRes(total); toast(`${total.imported} reviews imported.`);
  });
  return (
    <Card title="3. Trial only: import reviews from the old portal">
      <p className="mb-3 text-sm text-slate-600">To compare the new bill with the one you made the old way, upload the old spreadsheet (File → Download → Microsoft Excel). Its <b>Supervisor_Inputs</b> tab is read and each review is added as if the supervisor had submitted it here. Days the attendance or approval does not support are trimmed, exactly as the new portal would.</p>
      <FilePick accept=".xlsx" onFiles={pick} label="Choose the old month spreadsheet (.xlsx)" disabled={a.busy} />
      {a.busy && <div className="mt-2 text-sm text-slate-500"><Spinner small /> {prog || 'Reading…'}</div>}
      <ErrorText error={a.error} />
      {res && <div className="mt-3"><Notice tone="green" title={`${res.imported} reviews imported`}>
        {res.trimmedDays} day(s) were reduced to what the punches allow and {res.droppedDays} day(s) were left out (no attendance or no approval for that day).
        {res.skipped.length > 0 && <div className="mt-1">Skipped {res.skipped.length}: {res.skipped.slice(0, 15).map((x: any) => `${x.empId} (${x.why})`).join(', ')}{res.skipped.length > 15 ? '…' : ''}</div>}
        <div className="mt-1">See the result in the Bill tab.</div>
      </Notice></div>}
    </Card>
  );
}
