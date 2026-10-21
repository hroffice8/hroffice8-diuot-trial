// A small in-memory stand-in for the Google Apps Script services the backend uses,
// so the whole backend can be exercised with real data in Node before deploying.
import crypto from 'crypto';
import fs from 'fs';
import vm from 'vm';

export function createGas({ owner = 'hroffice8@daffodilvarsity.edu.bd', now = () => new Date() } = {}) {
  let idSeq = 1;
  const newId = p => `${p}${String(idSeq++).padStart(6, '0')}`;
  const props = {};
  const spreadsheets = {};
  const files = {};
  const sent = [];
  const fetches = [];

  class Range {
    constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
    getValues() {
      const out = [];
      for (let i = 0; i < this.nr; i++) {
        const row = this.sheet.grid[this.r - 1 + i] || [];
        const o = [];
        for (let j = 0; j < this.nc; j++) { const v = row[this.c - 1 + j]; o.push(v === undefined ? '' : v); }
        out.push(o);
      }
      return out;
    }
    setValues(vals) {
      if (vals.length !== this.nr || vals.some(v => v.length !== this.nc)) throw new Error(`setValues size mismatch: ${vals.length}x${vals[0] && vals[0].length} into ${this.nr}x${this.nc}`);
      if (this.r - 1 + this.nr > this.sheet.maxRows) throw new Error('Range beyond max rows');
      if (this.c - 1 + this.nc > this.sheet.maxCols) throw new Error('Range beyond max columns');
      vals.forEach((row, i) => {
        const g = this.sheet.grid[this.r - 1 + i] || (this.sheet.grid[this.r - 1 + i] = []);
        row.forEach((v, j) => { g[this.c - 1 + j] = v; });
      });
      return this;
    }
    setValue(v) { return this.setValues([[v]]); }
    clearContent() { for (let i = 0; i < this.nr; i++) { const g = this.sheet.grid[this.r - 1 + i]; if (g) for (let j = 0; j < this.nc; j++) g[this.c - 1 + j] = ''; } return this; }
  }
  // Formatting calls are accepted and ignored
  ['setNumberFormat', 'setFontWeight', 'setBackground', 'setWrap', 'setFontColor', 'merge', 'setBorder', 'setHorizontalAlignment'].forEach(m => { Range.prototype[m] = function () { return this; }; });

  class Sheet {
    constructor(name) { this.name = name; this.grid = []; this.maxRows = 1000; this.maxCols = 26; }
    getName() { return this.name; }
    getMaxRows() { return this.maxRows; }
    getMaxColumns() { return this.maxCols; }
    insertColumnsAfter(a, n) { this.maxCols += n; }
    deleteColumns(start, n) { this.maxCols -= n; this.grid.forEach(r => r.splice(start - 1, n)); }
    insertRowsAfter(a, n) { this.maxRows += n; }
    deleteRows(start, n) { this.maxRows -= n; this.grid.splice(start - 1, n); }
    getLastRow() { for (let i = this.grid.length - 1; i >= 0; i--) if ((this.grid[i] || []).some(v => v !== '' && v !== undefined && v !== null)) return i + 1; return 0; }
    getLastColumn() { let m = 0; this.grid.forEach(r => { for (let j = (r || []).length - 1; j >= 0; j--) if (r[j] !== '' && r[j] !== undefined) { m = Math.max(m, j + 1); break; } }); return m; }
    getRange(r, c, nr = 1, nc = 1) { if (r < 1 || c < 1 || nr < 1 || nc < 1) throw new Error(`bad range ${r},${c},${nr},${nc}`); return new Range(this, r, c, nr, nc); }
    setFrozenRows() { } setColumnWidth() { }
    cells() { return this.maxRows * this.maxCols; }
  }

  class Spreadsheet {
    constructor(name) { this.id = newId('SS'); this.name = name; this.sheets = [new Sheet('Sheet1')]; spreadsheets[this.id] = this; files[this.id] = { id: this.id, name, kind: 'ss' }; }
    getId() { return this.id; } getName() { return this.name; } getUrl() { return `https://docs.google.com/spreadsheets/d/${this.id}`; }
    getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
    insertSheet(n) { if (this.getSheetByName(n)) throw new Error('sheet exists ' + n); const s = new Sheet(n); this.sheets.push(s); return s; }
    deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
    getSheets() { return this.sheets.slice(); }
    cells() { return this.sheets.reduce((t, s) => t + s.cells(), 0); }
  }

  const folder = (name) => {
    const f = { id: newId('FD'), name, children: [], getId() { return this.id; }, getUrl() { return 'https://drive.google.com/drive/folders/' + this.id; },
      createFolder(n) { const c = folder(n); this.children.push(c); return c; },
      createFile(blob) { const id = newId('FL'); files[id] = { id, name: blob.name, bytes: blob.bytes.length, kind: 'file' }; return { getUrl: () => 'https://drive.google.com/file/d/' + id, getId: () => id }; },
      getFoldersByName(n) { const m = this.children.filter(c => c.name === n); let i = 0; return { hasNext: () => i < m.length, next: () => m[i++] }; } };
    files[f.id] = f;
    return f;
  };

  const blob = (bytes, mime, name) => ({ bytes: Buffer.from(bytes), mime, name, getDataAsString: () => Buffer.from(bytes).toString('utf8') });

  const g = {
    console,
    Logger: { log: (...a) => { if (process.env.GAS_LOG) console.log('[Logger]', ...a); } },
    SpreadsheetApp: { create: n => new Spreadsheet(n), openById: id => { if (!spreadsheets[id]) throw new Error('no spreadsheet ' + id); return spreadsheets[id]; } },
    DriveApp: {
      createFolder: n => folder(n),
      getFolderById: id => files[id],
      getFileById: id => ({ moveTo() { }, getId: () => id, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + id,
        makeCopy(name) { const src = spreadsheets[id]; const c = new Spreadsheet(name); c.sheets = JSON.parse(JSON.stringify(src.sheets)).map(s => Object.assign(new Sheet(s.name), s)); return { getId: () => c.id, getUrl: () => c.getUrl() }; } })
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    Utilities: {
      formatDate(d, tz, fmt) {
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
          .formatToParts(d).map(p => [p.type, p.value]));
        return fmt.replace(/'T'/, 'T').replace('yyyy', parts.year).replace('yy', parts.year.slice(2)).replace('MM', parts.month).replace('dd', parts.day)
          .replace('HH', parts.hour).replace('mm', parts.minute).replace('ss', parts.second);
      },
      computeHmacSha256Signature: (v, key) => [...crypto.createHmac('sha256', key).update(v).digest()].map(b => (b > 127 ? b - 256 : b)),
      base64EncodeWebSafe: v => Buffer.from(Array.isArray(v) ? v.map(b => (b + 256) % 256) : String(v)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      base64DecodeWebSafe: s => [...Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')],
      base64Decode: s => [...Buffer.from(s, 'base64')],
      newBlob: (bytes, mime, name) => blob(bytes, mime, name),
      getUuid: () => crypto.randomUUID()
    },
    MailApp: { sendEmail: o => { sent.push(typeof o === 'string' ? { to: o } : o); }, getRemainingDailyQuota: () => 1500 - sent.length },
    GmailApp: { search: () => [] },
    LockService: { getScriptLock: () => ({ waitLock() { }, releaseLock() { } }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => owner }) },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger() { }, getOAuthToken: () => 'token',
      newTrigger: () => { const t = { timeBased: () => t, everyDays: () => t, atHour: () => t, inTimezone: () => t, create: () => t }; return t; } },
    UrlFetchApp: { fetch: (u, o) => { fetches.push({ u, o }); return { getResponseCode: () => 200 }; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ setMimeType() { return this; }, content: s }) },
    Date, JSON, Math
  };
  const realDate = Date;
  g.Date = class extends realDate { constructor(...a) { if (a.length) super(...a); else super(now().getTime()); } static now() { return now().getTime(); } };
  vm.createContext(g);
  return {
    g, props, sent, fetches, spreadsheets, files,
    load(code) { vm.runInContext(code, g); },
    call(action, params = {}, token) {
      vm.runInContext('RUN_CACHE_ = {};', g); // every web request is a fresh execution in Apps Script
      const out = g.doPost({ postData: { contents: JSON.stringify(Object.assign({ action, token }, params)) } });
      return JSON.parse(out.content);
    }
  };
}

export function loadBackend(gas, path) { gas.load(fs.readFileSync(path, 'utf8')); }
