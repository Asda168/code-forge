// Creates a CodeForge shortcut on the Desktop when running from source (installers do this themselves).
// Usage: npm run shortcut
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const desktop = path.join(os.homedir(), 'Desktop');
if (!fs.existsSync(desktop)) { console.error('Desktop folder not found: ' + desktop); process.exit(1); }
const electron = require('electron'); // path to the electron binary

if (process.platform === 'win32') {
  const lnk = path.join(desktop, 'CodeForge.lnk');
  const icon = path.join(root, 'build', 'icon.ico');
  const ps = `$s=(New-Object -ComObject WScript.Shell).CreateShortcut('${lnk}');$s.TargetPath='${electron}';` +
    `$s.Arguments='"${root}"';$s.WorkingDirectory='${root}';$s.Description='CodeForge - Code. Build. Run. Ship.';` +
    (fs.existsSync(icon) ? `$s.IconLocation='${icon}';` : '') + '$s.Save()';
  execFileSync('powershell', ['-NoProfile', '-Command', ps]);
  console.log('Shortcut created: ' + lnk);
} else if (process.platform === 'linux') {
  const f = path.join(desktop, 'codeforge.desktop');
  fs.writeFileSync(f, `[Desktop Entry]\nType=Application\nName=CodeForge\nComment=Code. Build. Run. Ship.\nExec="${electron}" "${root}"\nPath=${root}\nIcon=${path.join(root, 'assets', 'icon.png')}\nTerminal=false\nCategories=Development;IDE;\n`, { mode: 0o755 });
  console.log('Shortcut created: ' + f + ' (right-click > Allow Launching if needed)');
} else {
  const f = path.join(desktop, 'CodeForge.command');
  fs.writeFileSync(f, `#!/bin/bash\ncd "${root}" && "${electron}" . >/dev/null 2>&1 &\n`, { mode: 0o755 });
  console.log('Launcher created: ' + f);
}
