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
