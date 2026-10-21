// One-time conversion of the old approval sheets into structured approval records.
// Input rows are the raw sheet rows (arrays) from "Employee-Wise Approval Type".
import { capToMinutes, applyRemark, mapDutyCategory } from '../src/lib/approvalText.js';

const SPECIAL_4H = { '710001397': { dailyOtCapMin: 240, monthlyOtCapMin: 90 * 60, note: '4H per day, 90H per month (special approval)' } };

export function convertLegacyApprovals(sheetRows, maintRemarkById, maintHoursById, monthKey) {
  const hdr = sheetRows[0].map(h => String(h || '').trim().toLowerCase());
  const col = name => hdr.findIndex(h => h.startsWith(name));
  const cId = col('id no'), cMaxOt = col('max ot'), cMaxHol = col('max holiday'), cRem = col('remarks'), cType = col('employee type');
  const approvals = [], flags = [];
  const seen = new Set();
  for (const r of sheetRows.slice(1)) {
    const id = String(r[cId] || '').trim();
    if (!/^\d{6,}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const cap = capToMinutes(r[cMaxOt]);
    const a = {
      empId: id, validFrom: '', validTo: '', dailyOtCapMin: cap === null ? 120 : cap, monthlyOtCapMin: 0,
      otWeekdays: [], otDaysPerWeek: 0, weekendDuty: true, holidayDuty: true,
      holidayMaxMin: capToMinutes(r[cMaxHol]) || 480, securityBonus: false,
      source: 'HR', month: '', reference: 'Imported from Employee-Wise Approval Type', notes: '', active: true,
    };
    if (cap === null) flags.push({ empId: id, msg: 'Max OT Hours blank — set to 2H, please confirm' });
    if (!String(r[cMaxHol] || '').trim()) flags.push({ empId: id, msg: 'Max Holiday Duty Hours blank — weekend/holiday kept allowed (as the old formulas did), please confirm' });
    for (const k of [cRem, cRem + 1]) {
      const rem = String(r[k] || '').trim();
      if (!rem || rem === '#N/A') continue;
      if (/need approval|pending|updated salary/i.test(rem)) { flags.push({ empId: id, msg: `Note in sheet: "${rem}"` }); continue; }
      if (/hall/i.test(rem) && rem.length < 6) { a.notes = 'Hall'; continue; }
      if (/june|july|jan|feb|mar|apr|may|aug|sep|oct|nov|dec/i.test(rem) && /\d/.test(rem)) {
        a.notes = [a.notes, `Seasonal: ${rem}`].filter(Boolean).join('; ');
        flags.push({ empId: id, msg: `Seasonal approval "${rem}" — kept current cap all year; add a dated approval if it should only apply in season` });
        continue;
      }
      const f = applyRemark(a, rem);
      if (f) flags.push({ empId: id, msg: f });
    }
    if (/security/i.test(String(r[4] || ''))) { a.securityBonus = true; }
    if (SPECIAL_4H[id]) { Object.assign(a, { dailyOtCapMin: SPECIAL_4H[id].dailyOtCapMin, monthlyOtCapMin: SPECIAL_4H[id].monthlyOtCapMin }); a.notes = [a.notes, SPECIAL_4H[id].note].filter(Boolean).join('; '); }
    a.employeeType = String(r[cType] || '').trim();
    approvals.push(a);

    // Monthly Maintenance approval overrides the base for that month
    const mRem = maintRemarkById[id];
    if (mRem && monthKey) {
      const cat = mapDutyCategory(mRem);
      const m = { ...a, source: 'Maintenance', month: monthKey, validFrom: `${monthKey}-01`, validTo: `${monthKey}-31`, reference: `Maintenance list ${monthKey}`, notes: mRem };
      if (cat) { if (!cat.otAllowed) m.dailyOtCapMin = 0; m.weekendDuty = cat.weekendDuty; m.holidayDuty = cat.holidayDuty; }
      else flags.push({ empId: id, msg: `Maintenance remark "${mRem}" not recognised` });
      const h = capToMinutes(maintHoursById[id]);
      if (h && cat && cat.otAllowed) m.dailyOtCapMin = h;
      approvals.push(m);
    }
  }
  return { approvals, flags };
}
