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
