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
