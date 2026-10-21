// Turns the free-text approval wording used in the old spreadsheets
// ("Evening & Only Friday", "3 Hours", "Saturday, Wednesday, Thursday" ...)
// into structured approval fields. Used by the Maintenance upload and the
// one-time import of the old "Employee-Wise Approval Type" sheet.

export const WEEKDAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/** "3H", "3 Hours", "1:30H", "2", "0" → minutes (null when blank/unknown). */
export function capToMinutes(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toUpperCase().replace(/\s*(HOURS?|HRS?|H)$/, '');
  if (!s) return null;
  let m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60);
  return null;
}

/**
 * Duty category wording → { otAllowed, weekendDuty, holidayDuty } or null if not recognised.
 * "Evening" = workday overtime after office hours. "Friday"/"weekend" = weekend duty. "All off day" = weekend + holiday.
 */
export function mapDutyCategory(text) {
  const t = String(text || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!t) return null;
  const table = {
    'EVENING & ALL OFF DAY': [true, true, true],
    'EVENING & OFF DAY': [true, true, true],
    'EVENING & ONLY FRIDAY': [true, true, false],
    'EVENING & FRIDAY': [true, true, false],
    'EVENING & WEEKEND': [true, true, false],
    'ONLY EVENING': [true, false, false],
    'ONLY OT': [true, false, false],
    'EVENING': [true, false, false],
    'ONLY FRIDAY': [false, true, false],
    'ONLY WEEKEND': [false, true, false],
    'ALL OFF DAY': [false, true, true],
    'ONLY HOLIDAY': [false, true, true],
    'WILL GET HOLIDAY ONLY': [false, true, true],
  };
  const v = table[t];
  return v ? { otAllowed: v[0], weekendDuty: v[1], holidayDuty: v[2] } : null;
}

function findWeekday(p) {
  const k = p.trim().toLowerCase().slice(0, 3);
  if (k.length < 3) return null;
  return WEEKDAYS.find(w => w.toLowerCase().startsWith(k)) || null;
}

/**
 * "Saturday, Wednesday, Thursday" → ['Saturday','Wednesday','Thursday'];
 * "Sat-Tue" / "Saturday to Tuesday" → ['Saturday','Sunday','Monday','Tuesday']. Null if not a weekday list.
 */
export function parseWeekdayList(text) {
  const parts = String(text || '').split(/[,&/]| and /i).map(p => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const out = [];
  for (const p of parts) {
    const range = p.split(/\s*(?:-|–|\bto\b)\s*/i).filter(Boolean);
    if (range.length === 2) {
      const a = findWeekday(range[0]), b = findWeekday(range[1]);
      if (!a || !b) return null;
      let i = WEEKDAYS.indexOf(a);
      for (let n = 0; n < 7; n++) { out.push(WEEKDAYS[i]); if (WEEKDAYS[i] === b) break; i = (i + 1) % 7; }
      continue;
    }
    const d = findWeekday(p);
    if (!d || p.trim().split(/\s+/).length > 1) return null;
    out.push(d);
  }
  return [...new Set(out)];
}

/** Apply a free-text remark to an approval draft. Returns a flag message when a human should check it. */
export function applyRemark(appr, remark) {
  const r = String(remark || '').trim();
  if (!r) return null;
  const cat = mapDutyCategory(r);
  if (cat) {
    if (!cat.otAllowed) appr.dailyOtCapMin = 0;
    appr.weekendDuty = cat.weekendDuty;
    appr.holidayDuty = cat.holidayDuty;
    return /HOLIDAY/i.test(r) ? `"${r}" read as: no workday OT, weekend + holiday duty allowed — please confirm` : null;
  }
  const cap = /^\d+(:\d{2})?\s*H(ours?)?$/i.test(r) ? capToMinutes(r) : null;
  if (cap !== null) { appr.dailyOtCapMin = cap; return null; }
  const days = parseWeekdayList(r);
  if (days) { appr.otWeekdays = days; return null; }
  const perWeek = r.match(/(\d)\s*days?.*(alternat|week)|alternat.*?(\d)\s*days?/i);
  if (/alternat/i.test(r)) {
    appr.otDaysPerWeek = Number((perWeek && (perWeek[1] || perWeek[3])) || 3);
    return `"${r}" read as: OT on at most ${appr.otDaysPerWeek} days per week — please confirm`;
  }
  appr.notes = [appr.notes, r].filter(Boolean).join('; ');
  return `"${r}" could not be read automatically — kept as a note, please set the fields by hand`;
}
