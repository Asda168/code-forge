// Run: node scripts/security-test.js
const s = require('../src/security');
const os = require('os');
let fail = 0;
const t = (l, v) => { if (!v) fail++; console.log(v ? 'ok  ' : 'FAIL', l); };
const throws = (f) => { try { f(); return false; } catch { return true; } };
if (process.platform === 'win32') {
  t('C:\\Windows\\System32 protected', s.isProtectedPath('C:\\Windows\\System32'));
  t('drive root protected', s.isProtectedPath('C:\\'));
  t('Program Files protected', s.isProtectedPath('C:\\Program Files\\Git'));
} else {
  t('/etc protected', s.isProtectedPath('/etc/passwd'));
  t('/ protected', s.isProtectedPath('/'));
}
t('home protected', s.isProtectedPath(os.homedir()));
t('project dir allowed', !s.isProtectedPath(process.cwd()));
t('git push allowed', !!s.validateGitArgs(['push']));
t('git -c blocked', throws(() => s.validateGitArgs(['-c', 'a=b', 'status'])));
t('git --upload-pack blocked', throws(() => s.validateGitArgs(['fetch', '--upload-pack=x'])));
t('git ext:: blocked', throws(() => s.validateGitArgs(['fetch', 'ext::sh -c x'])));
t('git unknown subcommand blocked', throws(() => s.validateGitArgs(['daemon'])));
t('name .. rejected', throws(() => s.validateName('..')));
t('name a/b rejected', throws(() => s.validateName('a/b')));
t('rm -rf / dangerous', s.isDangerousCommand('rm -rf /'));
t('npm run dev not dangerous', !s.isDangerousCommand('npm run dev'));
process.exit(fail ? 1 : 0);
