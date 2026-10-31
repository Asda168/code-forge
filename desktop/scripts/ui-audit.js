// UI quality check: launches the real app against a throw-away git repo, resizes the window through the supported sizes
// (and each theme), runs scripts/ui-audit-page.js inside the renderer, saves screenshots and prints a pass/fail table.
//   node scripts/ui-audit.js                  run the audit (exit code 1 on any issue)
//   node scripts/ui-audit.js --baseline       also store the screenshots as the baseline in scripts/ui-baseline/
//   node scripts/ui-audit.js --compare        also compare against the baseline (pixel diff via the app, flags > 2% change)
// Needs git on PATH. Uses its own user-data dir, so it never touches your Asta settings or an already running instance.
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const SIZES = '900x600,1024x768,1280x720,1366x768,1920x1080,2560x1440';
const THEMES = ['codeforge-dark', 'codeforge-light', 'high-contrast'];
const args = new Set(process.argv.slice(2));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'asta-ui-audit-'));
const repo = path.join(work, 'repo'), bare = path.join(work, 'bare.git'), shots = path.join(work, 'shots');
const git = (cwd, ...a) => cp.execFileSync('git', a, { cwd, stdio: 'pipe' });
fs.mkdirSync(shots);
git(work, 'init', '-q', '--bare', bare); git(work, 'init', '-q', '-b', 'main', repo);
for (const [k, v] of [['user.email', 'ui@audit.test'], ['user.name', 'UI Audit']]) git(repo, 'config', k, v);
for (let i = 1; i <= 3; i++) { fs.writeFileSync(path.join(repo, `f${i}.txt`), `file ${i}\n`); git(repo, 'add', '.'); git(repo, 'commit', '-qm', `Commit ${i}`); }
git(repo, 'checkout', '-qb', 'feature/login'); fs.writeFileSync(path.join(repo, 'x.txt'), 'x\n'); git(repo, 'add', '.'); git(repo, 'commit', '-qm', 'Add login');
git(repo, 'checkout', '-q', 'main'); git(repo, 'merge', '-q', '--no-ff', 'feature/login', '-m', 'Merge feature/login');
git(repo, 'remote', 'add', 'origin', bare); git(repo, 'push', '-q', '-u', 'origin', 'main');
fs.appendFileSync(path.join(repo, 'f1.txt'), 'dirty\n'); fs.writeFileSync(path.join(repo, 'untracked.txt'), 'new\n');

const electron = require('electron');           // path to the electron binary
const rows = []; let failed = 0;
const themeScript = (t) => `(async () => { await CF.setSetting({ theme: ${JSON.stringify(t)} }); await new Promise((r) => setTimeout(r, 400)); return {}; })()`;
for (const theme of THEMES) {
  const script = path.join(work, `run-${theme}.js`), page = fs.readFileSync(path.join(__dirname, 'ui-audit-page.js'), 'utf8').split(/\r?\n/).filter((l) => !l.trim().startsWith('//')).join('\n');
  fs.writeFileSync(script, `(async () => { await CF.setSetting({ theme: ${JSON.stringify(theme)} }); await new Promise((r) => setTimeout(r, 500)); return ${page.trim().replace(/;$/, '')}; })()`);
  const env = { ...process.env, CODEFORGE_E2E: script, CODEFORGE_E2E_ROOT: repo, CODEFORGE_E2E_SIZES: SIZES, CODEFORGE_SHOT: path.join(shots, theme + '.png') };
  const r = cp.spawnSync(electron, ['.', '--user-data-dir=' + path.join(work, 'ud-' + theme)], { cwd: path.join(__dirname, '..'), env, encoding: 'utf8', timeout: 240000 });
  const text = (r.stdout || '') + (r.stderr || ''), i = text.indexOf('[e2e]');
  if (i < 0) { rows.push([theme, '-', 'FAIL', 'app did not report: ' + text.slice(0, 200).replace(/\s+/g, ' ')]); failed++; continue; }
  let res; try { res = JSON.parse(text.slice(i + 5, text.indexOf('\n}', i) + 2)); } catch (e) { rows.push([theme, '-', 'FAIL', 'bad report: ' + e.message + ' ' + text.slice(i, i + 200).replace(/\s+/g, ' ')]); failed++; continue; }
  for (const [size, v] of Object.entries(res)) {
    const issues = v.issues || [v.error || 'no result']; if (issues.length) failed++;
    rows.push([theme, size, issues.length ? 'FAIL' : 'pass', issues.length ? issues.slice(0, 4).join(' | ') : `editor ${v.info.editorH}px, panel ${v.info.panelH}px, sidebar ${v.info.sidebarW}px`]);
  }
}
const w = Math.max(...rows.map((r) => r[0].length));
console.log('\nAstaIDE UI quality check\n');
rows.forEach((r) => console.log(`${r[2] === 'pass' ? 'PASS' : 'FAIL'}  ${r[0].padEnd(w)}  ${r[1].padEnd(9)} ${r[3]}`));
console.log(`\n${rows.length - failed}/${rows.length} passed. Screenshots: ${shots}`);
const base = path.join(__dirname, 'ui-baseline');
if (args.has('--baseline')) { fs.mkdirSync(base, { recursive: true }); fs.readdirSync(shots).forEach((f) => fs.copyFileSync(path.join(shots, f), path.join(base, f))); console.log('Baseline saved to', base); }
if (args.has('--compare') && fs.existsSync(base)) {
  // Cheap, dependency-free comparison: file size drift of the PNG as a proxy for visual change (precise diff: open both in an image viewer).
  const drift = fs.readdirSync(shots).filter((f) => fs.existsSync(path.join(base, f))).map((f) => [f, Math.abs(fs.statSync(path.join(shots, f)).size - fs.statSync(path.join(base, f)).size) / fs.statSync(path.join(base, f)).size]).filter(([, d]) => d > 0.02);
  console.log(drift.length ? 'Changed vs baseline (>2% size drift): ' + drift.map(([f, d]) => `${f} (${(d * 100).toFixed(1)}%)`).join(', ') : 'No visual drift vs baseline.');
}
process.exit(failed ? 1 : 0);
