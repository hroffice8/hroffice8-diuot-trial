/** "2:30", "2.5", "230", "2" → minutes (null when not understood). */
export function parseHours(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(\d+)\.(\d+)$/);
  if (m) return Math.round(parseFloat(s) * 60);
  if (/^\d{3,4}$/.test(s)) { const h = Number(s.slice(0, -2)), mi = Number(s.slice(-2)); if (mi < 60) return h * 60 + mi; }
  if (/^\d{1,2}$/.test(s)) return Number(s) * 60;
  return null;
}

export function fmtHours(min: number | null | undefined): string {
  if (!min || min <= 0 || isNaN(min)) return '0:00';
  const t = Math.round(min);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/** Tidies what the user typed into "h:mm" when they leave the box. */
export function tidyHours(v: string): string {
  const m = parseHours(v);
  return m === null ? v : fmtHours(m);
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthLabel = (key: string) => (key ? `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}` : '');
export const daysInMonth = (key: string) => new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0).getDate();
export const prettyDate = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}-${MONTHS[Number(m) - 1].slice(0, 3)}-${y}`;
};
export const prettyStamp = (iso: string) => (iso ? `${prettyDate(iso)} ${iso.slice(11, 16)}` : '');
export const weekdayOf = (iso: string) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(iso + 'T00:00:00').getDay()];
export const wordCount = (t: string) => (t || '').trim().split(/\s+/).filter(Boolean).length;
export const taka = (n: number) => Math.round(n || 0).toLocaleString('en-IN');
