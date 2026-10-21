// Small .xlsx reader and writer built on JSZip (no other Excel library needed).
// Reader: returns each sheet as rows of cell values (strings or numbers).
// Writer: plain tables with bold headers, borders, column widths, merged title rows,
// number formats, landscape/A4 page setup and repeated header rows.
import JSZip from 'jszip';

export type Cell = string | number | null;
export interface SheetData { name: string; rows: Cell[][] }

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parseXml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

function colIndex(ref: string): number {
  const letters = ref.replace(/\d+/g, '');
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function colName(i: number): string {
  let s = '';
  i += 1;
  while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

const byTag = (el: Element | Document, tag: string) => Array.from(el.getElementsByTagName(tag));
const textOf = (el: Element) => byTag(el, 't').map(t => t.textContent || '').join('');

/** Excel date serial → "YYYY-MM-DD". */
export function serialToIso(n: number): string {
  const d = new Date(Math.round((n - 25569) * 86400000));
  return d.toISOString().slice(0, 10);
}

/** Reads every sheet of an .xlsx file. Dates stored as dates come back as "YYYY-MM-DD". */
export async function readXlsx(file: Blob | ArrayBuffer): Promise<SheetData[]> {
  const buf = file instanceof Blob ? await file.arrayBuffer() : file;
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(buf); } catch { throw new Error('This does not look like an .xlsx file. In Excel use File → Save As → Excel Workbook (.xlsx).'); }
  const read = async (p: string) => { const f = zip.file(p); return f ? f.async('string') : null; };
  const wbXml = await read('xl/workbook.xml');
  if (!wbXml) throw new Error('This does not look like an .xlsx file.');
  const wb = parseXml(wbXml);
  const rels = parseXml((await read('xl/_rels/workbook.xml.rels')) || '<Relationships/>');
  const relTarget: Record<string, string> = {};
  byTag(rels, 'Relationship').forEach(r => { relTarget[r.getAttribute('Id') || ''] = r.getAttribute('Target') || ''; });

  const shared: string[] = [];
  const ssXml = await read('xl/sharedStrings.xml');
  if (ssXml) byTag(parseXml(ssXml), 'si').forEach(si => shared.push(textOf(si)));

  // Which styles are dates
  const dateStyles = new Set<number>();
  const stXml = await read('xl/styles.xml');
  if (stXml) {
    const st = parseXml(stXml);
    const custom: Record<number, string> = {};
    byTag(st, 'numFmt').forEach(f => { custom[Number(f.getAttribute('numFmtId'))] = f.getAttribute('formatCode') || ''; });
    const xfs = st.getElementsByTagName('cellXfs')[0];
    if (xfs) byTag(xfs, 'xf').forEach((xf, i) => {
      const id = Number(xf.getAttribute('numFmtId') || 0);
      const code = custom[id] || '';
      const isTime = /h/i.test(code) && !/[dy]/i.test(code);
      if ((id >= 14 && id <= 17) || id === 22 || (code && /[dy]/i.test(code) && !isTime)) dateStyles.add(i);
    });
  }

  const sheets: SheetData[] = [];
  for (const s of byTag(wb, 'sheet')) {
    const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || '';
    let target = relTarget[rid] || '';
    target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
    const xml = await read(target);
    if (!xml) continue;
    const doc = parseXml(xml);
    const rows: Cell[][] = [];
    byTag(doc, 'row').forEach(rowEl => {
      const r = Number(rowEl.getAttribute('r')) - 1;
      const row: Cell[] = rows[r] || [];
      byTag(rowEl, 'c').forEach(c => {
        const ref = c.getAttribute('r') || '';
        const ci = ref ? colIndex(ref) : row.length;
        const t = c.getAttribute('t');
        const vEl = c.getElementsByTagName('v')[0];
        const v = vEl ? vEl.textContent || '' : '';
        let val: Cell = null;
        if (t === 's') val = shared[Number(v)] ?? '';
        else if (t === 'inlineStr') val = textOf(c);
        else if (t === 'str' || t === 'e') val = v;
        else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE';
        else if (v !== '') {
          const num = Number(v);
          const style = Number(c.getAttribute('s') || -1);
          val = dateStyles.has(style) && num > 20000 && num < 80000 ? serialToIso(Math.floor(num)) : num;
        }
        row[ci] = val;
      });
      rows[r] = row;
    });
    for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
    sheets.push({ name: s.getAttribute('name') || 'Sheet', rows });
  }
  return sheets;
}

/** Simple CSV reader (for files saved as .csv). */
export function readCsv(text: string): Cell[][] {
  const rows: Cell[][] = [];
  let row: Cell[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

export async function readSpreadsheetFile(file: File): Promise<SheetData[]> {
  if (/\.csv$/i.test(file.name)) return [{ name: file.name, rows: readCsv(await file.text()) }];
  if (/\.xls$/i.test(file.name)) throw new Error('Old .xls files are not supported. Open it in Excel and save as .xlsx (Excel Workbook).');
  return readXlsx(file);
}

/* ---------------- Writer ---------------- */

export interface ColumnSpec { header: string; width?: number; format?: 'int' | 'money' | 'text' | 'hours' }
export interface WriteSheet {
  name: string;
  title?: string[];             // lines above the table (merged across all columns, centered)
  columns: ColumnSpec[];
  rows: Cell[][];
  totalRow?: Cell[];            // bold row after the data
  footer?: Cell[][];            // free rows after the table (e.g. amount in words, signatures)
  landscape?: boolean;
  fitWidth?: boolean;
}

// Style ids in styles.xml below
const S = { normal: 0, header: 1, cell: 2, int: 3, money: 4, title: 5, titleBig: 6, bold: 7, boldMoney: 8, footer: 9 };

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>
<fonts count="4"><font><sz val="10"/><name val="Arial"/></font><font><b/><sz val="10"/><name val="Arial"/></font><font><b/><sz val="13"/><name val="Arial"/></font><font><sz val="10"/><name val="Arial"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE6F4EA"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF808080"/></left><right style="thin"><color rgb="FF808080"/></right><top style="thin"><color rgb="FF808080"/></top><bottom style="thin"><color rgb="FF808080"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="10">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right"/></xf>
<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function cellXml(ref: string, v: Cell, style: number): string {
  if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${style}"/>`;
  if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(String(v))}</t></is></c>`;
}

function sheetXml(sh: WriteSheet): { xml: string; headerRow: number } {
  const n = sh.columns.length;
  const rowsXml: string[] = [];
  const merges: string[] = [];
  let r = 1;
  (sh.title || []).forEach((line, i) => {
    rowsXml.push(`<row r="${r}">${cellXml('A' + r, line, i === 0 ? S.titleBig : S.title)}</row>`);
    merges.push(`A${r}:${colName(n - 1)}${r}`);
    r++;
  });
  if (sh.title && sh.title.length) r++;
  const headerRow = r;
  rowsXml.push(`<row r="${r}" ht="42" customHeight="1">${sh.columns.map((c, i) => cellXml(colName(i) + r, c.header, S.header)).join('')}</row>`);
  r++;
  const styleFor = (c: ColumnSpec, v: Cell) => (c.format === 'money' ? S.money : c.format === 'int' ? S.int : typeof v === 'number' && c.format !== 'text' ? S.int : S.cell);
  sh.rows.forEach(row => {
    rowsXml.push(`<row r="${r}">${sh.columns.map((c, i) => cellXml(colName(i) + r, row[i] ?? '', styleFor(c, row[i] ?? ''))).join('')}</row>`);
    r++;
  });
  if (sh.totalRow) {
    rowsXml.push(`<row r="${r}">${sh.columns.map((c, i) => cellXml(colName(i) + r, sh.totalRow![i] ?? '', typeof sh.totalRow![i] === 'number' ? S.boldMoney : S.bold)).join('')}</row>`);
    r++;
  }
  (sh.footer || []).forEach(line => {
    r++;
    rowsXml.push(`<row r="${r}">${line.map((v, i) => cellXml(colName(i) + r, v, S.footer)).join('')}</row>`);
  });
  const cols = sh.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 12}" customWidth="1"/>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="${sh.fitWidth ? 1 : 0}"/></sheetPr>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${rowsXml.join('')}</sheetData>
${merges.length ? `<mergeCells count="${merges.length}">${merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : ''}
<printOptions horizontalCentered="1"/>
<pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/>
<pageSetup paperSize="9" orientation="${sh.landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>
<headerFooter><oddFooter>&amp;CPage &amp;P of &amp;N</oddFooter></headerFooter>
</worksheet>`;
  return { xml, headerRow };
}

/** Builds an .xlsx file from simple table definitions. */
export async function writeXlsx(sheets: WriteSheet[]): Promise<Blob> {
  const zip = new JSZip();
  const names = sheets.map((s, i) => s.name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || `Sheet${i + 1}`);
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${names.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  const defined: string[] = [];
  sheets.forEach((s, i) => {
    const { xml, headerRow } = sheetXml(s);
    zip.file(`xl/worksheets/sheet${i + 1}.xml`, xml);
    defined.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${names[i].replace(/'/g, "''")}'!$${headerRow}:$${headerRow}</definedName>`);
  });
  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((n, i) => `<sheet name="${xmlEsc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><definedNames>${defined.join('')}</definedNames></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('xl/styles.xml', stylesXml());
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
