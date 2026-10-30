// Windows: sets the exe icon/version with rcedit (electron-builder's own step needs symlink privileges
// on Windows without Developer Mode). Used together with win.signAndEditExecutable=false.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const cache = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign');
  const rcedit = fs.existsSync(cache) && fs.readdirSync(cache).map((d) => path.join(cache, d, 'rcedit-x64.exe')).find((p) => fs.existsSync(p));
  const exe = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.exe`);
  const icon = path.join(ctx.packager.projectDir, 'build', 'icon.ico');
  if (!rcedit || !fs.existsSync(icon)) { console.warn('afterPack: rcedit or icon missing; exe keeps the default icon'); return; }
  const v = ctx.packager.appInfo.version;
  // Keep the exe's CompanyName identical to the signing certificate's publisher (WIN_PUBLISHER_NAME) so Windows shows one consistent publisher.
  const company = process.env.WIN_PUBLISHER_NAME || 'Asta';
  execFileSync(rcedit, [exe, '--set-icon', icon, '--set-version-string', 'ProductName', 'Asta', '--set-version-string', 'FileDescription', 'Asta',
    '--set-version-string', 'CompanyName', company, '--set-file-version', v, '--set-product-version', v]);
  console.log('afterPack: icon + version set on', path.basename(exe));
};
