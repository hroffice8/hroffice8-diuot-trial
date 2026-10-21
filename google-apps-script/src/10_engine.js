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

if (typeof module !== 'undefined') {
  module.exports = {
    eng_parseClock: eng_parseClock, eng_parseDuration: eng_parseDuration, eng_fmt: eng_fmt, eng_dayType: eng_dayType,
    eng_worked: eng_worked, eng_approvalFor: eng_approvalFor, eng_isEligible: eng_isEligible,
    eng_employeeDays: eng_employeeDays, eng_supervisorCredit: eng_supervisorCredit, eng_rate: eng_rate,
    eng_employeeBill: eng_employeeBill, WEEKDAYS: WEEKDAYS
  };
}
