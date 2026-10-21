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
