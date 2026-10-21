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
