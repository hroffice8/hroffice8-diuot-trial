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
