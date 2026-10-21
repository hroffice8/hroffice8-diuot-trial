// Readers for the files HR works with: HRIS attendance exports, HRIS employee list,
// grade & salary list, approvals template, the Maintenance section's monthly list,
// and the HRIS "Individual Attendance Report" PDF.
import { readSpreadsheetFile, SheetData, Cell } from './xlsx';
import { mapDutyCategory, capToMinutes, parseWeekdayList } from './approvalText.js';

export interface AttendanceRow {
  empId: string; name: string; designation: string; department: string; weekday: string; date: string;
  schIn: string; schOut: string; chkIn: string; chkOut: string; total: string; status: string;
}

const norm = (v: Cell) => (v === null || v === undefined ? '' : String(v).trim());
const key = (v: Cell) => norm(v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Excel time fraction or "7:25 PM" → "19:25:00"; keeps "07:25:33". */
export function toClock(v: Cell): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    const secs = Math.round((v % 1) * 86400);
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return s;
  let h = Number(m[1]);
  if (m[4]) { const pm = m[4].toUpperCase() === 'PM'; if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
  return `${String(h).padStart(2, '0')}:${m[2]}:${m[3] || '00'}`;
}

/** "2026-09-04", "04-Sep-2026", "04/09/2026", "4 September 2026" → "2026-09-04". */
export function toIsoDate(v: Cell): string {
  const s = norm(v);
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  let m = s.match(/^(\d{1,2})[-\s/]([A-Za-z]+)[-\s/,]*(\d{4})$/);
  if (m) { const mi = months.indexOf(m[2].slice(0, 3).toLowerCase()); if (mi >= 0) return `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; // day/month/year (Bangladesh)
  return s;
}

function findHeaderRow(rows: Cell[][], must: string[][], maxScan = 25): number {
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const cells = (rows[i] || []).map(key);
    if (must.every(alts => cells.some(c => alts.some(a => c === a || c.startsWith(a))))) return i;
  }
  return -1;
}

function colFinder(header: Cell[]) {
  const cells = header.map(key);
  return (...alts: string[]) => {
    for (const a of alts) { const i = cells.findIndex(c => c === a); if (i >= 0) return i; }
    for (const a of alts) { const i = cells.findIndex(c => c.includes(a)); if (i >= 0) return i; }
    return -1;
  };
}

/* ---------- HRIS attendance ("Detailed Report") ---------- */

export interface AttendanceFile { fileName: string; rows: AttendanceRow[]; months: Record<string, number>; employees: number }

export async function readHrisAttendance(file: File): Promise<AttendanceFile> {
  const sheets = await readSpreadsheetFile(file);
  const sheet = sheets.find(s => /detailed/i.test(s.name)) ||
    sheets.find(s => findHeaderRow(s.rows, [['employee id', 'id'], ['check in'], ['status']]) >= 0);
  if (!sheet) throw new Error(`${file.name}: no "Detailed Report" sheet found. Upload the Overtime Sheet Excel downloaded from HRIS.`);
  const h = findHeaderRow(sheet.rows, [['employee id', 'id'], ['date'], ['status']]);
  if (h < 0) throw new Error(`${file.name}: could not find the header row (Employee Id, Date, Status…).`);
  const col = colFinder(sheet.rows[h]);
  const c = {
    id: col('employee id', 'id'), name: col('employee name', 'name'), desig: col('designation'), dept: col('department'),
    day: col('week day', 'weekday', 'day'), date: col('date'), schIn: col('scheduled in', 'schin'), schOut: col('scheduled out', 'schout'),
    in: col('check in', 'checkin'), out: col('check out', 'checkout'), total: col('total time', 'total'), status: col('status', 'description')
  };
  if (c.id < 0 || c.date < 0 || c.status < 0) throw new Error(`${file.name}: Employee Id, Date or Status column is missing.`);
  const rows: AttendanceRow[] = [];
  const months: Record<string, number> = {};
  const emps = new Set<string>();
  for (const r of sheet.rows.slice(h + 1)) {
    const id = norm(r[c.id]);
    if (!/^\d{5,}$/.test(id)) continue;
    const date = toIsoDate(r[c.date]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    rows.push({
      empId: id, name: norm(r[c.name]), designation: norm(r[c.desig]), department: norm(r[c.dept]), weekday: norm(r[c.day]), date,
      schIn: toClock(r[c.schIn]), schOut: toClock(r[c.schOut]), chkIn: toClock(r[c.in]), chkOut: toClock(r[c.out]),
      total: toClock(r[c.total]), status: norm(r[c.status])
    });
    months[date.slice(0, 7)] = (months[date.slice(0, 7)] || 0) + 1;
    emps.add(id);
  }
  if (!rows.length) throw new Error(`${file.name}: no attendance rows found.`);
  return { fileName: file.name, rows, months, employees: emps.size };
}

/* ---------- HRIS employee list ("Employee common info") ---------- */

export interface HrisEmployee { empId: string; name: string; designation: string; department: string; employeeType: string; category: string; supervisorName: string; supervisorEmail: string }

export async function readHrisEmployees(file: File): Promise<HrisEmployee[]> {
  const sheets = await readSpreadsheetFile(file);
  for (const s of sheets) {
    const h = findHeaderRow(s.rows, [['employee id'], ['supervisor mail', 'supervisor email']]);
    if (h < 0) continue;
    const col = colFinder(s.rows[h]);
    const c = { id: col('employee id'), name: col('employee name', 'name'), desig: col('designation'), dept: col('department'), type: col('type'),
      cat: col('category'), sup: col('supervisor'), supMail: col('supervisor mail', 'supervisor email') };
    // "supervisor" also matches "supervisor mail" when looked up by "includes" — make sure it is the name column
    const exactSup = s.rows[h].map(key).findIndex(x => x === 'supervisor');
    if (exactSup >= 0) c.sup = exactSup;
    return s.rows.slice(h + 1).filter(r => /^\d{5,}$/.test(norm(r[c.id]))).map(r => ({
      empId: norm(r[c.id]), name: norm(r[c.name]), designation: norm(r[c.desig]), department: norm(r[c.dept]),
      employeeType: norm(r[c.type]), category: norm(r[c.cat]), supervisorName: norm(r[c.sup]),
      supervisorEmail: /@/.test(norm(r[c.supMail])) ? norm(r[c.supMail]).toLowerCase() : ''
    }));
  }
  throw new Error(`${file.name}: could not find the "Employee ID" and "Supervisor Mail" columns. Upload the Employee common info export from HRIS.`);
}

/* ---------- Grade and salary ---------- */

export async function readGrades(file: File): Promise<{ empId: string; grade: string; grossSalary: string; name: string; designation: string; department: string }[]> {
  const sheets = await readSpreadsheetFile(file);
  for (const s of sheets) {
    const h = findHeaderRow(s.rows, [['id no', 'employee id', 'id'], ['grade']]);
    if (h < 0) continue;
    const col = colFinder(s.rows[h]);
    const c = { id: col('id no', 'employee id', 'id'), grade: col('grade'), sal: col('gross salary', 'gross', 'salary'), name: col('name', 'employee name'), desig: col('designation'), dept: col('department') };
    return s.rows.slice(h + 1).filter(r => /^\d{5,}$/.test(norm(r[c.id]))).map(r => ({
      empId: norm(r[c.id]), grade: norm(r[c.grade]), grossSalary: c.sal >= 0 ? norm(r[c.sal]).replace(/,/g, '') : '',
      name: c.name >= 0 ? norm(r[c.name]) : '', designation: c.desig >= 0 ? norm(r[c.desig]) : '', department: c.dept >= 0 ? norm(r[c.dept]) : ''
    }));
  }
  throw new Error(`${file.name}: could not find "ID" and "Grade" columns.`);
}

/* ---------- Approvals template ---------- */

export const APPROVAL_TEMPLATE_COLUMNS = ['Employee ID', 'Valid From (YYYY-MM-DD)', 'Valid To (YYYY-MM-DD)', 'Daily OT Cap (hours)', 'Monthly OT Cap (hours)',
  'OT Weekdays (blank = all)', 'OT Days per Week (blank = no limit)', 'Weekend Duty (YES/NO)', 'Holiday Duty (YES/NO)', 'Holiday Max Hours',
  'Security Bonus (YES/NO)', 'Reference', 'Notes'];

const yes = (v: Cell) => /^(yes|y|true|1)$/i.test(norm(v));

export interface ApprovalInput {
  empId: string; validFrom: string; validTo: string; dailyOtCap: string; monthlyOtCap: string; otWeekdays: string[]; otDaysPerWeek: string;
  weekendDuty: boolean; holidayDuty: boolean; holidayMaxHours: string; securityBonus: boolean; reference: string; notes: string;
  sourceRow?: number; problems?: string[];
}

export async function readApprovalsTemplate(file: File): Promise<ApprovalInput[]> {
  const sheets = await readSpreadsheetFile(file);
  const s = sheets[0];
  const h = findHeaderRow(s.rows, [['employee id'], ['daily ot cap']]);
  if (h < 0) throw new Error('Use the approvals template (download it from this page). The "Employee ID" and "Daily OT Cap" columns were not found.');
  const col = colFinder(s.rows[h]);
  const c = { id: col('employee id'), from: col('valid from'), to: col('valid to'), cap: col('daily ot cap'), mcap: col('monthly ot cap'), days: col('ot weekdays'),
    perWeek: col('ot days per week'), wk: col('weekend duty'), hol: col('holiday duty'), hmax: col('holiday max'), sec: col('security bonus'), ref: col('reference'), notes: col('notes') };
  return s.rows.slice(h + 1).map((r, i) => ({ r, i })).filter(({ r }) => norm(r[c.id])).map(({ r, i }) => {
    const problems: string[] = [];
    const daysTxt = norm(r[c.days]);
    const days = daysTxt ? parseWeekdayList(daysTxt) : [];
    if (daysTxt && !days) problems.push(`OT weekdays "${daysTxt}" not understood`);
    return {
      empId: norm(r[c.id]), validFrom: toIsoDate(r[c.from]), validTo: toIsoDate(r[c.to]), dailyOtCap: norm(r[c.cap]), monthlyOtCap: norm(r[c.mcap]),
      otWeekdays: days || [], otDaysPerWeek: norm(r[c.perWeek]), weekendDuty: yes(r[c.wk]), holidayDuty: yes(r[c.hol]), holidayMaxHours: norm(r[c.hmax]) || '8',
      securityBonus: yes(r[c.sec]), reference: norm(r[c.ref]), notes: norm(r[c.notes]), sourceRow: h + i + 2, problems
    };
  });
}

/* ---------- Maintenance section monthly list ---------- */

export interface MaintenanceRow {
  sourceRow: number; empId: string; name: string; category: string; hours: string; remarks: string;
  // interpreted
  dailyOtCap: string; weekendDuty: boolean; holidayDuty: boolean; validFrom: string; validTo: string; otWeekdays: string[];
  level: 'ok' | 'check' | 'error'; messages: string[];
}

export async function readMaintenanceList(file: File, monthKey: string): Promise<MaintenanceRow[]> {
  const sheets = await readSpreadsheetFile(file);
  const lastDay = new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)), 0).getDate();
  for (const s of sheets) {
    const h = findHeaderRow(s.rows, [['id', 'id no', 'employee id']]);
    if (h < 0) continue;
    const col = colFinder(s.rows[h]);
    const c = { id: col('id', 'id no', 'employee id'), name: col('name'), cat: col('evening off day', 'evening', 'category', 'approval', 'duty'),
      hours: col('hours', 'hour', 'ot cap'), remarks: col('remarks', 'remark', 'note'), from: col('valid from', 'from'), to: col('valid to', 'to') };
    const out: MaintenanceRow[] = [];
    s.rows.slice(h + 1).forEach((r, i) => {
      const id = norm(r[c.id]);
      if (!id) return;
      const row: MaintenanceRow = { sourceRow: h + i + 2, empId: id, name: norm(r[c.name]), category: norm(r[c.cat]), hours: norm(r[c.hours]),
        remarks: norm(r[c.remarks]), dailyOtCap: '', weekendDuty: false, holidayDuty: false,
        validFrom: c.from >= 0 ? toIsoDate(r[c.from]) : '', validTo: c.to >= 0 ? toIsoDate(r[c.to]) : '', otWeekdays: [], level: 'ok', messages: [] };
      if (!/^\d{5,}$/.test(id)) { row.level = 'error'; row.messages.push('Employee ID is not valid'); out.push(row); return; }
      const cat = mapDutyCategory(row.category);
      if (!cat) { row.level = 'error'; row.messages.push(row.category ? `Category "${row.category}" not recognised — choose it below` : 'No duty category'); }
      const capMin = capToMinutes(row.hours);
      if (cat) {
        row.weekendDuty = cat.weekendDuty; row.holidayDuty = cat.holidayDuty;
        row.dailyOtCap = cat.otAllowed ? String((capMin ?? 180) / 60) : '0';
        if (cat.otAllowed && capMin === null) { row.level = 'check'; row.messages.push('No hours given — 3 hours used'); }
      }
      const rem = row.remarks;
      if (rem) {
        if (/1st\s*15|first\s*15/i.test(rem)) { row.validFrom = `${monthKey}-01`; row.validTo = `${monthKey}-15`; }
        else if (/last\s*15|2nd\s*15|second\s*15/i.test(rem)) { row.validFrom = `${monthKey}-16`; row.validTo = `${monthKey}-${lastDay}`; }
        const hm = rem.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i);
        if (hm && cat && cat.otAllowed) row.dailyOtCap = hm[1];
        const days = parseWeekdayList(rem);
        if (days) row.otWeekdays = days;
        if (row.level === 'ok') row.level = 'check';
        row.messages.push(`Remark "${rem}" read as: ${row.validFrom ? `valid ${row.validFrom.slice(8)}–${(row.validTo || '').slice(8)}` : 'whole month'}` +
          `${row.dailyOtCap && row.dailyOtCap !== '0' ? `, ${row.dailyOtCap}h OT/day` : ''}${days ? `, OT only on ${days.join(', ')}` : ''}`);
      }
      out.push(row);
    });
    if (out.length) return out;
  }
  throw new Error(`${file.name}: could not find an "ID" column.`);
}

/* ---------- HRIS Individual Attendance Report (PDF) ---------- */

export interface IndividualReport { empId: string; name: string; designation: string; department: string; rows: AttendanceRow[] }

interface PdfItem { page: number; x: number; y: number; s: string }

/** Turns positioned text from the PDF into rows (kept separate from pdf.js so it can be tested). */
export function parseIndividualReportItems(items: PdfItem[]): IndividualReport {
  const lines = (label: string) => items.find(i => i.s.trim().toLowerCase().startsWith(label));
  const valueRight = (label: string) => {
    const l = lines(label);
    if (!l) return '';
    return items.filter(i => i.page === l.page && Math.abs(i.y - l.y) < 3 && i.x > l.x + 20).map(i => i.s).join(' ').trim();
  };
  const empLine = valueRight('employee:');
  const em = empLine.match(/^(\d{5,})\s+(.*)$/);
  if (!em) throw new Error('This does not look like an HRIS Individual Attendance Report (Employee line not found).');
  const out: IndividualReport = { empId: em[1], name: em[2].trim(), designation: valueRight('designation:'), department: valueRight('department:'), rows: [] };

  const pages = [...new Set(items.map(i => i.page))];
  for (const p of pages) {
    const its = items.filter(i => i.page === p);
    const hdr = its.find(i => i.s.trim() === 'Date');
    if (!hdr) continue;
    const head = its.filter(i => Math.abs(i.y - hdr.y) < 3);
    const xOf = (name: string) => (head.find(i => i.s.trim().toLowerCase() === name.toLowerCase()) || { x: -1 }).x;
    const cols = [['date', xOf('Date')], ['schIn', xOf('SchIn')], ['schOut', xOf('SchOut')], ['chkIn', xOf('CheckIn')], ['chkOut', xOf('CheckOut')],
      ['total', xOf('Total Time')], ['status', xOf('Description')]].filter(c => (c[1] as number) >= 0) as [string, number][];
    const colFor = (x: number) => { let best = cols[0][0], d = 1e9; cols.forEach(([n, cx]) => { if (Math.abs(x - cx) < d) { d = Math.abs(x - cx); best = n; } }); return best; };
    const body = its.filter(i => i.y < hdr.y - 3).sort((a, b) => b.y - a.y || a.x - b.x);
    let current: Record<string, string> | null = null, currentY = 0;
    for (const it of body) {
      const t = it.s.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(t) && colFor(it.x) === 'date') {
        if (current) out.rows.push(toRow(current));
        current = { date: t }; currentY = it.y; continue;
      }
      if (!current) continue;
      if (/page \d+ of \d+/i.test(t) || /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.*\d{4}/i.test(t)) continue;
      const col = colFor(it.x);
      if (Math.abs(it.y - currentY) < 3) current[col] = ((current[col] || '') + ' ' + t).trim();
      else if (col === 'status' && currentY - it.y < 90) current.status = ((current.status || '') + ' ' + t).trim(); // wrapped description
    }
    if (current) out.rows.push(toRow(current));
  }
  function toRow(r: Record<string, string>): AttendanceRow {
    return { empId: out.empId, name: out.name, designation: out.designation, department: out.department, weekday: '', date: r.date,
      schIn: toClock(r.schIn || ''), schOut: toClock(r.schOut || ''), chkIn: toClock(r.chkIn || ''), chkOut: toClock(r.chkOut || ''),
      total: r.total ? toClock(r.total) : '', status: (r.status || '').replace(/\s+/g, ' ') };
  }
  const seen = new Set<string>();
  out.rows = out.rows.filter(r => (seen.has(r.date) ? false : (seen.add(r.date), true))).sort((a, b) => (a.date < b.date ? -1 : 1));
  return out;
}

export async function readIndividualReportPdf(file: File): Promise<IndividualReport> {
  const pdfjs: any = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const items: PdfItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    tc.items.forEach((i: any) => { if (i.str && i.str.trim()) items.push({ page: p, x: i.transform[4], y: i.transform[5], s: i.str }); });
  }
  return parseIndividualReportItems(items);
}

export function sheetSummary(s: SheetData[]) { return s.map(x => `${x.name} (${x.rows.length} rows)`).join(', '); }

/* ---------- Old portal reviews ("Supervisor_Inputs" tab), for trial comparison ---------- */

export interface LegacyReview { empId: string; reviewerEmail: string; submittedAt: string; days: { date: string; hours: string; task: string; fileUrl: string }[] }

export async function readLegacyReviews(file: File): Promise<LegacyReview[]> {
  const sheets = await readSpreadsheetFile(file);
  const s = sheets.find(x => /supervisor_inputs/i.test(x.name)) || sheets.find(x => findHeaderRow(x.rows, [['id'], ['date 1']]) >= 0);
  if (!s) throw new Error('No "Supervisor_Inputs" sheet found. In the old spreadsheet use File → Download → Microsoft Excel, then upload that file.');
  const h = findHeaderRow(s.rows, [['id'], ['email']]);
  const hdr = s.rows[h].map(key);
  const c = { id: hdr.indexOf('id'), email: hdr.indexOf('email'), ts: hdr.indexOf('timestamp') };
  const dateCols = hdr.map((x, i) => (/^date \d+$/.test(x) ? i : -1)).filter(i => i >= 0);
  const out: LegacyReview[] = [];
  for (const r of s.rows.slice(h + 1)) {
    const id = norm(r[c.id]);
    if (!/^\d{5,}$/.test(id)) continue;
    const days = dateCols.map(i => ({ date: toIsoDate(r[i]), hours: typeof r[i + 1] === 'number' ? toClock(r[i + 1] as number).slice(0, 5) : norm(r[i + 1]), task: norm(r[i + 2]), fileUrl: norm(r[i + 3]) }))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.hours);
    out.push({ empId: id, reviewerEmail: norm(r[c.email]).toLowerCase(), submittedAt: norm(r[c.ts]), days });
  }
  return out;
}
