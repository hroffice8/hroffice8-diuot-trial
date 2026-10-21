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
