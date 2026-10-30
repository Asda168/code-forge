// Regression test: the central error log must never write secrets or the user's home path.
// Extracts scrub() from main.js (Electron-free) and checks representative leaks.
const fs = require('fs'), os = require('os'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
const m = src.match(/function scrub[\s\S]*?\r?\n}\r?\n/);
if (!m) { console.error('FAIL scrub() not found in main.js'); process.exit(1); }
const scrub = new Function('os', m[0] + '; return scrub;')(os);
const home = os.homedir();
const cases = [
  ['Authorization: Bearer abc123def456ghi789xyz', 'abc123def456'],
  ['{"password":"hunter2hunter2"}', 'hunter2'],
  ['api_key=sk_live_1234567890abcdef', '1234567890abcdef'],
  ['clone https://user:s3cretpw@github.com/x/y.git', 's3cretpw'],
  ['token ghp_' + 'a'.repeat(36), 'ghp_aaaa'],
  ['Error at ' + path.join(home, 'project', 'file.js'), home],
  ['jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijk', 'eyJhbGci'],
];
let bad = 0;
for (const [input, secret] of cases) {
  const out = scrub(input), leaked = out.includes(secret);
  console.log((leaked ? 'FAIL' : 'ok  ') + ' ' + out.slice(0, 70));
  if (leaked) bad++;
}
if (!/\bfile\.js\b/.test(scrub('Error at ' + path.join(home, 'project', 'file.js')))) { console.log('FAIL scrub removed too much'); bad++; }
process.exit(bad ? 1 : 0);
