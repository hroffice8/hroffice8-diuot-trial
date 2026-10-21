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
