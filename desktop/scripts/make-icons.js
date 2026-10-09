// Generates assets/icon.png (1024), build/icon.png, assets/icons/png/*.png and the Windows .ico from assets/asda.png
// (the transparent gold mark; see prep-asda.js). The icon is the mark alone on a transparent background.
// Requires devDependency `sharp`. macOS .icns is produced by electron-builder from build/icon.png.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const mark = path.join(root, 'assets', 'asda.png');
const png = (size) => sharp(mark).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png();

(async () => {
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'icons', 'png'), { recursive: true });
  await png(1024).toFile(path.join(root, 'assets', 'icon.png'));
  await png(1024).toFile(path.join(root, 'build', 'icon.png'));
  for (const s of [16, 32, 48, 64, 128, 256, 512, 1024]) await png(s).toFile(path.join(root, 'assets', 'icons', 'png', `${s}x${s}.png`));
  // Windows .ico: multi-size, PNG-compressed entries (supported since Vista); 256px is stored as 0.
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngs = sizes.map((n) => fs.readFileSync(path.join(root, 'assets', 'icons', 'png', `${n}x${n}.png`)));
  const hdr = Buffer.alloc(6 + 16 * sizes.length); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(sizes.length, 4);
  let off = hdr.length;
  sizes.forEach((n, k) => { const e = 6 + 16 * k; hdr[e] = n % 256; hdr[e + 1] = n % 256; hdr.writeUInt16LE(1, e + 4); hdr.writeUInt16LE(32, e + 6); hdr.writeUInt32LE(pngs[k].length, e + 8); hdr.writeUInt32LE(off, e + 12); off += pngs[k].length; });
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), Buffer.concat([hdr, ...pngs]));
  fs.copyFileSync(path.join(root, 'build', 'icon.ico'), path.join(root, 'assets', 'icon.ico'));
  console.log('Icons written.');
})();
