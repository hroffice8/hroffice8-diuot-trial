// Joins google-apps-script/src/*.js into one Code.gs that can be pasted into the Apps Script editor.
import fs from 'fs';
import path from 'path';

const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../google-apps-script');
const files = fs.readdirSync(path.join(dir, 'src')).filter(f => f.endsWith('.js')).sort();
const parts = files.map(f => `// ---- ${f} ----\n` + fs.readFileSync(path.join(dir, 'src', f), 'utf8')
  .replace(/\nif \(typeof module !== 'undefined'\) \{[\s\S]*?\n\}\n?$/, '\n'));
const out = `// DIU Overtime — trial backend. Generated ${new Date().toISOString().slice(0, 10)} from google-apps-script/src. Paste this whole file into Code.gs.\n\n` + parts.join('\n');
fs.writeFileSync(path.join(dir, 'Code.gs'), out);
fs.writeFileSync(path.join(dir, 'appsscript.json'), JSON.stringify({
  timeZone: 'Asia/Dhaka', exceptionLogging: 'STACKDRIVER', runtimeVersion: 'V8',
  webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' }
}, null, 2) + '\n');
console.log(`Code.gs written (${files.length} parts, ${out.length.toLocaleString()} characters)`);
