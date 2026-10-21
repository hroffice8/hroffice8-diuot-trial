// DIU Overtime — trial backend. Generated 2026-10-21 from google-apps-script/src. Paste this whole file into Code.gs.

// ---- 00_config.js ----
/* ==================================================
   DIU HOLIDAY & OVERTIME — TRIAL SYSTEM (v2)
   Google Apps Script backend. Built from google-apps-script/src/*.js
   by tools/build-gas.mjs — edit the src files, not Code.gs.
   ================================================== */

var APP_VERSION = '2.0.0-trial';
var TZ = 'Asia/Dhaka';

/** Column layouts. The first row of every sheet holds these headers. */
var MASTER_SHEETS = {
  Settings: ['Key', 'Value', 'Notes'],
  Employees: ['EmpID', 'Name', 'Designation', 'Department', 'EmployeeType', 'Category', 'Grade', 'GrossSalary',
    'SupervisorName', 'SupervisorEmail', 'ReviewerOverrideEmail', 'HolidayRateOverride', 'OtRateOverride',
    'WorkArea', 'WorkAreaUpdated', 'WorkAreaUpdatedBy', 'InLatestHRIS', 'UpdatedAt'],
  Delegates: ['SupervisorEmail', 'DelegateEmail', 'Note', 'Active', 'AddedAt', 'AddedBy'],
  Approvals: ['ApprovalID', 'EmpID', 'ValidFrom', 'ValidTo', 'DailyOtCap', 'MonthlyOtCap', 'OtWeekdays', 'OtDaysPerWeek',
    'WeekendDuty', 'HolidayDuty', 'HolidayMaxHours', 'SecurityBonus', 'Source', 'Month', 'Reference', 'Notes',
    'Active', 'CreatedAt', 'CreatedBy'],
  Rates: ['Order', 'RuleType', 'Value', 'HolidayRatePerDay', 'OtRatePerHour'],
  Signatories: ['Order', 'Name', 'Title'],
  Access: ['Email', 'Name', 'Permissions', 'Active', 'AddedAt', 'AddedBy'],
  Months: ['MonthKey', 'Label', 'FileId', 'FileUrl', 'Status', 'LateRule', 'LowestMode', 'Deadline',
    'CreatedAt', 'ClosedAt', 'DisbursedAt', 'ArchiveFileId', 'ArchiveUrl', 'Notes'],
  Audit: ['Timestamp', 'Actor', 'Action', 'Month', 'Details'],
  OTP: ['Timestamp', 'Email', 'CodeHash', 'Purpose', 'Status', 'Attempts'],
  EmailLog: ['Timestamp', 'Month', 'To', 'Cc', 'Type', 'Subject', 'Status', 'Error']
};

var MONTH_SHEETS = {
  Attendance: ['EmpID', 'Name', 'Designation', 'Department', 'Weekday', 'Date', 'SchIn', 'SchOut', 'ChkIn', 'ChkOut',
    'Total', 'Status', 'Source', 'AddedAt'],
  Schedule: ['Date', 'Weekday', 'In', 'Out', 'ShiftHours', 'Note'],
  Submissions: ['SubmissionID', 'EmpID', 'EmpName', 'ReviewerEmail', 'OnBehalfOf', 'SubmittedAt', 'Version',
    'OtDays', 'OtHours', 'HolDays', 'HolHours', 'State', 'ReplacedAt', 'ReplacedBy', 'WorkArea'],
  ReviewDays: ['SubmissionID', 'EmpID', 'Date', 'DayType', 'Hours', 'Task', 'FileUrl']
};

var DEFAULT_SETTINGS = [
  ['orgName', 'Daffodil International University', 'Shown on bills and emails'],
  ['orgAddress', 'Daffodil Smart City, Birulia, Savar, Dhaka-1216', 'Shown on bills'],
  ['portalUrl', '', 'Address of the review portal, used in emails'],
  ['tutorialUrl', 'https://drive.google.com/file/d/1pO-BADnvdbjUqSkUPrlLnFG1EeQJxbZl/view', ''],
  ['contactName', 'মোঃ নাদিম হোসেন', ''],
  ['contactTitle', 'সিনিয়র অফিসার, এইচআর', ''],
  ['contactPhone', '01847334930', ''],
  ['contactExt', '65187', ''],
  ['allowedEmailDomains', 'daffodilvarsity.edu.bd,diu.edu.bd', 'Comma separated; reviewers/admins must use these'],
  ['otpMinutes', '5', 'How long a login code is valid'],
  ['sessionHours', '8', 'How long a login lasts'],
  ['defaultShiftIn', '08:00', ''],
  ['defaultShiftOut', '16:00', ''],
  ['taskWordLimit', '200', 'Weekend/holiday task description limit'],
  ['autoReminderDays', '3,1', 'Days before the deadline to send automatic reminders (blank = off)'],
  ['testEmailRedirect', '__OWNER__', 'TRIAL SAFETY: invitations, reminders and confirmations go to this address instead of the real people. Clear it only when going live.']
];

var DEFAULT_SIGNATORIES = [
  [1, 'Md Nadim Hossain', 'Senior Officer, HR'],
  [2, 'Md. Nurul Islam', 'Assistant Director, HR'],
  [3, 'Mohammad Riaz Uddin', 'Deputy Director, HR'],
  [4, 'Mr. Muhammad Rezaul Karim', 'Director (In-Charge), F&A'],
  [5, 'Dr. Hamidul Haque Khan', 'Treasurer']
];

/** Rate rules copied from the RatesRef tab of the September 2026 sheet (first match wins). */
var DEFAULT_RATES = [["Starts With", "Senior Student Counselor", 1300, 160], ["Starts With", "Sr. Student Counselor", 1300, 160], ["Starts With", "Sr Student Counselor", 1300, 160], ["Starts With", "Senior Administrative Officer", 1300, 160], ["Starts With", "Sr. Administrative Officer", 1300, 160], ["Starts With", "Sr Administrative Officer", 1300, 160], ["Starts With", "Senior Assistant Director", 1300, 160], ["Starts With", "Sr. Assistant Director", 1300, 160], ["Starts With", "Sr Assistant Director", 1300, 160], ["Starts With", "Senior Accounts Officer", 1300, 160], ["Starts With", "Sr. Accounts Officer", 1300, 160], ["Starts With", "Sr Accounts Officer", 1300, 160], ["Starts With", "Senior Library Officer", 1300, 160], ["Starts With", "Sr. Library Officer", 1300, 160], ["Starts With", "Sr Library Officer", 1300, 160], ["Starts With", "Assistant Administrative Officer", 850, 105], ["Starts With", "Asst. Administrative Officer", 850, 105], ["Starts With", "Assistant Student Counselor", 850, 105], ["Starts With", "Asst. Student Counselor", 850, 105], ["Starts With", "Assistant Accounts Officer", 850, 105], ["Starts With", "Asst. Accounts Officer", 850, 105], ["Starts With", "Asst Accounts Officer", 850, 105], ["Starts With", "Assistant Development Officer", 850, 105], ["Starts With", "Asst. Development Officer", 850, 105], ["Starts With", "Assistant IT Officer", 850, 105], ["Starts With", "Asst. IT Officer", 850, 105], ["Starts With", "Asst IT Officer", 850, 105], ["Starts With", "Assistant Engineer", 850, 105], ["Starts With", "Asst. Engineer", 850, 105], ["Starts With", "Asst Engineer", 850, 105], ["Contains", "Administrative Officer", 1000, 125], ["Contains", "Accounts Officer", 1000, 125], ["Contains", "Library Officer", 1000, 125], ["Contains", "Coordination Officer", 1000, 125], ["Contains", "Student Counselor", 1000, 125], ["Contains", "Executive", 1000, 125], ["Contains", "Development Officer", 1000, 125], ["Contains", "Lab Assistant", 700, 85], ["Contains", "Office Assistant", 700, 85], ["Contains", "IT Assistant", 700, 85], ["Contains", "Development Assistant", 700, 85], ["Contains", "Technical Assistant", 700, 85], ["Contains", "Sub Assistant Engineer", 700, 85], ["Contains", "Sub-Assistant Engineer", 700, 85], ["Exact", "Assistant", 700, 85], ["Grade Contains", "grade-11", 700, 85], ["Salary <", "17000", 550, 65], ["Default", "default", 600, 75]];

/** Admin permission areas. Levels: none | view | edit. */
var PERMISSION_AREAS = ['months', 'employees', 'approvals', 'mail', 'bill', 'settings', 'access', 'audit'];

var MONTH_STATUSES = ['DRAFT', 'REVIEW', 'CLOSED', 'DISBURSED'];

function prop_(key) { return PropertiesService.getScriptProperties().getProperty(key); }
function setProp_(key, val) { PropertiesService.getScriptProperties().setProperty(key, String(val)); }

function nowIso_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ss"); }
function todayIso_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

function monthLabel_(monthKey) {
  var p = String(monthKey).split('-');
  var names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return names[Number(p[1]) - 1] + ' ' + p[0];
}

function daysInMonth_(monthKey) {
  var p = String(monthKey).split('-');
  return new Date(Number(p[0]), Number(p[1]), 0).getDate();
}

function weekdayOf_(iso) {
  var p = iso.split('-');
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()];
}

function fail_(msg) { var e = new Error(msg); e.userFacing = true; throw e; }

// ---- 10_engine.js ----
/* ==================================================
   CALCULATION ENGINE (pure functions, no Google APIs)
   Used by the backend for supervisor limits, validation
   and the monthly bill. Times are handled in minutes.
   ================================================== */

var WEEKDAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
var FULL_DAY_MIN = 480; // 8 hours = one full holiday/weekend day

/** "18:00:45", "8:10", "07:25 PM", Date-like → minutes from midnight (seconds kept as fraction). */
function eng_parseClock(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') { // sheet time fraction
    if (v < 0) return null;
    return Math.round((v % 1) * 1440 * 60) / 60;
  }
  var s = String(v).trim();
  if (!s || s === '-' || /^absent$/i.test(s)) return null;
  var m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  var h = parseInt(m[1], 10), mi = parseInt(m[2], 10), se = m[3] ? parseInt(m[3], 10) : 0;
  if (m[4]) {
    var ap = m[4].toUpperCase();
    if (ap === 'PM' && h < 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
  }
  return h * 60 + mi + se / 60;
}

/** Duration "2:00", "24:00:00", "1:30H", "3H", "3 Hours", "2.5", 3 → minutes. */
function eng_parseDuration(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Math.round(v * 60); // plain number = hours
  var s = String(v).trim().toUpperCase().replace(/\s*(HOURS?|HRS?|H)$/, '');
  if (!s) return null;
  var m = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + (m[3] ? parseInt(m[3], 10) / 60 : 0);
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60);
  return null;
}

/** minutes → "h:mm" (rounded to the minute). */
function eng_fmt(min) {
  if (!min || min <= 0 || isNaN(min)) return '0:00';
  var t = Math.round(min);
  return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
}

function eng_dayType(status) {
  var s = String(status || '').toUpperCase();
  if (s.indexOf('HOLIDAY') !== -1) return 'HOLIDAY';
  if (s.indexOf('WEEKEND') !== -1) return 'WEEKEND';
  return 'WORKDAY';
}

function eng_isLate(status) {
  return /LATE:\s*Y/i.test(String(status || ''));
}

/** Worked minutes from punches; handles shifts crossing midnight. */
function eng_worked(chkIn, chkOut) {
  var a = eng_parseClock(chkIn), b = eng_parseClock(chkOut);
  if (a === null || b === null) return 0;
  var d = b - a;
  if (d < 0) d += 1440;
  if (d <= 0) return 0;
  return d;
}

/** "YYYY-MM-DD" helpers (string compare works for ISO dates). */
function eng_inRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

/**
 * Pick the approval that governs a date.
 * Priority: Maintenance (month-specific) > dated (seasonal) > ongoing; then newest.
 */
function eng_approvalFor(approvals, date) {
  var best = null, bestScore = -1;
  for (var i = 0; i < approvals.length; i++) {
    var a = approvals[i];
    if (a.active === false) continue;
    if (!eng_inRange(date, a.validFrom, a.validTo)) continue;
    var score = (a.source === 'Maintenance' ? 200 : 0) + (a.validTo ? 100 : 0);
    if (score > bestScore || (score === bestScore && String(a.createdAt || '') > String(best.createdAt || ''))) {
      best = a; bestScore = score;
    }
  }
  return best;
}

/** Is the employee covered by any approval during the month (YYYY-MM)? */
function eng_isEligible(approvals, monthKey) {
  var first = monthKey + '-01', last = monthKey + '-31';
  for (var i = 0; i < approvals.length; i++) {
    var a = approvals[i];
    if (a.active === false) continue;
    if (a.validTo && a.validTo < first) continue;
    if (a.validFrom && a.validFrom > last) continue;
    if ((a.dailyOtCapMin || 0) > 0 || a.weekendDuty || a.holidayDuty) return true;
  }
  return false;
}

/**
 * Attendance-based entitlement for every day of one employee.
 * opts: { schedule: {date:{shiftMin}}, lateRule: 'COUNT'|'DISQUALIFY' }
 * Returns array of day objects with eligible minutes and the reason when zero.
 */
function eng_employeeDays(rows, approvals, opts) {
  opts = opts || {};
  var schedule = opts.schedule || {};
  // Weekdays that are this employee's weekend (from their own WEEKEND rows); default Friday.
  var weekendDays = {};
  rows.forEach(function (r) { if (eng_dayType(r.status) === 'WEEKEND' && r.weekday) weekendDays[r.weekday] = true; });
  if (!Object.keys(weekendDays).length) weekendDays.Friday = true;

  return rows.map(function (r) {
    var type = eng_dayType(r.status);
    var sch = schedule[r.date] || {};
    var shift = sch.shiftMin || FULL_DAY_MIN;
    var special = shift < FULL_DAY_MIN;
    var worked = eng_worked(r.chkIn, r.chkOut);
    var appr = eng_approvalFor(approvals, r.date);
    var d = {
      date: r.date, weekday: r.weekday, status: r.status, type: type,
      schIn: r.schIn, schOut: r.schOut, chkIn: r.chkIn, chkOut: r.chkOut,
      workedMin: worked, shiftMin: shift, special: special,
      otMin: 0, otCapMin: 0, holidayMin: 0, holidayFraction: 0, holidayOnWeekend: false,
      allowed: false, reason: ''
    };
    if (!appr) { d.reason = 'No approval for this date'; return d; }

    if (type === 'WORKDAY') {
      var cap = appr.dailyOtCapMin || 0;
      if (cap > 0 && appr.securityBonus && special) cap += FULL_DAY_MIN - shift;
      d.otCapMin = cap;
      if (cap <= 0) { d.reason = 'Workday OT not approved'; return d; }
      if (appr.otWeekdays && appr.otWeekdays.length && appr.otWeekdays.indexOf(r.weekday) === -1) {
        d.reason = 'OT not approved on ' + r.weekday; return d;
      }
      d.allowed = true;
      if (opts.lateRule === 'DISQUALIFY' && eng_isLate(r.status)) { d.reason = 'Late (no OT this month)'; return d; }
      if (!worked) { d.reason = 'Punch missing'; return d; }
      if (worked < shift + 60) { d.reason = 'Worked less than shift + 1 hour'; return d; }
      d.otMin = Math.min(worked - shift, cap);
      return d;
    }

    // Weekend or holiday
    var onWeekendDay = type === 'HOLIDAY' && !!weekendDays[r.weekday];
    d.holidayOnWeekend = onWeekendDay;
    var ok = type === 'WEEKEND' ? !!appr.weekendDuty : (!!appr.holidayDuty || (!!appr.weekendDuty && onWeekendDay));
    if (!ok) { d.reason = type === 'WEEKEND' ? 'Weekend duty not approved' : 'Holiday duty not approved'; return d; }
    d.allowed = true;
    if (!worked) { d.reason = 'Punch missing'; return d; }
    var frac = Math.min(worked, shift) / shift;          // scheduled hours = one full day
    var maxMin = appr.holidayMaxMin || FULL_DAY_MIN;
    d.holidayFraction = frac;
    d.holidayMin = Math.min(frac * FULL_DAY_MIN, maxMin);
    return d;
  });
}

/** Credit for a supervisor-entered value on a given day (same scaling as attendance). */
function eng_supervisorCredit(day, supMin) {
  if (!supMin || supMin <= 0 || !day.allowed) return 0;
  if (day.type === 'WORKDAY') return Math.min(supMin, day.otMin);
  var frac = Math.min(supMin, day.shiftMin) / day.shiftMin;
  return Math.min(frac * FULL_DAY_MIN, day.holidayMin);
}

/** Rate lookup from rules [{type, value, holidayRate, otRate}] in order; first match wins. */
function eng_rate(rules, emp) {
  var d = String(emp.designation || '').trim().toLowerCase();
  var g = String(emp.grade || '').trim().toLowerCase();
  var sal = Number(String(emp.grossSalary || '').replace(/,/g, '')) || 0;
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i], t = String(r.type || '').toLowerCase(), v = String(r.value || '').trim().toLowerCase();
    var hit = false;
    if (t === 'starts with') hit = d.indexOf(v) === 0;
    else if (t === 'contains') hit = d.indexOf(v) !== -1;
    else if (t === 'exact') hit = d === v;
    else if (t === 'grade contains') hit = g.indexOf(v) !== -1;
    else if (t === 'salary <') hit = sal > 0 && sal < Number(v);
    else if (t === 'default') hit = true;
    if (hit) return { holidayRate: Number(r.holidayRate) || 0, otRate: Number(r.otRate) || 0, rule: r.type + ': ' + r.value };
  }
  return { holidayRate: 0, otRate: 0, rule: 'No rate rule matched' };
}

/**
 * Full monthly calculation for one employee.
 * sup: { 'YYYY-MM-DD': minutes } from the current supervisor submission (or null).
 * mode: 'DAY'  → lowest of supervisor vs attendance for each selected date
 *       'MONTH'→ lowest of supervisor total vs attendance total (previous spreadsheet method)
 */
function eng_employeeBill(emp, rows, approvals, sup, opts) {
  opts = opts || {};
  var days = eng_employeeDays(rows, approvals, opts);
  var a = { otDays: 0, otMin: 0, holDays: 0, holMin: 0, holFraction: 0 };
  var s = { otDays: 0, otMin: 0, holDays: 0, holMin: 0 };
  var f = { otDays: 0, otMin: 0, holDays: 0, holMin: 0 };
  days.forEach(function (d) {
    if (d.type === 'WORKDAY') { if (d.otMin > 0) { a.otDays++; a.otMin += d.otMin; } }
    else if (d.holidayMin > 0) { a.holDays++; a.holMin += d.holidayMin; a.holFraction += d.holidayFraction; }
    var sm = sup ? (sup[d.date] || 0) : 0;
    if (sm > 0) {
      if (d.type === 'WORKDAY') { s.otDays++; s.otMin += sm; } else { s.holDays++; s.holMin += sm; }
      var c = eng_supervisorCredit(d, sm);
      if (c > 0) {
        if (d.type === 'WORKDAY') { f.otDays++; f.otMin += c; } else { f.holDays++; f.holMin += c; }
      }
    }
  });
  // Monthly OT cap (e.g. 90 hours) — highest monthly cap among approvals in force this month
  var monthlyCap = 0;
  approvals.forEach(function (ap) {
    if (ap.active !== false && ap.monthlyOtCapMin && eng_isEligible([ap], opts.monthKey || '')) monthlyCap = Math.max(monthlyCap, ap.monthlyOtCapMin);
  });
  if (monthlyCap) { a.otMin = Math.min(a.otMin, monthlyCap); f.otMin = Math.min(f.otMin, monthlyCap); }

  var fin = f;
  if (opts.mode === 'MONTH') {
    fin = {
      otDays: Math.min(s.otDays, a.otDays), otMin: Math.min(s.otMin, a.otMin),
      holDays: Math.min(s.holDays, a.holDays), holMin: Math.min(s.holMin, a.holMin)
    };
  }
  var rate = emp.holidayRateOverride || emp.otRateOverride
    ? { holidayRate: Number(emp.holidayRateOverride) || eng_rate(opts.rates || [], emp).holidayRate,
        otRate: Number(emp.otRateOverride) || eng_rate(opts.rates || [], emp).otRate, rule: 'Employee override' }
    : eng_rate(opts.rates || [], emp);
  // Money uses the exact time (seconds included, as the spreadsheet did); each amount is rounded to whole Taka
  var holMinR = Math.round(fin.holMin), otMinR = Math.round(fin.otMin);
  var holidayBill = Math.round(rate.holidayRate / FULL_DAY_MIN * fin.holMin);
  var otBill = Math.round(rate.otRate * fin.otMin / 60);
  return {
    days: days, attendance: a, supervisor: s, final: { otDays: fin.otDays, otMin: otMinR, holDays: fin.holDays, holMin: holMinR },
    rate: rate, holidayBill: holidayBill, otBill: otBill, total: holidayBill + otBill, monthlyCapMin: monthlyCap
  };
}


// ---- 20_store.js ----
/* ==================================================
   STORAGE HELPERS — every sheet is a simple table:
   row 1 = headers, rows 2.. = records (stored as text).
   ================================================== */

var RUN_CACHE_ = {};

function master_() {
  if (RUN_CACHE_.master) return RUN_CACHE_.master;
  var id = prop_('MASTER_ID');
  if (!id) fail_('The system is not set up yet. Run SETUP once from the Apps Script editor.');
  RUN_CACHE_.master = SpreadsheetApp.openById(id);
  return RUN_CACHE_.master;
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
  }
  var maxCols = sh.getMaxColumns();
  if (maxCols < headers.length) sh.insertColumnsAfter(maxCols, headers.length - maxCols);
  else if (maxCols > headers.length) sh.deleteColumns(headers.length + 1, maxCols - headers.length);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground('#e6f4ea');
  sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
  sh.setFrozenRows(1);
  return sh;
}

function sheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) fail_('Sheet "' + name + '" is missing in ' + ss.getName());
  return sh;
}

/** Read a table as objects. Every value is returned as a trimmed string. */
function readTable_(ss, name) {
  var sh = sheet_(ss, name);
  var last = sh.getLastRow(), cols = sh.getLastColumn();
  if (last < 1 || cols < 1) return [];
  var values = sh.getRange(1, 1, last, cols).getValues();
  var headers = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i], o = {}, empty = true;
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      var v = row[c];
      if (v instanceof Date) v = Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
      v = v === null || v === undefined ? '' : String(v).trim();
      if (v !== '') empty = false;
      o[headers[c]] = v;
    }
    if (!empty) { o._row = i + 1; out.push(o); }
  }
  return out;
}

function headersOf_(ss, name) {
  var sh = sheet_(ss, name);
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) { return String(h).trim(); });
}

function toRow_(headers, obj) {
  return headers.map(function (h) {
    var v = obj[h];
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'YES' : 'NO';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  });
}

/** Append records (objects keyed by header). */
function appendRows_(ss, name, objs) {
  if (!objs.length) return;
  var sh = sheet_(ss, name);
  var headers = headersOf_(ss, name);
  var rows = objs.map(function (o) { return toRow_(headers, o); });
  var start = sh.getLastRow() + 1;
  if (sh.getMaxRows() < start + rows.length - 1) sh.insertRowsAfter(sh.getMaxRows(), start + rows.length - 1 - sh.getMaxRows());
  sh.getRange(start, 1, rows.length, headers.length).setNumberFormat('@').setValues(rows);
}

/** Replace the whole table body with these records. */
function writeTable_(ss, name, objs) {
  var sh = sheet_(ss, name);
  var headers = headersOf_(ss, name);
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, headers.length).clearContent();
  if (!objs.length) return;
  var rows = objs.map(function (o) { return toRow_(headers, o); });
  if (sh.getMaxRows() < rows.length + 1) sh.insertRowsAfter(sh.getMaxRows(), rows.length + 1 - sh.getMaxRows());
  sh.getRange(2, 1, rows.length, headers.length).setNumberFormat('@').setValues(rows);
  // Trim empty rows left behind so the file stays small
  var extra = sh.getMaxRows() - (rows.length + 1);
  if (extra > 50) sh.deleteRows(rows.length + 2, extra - 20);
}

/** Update fields of records that already have _row (from readTable_). */
function updateRows_(ss, name, objs) {
  if (!objs.length) return;
  var sh = sheet_(ss, name);
  var headers = headersOf_(ss, name);
  objs.forEach(function (o) {
    if (!o._row) return;
    sh.getRange(o._row, 1, 1, headers.length).setValues([toRow_(headers, o)]);
  });
}

function audit_(actor, action, monthKey, details) {
  try {
    appendRows_(master_(), 'Audit', [{ Timestamp: nowIso_(), Actor: actor || 'system', Action: action, Month: monthKey || '', Details: typeof details === 'string' ? details : JSON.stringify(details || {}) }]);
  } catch (e) { Logger.log('audit failed: ' + e); }
}

function settings_() {
  if (RUN_CACHE_.settings) return RUN_CACHE_.settings;
  var s = {};
  readTable_(master_(), 'Settings').forEach(function (r) { s[r.Key] = r.Value; });
  RUN_CACHE_.settings = s;
  return s;
}

function yes_(v) { return /^(yes|y|true|1)$/i.test(String(v || '').trim()); }

/* ---------- Months ---------- */

function monthRow_(monthKey) {
  var rows = readTable_(master_(), 'Months').filter(function (r) { return r.MonthKey === monthKey; });
  if (!rows.length) fail_('Month ' + monthKey + ' has not been opened yet.');
  return rows[0];
}

function monthSS_(monthKey) {
  RUN_CACHE_.months = RUN_CACHE_.months || {};
  if (RUN_CACHE_.months[monthKey]) return RUN_CACHE_.months[monthKey];
  var row = monthRow_(monthKey);
  var ss = SpreadsheetApp.openById(row.FileId);
  RUN_CACHE_.months[monthKey] = ss;
  return ss;
}

function requireMonthStatus_(monthKey, allowed) {
  var row = monthRow_(monthKey);
  if (allowed.indexOf(row.Status) === -1) {
    fail_('This is not allowed while ' + monthLabel_(monthKey) + ' is ' + row.Status + '.');
  }
  return row;
}

/* ---------- Domain objects ---------- */

function employeesMap_() {
  if (RUN_CACHE_.emps) return RUN_CACHE_.emps;
  var m = {};
  readTable_(master_(), 'Employees').forEach(function (e) { m[e.EmpID] = e; });
  RUN_CACHE_.emps = m;
  return m;
}

/** Approvals from the sheet → engine shape, grouped by employee. */
function approvalsByEmp_() {
  if (RUN_CACHE_.apprs) return RUN_CACHE_.apprs;
  var m = {};
  readTable_(master_(), 'Approvals').forEach(function (a) {
    (m[a.EmpID] = m[a.EmpID] || []).push(approvalToEngine_(a));
  });
  RUN_CACHE_.apprs = m;
  return m;
}

function approvalToEngine_(a) {
  return {
    id: a.ApprovalID, empId: a.EmpID, validFrom: a.ValidFrom, validTo: a.ValidTo,
    dailyOtCapMin: eng_parseDuration(a.DailyOtCap) || 0,
    monthlyOtCapMin: eng_parseDuration(a.MonthlyOtCap) || 0,
    otWeekdays: a.OtWeekdays ? a.OtWeekdays.split(/\s*,\s*/).filter(String) : [],
    otDaysPerWeek: Number(a.OtDaysPerWeek) || 0,
    weekendDuty: yes_(a.WeekendDuty), holidayDuty: yes_(a.HolidayDuty),
    holidayMaxMin: eng_parseDuration(a.HolidayMaxHours) || FULL_DAY_MIN,
    securityBonus: yes_(a.SecurityBonus), source: a.Source, month: a.Month,
    reference: a.Reference, notes: a.Notes, active: a.Active === '' ? true : yes_(a.Active), createdAt: a.CreatedAt
  };
}

function ratesRules_() {
  return readTable_(master_(), 'Rates')
    .sort(function (a, b) { return Number(a.Order) - Number(b.Order); })
    .map(function (r) { return { type: r.RuleType, value: r.Value, holidayRate: Number(r.HolidayRatePerDay), otRate: Number(r.OtRatePerHour) }; });
}

function scheduleMap_(monthKey) {
  var m = {};
  readTable_(monthSS_(monthKey), 'Schedule').forEach(function (s) {
    m[s.Date] = { shiftMin: eng_parseDuration(s.ShiftHours) || FULL_DAY_MIN, in: s.In, out: s.Out, note: s.Note };
  });
  return m;
}

function attendanceRowToEngine_(r) {
  return { empId: r.EmpID, name: r.Name, designation: r.Designation, department: r.Department, weekday: r.Weekday,
    date: r.Date, schIn: r.SchIn, schOut: r.SchOut, chkIn: r.ChkIn, chkOut: r.ChkOut, total: r.Total, status: r.Status, source: r.Source };
}

/** All attendance of the month grouped by employee. */
function attendanceByEmp_(monthKey) {
  var m = {};
  readTable_(monthSS_(monthKey), 'Attendance').forEach(function (r) {
    (m[r.EmpID] = m[r.EmpID] || []).push(attendanceRowToEngine_(r));
  });
  Object.keys(m).forEach(function (k) { m[k].sort(function (a, b) { return a.date < b.date ? -1 : 1; }); });
  return m;
}

/** Attendance of one employee — reads only that employee's block (sheet is kept sorted by EmpID). */
function attendanceOf_(monthKey, empId) {
  var sh = sheet_(monthSS_(monthKey), 'Attendance');
  var last = sh.getLastRow();
  if (last < 2) return [];
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  var first = -1, end = -1;
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === empId) { if (first === -1) first = i; end = i; }
  }
  if (first === -1) return [];
  var headers = MONTH_SHEETS.Attendance;
  var vals = sh.getRange(first + 2, 1, end - first + 1, headers.length).getValues();
  return vals.filter(function (v) { return String(v[0]).trim() === empId; }).map(function (v) {
    var o = {}; headers.forEach(function (h, c) { o[h] = String(v[c] === null ? '' : v[c]).trim(); });
    return attendanceRowToEngine_(o);
  }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
}

function currentSubmissions_(monthKey) {
  var m = {};
  readTable_(monthSS_(monthKey), 'Submissions').forEach(function (s) { if (s.State === 'CURRENT') m[s.EmpID] = s; });
  return m;
}

function reviewDaysFor_(monthKey, submissionIds) {
  var want = {};
  submissionIds.forEach(function (id) { want[id] = true; });
  var m = {};
  readTable_(monthSS_(monthKey), 'ReviewDays').forEach(function (d) {
    if (!want[d.SubmissionID]) return;
    (m[d.SubmissionID] = m[d.SubmissionID] || []).push(d);
  });
  return m;
}

// ---- 30_auth.js ----
/* ==================================================
   SIGN-IN: one-time codes by email, signed session tokens,
   admin permissions, and the reviewer (supervisor/delegate) rule.
   ================================================== */

function normEmail_(e) { return String(e || '').trim().toLowerCase(); }

function hash_(text) {
  var bytes = Utilities.computeHmacSha256Signature(String(text), prop_('SECRET'));
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function makeToken_(payload) {
  var body = Utilities.base64EncodeWebSafe(JSON.stringify(payload)).replace(/=+$/, '');
  return body + '.' + hash_(body);
}

function readToken_(token) {
  if (!token) return null;
  var parts = String(token).split('.');
  if (parts.length !== 2 || hash_(parts[0]) !== parts[1]) return null;
  try {
    var json = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0] + '==='.slice((parts[0].length + 3) % 4))).getDataAsString();
    var p = JSON.parse(json);
    if (!p.x || Date.now() > p.x) return null;
    return p;
  } catch (e) { return null; }
}

function domainAllowed_(email) {
  var list = String(settings_().allowedEmailDomains || '').split(',').map(function (d) { return d.trim().toLowerCase(); }).filter(String);
  if (!list.length) return true;
  var dom = email.split('@')[1] || '';
  return list.indexOf(dom) !== -1;
}

/* ---------- Reviewer rule ---------- */

function delegatesMap_() {
  if (RUN_CACHE_.delegates) return RUN_CACHE_.delegates;
  var m = {};
  readTable_(master_(), 'Delegates').forEach(function (d) {
    if (d.Active !== '' && !yes_(d.Active)) return;
    var s = normEmail_(d.SupervisorEmail), del = normEmail_(d.DelegateEmail);
    if (!s || !del) return;
    (m[s] = m[s] || []).push(del);
  });
  RUN_CACHE_.delegates = m;
  return m;
}

/** The email responsible for an employee: admin override, else the HRIS supervisor. */
function reviewerOf_(emp) {
  return normEmail_(emp.ReviewerOverrideEmail) || normEmail_(emp.SupervisorEmail);
}

/** Returns 'reviewer', 'delegate' or '' for this email and employee. */
function reviewRole_(email, emp) {
  var r = reviewerOf_(emp);
  if (!r) return '';
  if (email === r) return 'reviewer';
  var dels = delegatesMap_()[r] || [];
  return dels.indexOf(email) !== -1 ? 'delegate' : '';
}

/** Employees this email may review (as reviewer or delegate). */
function reviewableEmployees_(email) {
  var emps = employeesMap_();
  return Object.keys(emps).map(function (k) { return emps[k]; }).filter(function (e) { return !!reviewRole_(email, e); });
}

/* ---------- Admin permissions ---------- */

function isOwner_(email) { return email === normEmail_(prop_('OWNER_EMAIL')); }

function adminPermissions_(email) {
  if (isOwner_(email)) {
    var all = {};
    PERMISSION_AREAS.forEach(function (a) { all[a] = 'edit'; });
    return all;
  }
  var row = readTable_(master_(), 'Access').filter(function (a) { return normEmail_(a.Email) === email && (a.Active === '' || yes_(a.Active)); })[0];
  if (!row) return null;
  var p = {};
  try { p = JSON.parse(row.Permissions || '{}'); } catch (e) { p = {}; }
  var out = {};
  PERMISSION_AREAS.forEach(function (a) { out[a] = p[a] === 'edit' || p[a] === 'view' ? p[a] : 'none'; });
  return out;
}

function requirePerm_(ctx, area, level) {
  if (ctx.role !== 'admin') fail_('Please sign in to the admin panel.');
  var have = ctx.perms[area] || 'none';
  var ok = level === 'view' ? (have === 'view' || have === 'edit') : have === 'edit';
  if (!ok) fail_('You do not have ' + level + ' access to ' + area + '.');
}

/* ---------- One-time codes ---------- */

function sendOtp_(p) {
  var email = normEmail_(p.email);
  var purpose = p.purpose === 'admin' ? 'admin' : 'sup';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail_('Please enter a valid email address.');

  // Only send codes to people who can actually use them (same reply otherwise, so the list cannot be probed).
  var allowed = false;
  if (purpose === 'admin') allowed = !!adminPermissions_(email);
  else allowed = domainAllowed_(email) && reviewableEmployees_(email).length > 0;

  var ss = master_();
  var recent = readTable_(ss, 'OTP').filter(function (o) {
    return o.Email === email && (Date.now() - new Date(o.Timestamp + '+06:00').getTime()) < 3600 * 1000;
  });
  if (recent.length >= 5) fail_('Too many codes requested. Please wait an hour and try again.');

  if (allowed) {
    var code = String(Math.floor(100000 + Math.random() * 900000));
    appendRows_(ss, 'OTP', [{ Timestamp: nowIso_(), Email: email, CodeHash: hash_(email + ':' + code), Purpose: purpose, Status: 'PENDING', Attempts: '0' }]);
    var s = settings_();
    var mins = Number(s.otpMinutes) || 5;
    MailApp.sendEmail({
      to: email,
      subject: 'DIU Overtime Portal sign-in code: ' + code,
      htmlBody: '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:2px solid #006a4e;border-radius:12px">' +
        '<h2 style="color:#006a4e;text-align:center;margin:0 0 12px">' + (s.orgName || 'DIU') + '</h2>' +
        '<p>Your sign-in code for the ' + (purpose === 'admin' ? 'admin panel' : 'review portal') + ' is:</p>' +
        '<div style="background:#f0fdf4;padding:16px;text-align:center;font-size:34px;font-weight:900;letter-spacing:8px;color:#006a4e">' + code + '</div>' +
        '<p style="color:#555;font-size:13px">The code works for ' + mins + ' minutes. If you did not ask for it, ignore this email.</p></div>'
    });
  }
  return { sent: true, message: 'If this email is registered, a code has been sent to it.' };
}

function verifyOtp_(p) {
  var email = normEmail_(p.email), code = String(p.code || '').trim();
  var purpose = p.purpose === 'admin' ? 'admin' : 'sup';
  var ss = master_();
  var rows = readTable_(ss, 'OTP').filter(function (o) { return o.Email === email && o.Purpose === purpose && o.Status === 'PENDING'; });
  if (!rows.length) fail_('No active code. Please request a new one.');
  var row = rows[rows.length - 1];
  var mins = Number(settings_().otpMinutes) || 5;
  var age = Date.now() - new Date(row.Timestamp + '+06:00').getTime();
  if (age > mins * 60000) { row.Status = 'EXPIRED'; updateRows_(ss, 'OTP', [row]); fail_('The code has expired. Please request a new one.'); }
  if (row.CodeHash !== hash_(email + ':' + code)) {
    row.Attempts = String((Number(row.Attempts) || 0) + 1);
    if (Number(row.Attempts) >= 5) row.Status = 'BLOCKED';
    updateRows_(ss, 'OTP', [row]);
    fail_(row.Status === 'BLOCKED' ? 'Too many wrong attempts. Please request a new code.' : 'That code is not correct.');
  }
  row.Status = 'USED';
  updateRows_(ss, 'OTP', [row]);

  var hours = Number(settings_().sessionHours) || 8;
  var token = makeToken_({ e: email, r: purpose, x: Date.now() + hours * 3600 * 1000 });
  audit_(email, purpose === 'admin' ? 'admin.signin' : 'reviewer.signin', '', '');
  return { token: token, email: email, role: purpose, perms: purpose === 'admin' ? adminPermissions_(email) : null };
}

/** Builds the request context from a token. */
function context_(token) {
  var t = readToken_(token);
  if (!t) return { role: 'guest' };
  if (t.r === 'admin') {
    var perms = adminPermissions_(t.e);
    if (!perms) return { role: 'guest' };
    return { role: 'admin', email: t.e, perms: perms, owner: isOwner_(t.e) };
  }
  return { role: 'sup', email: t.e };
}

/** Delete codes older than 30 days (runs from the daily trigger). */
function purgeOtps_() {
  var ss = master_();
  var cutoff = Date.now() - 30 * 86400000;
  var keep = readTable_(ss, 'OTP').filter(function (o) { return new Date(o.Timestamp + '+06:00').getTime() > cutoff; });
  writeTable_(ss, 'OTP', keep);
}

// ---- 40_months.js ----
/* ==================================================
   ONE-TIME SETUP, MONTH FILES, SCHEDULE AND ATTENDANCE
   ================================================== */

/**
 * RUN THIS ONCE from the Apps Script editor (select SETUP → Run).
 * Creates the folder "DIU OT Trial", the master spreadsheet and the daily maintenance trigger.
 * Safe to run again: it only adds what is missing.
 */
function SETUP() {
  var props = PropertiesService.getScriptProperties();
  var owner = Session.getEffectiveUser().getEmail();
  if (!prop_('OWNER_EMAIL')) setProp_('OWNER_EMAIL', owner);
  if (!prop_('SECRET')) setProp_('SECRET', Utilities.getUuid() + Utilities.getUuid());

  var root = prop_('ROOT_FOLDER_ID') ? DriveApp.getFolderById(prop_('ROOT_FOLDER_ID')) : DriveApp.createFolder('DIU OT Trial');
  setProp_('ROOT_FOLDER_ID', root.getId());
  ['MONTHS', 'ARCHIVE', 'UPLOADS'].forEach(function (k) {
    var key = k + '_FOLDER_ID';
    if (!prop_(key)) setProp_(key, root.createFolder({ MONTHS: 'Monthly files', ARCHIVE: 'Disbursed (locked copies)', UPLOADS: 'Uploads and supporting files' }[k]).getId());
  });

  var ss;
  if (prop_('MASTER_ID')) ss = SpreadsheetApp.openById(prop_('MASTER_ID'));
  else {
    ss = SpreadsheetApp.create('DIU OT Trial — Master');
    DriveApp.getFileById(ss.getId()).moveTo(root);
    setProp_('MASTER_ID', ss.getId());
  }
  RUN_CACHE_.master = ss;
  Object.keys(MASTER_SHEETS).forEach(function (name) { ensureSheet_(ss, name, MASTER_SHEETS[name]); });
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  var have = {};
  readTable_(ss, 'Settings').forEach(function (r) { have[r.Key] = true; });
  appendRows_(ss, 'Settings', DEFAULT_SETTINGS.filter(function (r) { return !have[r[0]]; }).map(function (r) { return { Key: r[0], Value: r[1] === '__OWNER__' ? owner : r[1], Notes: r[2] }; }));
  if (!readTable_(ss, 'Rates').length) {
    appendRows_(ss, 'Rates', DEFAULT_RATES.map(function (r, i) { return { Order: String(i + 1), RuleType: r[0], Value: String(r[1]), HolidayRatePerDay: String(r[2]), OtRatePerHour: String(r[3]) }; }));
  }
  if (!readTable_(ss, 'Signatories').length) {
    appendRows_(ss, 'Signatories', DEFAULT_SIGNATORIES.map(function (r) { return { Order: r[0], Name: r[1], Title: r[2] }; }));
  }

  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'DAILY_JOBS') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('DAILY_JOBS').timeBased().everyDays(1).atHour(9).inTimezone(TZ).create();

  audit_(owner, 'setup', '', { version: APP_VERSION });
  Logger.log('Setup complete. Master: ' + ss.getUrl());
  Logger.log('Next: Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone). Put the URL in the portal.');
  return { masterUrl: ss.getUrl(), folderUrl: root.getUrl() };
}

/** Runs every morning: automatic reminders and clean-up. */
function DAILY_JOBS() {
  try { purgeOtps_(); } catch (e) { Logger.log(e); }
  try { autoReminders_(); } catch (e) { Logger.log(e); }
}

/* ---------- Months ---------- */

function listMonths_() {
  return readTable_(master_(), 'Months').sort(function (a, b) { return a.MonthKey < b.MonthKey ? 1 : -1; }).map(publicMonth_);
}

function publicMonth_(m) {
  return { monthKey: m.MonthKey, label: m.Label, fileUrl: m.FileUrl, status: m.Status, lateRule: m.LateRule || 'COUNT',
    lowestMode: m.LowestMode || 'MONTH', deadline: m.Deadline, createdAt: m.CreatedAt, closedAt: m.ClosedAt,
    disbursedAt: m.DisbursedAt, archiveUrl: m.ArchiveUrl, notes: m.Notes };
}

function createMonth_(ctx, p) {
  var key = String(p.monthKey || '');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) fail_('Choose a month.');
  var ms = master_();
  if (readTable_(ms, 'Months').some(function (r) { return r.MonthKey === key; })) fail_(monthLabel_(key) + ' already exists.');

  var ss = SpreadsheetApp.create('OT ' + monthLabel_(key) + ' (trial)');
  DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(prop_('MONTHS_FOLDER_ID')));
  Object.keys(MONTH_SHEETS).forEach(function (name) { ensureSheet_(ss, name, MONTH_SHEETS[name]); });
  var def = ss.getSheetByName('Sheet1');
  if (def) ss.deleteSheet(def);

  // Default office schedule: every day of the month, normal shift
  var s = settings_();
  var days = [];
  for (var d = 1; d <= daysInMonth_(key); d++) {
    var iso = key + '-' + ('0' + d).slice(-2);
    days.push({ Date: iso, Weekday: weekdayOf_(iso), In: s.defaultShiftIn || '08:00', Out: s.defaultShiftOut || '16:00', ShiftHours: '8:00', Note: '' });
  }
  writeTable_(ss, 'Schedule', days);

  appendRows_(ms, 'Months', [{ MonthKey: key, Label: monthLabel_(key), FileId: ss.getId(), FileUrl: ss.getUrl(), Status: 'DRAFT',
    LateRule: p.lateRule === 'DISQUALIFY' ? 'DISQUALIFY' : 'COUNT', LowestMode: p.lowestMode === 'DAY' ? 'DAY' : 'MONTH',
    Deadline: p.deadline || '', CreatedAt: nowIso_(), Notes: '' }]);
  audit_(ctx.email, 'month.create', key, '');
  return publicMonth_(monthRow_(key));
}

function updateMonth_(ctx, p) {
  var row = monthRow_(p.monthKey);
  if (row.Status === 'DISBURSED') fail_('A disbursed month cannot be changed.');
  if (p.deadline !== undefined) row.Deadline = p.deadline;
  if (p.lateRule) row.LateRule = p.lateRule === 'DISQUALIFY' ? 'DISQUALIFY' : 'COUNT';
  if (p.lowestMode) row.LowestMode = p.lowestMode === 'DAY' ? 'DAY' : 'MONTH';
  if (p.notes !== undefined) row.Notes = p.notes;
  if (row.Status === 'CLOSED' && (p.lateRule || p.lowestMode)) fail_('Reopen the month before changing calculation settings.');
  updateRows_(master_(), 'Months', [row]);
  audit_(ctx.email, 'month.update', p.monthKey, { deadline: row.Deadline, lateRule: row.LateRule, lowestMode: row.LowestMode });
  return publicMonth_(row);
}

/** DRAFT → REVIEW (open to supervisors) and back; CLOSED → REVIEW (reopen). Closing and disbursing have their own actions. */
function setMonthStatus_(ctx, p) {
  var row = monthRow_(p.monthKey);
  var to = p.status;
  var okMoves = { 'DRAFT>REVIEW': 1, 'REVIEW>DRAFT': 1, 'CLOSED>REVIEW': 1 };
  if (!okMoves[row.Status + '>' + to]) fail_('Cannot change ' + row.Status + ' to ' + to + ' here.');
  if (to === 'REVIEW') {
    var ss = monthSS_(p.monthKey);
    if (sheet_(ss, 'Attendance').getLastRow() < 2) fail_('Upload the attendance before opening the month for review.');
  }
  if (row.Status === 'CLOSED') {
    if (!p.reason) fail_('Please give a reason for reopening.');
    row.ClosedAt = '';
  }
  row.Status = to;
  updateRows_(master_(), 'Months', [row]);
  audit_(ctx.email, 'month.status', p.monthKey, { to: to, reason: p.reason || '' });
  return publicMonth_(row);
}

/* ---------- Office schedule ---------- */

function getSchedule_(p) {
  return readTable_(monthSS_(p.monthKey), 'Schedule').map(function (s) {
    return { date: s.Date, weekday: s.Weekday, in: s.In, out: s.Out, shiftHours: s.ShiftHours, note: s.Note };
  });
}

function saveSchedule_(ctx, p) {
  requireMonthStatus_(p.monthKey, ['DRAFT', 'REVIEW']);
  var rows = (p.days || []).map(function (d) {
    var inMin = eng_parseClock(d.in), outMin = eng_parseClock(d.out);
    var shift = d.shiftHours ? eng_parseDuration(d.shiftHours) : (inMin !== null && outMin !== null ? outMin - inMin : FULL_DAY_MIN);
    if (!shift || shift <= 0 || shift > 16 * 60) fail_('Check the shift on ' + d.date + '.');
    return { Date: d.date, Weekday: weekdayOf_(d.date), In: d.in || '', Out: d.out || '', ShiftHours: eng_fmt(shift), Note: d.note || '' };
  });
  writeTable_(monthSS_(p.monthKey), 'Schedule', rows);
  audit_(ctx.email, 'schedule.save', p.monthKey, { specialDays: rows.filter(function (r) { return r.ShiftHours !== '8:00'; }).length });
  return { saved: rows.length };
}

/* ---------- Attendance ---------- */

var ATT_KEYS_ = ['empId', 'name', 'designation', 'department', 'weekday', 'date', 'schIn', 'schOut', 'chkIn', 'chkOut', 'total', 'status'];

function cleanAttendanceRow_(r, monthKey, source) {
  var o = {};
  ATT_KEYS_.forEach(function (k) { o[k] = r[k] === null || r[k] === undefined ? '' : String(r[k]).trim(); });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.date)) fail_('Bad date "' + o.date + '" for employee ' + o.empId + '.');
  if (o.date.slice(0, 7) !== monthKey) return null; // other months are ignored
  if (!o.empId) return null;
  if (!o.weekday) o.weekday = weekdayOf_(o.date);
  return { EmpID: o.empId, Name: o.name, Designation: o.designation, Department: o.department, Weekday: o.weekday, Date: o.date,
    SchIn: o.schIn, SchOut: o.schOut, ChkIn: o.chkIn, ChkOut: o.chkOut, Total: o.total, Status: o.status, Source: source, AddedAt: nowIso_() };
}

/**
 * Import HRIS attendance. Sent in chunks: chunk 0 with mode 'replace' clears rows from the same source first.
 * Rows outside the month are skipped. The sheet is re-sorted by employee and date after the last chunk.
 */
function importAttendance_(ctx, p) {
  requireMonthStatus_(p.monthKey, ['DRAFT', 'REVIEW']);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var ss = monthSS_(p.monthKey);
    var source = p.source || 'HRIS';
    if (p.chunkIndex === 0 && p.mode === 'replace') {
      var keep = readTable_(ss, 'Attendance').filter(function (r) { return r.Source !== source; });
      writeTable_(ss, 'Attendance', keep);
    }
    var skipped = 0, rows = [];
    (p.rows || []).forEach(function (r) { var c = cleanAttendanceRow_(r, p.monthKey, source); if (c) rows.push(c); else skipped++; });
    appendRows_(ss, 'Attendance', rows);
    var done = p.chunkIndex === p.chunkCount - 1;
    var summary = null;
    if (done) {
      summary = sortAndDedupeAttendance_(ss);
      audit_(ctx.email, 'attendance.import', p.monthKey, { source: source, rows: summary.rows, employees: summary.employees, duplicatesRemoved: summary.duplicates });
    }
    return { added: rows.length, skipped: skipped, done: done, summary: summary };
  } finally { lock.releaseLock(); }
}

/** Keeps one row per employee+date (the latest added wins) and sorts by employee, date. */
function sortAndDedupeAttendance_(ss) {
  var all = readTable_(ss, 'Attendance');
  var byKey = {};
  all.forEach(function (r) { byKey[r.EmpID + '|' + r.Date] = r; });
  var rows = Object.keys(byKey).map(function (k) { return byKey[k]; });
  rows.sort(function (a, b) { return a.EmpID === b.EmpID ? (a.Date < b.Date ? -1 : 1) : (a.EmpID < b.EmpID ? -1 : 1); });
  writeTable_(ss, 'Attendance', rows);
  var emps = {}; rows.forEach(function (r) { emps[r.EmpID] = 1; });
  return { rows: rows.length, employees: Object.keys(emps).length, duplicates: all.length - rows.length };
}

/** Add or replace specific days for one employee (individual PDF report or manual entry). */
function addEmployeeAttendance_(ctx, p) {
  requireMonthStatus_(p.monthKey, ['DRAFT', 'REVIEW']);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var ss = monthSS_(p.monthKey);
    var source = p.source || 'Individual report';
    var rows = [];
    (p.rows || []).forEach(function (r) { var c = cleanAttendanceRow_(r, p.monthKey, source); if (c) rows.push(c); });
    if (!rows.length) fail_('None of these days are in ' + monthLabel_(p.monthKey) + '.');
    appendRows_(ss, 'Attendance', rows);
    var summary = sortAndDedupeAttendance_(ss);
    audit_(ctx.email, 'attendance.addEmployee', p.monthKey, { empId: rows[0].EmpID, days: rows.length, source: source });
    return { added: rows.length, summary: summary };
  } finally { lock.releaseLock(); }
}

function attendanceSummary_(p) {
  var ss = monthSS_(p.monthKey);
  var rows = readTable_(ss, 'Attendance');
  var bySource = {}, emps = {}, holidays = {};
  rows.forEach(function (r) {
    bySource[r.Source] = (bySource[r.Source] || 0) + 1; emps[r.EmpID] = 1;
    if (/HOLIDAY/i.test(r.Status)) holidays[r.Date] = r.Status;
  });
  return { rows: rows.length, employees: Object.keys(emps).length, bySource: bySource,
    holidays: Object.keys(holidays).sort().map(function (d) { return { date: d, weekday: weekdayOf_(d), status: holidays[d] }; }) };
}

/** Attendance rows of one employee for the admin (used before adding an individual report). */
function employeeAttendanceAdmin_(p) {
  return attendanceOf_(p.monthKey, String(p.empId).trim());
}

/* ---------- Disbursed: locked copy ---------- */

function disburseMonth_(ctx, p) {
  var row = requireMonthStatus_(p.monthKey, ['CLOSED']);
  var src = DriveApp.getFileById(row.FileId);
  var copy = src.makeCopy('OT ' + monthLabel_(p.monthKey) + ' — DISBURSED ' + todayIso_(), DriveApp.getFolderById(prop_('ARCHIVE_FOLDER_ID')));
  lockFile_(copy.getId(), 'Disbursed — do not change');
  lockFile_(row.FileId, 'Disbursed — the locked copy is in the archive folder');
  row.Status = 'DISBURSED';
  row.DisbursedAt = nowIso_();
  row.ArchiveFileId = copy.getId();
  row.ArchiveUrl = copy.getUrl();
  updateRows_(master_(), 'Months', [row]);
  audit_(ctx.email, 'month.disburse', p.monthKey, { archive: copy.getUrl() });
  return publicMonth_(row);
}

/** Google Drive "lock file" (read-only for everyone, including the owner, until unlocked). */
function lockFile_(fileId, reason) {
  try {
    UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + fileId + '?supportsAllDrives=true', {
      method: 'patch', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      payload: JSON.stringify({ contentRestrictions: [{ readOnly: true, reason: reason }] })
    });
  } catch (e) {
    Logger.log('Could not lock file ' + fileId + ': ' + e);
  }
}

// ---- 50_people.js ----
/* ==================================================
   EMPLOYEES, REVIEWERS, APPROVALS, MAINTENANCE LIST,
   RATES, SIGNATORIES, SETTINGS AND ACCESS
   ================================================== */

/* ---------- Employees ---------- */

function listEmployees_() {
  var dels = delegatesMap_();
  var apprs = approvalsByEmp_();
  return readTable_(master_(), 'Employees').map(function (e) {
    var rev = reviewerOf_(e);
    return {
      empId: e.EmpID, name: e.Name, designation: e.Designation, department: e.Department, employeeType: e.EmployeeType,
      category: e.Category, grade: e.Grade, grossSalary: e.GrossSalary, supervisorName: e.SupervisorName,
      supervisorEmail: e.SupervisorEmail, reviewerOverrideEmail: e.ReviewerOverrideEmail, reviewer: rev,
      delegates: dels[rev] || [], holidayRateOverride: e.HolidayRateOverride, otRateOverride: e.OtRateOverride,
      workArea: e.WorkArea, inLatestHris: e.InLatestHRIS, approvals: (apprs[e.EmpID] || []).filter(function (a) { return a.active; }).length
    };
  });
}

/**
 * HRIS "Employee common info" upload. Client sends only the needed columns.
 * dryRun → list of changes for the admin to check; otherwise apply them.
 */
function importHrisEmployees_(ctx, p) {
  var ss = master_();
  var existing = readTable_(ss, 'Employees');
  var byId = {};
  existing.forEach(function (e) { byId[e.EmpID] = e; });
  var seen = {}, added = [], changed = [], fields = [['name', 'Name'], ['designation', 'Designation'], ['department', 'Department'],
    ['employeeType', 'EmployeeType'], ['category', 'Category'], ['supervisorName', 'SupervisorName'], ['supervisorEmail', 'SupervisorEmail']];
  (p.rows || []).forEach(function (r) {
    var id = String(r.empId || '').trim();
    if (!/^\d{5,}$/.test(id) || seen[id]) return;
    seen[id] = true;
    var cur = byId[id];
    var next = {};
    fields.forEach(function (f) {
      var v = String(r[f[0]] === undefined ? '' : r[f[0]]).trim();
      if (f[0] === 'supervisorEmail') v = /@/.test(v) ? normEmail_(v) : '';
      next[f[1]] = v;
    });
    if (!cur) { added.push(Object.assign({ EmpID: id }, next)); return; }
    var diff = {};
    fields.forEach(function (f) { if ((cur[f[1]] || '') !== next[f[1]] && next[f[1]] !== '') diff[f[1]] = { from: cur[f[1]] || '', to: next[f[1]] }; });
    if (Object.keys(diff).length) changed.push({ empId: id, name: next.Name || cur.Name, diff: diff });
  });
  var apprs = approvalsByEmp_();
  var missing = existing.filter(function (e) { return !seen[e.EmpID]; }).map(function (e) {
    return { empId: e.EmpID, name: e.Name, hasApproval: (apprs[e.EmpID] || []).some(function (a) { return a.active; }) };
  });
  var result = { added: added.length, changed: changed, missing: missing, addedList: added.slice(0, 500).map(function (a) { return { empId: a.EmpID, name: a.Name, department: a.Department }; }) };
  if (p.dryRun) return result;

  var now = nowIso_();
  existing.forEach(function (e) {
    var r = null;
    for (var i = 0; i < changed.length; i++) if (changed[i].empId === e.EmpID) { r = changed[i]; break; }
    if (r) Object.keys(r.diff).forEach(function (k) { e[k] = r.diff[k].to; });
    e.InLatestHRIS = seen[e.EmpID] ? 'YES' : 'NO';
    if (r) e.UpdatedAt = now;
  });
  added.forEach(function (a) { a.InLatestHRIS = 'YES'; a.UpdatedAt = now; });
  writeTable_(ss, 'Employees', existing.concat(added));
  RUN_CACHE_.emps = null;
  audit_(ctx.email, 'employees.importHris', '', { added: added.length, changed: changed.length, notInFile: missing.length });
  return result;
}

/** Grade & gross salary upload ("Grade and Salary Info"). With addMissing, IDs not in the list are added using the name/designation/department in the file. */
function importGrades_(ctx, p) {
  var ss = master_();
  var existing = readTable_(ss, 'Employees');
  var byId = {}; existing.forEach(function (e) { byId[e.EmpID] = e; });
  var updated = 0, unknown = [], added = [];
  (p.rows || []).forEach(function (r) {
    var id = String(r.empId || '').trim();
    var g = String(r.grade || '').trim(), s = String(r.grossSalary || '').replace(/,/g, '').trim();
    var e = byId[id];
    if (!e) {
      if (!/^\d{5,}$/.test(id)) return;
      if (p.addMissing && r.name) {
        e = { EmpID: id, Name: String(r.name).trim(), Designation: String(r.designation || '').trim(), Department: String(r.department || '').trim(),
          Grade: g, GrossSalary: s, InLatestHRIS: 'NO', UpdatedAt: nowIso_() };
        byId[id] = e; added.push(e);
      } else unknown.push(id);
      return;
    }
    if ((g && g !== e.Grade) || (s && s !== e.GrossSalary)) { if (g) e.Grade = g; if (s) e.GrossSalary = s; e.UpdatedAt = nowIso_(); updated++; }
  });
  if (!p.dryRun) {
    writeTable_(ss, 'Employees', existing.concat(added)); RUN_CACHE_.emps = null;
    audit_(ctx.email, 'employees.importGrades', '', { updated: updated, added: added.length, unknown: unknown.length });
  }
  return { updated: updated, unknown: unknown, added: added.length };
}

function updateEmployee_(ctx, p) {
  var ss = master_();
  var rows = readTable_(ss, 'Employees');
  var e = rows.filter(function (r) { return r.EmpID === String(p.empId); })[0];
  var isNew = !e;
  if (isNew) {
    if (!p.name) fail_('Employee ' + p.empId + ' is not in the list. Give at least a name to add them.');
    e = { EmpID: String(p.empId).trim() };
  }
  var map = { name: 'Name', designation: 'Designation', department: 'Department', employeeType: 'EmployeeType', grade: 'Grade',
    grossSalary: 'GrossSalary', supervisorName: 'SupervisorName', supervisorEmail: 'SupervisorEmail',
    reviewerOverrideEmail: 'ReviewerOverrideEmail', holidayRateOverride: 'HolidayRateOverride', otRateOverride: 'OtRateOverride', workArea: 'WorkArea' };
  var changes = {};
  Object.keys(map).forEach(function (k) {
    if (p[k] === undefined) return;
    var v = String(p[k]).trim();
    if (/Email$/.test(k)) { v = normEmail_(v); if (v && !/@/.test(v)) fail_('Check the email address.'); }
    if (e[map[k]] !== v) { changes[map[k]] = { from: e[map[k]] || '', to: v }; e[map[k]] = v; }
  });
  e.UpdatedAt = nowIso_();
  if (isNew) appendRows_(ss, 'Employees', [e]); else updateRows_(ss, 'Employees', [e]);
  RUN_CACHE_.emps = null;
  audit_(ctx.email, isNew ? 'employee.add' : 'employee.update', '', { empId: e.EmpID, changes: changes });
  return { saved: true };
}

/* ---------- Delegates ---------- */

function listDelegates_() {
  return readTable_(master_(), 'Delegates').map(function (d) {
    return { supervisorEmail: d.SupervisorEmail, delegateEmail: d.DelegateEmail, note: d.Note, active: d.Active === '' || yes_(d.Active), addedAt: d.AddedAt, addedBy: d.AddedBy, row: d._row };
  });
}

function saveDelegate_(ctx, p) {
  var sup = normEmail_(p.supervisorEmail), del = normEmail_(p.delegateEmail);
  if (!/@/.test(sup) || !/@/.test(del)) fail_('Enter both email addresses.');
  if (sup === del) fail_('The delegate must be a different person.');
  var ss = master_();
  var rows = readTable_(ss, 'Delegates');
  var row = rows.filter(function (r) { return normEmail_(r.SupervisorEmail) === sup && normEmail_(r.DelegateEmail) === del; })[0];
  if (row) { row.Active = p.active === false ? 'NO' : 'YES'; row.Note = p.note || row.Note; updateRows_(ss, 'Delegates', [row]); }
  else appendRows_(ss, 'Delegates', [{ SupervisorEmail: sup, DelegateEmail: del, Note: p.note || '', Active: 'YES', AddedAt: nowIso_(), AddedBy: ctx.email }]);
  RUN_CACHE_.delegates = null;
  audit_(ctx.email, 'delegate.save', '', { supervisor: sup, delegate: del, active: p.active !== false });
  return { saved: true };
}

/* ---------- Approvals ---------- */

function approvalFromInput_(p) {
  var id = String(p.empId || '').trim();
  if (!/^\d{5,}$/.test(id)) fail_('Employee ID is missing or wrong.');
  var iso = /^\d{4}-\d{2}-\d{2}$/;
  if (p.validFrom && !iso.test(p.validFrom)) fail_('Valid from must be a date.');
  if (p.validTo && !iso.test(p.validTo)) fail_('Valid to must be a date.');
  if (p.validFrom && p.validTo && p.validTo < p.validFrom) fail_('Valid to is before valid from.');
  var cap = p.dailyOtCap === '' || p.dailyOtCap === undefined ? 0 : eng_parseDuration(p.dailyOtCap);
  if (cap === null || cap < 0 || cap > 8 * 60) fail_('Daily OT cap must be between 0 and 8 hours.');
  var mcap = p.monthlyOtCap ? eng_parseDuration(p.monthlyOtCap) : 0;
  if (mcap === null) fail_('Monthly OT cap is not a valid number of hours.');
  var days = (Array.isArray(p.otWeekdays) ? p.otWeekdays : String(p.otWeekdays || '').split(','))
    .map(function (d) { return String(d).trim(); }).filter(String);
  days.forEach(function (d) { if (WEEKDAYS.indexOf(d) === -1) fail_('Unknown weekday "' + d + '".'); });
  var hmax = p.holidayMaxHours ? eng_parseDuration(p.holidayMaxHours) : FULL_DAY_MIN;
  return {
    EmpID: id, ValidFrom: p.validFrom || '', ValidTo: p.validTo || '', DailyOtCap: eng_fmt(cap), MonthlyOtCap: mcap ? eng_fmt(mcap) : '',
    OtWeekdays: days.join(', '), OtDaysPerWeek: p.otDaysPerWeek ? String(Number(p.otDaysPerWeek)) : '',
    WeekendDuty: p.weekendDuty ? 'YES' : 'NO', HolidayDuty: p.holidayDuty ? 'YES' : 'NO', HolidayMaxHours: eng_fmt(hmax),
    SecurityBonus: p.securityBonus ? 'YES' : 'NO', Source: p.source || 'HR', Month: p.month || '', Reference: p.reference || '', Notes: p.notes || '',
    Active: p.active === false ? 'NO' : 'YES'
  };
}

function newApprovalId_() { return 'AP' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + Math.floor(Math.random() * 1000); }

function listApprovals_(p) {
  var emps = employeesMap_();
  return readTable_(master_(), 'Approvals').filter(function (a) {
    return !p.empId || a.EmpID === String(p.empId);
  }).map(function (a) {
    var e = emps[a.EmpID] || {};
    return { approvalId: a.ApprovalID, empId: a.EmpID, name: e.Name || '', department: e.Department || '', designation: e.Designation || '',
      validFrom: a.ValidFrom, validTo: a.ValidTo, dailyOtCap: a.DailyOtCap, monthlyOtCap: a.MonthlyOtCap,
      otWeekdays: a.OtWeekdays ? a.OtWeekdays.split(/\s*,\s*/) : [], otDaysPerWeek: a.OtDaysPerWeek,
      weekendDuty: yes_(a.WeekendDuty), holidayDuty: yes_(a.HolidayDuty), holidayMaxHours: a.HolidayMaxHours,
      securityBonus: yes_(a.SecurityBonus), source: a.Source, month: a.Month, reference: a.Reference, notes: a.Notes,
      active: a.Active === '' || yes_(a.Active), createdAt: a.CreatedAt, createdBy: a.CreatedBy };
  });
}

function saveApproval_(ctx, p) {
  var ss = master_();
  var rec = approvalFromInput_(p);
  if (!employeesMap_()[rec.EmpID]) fail_('Employee ' + rec.EmpID + ' is not in the employee list. Upload the HRIS file or add them first.');
  if (p.approvalId) {
    var row = readTable_(ss, 'Approvals').filter(function (a) { return a.ApprovalID === p.approvalId; })[0];
    if (!row) fail_('Approval not found.');
    Object.keys(rec).forEach(function (k) { row[k] = rec[k]; });
    updateRows_(ss, 'Approvals', [row]);
    audit_(ctx.email, 'approval.update', rec.Month, { id: p.approvalId, empId: rec.EmpID, record: rec });
    return { approvalId: p.approvalId };
  }
  rec.ApprovalID = newApprovalId_(); rec.CreatedAt = nowIso_(); rec.CreatedBy = ctx.email;
  appendRows_(ss, 'Approvals', [rec]);
  audit_(ctx.email, 'approval.add', rec.Month, { id: rec.ApprovalID, empId: rec.EmpID, record: rec });
  return { approvalId: rec.ApprovalID };
}

/** Bulk approvals upload (template columns). dryRun returns row-by-row problems. */
function importApprovals_(ctx, p) {
  var emps = employeesMap_();
  var ok = [], errors = [];
  (p.rows || []).forEach(function (r, i) {
    try {
      var rec = approvalFromInput_(r);
      if (!emps[rec.EmpID]) throw new Error('Employee ' + rec.EmpID + ' is not in the employee list');
      ok.push(rec);
    } catch (e) { errors.push({ row: i + 2, empId: r.empId || '', message: e.message }); }
  });
  if (p.dryRun || errors.length) return { valid: ok.length, errors: errors, saved: 0 };
  var stamp = nowIso_();
  ok.forEach(function (rec, i) { rec.ApprovalID = newApprovalId_() + i; rec.CreatedAt = stamp; rec.CreatedBy = ctx.email; });
  appendRows_(master_(), 'Approvals', ok);
  RUN_CACHE_.apprs = null;
  audit_(ctx.email, 'approvals.import', '', { saved: ok.length });
  return { valid: ok.length, errors: [], saved: ok.length };
}

/**
 * Maintenance section's monthly list. Rows were interpreted in the browser and confirmed by the admin.
 * Replaces any earlier Maintenance approvals for the same month. The original file is kept in Drive.
 */
function importMaintenance_(ctx, p) {
  var key = p.monthKey;
  requireMonthStatus_(key, ['DRAFT', 'REVIEW']);
  var emps = employeesMap_();
  var recs = [], errors = [];
  (p.rows || []).forEach(function (r, i) {
    try {
      var rec = approvalFromInput_(Object.assign({}, r, {
        source: 'Maintenance', month: key,
        validFrom: r.validFrom || key + '-01', validTo: r.validTo || key + '-' + ('0' + daysInMonth_(key)).slice(-2),
        reference: 'Maintenance list ' + monthLabel_(key)
      }));
      if (!emps[rec.EmpID]) throw new Error('Employee ' + rec.EmpID + ' is not in the employee list');
      recs.push(rec);
    } catch (e) { errors.push({ row: r.sourceRow || i + 2, empId: r.empId || '', message: e.message }); }
  });
  if (errors.length) return { saved: 0, errors: errors };

  var fileUrl = '';
  if (p.fileBase64 && p.fileName) {
    var blob = Utilities.newBlob(Utilities.base64Decode(p.fileBase64), p.mimeType || 'application/octet-stream', key + ' Maintenance list - ' + p.fileName);
    fileUrl = DriveApp.getFolderById(prop_('UPLOADS_FOLDER_ID')).createFile(blob).getUrl();
  }
  var ss = master_();
  var all = readTable_(ss, 'Approvals');
  var keep = all.filter(function (a) { return !(a.Source === 'Maintenance' && a.Month === key); });
  var stamp = nowIso_();
  recs.forEach(function (rec, i) { rec.ApprovalID = newApprovalId_() + i; rec.CreatedAt = stamp; rec.CreatedBy = ctx.email; if (fileUrl) rec.Reference += ' (' + fileUrl + ')'; });
  writeTable_(ss, 'Approvals', keep.concat(recs));
  RUN_CACHE_.apprs = null;
  audit_(ctx.email, 'maintenance.import', key, { saved: recs.length, replaced: all.length - keep.length, file: fileUrl });
  return { saved: recs.length, replaced: all.length - keep.length, errors: [], fileUrl: fileUrl };
}

/* ---------- Rates, signatories, settings ---------- */

function getRates_() {
  return ratesRules_().map(function (r, i) { return { order: i + 1, type: r.type, value: r.value, holidayRate: r.holidayRate, otRate: r.otRate }; });
}

function saveRates_(ctx, p) {
  var types = ['Starts With', 'Contains', 'Exact', 'Grade Contains', 'Salary <', 'Default'];
  var rows = (p.rules || []).map(function (r, i) {
    if (types.indexOf(r.type) === -1) fail_('Unknown rule type "' + r.type + '" on line ' + (i + 1) + '.');
    if (!(Number(r.holidayRate) >= 0) || !(Number(r.otRate) >= 0)) fail_('Rates must be numbers (line ' + (i + 1) + ').');
    return { Order: String(i + 1), RuleType: r.type, Value: String(r.value || ''), HolidayRatePerDay: String(Number(r.holidayRate)), OtRatePerHour: String(Number(r.otRate)) };
  });
  if (!rows.some(function (r) { return r.RuleType === 'Default'; })) fail_('Keep a "Default" rule at the end so every employee gets a rate.');
  writeTable_(master_(), 'Rates', rows);
  audit_(ctx.email, 'rates.save', '', { rules: rows.length });
  return { saved: rows.length };
}

function getSignatories_() {
  return readTable_(master_(), 'Signatories').sort(function (a, b) { return Number(a.Order) - Number(b.Order); })
    .map(function (s) { return { name: s.Name, title: s.Title }; });
}

function saveSignatories_(ctx, p) {
  var rows = (p.signatories || []).filter(function (s) { return s.name; }).map(function (s, i) { return { Order: String(i + 1), Name: s.name, Title: s.title || '' }; });
  writeTable_(master_(), 'Signatories', rows);
  audit_(ctx.email, 'signatories.save', '', { count: rows.length });
  return { saved: rows.length };
}

function getSettings_() {
  return readTable_(master_(), 'Settings').map(function (r) { return { key: r.Key, value: r.Value, notes: r.Notes }; });
}

function saveSettings_(ctx, p) {
  var ss = master_();
  var rows = readTable_(ss, 'Settings');
  var changed = {};
  (p.settings || []).forEach(function (s) {
    var r = rows.filter(function (x) { return x.Key === s.key; })[0];
    if (!r) return;
    if (r.Value !== String(s.value)) { changed[s.key] = { from: r.Value, to: String(s.value) }; r.Value = String(s.value); }
  });
  updateRows_(ss, 'Settings', rows.filter(function (r) { return changed[r.Key]; }));
  audit_(ctx.email, 'settings.save', '', changed);
  return { saved: Object.keys(changed).length };
}

/* ---------- Access (who can use the admin panel) ---------- */

function listAccess_() {
  return [{ email: normEmail_(prop_('OWNER_EMAIL')), name: 'Owner', owner: true, active: true, permissions: adminPermissions_(normEmail_(prop_('OWNER_EMAIL'))) }]
    .concat(readTable_(master_(), 'Access').map(function (a) {
      var perms = {}; try { perms = JSON.parse(a.Permissions || '{}'); } catch (e) { }
      return { email: a.Email, name: a.Name, owner: false, active: a.Active === '' || yes_(a.Active), permissions: perms, addedAt: a.AddedAt, addedBy: a.AddedBy };
    }));
}

function saveAccess_(ctx, p) {
  if (!ctx.owner) fail_('Only the owner can change who has access.');
  var email = normEmail_(p.email);
  if (!/@/.test(email)) fail_('Enter an email address.');
  if (isOwner_(email)) fail_('The owner always has full access.');
  if (!domainAllowed_(email)) fail_('Only DIU email addresses can be given access.');
  var perms = {};
  PERMISSION_AREAS.forEach(function (a) {
    var v = (p.permissions || {})[a];
    perms[a] = v === 'edit' || v === 'view' ? v : 'none';
  });
  perms.access = 'none'; // only the owner manages access
  var ss = master_();
  var row = readTable_(ss, 'Access').filter(function (a) { return normEmail_(a.Email) === email; })[0];
  if (row) { row.Name = p.name || row.Name; row.Permissions = JSON.stringify(perms); row.Active = p.active === false ? 'NO' : 'YES'; updateRows_(ss, 'Access', [row]); }
  else appendRows_(ss, 'Access', [{ Email: email, Name: p.name || '', Permissions: JSON.stringify(perms), Active: p.active === false ? 'NO' : 'YES', AddedAt: nowIso_(), AddedBy: ctx.email }]);
  audit_(ctx.email, 'access.save', '', { email: email, permissions: perms, active: p.active !== false });
  return { saved: true };
}

function listAudit_(p) {
  var rows = readTable_(master_(), 'Audit');
  if (p.monthKey) rows = rows.filter(function (r) { return r.Month === p.monthKey; });
  return rows.slice(-Math.min(Number(p.limit) || 300, 2000)).reverse().map(function (r) {
    return { at: r.Timestamp, actor: r.Actor, action: r.Action, month: r.Month, details: r.Details };
  });
}

// ---- 60_review.js ----
/* ==================================================
   SUPERVISOR REVIEW: my team, one employee, submit
   ================================================== */

function supMonths_() {
  return readTable_(master_(), 'Months').filter(function (m) { return m.Status === 'REVIEW'; })
    .sort(function (a, b) { return a.MonthKey < b.MonthKey ? 1 : -1; }).map(publicMonth_);
}

function attendanceIdSet_(monthKey) {
  var sh = sheet_(monthSS_(monthKey), 'Attendance');
  var set = {};
  if (sh.getLastRow() < 2) return set;
  sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (v) { set[String(v[0]).trim()] = true; });
  return set;
}

function describeApproval_(a) {
  if (!a) return 'No approval';
  var parts = [];
  if (a.dailyOtCapMin > 0) {
    parts.push('Workday OT up to ' + eng_fmt(a.dailyOtCapMin) + ' h/day' + (a.securityBonus ? ' (+ special-schedule hours)' : ''));
    if (a.otWeekdays && a.otWeekdays.length) parts.push('only on ' + a.otWeekdays.join(', '));
    if (a.otDaysPerWeek) parts.push('max ' + a.otDaysPerWeek + ' OT days a week');
    if (a.monthlyOtCapMin) parts.push('max ' + eng_fmt(a.monthlyOtCapMin) + ' h OT a month');
  } else parts.push('No workday OT');
  parts.push(a.weekendDuty ? 'Weekend duty: yes' : 'Weekend duty: no');
  parts.push(a.holidayDuty ? 'Holiday duty: yes' : (a.weekendDuty ? 'Holiday duty: only when it falls on the weekend' : 'Holiday duty: no'));
  return parts.join(' · ');
}

function teamFor_(ctx, p) {
  var key = p.monthKey;
  var month = monthRow_(key);
  if (['REVIEW', 'CLOSED', 'DISBURSED'].indexOf(month.Status) === -1) fail_('This month is not open for review yet.');
  var apprs = approvalsByEmp_();
  var subs = currentSubmissions_(key);
  var att = attendanceIdSet_(key);
  var team = reviewableEmployees_(ctx.email).filter(function (e) { return eng_isEligible(apprs[e.EmpID] || [], key); }).map(function (e) {
    var s = subs[e.EmpID];
    return {
      empId: e.EmpID, name: e.Name, designation: e.Designation, department: e.Department, role: reviewRole_(ctx.email, e),
      reviewer: reviewerOf_(e), hasAttendance: !!att[e.EmpID],
      submitted: s ? { by: s.ReviewerEmail, onBehalfOf: s.OnBehalfOf, at: s.SubmittedAt, version: s.Version, otHours: s.OtHours, holHours: s.HolHours, otDays: s.OtDays, holDays: s.HolDays } : null
    };
  }).sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  return { month: publicMonth_(month), team: team, canSubmit: month.Status === 'REVIEW' };
}

/** Everything the review screen needs for one employee. Used by supervisors and (read-only) by admins. */
function employeeReview_(ctx, p) {
  var key = p.monthKey, empId = String(p.empId || '').trim();
  var month = monthRow_(key);
  var emp = employeesMap_()[empId];
  if (!emp) fail_('Employee ' + empId + ' was not found.');
  if (ctx.role === 'sup' && !reviewRole_(ctx.email, emp)) fail_('You are not the supervisor (or approved delegate) for this employee.');
  var approvals = approvalsByEmp_()[empId] || [];
  if (!eng_isEligible(approvals, key)) fail_('This employee has no overtime/holiday approval for ' + monthLabel_(key) + '.');

  var rows = attendanceOf_(key, empId);
  var schedule = scheduleMap_(key);
  var days = eng_employeeDays(rows, approvals, { schedule: schedule, lateRule: month.LateRule || 'COUNT' });
  var sub = currentSubmissions_(key)[empId] || null;
  var subDays = sub ? (reviewDaysFor_(key, [sub.SubmissionID])[sub.SubmissionID] || []) : [];
  var prev = {};
  subDays.forEach(function (d) { prev[d.Date] = { hours: d.Hours, task: d.Task, fileUrl: d.FileUrl }; });

  return {
    month: publicMonth_(month),
    canSubmit: month.Status === 'REVIEW' && ctx.role === 'sup',
    employee: { empId: empId, name: emp.Name, designation: emp.Designation, department: emp.Department, workArea: emp.WorkArea,
      workAreaUpdated: emp.WorkAreaUpdated, reviewer: reviewerOf_(emp), supervisorName: emp.SupervisorName },
    yourRole: ctx.role === 'sup' ? reviewRole_(ctx.email, emp) : 'admin',
    approvalText: describeApproval_(eng_approvalFor(approvals, key + '-15') || approvals[0]),
    approval: (function (a) { return a ? { otDaysPerWeek: a.otDaysPerWeek, monthlyOtCapMin: a.monthlyOtCapMin } : null; })(eng_approvalFor(approvals, key + '-15')),
    wordLimit: Number(settings_().taskWordLimit) || 200,
    days: days.map(function (d) {
      var isOff = d.type !== 'WORKDAY';
      return {
        date: d.date, weekday: d.weekday, status: d.status, type: d.type, schIn: d.schIn, schOut: d.schOut, chkIn: d.chkIn, chkOut: d.chkOut,
        worked: eng_fmt(d.workedMin), shift: eng_fmt(d.shiftMin), special: d.special, allowed: d.allowed, reason: d.reason,
        holidayOnWeekend: d.holidayOnWeekend,
        // Most the supervisor can enter for the day (actual hours, not the 8-hour-equivalent)
        maxMin: isOff ? Math.round(Math.min(d.workedMin, d.shiftMin)) : Math.round(d.otMin), // the bill still uses the exact seconds
        capMin: isOff ? d.shiftMin : d.otCapMin,
        previous: prev[d.date] || null
      };
    }),
    submitted: sub ? { by: sub.ReviewerEmail, onBehalfOf: sub.OnBehalfOf, at: sub.SubmittedAt, version: sub.Version } : null
  };
}

function weekKey_(iso) {
  // Weeks run Saturday → Friday (DIU working week)
  var p = iso.split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  var back = (d.getDay() + 1) % 7; // days since Saturday
  d.setDate(d.getDate() - back);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function submitReview_(ctx, p) {
  if (ctx.role !== 'sup') fail_('Please sign in as a supervisor.');
  var key = p.monthKey, empId = String(p.empId || '').trim();
  requireMonthStatus_(key, ['REVIEW']);
  var view = employeeReview_(ctx, { monthKey: key, empId: empId });
  var byDate = {};
  view.days.forEach(function (d) { byDate[d.date] = d; });
  var wordLimit = view.wordLimit;

  var entries = [], errors = [];
  (p.days || []).forEach(function (x) {
    var d = byDate[x.date];
    var min = eng_parseDuration(x.hours);
    if (!d) { errors.push(x.date + ': not in this month\'s attendance'); return; }
    if (!min) return; // unticked / zero
    if (!d.allowed) { errors.push(x.date + ': ' + (d.reason || 'not approved')); return; }
    if (min < 60) { errors.push(x.date + ': minimum is 1:00'); return; }
    if (d.maxMin <= 0) { errors.push(x.date + ': attendance does not support duty on this day (' + (d.reason || 'no punch') + ')'); return; }
    if (min > d.maxMin + 5) { errors.push(x.date + ': ' + eng_fmt(min) + ' is more than the punch data allows (' + eng_fmt(d.maxMin) + ')'); return; }
    var task = String(x.task || '').trim();
    if (d.type !== 'WORKDAY') {
      if (!task) { errors.push(x.date + ': write what the employee worked on (required for weekend/holiday)'); return; }
      if (task.split(/\s+/).length > wordLimit) { errors.push(x.date + ': task description is longer than ' + wordLimit + ' words'); return; }
    }
    entries.push({ date: x.date, type: d.type, min: Math.min(min, d.maxMin), task: task, file: x.fileBase64 ? x : null, keepFileUrl: x.keepFileUrl || '' });
  });
  if (view.approval && view.approval.otDaysPerWeek) {
    var perWeek = {};
    entries.forEach(function (e) { if (e.type === 'WORKDAY') { var k = weekKey_(e.date); perWeek[k] = (perWeek[k] || 0) + 1; } });
    Object.keys(perWeek).forEach(function (k) {
      if (perWeek[k] > view.approval.otDaysPerWeek) errors.push('Week starting ' + k + ': ' + perWeek[k] + ' OT days selected, approval allows ' + view.approval.otDaysPerWeek);
    });
  }
  if (view.approval && view.approval.monthlyOtCapMin) {
    var tot = entries.reduce(function (s, e) { return s + (e.type === 'WORKDAY' ? e.min : 0); }, 0);
    if (tot > view.approval.monthlyOtCapMin) errors.push('Total OT ' + eng_fmt(tot) + ' is more than the monthly limit of ' + eng_fmt(view.approval.monthlyOtCapMin));
  }
  if (errors.length) fail_('Please fix:\n• ' + errors.join('\n• '));
  if (!entries.length) fail_('Select at least one day, or contact HR if this employee had no overtime or holiday duty.');

  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var ss = monthSS_(key);
    var subs = readTable_(ss, 'Submissions').filter(function (s) { return s.EmpID === empId; });
    var current = subs.filter(function (s) { return s.State === 'CURRENT'; })[0];
    var version = subs.reduce(function (m, s) { return Math.max(m, Number(s.Version) || 0); }, 0) + 1;
    var subId = key + '-' + empId + '-v' + version;
    var now = nowIso_();

    // Supporting files → Drive
    var folder = null;
    entries.forEach(function (e) {
      e.fileUrl = e.keepFileUrl;
      if (!e.file) return;
      if (!folder) folder = monthUploadFolder_(key);
      var ext = (String(e.file.fileName || '').match(/\.([0-9a-z]+)$/i) || [, 'pdf'])[1];
      var bytes = Utilities.base64Decode(e.file.fileBase64);
      if (bytes.length > 10 * 1024 * 1024) fail_(e.date + ': file is larger than 10 MB');
      e.fileUrl = folder.createFile(Utilities.newBlob(bytes, e.file.mimeType || 'application/octet-stream', empId + '_' + e.date + '_v' + version + '.' + ext)).getUrl();
    });

    if (current) { current.State = 'REPLACED'; current.ReplacedAt = now; current.ReplacedBy = ctx.email; updateRows_(ss, 'Submissions', [current]); }

    var emp = employeesMap_()[empId];
    var role = reviewRole_(ctx.email, emp);
    var t = { otDays: 0, ot: 0, holDays: 0, hol: 0 };
    entries.forEach(function (e) { if (e.type === 'WORKDAY') { t.otDays++; t.ot += e.min; } else { t.holDays++; t.hol += e.min; } });
    appendRows_(ss, 'Submissions', [{ SubmissionID: subId, EmpID: empId, EmpName: emp.Name, ReviewerEmail: ctx.email,
      OnBehalfOf: role === 'delegate' ? reviewerOf_(emp) : '', SubmittedAt: now, Version: String(version),
      OtDays: String(t.otDays), OtHours: eng_fmt(t.ot), HolDays: String(t.holDays), HolHours: eng_fmt(t.hol), State: 'CURRENT', WorkArea: p.workArea || '' }]);
    appendRows_(ss, 'ReviewDays', entries.map(function (e) {
      return { SubmissionID: subId, EmpID: empId, Date: e.date, DayType: e.type, Hours: eng_fmt(e.min), Task: e.task, FileUrl: e.fileUrl };
    }));

    if (p.workArea !== undefined && String(p.workArea).trim() && String(p.workArea).trim() !== emp.WorkArea) {
      var es = master_();
      var er = readTable_(es, 'Employees').filter(function (r) { return r.EmpID === empId; })[0];
      audit_(ctx.email, 'employee.workArea', key, { empId: empId, from: er.WorkArea, to: String(p.workArea).trim() });
      er.WorkArea = String(p.workArea).trim(); er.WorkAreaUpdated = now; er.WorkAreaUpdatedBy = ctx.email;
      updateRows_(es, 'Employees', [er]);
    }
    audit_(ctx.email, current ? 'review.replace' : 'review.submit', key, { empId: empId, version: version, onBehalfOf: role === 'delegate' ? reviewerOf_(emp) : '', otHours: eng_fmt(t.ot), holHours: eng_fmt(t.hol) });
  } finally { lock.releaseLock(); }

  try { sendSubmissionEmail_(key, emp, ctx.email, role, version, entries, t, current); } catch (e) { Logger.log('confirmation email failed: ' + e); }

  return {
    submissionId: subId, version: version,
    replaced: current ? { by: current.ReviewerEmail, at: current.SubmittedAt, version: current.Version } : null,
    totals: { otDays: t.otDays, otHours: eng_fmt(t.ot), holDays: t.holDays, holHours: eng_fmt(t.hol) }
  };
}

function monthUploadFolder_(key) {
  var parent = DriveApp.getFolderById(prop_('UPLOADS_FOLDER_ID'));
  var name = monthLabel_(key) + ' — supporting files';
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

/**
 * TRIAL helper: brings reviews from the old portal's "Supervisor_Inputs" tab into this month, so the new bill
 * can be compared with the bill made the old way. Each day is limited to what attendance and approvals allow
 * (as a supervisor would be today); the reply says how many days were trimmed or dropped.
 */
function importLegacyReviews_(ctx, p) {
  var key = p.monthKey;
  var month = requireMonthStatus_(key, ['DRAFT', 'REVIEW']);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var ss = monthSS_(key);
    var emps = employeesMap_(), apprs = approvalsByEmp_(), attBy = attendanceByEmp_(key), schedule = scheduleMap_(key);
    var allSubs = readTable_(ss, 'Submissions');
    var stats = { imported: 0, skipped: [], trimmedDays: 0, droppedDays: 0 };
    var newSubs = [], newDays = [], replaced = [];
    var now = nowIso_();
    (p.rows || []).forEach(function (r) {
      var id = String(r.empId || '').trim();
      var e = emps[id];
      if (!e) { stats.skipped.push({ empId: id, why: 'not in employee list' }); return; }
      var list = apprs[id] || [];
      if (!eng_isEligible(list, key)) { stats.skipped.push({ empId: id, why: 'no approval this month' }); return; }
      var days = eng_employeeDays(attBy[id] || [], list, { schedule: schedule, lateRule: month.LateRule || 'COUNT' });
      var byDate = {}; days.forEach(function (d) { byDate[d.date] = d; });
      var entries = [];
      (r.days || []).forEach(function (x) {
        var d = byDate[x.date], min = eng_parseDuration(x.hours);
        if (!min) return;
        var max = !d || !d.allowed ? 0 : (d.type === 'WORKDAY' ? Math.round(d.otMin) : Math.round(Math.min(d.workedMin, d.shiftMin)));
        if (max < 60) { stats.droppedDays++; return; }
        if (min > max + 5) { min = max; stats.trimmedDays++; }
        entries.push({ date: x.date, type: d.type, min: Math.min(min, Math.max(max, 60)), task: x.task || '', fileUrl: x.fileUrl || '' });
      });
      if (!entries.length) { stats.skipped.push({ empId: id, why: 'no day is supported by attendance/approval' }); return; }
      var mine = allSubs.filter(function (s) { return s.EmpID === id; });
      mine.forEach(function (s) { if (s.State === 'CURRENT') { s.State = 'REPLACED'; s.ReplacedAt = now; s.ReplacedBy = ctx.email + ' (import)'; replaced.push(s); } });
      var version = mine.reduce(function (m, s) { return Math.max(m, Number(s.Version) || 0); }, 0) + 1;
      var subId = key + '-' + id + '-v' + version;
      var t = { otDays: 0, ot: 0, holDays: 0, hol: 0 };
      entries.forEach(function (x) { if (x.type === 'WORKDAY') { t.otDays++; t.ot += x.min; } else { t.holDays++; t.hol += x.min; } });
      newSubs.push({ SubmissionID: subId, EmpID: id, EmpName: e.Name, ReviewerEmail: normEmail_(r.reviewerEmail) || 'imported', OnBehalfOf: 'Imported from old portal',
        SubmittedAt: r.submittedAt || now, Version: String(version), OtDays: String(t.otDays), OtHours: eng_fmt(t.ot), HolDays: String(t.holDays), HolHours: eng_fmt(t.hol), State: 'CURRENT' });
      entries.forEach(function (x) { newDays.push({ SubmissionID: subId, EmpID: id, Date: x.date, DayType: x.type, Hours: eng_fmt(x.min), Task: x.task, FileUrl: x.fileUrl }); });
      stats.imported++;
    });
    updateRows_(ss, 'Submissions', replaced);
    appendRows_(ss, 'Submissions', newSubs);
    appendRows_(ss, 'ReviewDays', newDays);
    audit_(ctx.email, 'review.importLegacy', key, { imported: stats.imported, skipped: stats.skipped.length, trimmedDays: stats.trimmedDays, droppedDays: stats.droppedDays });
    return stats;
  } finally { lock.releaseLock(); }
}

// ---- 70_bill.js ----
/* ==================================================
   PROGRESS, BILL CALCULATION, CLOSE MONTH
   ================================================== */

var BILL_HEADERS = ['SL', 'EmpID', 'Name', 'Designation', 'Department', 'Grade', 'GrossSalary',
  'HolDaysAttendance', 'HolHoursAttendance', 'HolidayMultiplier', 'HolDaysSupervisor', 'HolHoursSupervisor', 'HolDaysFinal', 'HolHoursFinal',
  'HolidayRate', 'HolidayBill', 'OtHoursAttendance', 'OtDailyCap', 'OtHoursSupervisor', 'OtHoursFinal', 'OtDaysFinal', 'OtRate', 'OtBill', 'Total',
  'ReviewedBy', 'OnBehalfOf', 'SubmittedAt', 'RateRule', 'Remarks'];

/** Reviewer-by-reviewer progress for the month. */
function progress_(p) {
  var key = p.monthKey;
  var emps = employeesMap_(), apprs = approvalsByEmp_(), subs = currentSubmissions_(key), att = attendanceIdSet_(key);
  var dels = delegatesMap_();
  var groups = {}, noReviewer = [];
  Object.keys(emps).forEach(function (id) {
    if (!eng_isEligible(apprs[id] || [], key)) return;
    var e = emps[id], rev = reviewerOf_(e);
    var item = { empId: id, name: e.Name, department: e.Department, hasAttendance: !!att[id], submitted: !!subs[id],
      submittedBy: subs[id] ? subs[id].ReviewerEmail : '', submittedAt: subs[id] ? subs[id].SubmittedAt : '' };
    if (!rev) { noReviewer.push(item); return; }
    (groups[rev] = groups[rev] || { reviewer: rev, supervisorName: e.SupervisorName, delegates: dels[rev] || [], employees: [] }).employees.push(item);
  });
  var lastMail = {};
  readTable_(master_(), 'EmailLog').forEach(function (l) { if (l.Month === key) lastMail[normEmail_(l.To)] = { type: l.Type, at: l.Timestamp, status: l.Status, error: l.Error }; });
  var list = Object.keys(groups).map(function (k) {
    var g = groups[k];
    g.total = g.employees.length;
    g.done = g.employees.filter(function (x) { return x.submitted; }).length;
    g.lastEmail = lastMail[k] || null;
    return g;
  }).sort(function (a, b) { return (a.total - a.done) < (b.total - b.done) ? 1 : -1; });
  var total = list.reduce(function (s, g) { return s + g.total; }, 0) + noReviewer.length;
  var done = list.reduce(function (s, g) { return s + g.done; }, 0) + noReviewer.filter(function (x) { return x.submitted; }).length;
  return { reviewers: list, noReviewer: noReviewer, total: total, done: done };
}

function supMinutesFromDays_(days) {
  var m = {};
  (days || []).forEach(function (d) { m[d.Date] = eng_parseDuration(d.Hours) || 0; });
  return m;
}

/** Calculates every employee's figures for the month (live, not saved). */
function computeBill_(monthKey) {
  var month = monthRow_(monthKey);
  var emps = employeesMap_(), apprs = approvalsByEmp_();
  var attBy = attendanceByEmp_(monthKey);
  var subs = currentSubmissions_(monthKey);
  var daysBySub = reviewDaysFor_(monthKey, Object.keys(subs).map(function (k) { return subs[k].SubmissionID; }));
  var opts = { schedule: scheduleMap_(monthKey), lateRule: month.LateRule || 'COUNT', mode: month.LowestMode || 'MONTH', rates: ratesRules_(), monthKey: monthKey };

  var ids = {};
  Object.keys(attBy).forEach(function (k) { ids[k] = 1; });
  Object.keys(subs).forEach(function (k) { ids[k] = 1; });
  Object.keys(apprs).forEach(function (k) { if (eng_isEligible(apprs[k], monthKey)) ids[k] = 1; });

  var rows = [], exceptions = [];
  function ex(type, id, name, msg, extra) { exceptions.push(Object.assign({ type: type, empId: id, name: name, message: msg }, extra || {})); }

  Object.keys(ids).sort().forEach(function (id) {
    var e = emps[id] || {};
    var att = attBy[id] || [];
    var name = e.Name || (att[0] && att[0].name) || '';
    var list = apprs[id] || [];
    var eligible = eng_isEligible(list, monthKey);
    var sub = subs[id];
    var reviewer = e.EmpID ? reviewerOf_(e) : '';
    if (!e.EmpID && (eligible || sub)) ex('NOT_IN_EMPLOYEE_LIST', id, name, 'Not in the employee list (upload the latest HRIS employee file).');
    if (!eligible) {
      if (sub) ex('NOT_ELIGIBLE', id, name, 'Reviewed by ' + sub.ReviewerEmail + ' but has no approval for this month — left out of the bill.');
      return;
    }
    if (!reviewer) ex('NO_REVIEWER', id, name, 'No supervisor email — set a reviewer in Employees.');
    if (!att.length) { ex(sub ? 'NO_ATTENDANCE' : 'NO_ATTENDANCE_INFO', id, name, 'No attendance this month' + (sub ? ' but a review was submitted — nothing can be paid.' : '.')); }
    if (!sub) { if (att.length) ex('NOT_REVIEWED', id, name, 'Waiting for review by ' + (reviewer || '(no reviewer)'), { reviewer: reviewer }); return; }

    var emp = { designation: e.Designation, grade: e.Grade, grossSalary: e.GrossSalary, holidayRateOverride: e.HolidayRateOverride, otRateOverride: e.OtRateOverride };
    var b = eng_employeeBill(emp, att, list, supMinutesFromDays_(daysBySub[sub.SubmissionID]), opts);
    var appr = eng_approvalFor(list, monthKey + '-15') || list[0];
    if (!b.rate.holidayRate && !b.rate.otRate) ex('NO_RATE', id, name, 'No rate found (' + b.rate.rule + ').');
    var cutOt = b.supervisor.otMin - b.final.otMin, cutHol = b.supervisor.holMin - b.final.holMin;
    if (cutOt > 1 || cutHol > 1) {
      ex('REDUCED', id, name, 'Supervisor entered more than attendance/approval allows — paid the lower figure' +
        (cutOt > 1 ? ' (OT ' + eng_fmt(b.supervisor.otMin) + ' → ' + eng_fmt(b.final.otMin) + ')' : '') +
        (cutHol > 1 ? ' (holiday ' + eng_fmt(b.supervisor.holMin) + ' → ' + eng_fmt(b.final.holMin) + ')' : ''));
    }
    if (b.monthlyCapMin && b.attendance.otMin >= b.monthlyCapMin) ex('MONTHLY_CAP', id, name, 'Monthly OT limit of ' + eng_fmt(b.monthlyCapMin) + ' applied.');
    var remarks = [];
    if (e.HolidayRateOverride || e.OtRateOverride) remarks.push('Rate override');
    rows.push({
      EmpID: id, Name: name, Designation: e.Designation || '', Department: e.Department || '', Grade: e.Grade || '', GrossSalary: e.GrossSalary || '',
      HolDaysAttendance: b.attendance.holDays, HolHoursAttendance: eng_fmt(b.attendance.holMin), HolidayMultiplier: (Math.round(b.attendance.holFraction * 100) / 100).toFixed(2),
      HolDaysSupervisor: b.supervisor.holDays, HolHoursSupervisor: eng_fmt(b.supervisor.holMin), HolDaysFinal: b.final.holDays, HolHoursFinal: eng_fmt(b.final.holMin),
      HolidayRate: b.rate.holidayRate, HolidayBill: b.holidayBill, OtHoursAttendance: eng_fmt(b.attendance.otMin),
      OtDailyCap: appr ? eng_fmt(appr.dailyOtCapMin) + 'H' : '', OtHoursSupervisor: eng_fmt(b.supervisor.otMin), OtHoursFinal: eng_fmt(b.final.otMin),
      OtDaysFinal: b.final.otDays, OtRate: b.rate.otRate, OtBill: b.otBill, Total: b.total,
      ReviewedBy: sub.ReviewerEmail, OnBehalfOf: sub.OnBehalfOf, SubmittedAt: sub.SubmittedAt, RateRule: b.rate.rule, Remarks: remarks.join('; ')
    });
  });
  rows.sort(function (a, b) { return a.EmpID < b.EmpID ? -1 : 1; });
  rows.forEach(function (r, i) { r.SL = i + 1; });
  var totals = rows.reduce(function (t, r) { t.holiday += r.HolidayBill; t.ot += r.OtBill; t.total += r.Total; return t; }, { holiday: 0, ot: 0, total: 0, employees: rows.length });
  totals.inWords = takaInWords_(totals.total);
  return { rows: rows, exceptions: exceptions, totals: totals };
}

function getBill_(p) {
  var month = monthRow_(p.monthKey);
  var res;
  if (month.Status === 'CLOSED' || month.Status === 'DISBURSED') {
    var ss = monthSS_(p.monthKey);
    var saved = ss.getSheetByName('Bill') ? readTable_(ss, 'Bill') : [];
    var rows = saved.map(function (r) {
      var o = {}; BILL_HEADERS.forEach(function (h) { o[h] = r[h]; });
      ['SL', 'HolDaysAttendance', 'HolDaysSupervisor', 'HolDaysFinal', 'HolidayRate', 'HolidayBill', 'OtDaysFinal', 'OtRate', 'OtBill', 'Total'].forEach(function (h) { o[h] = Number(o[h]) || 0; });
      return o;
    });
    var totals = rows.reduce(function (t, r) { t.holiday += r.HolidayBill; t.ot += r.OtBill; t.total += r.Total; return t; }, { holiday: 0, ot: 0, total: 0, employees: rows.length });
    totals.inWords = takaInWords_(totals.total);
    var exc = ss.getSheetByName('Bill Notes') ? readTable_(ss, 'Bill Notes').map(function (x) {
      return { type: x.Type, empId: x.EmpID, name: x.Name, message: x.Message, reviewer: x.Reviewer };
    }) : [];
    res = { rows: rows, exceptions: exc, totals: totals, frozen: true };
  } else {
    res = computeBill_(p.monthKey);
    res.frozen = false;
  }
  res.month = publicMonth_(month);
  res.signatories = getSignatories_();
  res.org = { name: settings_().orgName, address: settings_().orgAddress };
  return res;
}

/** Freeze the figures: writes the Bill tab into the month file and stops further supervisor changes. */
function closeMonth_(ctx, p) {
  requireMonthStatus_(p.monthKey, ['REVIEW']);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var res = computeBill_(p.monthKey);
    var ss = monthSS_(p.monthKey);
    var old = ss.getSheetByName('Bill'); if (old) ss.deleteSheet(old);
    var acc = ss.getSheetByName('Accounts Bill'); if (acc) ss.deleteSheet(acc);
    var notes = ss.getSheetByName('Bill Notes'); if (notes) ss.deleteSheet(notes);
    ensureSheet_(ss, 'Bill', BILL_HEADERS);
    writeTable_(ss, 'Bill', res.rows);
    writeAccountsSheet_(ss, p.monthKey, res);
    ensureSheet_(ss, 'Bill Notes', ['Type', 'EmpID', 'Name', 'Message', 'Reviewer']);
    writeTable_(ss, 'Bill Notes', res.exceptions.map(function (x) { return { Type: x.type, EmpID: x.empId, Name: x.name, Message: x.message, Reviewer: x.reviewer || '' }; }));
    var row = monthRow_(p.monthKey);
    row.Status = 'CLOSED'; row.ClosedAt = nowIso_();
    updateRows_(master_(), 'Months', [row]);
    audit_(ctx.email, 'month.close', p.monthKey, { employees: res.totals.employees, total: res.totals.total });
    return { month: publicMonth_(row), totals: res.totals };
  } finally { lock.releaseLock(); }
}

/** A print-ready "Accounts Bill" tab, same layout as the old Print Sheet (2). */
function writeAccountsSheet_(ss, monthKey, res) {
  var sh = ss.insertSheet('Accounts Bill');
  var s = settings_();
  var last = daysInMonth_(monthKey);
  var title = [[s.orgName], [s.orgAddress], ['Monthly Holiday and Overtime Bill For the Month of ' + monthLabel_(monthKey)],
    ['(From 01 ' + monthLabel_(monthKey) + ' to ' + last + ' ' + monthLabel_(monthKey) + ')'], ['Date: ' + todayIso_()]];
  var cols = ['SL', 'ID No', 'Name', 'Designation', 'Department', 'Holiday Days (Final)', 'Holiday Duty Hours (Final)', 'Holiday rate (BDT)',
    'Holiday Bill Amount (BDT)', 'OT Hours (Final)', 'OT Rate per hrs (BDT)', 'OT Bill Amount (BDT)', 'Total Amount (BDT)', 'Remarks'];
  sh.getRange(1, 1, title.length, 1).setValues(title);
  sh.getRange(7, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setWrap(true);
  var body = res.rows.map(function (r) {
    return [r.SL, r.EmpID, r.Name, r.Designation, r.Department, r.HolDaysFinal, r.HolHoursFinal, r.HolidayRate, r.HolidayBill, r.OtHoursFinal, r.OtRate, r.OtBill, r.Total, r.Remarks];
  });
  if (body.length) sh.getRange(8, 1, body.length, cols.length).setValues(body);
  var end = 8 + body.length;
  sh.getRange(end, 8, 1, 6).setValues([['Total =', res.totals.holiday, '', '', res.totals.ot, res.totals.total]]).setFontWeight('bold');
  sh.getRange(end + 1, 1).setValue('In Words: ' + res.totals.inWords);
  var sig = getSignatories_();
  if (sig.length) {
    sh.getRange(end + 5, 1, 1, sig.length).setValues([sig.map(function (x) { return x.name; })]).setFontWeight('bold');
    sh.getRange(end + 6, 1, 1, sig.length).setValues([sig.map(function (x) { return x.title; })]);
  }
  sh.setFrozenRows(7);
}

/* ---------- Taka in words (Bangladeshi lakh/crore system) ---------- */

function takaInWords_(n) {
  n = Math.round(Number(n) || 0);
  if (n === 0) return 'Zero Taka only.';
  var ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function two(x) { return x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : ''); }
  function three(x) { var h = Math.floor(x / 100), r = x % 100; return (h ? ones[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? two(r) : ''); }
  var parts = [];
  var crore = Math.floor(n / 10000000); n %= 10000000;
  var lakh = Math.floor(n / 100000); n %= 100000;
  var thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push((crore > 999 ? takaInWords_(crore).replace(/ Taka only\.$/, '') : three(crore)) + ' Crore');
  if (lakh) parts.push(two(lakh) + ' Lakh');
  if (thousand) parts.push(two(thousand) + ' Thousand');
  if (n) parts.push(three(n));
  return parts.join(' ') + ' Taka only.';
}

// ---- 80_mail.js ----
/* ==================================================
   EMAILS: personal invitations, reminders, confirmations,
   bounce check, automatic reminders
   ================================================== */

/**
 * Sends an email. While the "testEmailRedirect" setting has an address, every invitation, reminder and
 * confirmation goes to that address instead (subject shows who it was meant for), so a trial never emails real supervisors.
 */
function sendMail_(o) {
  var redirect = normEmail_(settings_().testEmailRedirect);
  if (redirect) {
    o = Object.assign({}, o, { subject: '[TEST — for ' + o.to + (o.cc ? ', cc ' + o.cc : '') + '] ' + o.subject, to: redirect, cc: '' });
  }
  MailApp.sendEmail(o);
}

function esc_(s) { return String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function bnDate_(iso) {
  if (!iso) return '';
  var p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

/** Who would get an invitation or reminder, and with which employees. */
function mailPlan_(p) {
  var prog = progress_({ monthKey: p.monthKey });
  var only = (p.onlyTo || []).map(normEmail_);
  var list = prog.reviewers.map(function (g) {
    var emps = g.employees.filter(function (e) { return e.hasAttendance && (p.type !== 'reminder' || !e.submitted); });
    return { to: g.reviewer, cc: g.delegates, supervisorName: g.supervisorName, employees: emps, total: g.total, done: g.done, lastEmail: g.lastEmail };
  }).filter(function (r) { return r.employees.length && (!only.length || only.indexOf(r.to) !== -1); });
  return { type: p.type, recipients: list, noReviewer: prog.noReviewer, quota: MailApp.getRemainingDailyQuota() };
}

function mailPreview_(ctx, p) {
  var plan = mailPlan_(p);
  var sample = plan.recipients[0];
  plan.sampleHtml = sample ? reviewEmailHtml_(p.monthKey, p.type, sample) : '';
  return plan;
}

function mailSend_(ctx, p) {
  requireMonthStatus_(p.monthKey, ['REVIEW']);
  var plan = mailPlan_(p);
  var needed = plan.recipients.reduce(function (s, r) { return s + 1 + r.cc.length; }, 0);
  if (needed > plan.quota) fail_('Google allows ' + plan.quota + ' more emails today; this needs ' + needed + '. Send to fewer people or try tomorrow.');
  var sent = 0, failed = [];
  var logs = [];
  var subject = (p.type === 'reminder' ? 'Reminder: ' : '') + 'HOLIDAY AND OVERTIME DUTY REVIEW, ' + monthLabel_(p.monthKey).toUpperCase();
  plan.recipients.forEach(function (r) {
    try {
      sendMail_({ to: r.to, cc: r.cc.join(','), subject: subject, htmlBody: reviewEmailHtml_(p.monthKey, p.type, r), name: 'DIU HR — Overtime Review' });
      sent++;
      logs.push({ Timestamp: nowIso_(), Month: p.monthKey, To: r.to, Cc: r.cc.join(', '), Type: p.type, Subject: subject, Status: 'SENT', Error: '' });
    } catch (e) {
      failed.push({ to: r.to, error: String(e.message || e) });
      logs.push({ Timestamp: nowIso_(), Month: p.monthKey, To: r.to, Cc: r.cc.join(', '), Type: p.type, Subject: subject, Status: 'FAILED', Error: String(e.message || e) });
    }
  });
  appendRows_(master_(), 'EmailLog', logs);
  audit_(ctx.email || 'system', 'mail.' + p.type, p.monthKey, { sent: sent, failed: failed.length });
  return { sent: sent, failed: failed };
}

function reviewEmailHtml_(monthKey, type, r) {
  var s = settings_();
  var row = monthRow_(monthKey);
  var url = (s.portalUrl || '') + (s.portalUrl && s.portalUrl.indexOf('?') === -1 ? '?' : '&') + 'month=' + monthKey;
  var label = monthLabel_(monthKey);
  var lastDay = monthKey + '-' + ('0' + daysInMonth_(monthKey)).slice(-2);
  var rowsHtml = r.employees.map(function (e, i) {
    return '<tr><td style="border:1px solid #ddd;padding:6px">' + (i + 1) + '</td><td style="border:1px solid #ddd;padding:6px">' + esc_(e.empId) +
      '</td><td style="border:1px solid #ddd;padding:6px">' + esc_(e.name) + '</td><td style="border:1px solid #ddd;padding:6px">' + esc_(e.department) +
      '</td><td style="border:1px solid #ddd;padding:6px">' + (e.submitted ? '✅ জমা হয়েছে' : '⏳ বাকি') + '</td></tr>';
  }).join('');
  var intro = type === 'reminder'
    ? '<p>এটি একটি স্মরণবার্তা। নিচের কর্মীদের <b>' + label + '</b> মাসের ডিউটি রিভিউ এখনও জমা হয়নি। অনুগ্রহ করে ' + (row.Deadline ? '<b>' + bnDate_(row.Deadline) + '</b> তারিখের' : 'নির্ধারিত সময়ের') + ' মধ্যে রিভিউ সম্পন্ন করুন।</p>'
    : '<p>আপনার অধীনস্থ কর্মীদের <b>' + label + '</b> মাসের (' + bnDate_(monthKey + '-01') + ' থেকে ' + bnDate_(lastDay) + ' পর্যন্ত) হলিডে এবং ওভারটাইম বিল সঠিক সময়ে এবং নির্ভুলভাবে প্রদানের লক্ষ্যে তাদের ডিউটি (অ্যাটেনডেন্স) রিভিউ করার জন্য বিনীত অনুরোধ করা হচ্ছে।</p>';
  var delegateNote = r.cc.length ? '<p style="font-size:13px;color:#555">অনুমোদিত প্রতিনিধি (' + esc_(r.cc.join(', ')) + ') আপনার পক্ষে রিভিউ জমা দিতে পারবেন; জমা দেওয়ার পর আপনি একটি কপি পাবেন।</p>' : '';
  return '<div style="font-family:Arial,\'Noto Sans Bengali\',sans-serif;max-width:680px;margin:auto;color:#222">' +
    '<h2 style="color:#006a4e;text-align:center">HOLIDAY AND OVERTIME DUTY REVIEW, ' + esc_(label.toUpperCase()) + '</h2>' +
    '<p>শ্রদ্ধেয় স্যার,<br>আসসালামু আলাইকুম।</p>' + intro +
    '<p style="text-align:center;margin:24px 0"><a href="' + esc_(url) + '" style="background:#006a4e;color:#fff;padding:14px 26px;border-radius:8px;text-decoration:none;font-weight:bold">অ্যাটেনডেন্স রিভিউ পোর্টাল ওপেন করুন</a></p>' +
    '<p>আপনার দায়িত্বে থাকা কর্মী (' + r.employees.length + ' জন):</p>' +
    '<table style="border-collapse:collapse;width:100%;font-size:13px"><tr style="background:#e6f4ea"><th style="border:1px solid #ddd;padding:6px">#</th><th style="border:1px solid #ddd;padding:6px">ID</th><th style="border:1px solid #ddd;padding:6px">নাম</th><th style="border:1px solid #ddd;padding:6px">বিভাগ</th><th style="border:1px solid #ddd;padding:6px">অবস্থা</th></tr>' + rowsHtml + '</table>' +
    delegateNote +
    (row.Deadline ? '<p><b>অনলাইনে রিভিউ সাবমিট এবং প্রিন্ট কপি এইচআর অফিসে জমা দেওয়ার শেষ তারিখ: ' + bnDate_(row.Deadline) + '</b></p>' : '') +
    '<p><b>বিল প্রদানের অত্যাবশ্যকীয় শর্তাবলী:</b></p><ul>' +
    '<li>সিস্টেমে অবশ্যই অ্যাটেনডেন্স (পাঞ্চ) তথ্য থাকতে হবে।</li>' +
    '<li>সুপারভাইজার (বা অনুমোদিত প্রতিনিধি) কর্তৃক অনলাইনে রিভিউ সম্পন্ন হতে হবে।</li>' +
    '<li>Weekend এবং Holiday ডিউটির ক্ষেত্রে নির্দিষ্ট তারিখে কর্মী কী কাজ করেছে তা লিখতে হবে।</li>' +
    '<li>কর্মী এবং সুপারভাইজারের স্বাক্ষরযুক্ত প্রিন্টেড কপি এইচআর অফিসে জমা দিতে হবে।</li></ul>' +
    (s.tutorialUrl ? '<p><a href="' + esc_(s.tutorialUrl) + '">▶ টিউটোরিয়াল ভিডিও দেখুন</a></p>' : '') +
    '<p style="font-size:13px;color:#555">কোনো যোগ্য কর্মীর অ্যাটেনডেন্স পোর্টালে পাওয়া না গেলে, বা তালিকায় নাম না থাকলেও অনুমোদন থাকলে যোগাযোগ করুন: ' +
    esc_(s.contactName) + ', ' + esc_(s.contactTitle) + ' — ফোন ' + esc_(s.contactPhone) + (s.contactExt ? ', এক্সটেনশন ' + esc_(s.contactExt) : '') + '</p>' +
    '<p>Kind regards,<br>HR Office, ' + esc_(s.orgName) + '</p></div>';
}

function sendSubmissionEmail_(monthKey, emp, by, role, version, entries, t, replaced) {
  var cc = role === 'delegate' ? reviewerOf_(emp) : '';
  var rows = entries.map(function (e) {
    return '<tr><td style="border:1px solid #ddd;padding:5px">' + e.date + '</td><td style="border:1px solid #ddd;padding:5px">' + (e.type === 'WORKDAY' ? 'Overtime' : e.type === 'WEEKEND' ? 'Weekend' : 'Holiday') +
      '</td><td style="border:1px solid #ddd;padding:5px">' + eng_fmt(e.min) + '</td><td style="border:1px solid #ddd;padding:5px">' + esc_(e.task) + '</td></tr>';
  }).join('');
  sendMail_({
    to: by, cc: cc,
    subject: 'Review recorded: ' + emp.Name + ' (' + emp.EmpID + '), ' + monthLabel_(monthKey) + (version > 1 ? ' — updated (version ' + version + ')' : ''),
    name: 'DIU HR — Overtime Review',
    htmlBody: '<div style="font-family:Arial,sans-serif;max-width:640px;color:#222">' +
      '<p>Your review for <b>' + esc_(emp.Name) + '</b> (' + esc_(emp.EmpID) + ', ' + esc_(emp.Designation) + ') for <b>' + monthLabel_(monthKey) + '</b> has been recorded.</p>' +
      (role === 'delegate' ? '<p>Submitted by <b>' + esc_(by) + '</b> on behalf of <b>' + esc_(cc) + '</b>.</p>' : '') +
      (replaced ? '<p style="color:#b45309">This replaces the earlier review submitted by ' + esc_(replaced.ReviewerEmail) + ' on ' + esc_(replaced.SubmittedAt.replace('T', ' ')) + '. The earlier version is kept in the history.</p>' : '') +
      '<p>Overtime: <b>' + t.otDays + '</b> days, <b>' + eng_fmt(t.ot) + '</b> hours · Weekend/Holiday: <b>' + t.holDays + '</b> days, <b>' + eng_fmt(t.hol) + '</b> hours</p>' +
      '<table style="border-collapse:collapse;font-size:13px;width:100%"><tr style="background:#e6f4ea"><th style="border:1px solid #ddd;padding:5px">Date</th><th style="border:1px solid #ddd;padding:5px">Type</th><th style="border:1px solid #ddd;padding:5px">Hours</th><th style="border:1px solid #ddd;padding:5px">Task</th></tr>' + rows + '</table>' +
      '<p style="font-size:13px;color:#555">Please print the report from the portal, sign it with the employee, and send the signed copy to the HR office.</p></div>'
  });
  appendRows_(master_(), 'EmailLog', [{ Timestamp: nowIso_(), Month: monthKey, To: by, Cc: cc, Type: 'confirmation', Subject: 'Review recorded ' + emp.EmpID, Status: 'SENT', Error: '' }]);
}

/** Looks for "address not found" replies in the owner's mailbox (last 14 days). */
function checkBounces_(ctx) {
  var threads = GmailApp.search('from:mailer-daemon newer_than:14d', 0, 100);
  var found = {};
  threads.forEach(function (th) {
    th.getMessages().forEach(function (m) {
      var body = m.getPlainBody() || '';
      var re = /Final-Recipient:\s*rfc822;\s*([^\s]+)/gi, x;
      while ((x = re.exec(body))) found[normEmail_(x[1])] = Utilities.formatDate(m.getDate(), TZ, 'yyyy-MM-dd HH:mm');
      var re2 = /delivered to\s+([^\s]+@[^\s]+?)\s+because/gi;
      while ((x = re2.exec(body))) found[normEmail_(x[1])] = found[normEmail_(x[1])] || Utilities.formatDate(m.getDate(), TZ, 'yyyy-MM-dd HH:mm');
    });
  });
  var ss = master_();
  var logs = readTable_(ss, 'EmailLog');
  var upd = logs.filter(function (l) { return found[normEmail_(l.To)] && l.Status === 'SENT'; });
  upd.forEach(function (l) { l.Status = 'BOUNCED'; l.Error = 'Address not found (' + found[normEmail_(l.To)] + ')'; });
  updateRows_(ss, 'EmailLog', upd);
  var emps = employeesMap_();
  var affected = Object.keys(found).map(function (addr) {
    var n = Object.keys(emps).filter(function (k) { return reviewerOf_(emps[k]) === addr; }).length;
    return { email: addr, at: found[addr], employees: n };
  });
  return { bounced: affected };
}

/** Called by DAILY_JOBS: sends reminders N days before each open month's deadline. */
function autoReminders_() {
  var daysList = String(settings_().autoReminderDays || '').split(',').map(function (x) { return Number(x.trim()); }).filter(function (x) { return x > 0; });
  if (!daysList.length) return;
  var today = todayIso_();
  readTable_(master_(), 'Months').forEach(function (m) {
    if (m.Status !== 'REVIEW' || !m.Deadline) return;
    var left = Math.round((new Date(m.Deadline + 'T00:00:00+06:00').getTime() - new Date(today + 'T00:00:00+06:00').getTime()) / 86400000);
    if (daysList.indexOf(left) === -1) return;
    var already = readTable_(master_(), 'EmailLog').some(function (l) { return l.Month === m.MonthKey && l.Type === 'reminder' && l.Timestamp.slice(0, 10) === today; });
    if (already) return;
    mailSend_({ email: 'automatic reminder' }, { monthKey: m.MonthKey, type: 'reminder' });
  });
}

// ---- 90_api.js ----
/* ==================================================
   WEB API — the portal sends POST {action, token, ...}
   (as text/plain so browsers skip the CORS pre-check)
   ================================================== */

function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function doGet(e) {
  var ready = !!prop_('MASTER_ID');
  return json_({ ok: true, data: { app: 'DIU Overtime (trial)', version: APP_VERSION, ready: ready } });
}

/** action → [handler, permission area or 'sup' or 'public', level] */
var ROUTES_ = {
  'auth.sendOtp': [function (c, p) { return sendOtp_(p); }, 'public'],
  'auth.verify': [function (c, p) { return verifyOtp_(p); }, 'public'],
  'public.info': [function () { var s = settings_(); return { orgName: s.orgName, tutorialUrl: s.tutorialUrl, contactName: s.contactName, contactTitle: s.contactTitle, contactPhone: s.contactPhone, contactExt: s.contactExt, version: APP_VERSION }; }, 'public'],

  'sup.months': [function () { return supMonths_(); }, 'sup'],
  'sup.team': [teamFor_, 'sup'],
  'sup.employee': [employeeReview_, 'sup'],
  'sup.submit': [submitReview_, 'sup'],

  'admin.me': [function (c) { return { email: c.email, perms: c.perms, owner: c.owner, version: APP_VERSION }; }, 'any-admin'],
  'months.list': [function () { return listMonths_(); }, 'months', 'view'],
  'months.create': [createMonth_, 'months', 'edit'],
  'months.update': [updateMonth_, 'months', 'edit'],
  'months.setStatus': [setMonthStatus_, 'months', 'edit'],
  'schedule.get': [function (c, p) { return getSchedule_(p); }, 'months', 'view'],
  'schedule.save': [saveSchedule_, 'months', 'edit'],
  'attendance.import': [importAttendance_, 'months', 'edit'],
  'attendance.addEmployee': [addEmployeeAttendance_, 'months', 'edit'],
  'attendance.summary': [function (c, p) { return attendanceSummary_(p); }, 'months', 'view'],
  'attendance.employee': [function (c, p) { return employeeAttendanceAdmin_(p); }, 'months', 'view'],
  'review.view': [employeeReview_, 'months', 'view'],
  'review.importLegacy': [importLegacyReviews_, 'months', 'edit'],

  'employees.list': [function () { return listEmployees_(); }, 'employees', 'view'],
  'employees.importHris': [importHrisEmployees_, 'employees', 'edit'],
  'employees.importGrades': [importGrades_, 'employees', 'edit'],
  'employees.update': [updateEmployee_, 'employees', 'edit'],
  'delegates.list': [function () { return listDelegates_(); }, 'employees', 'view'],
  'delegates.save': [saveDelegate_, 'employees', 'edit'],

  'approvals.list': [function (c, p) { return listApprovals_(p); }, 'approvals', 'view'],
  'approvals.save': [saveApproval_, 'approvals', 'edit'],
  'approvals.import': [importApprovals_, 'approvals', 'edit'],
  'maintenance.import': [importMaintenance_, 'approvals', 'edit'],

  'progress.get': [function (c, p) { return progress_(p); }, 'mail', 'view'],
  'mail.preview': [mailPreview_, 'mail', 'view'],
  'mail.send': [mailSend_, 'mail', 'edit'],
  'mail.bounces': [checkBounces_, 'mail', 'view'],

  'bill.get': [function (c, p) { return getBill_(p); }, 'bill', 'view'],
  'bill.close': [closeMonth_, 'bill', 'edit'],
  'bill.disburse': [disburseMonth_, 'bill', 'edit'],

  'rates.get': [function () { return getRates_(); }, 'settings', 'view'],
  'rates.save': [saveRates_, 'settings', 'edit'],
  'signatories.get': [function () { return getSignatories_(); }, 'settings', 'view'],
  'signatories.save': [saveSignatories_, 'settings', 'edit'],
  'settings.get': [function () { return getSettings_(); }, 'settings', 'view'],
  'settings.save': [saveSettings_, 'settings', 'edit'],

  'access.list': [function () { return listAccess_(); }, 'access', 'view'],
  'access.save': [saveAccess_, 'access', 'edit'],
  'audit.list': [function (c, p) { return listAudit_(p); }, 'audit', 'view']
};

function doPost(e) {
  var started = Date.now();
  var p = {};
  try {
    p = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var route = ROUTES_[p.action];
    if (!route) fail_('Unknown action: ' + p.action);
    var ctx = route[1] === 'public' ? { role: 'guest' } : context_(p.token);
    if (route[1] === 'sup') {
      if (ctx.role !== 'sup' && !(ctx.role === 'admin' && p.action === 'sup.employee')) return json_({ ok: false, error: 'Your sign-in has expired. Please sign in again.', code: 'AUTH' });
    } else if (route[1] === 'any-admin') {
      if (ctx.role !== 'admin') return json_({ ok: false, error: 'Please sign in to the admin panel.', code: 'AUTH' });
    } else if (route[1] !== 'public') {
      if (ctx.role !== 'admin') return json_({ ok: false, error: 'Please sign in to the admin panel.', code: 'AUTH' });
      requirePerm_(ctx, route[1], route[2]);
    }
    var data = route[0](ctx, p);
    return json_({ ok: true, data: data, ms: Date.now() - started });
  } catch (err) {
    var msg = err && err.userFacing ? err.message : 'Something went wrong: ' + (err && err.message ? err.message : err);
    if (!(err && err.userFacing)) Logger.log((p.action || '') + ' failed: ' + (err && err.stack ? err.stack : err));
    return json_({ ok: false, error: msg });
  }
}
