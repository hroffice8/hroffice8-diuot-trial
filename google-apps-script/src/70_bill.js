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
