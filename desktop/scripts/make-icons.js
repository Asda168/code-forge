// Generates assets/icon.png (1024) and per-platform icons from assets/logo-map.png (Cambodia map flag; see prep-logo.js).
// Requires devDependency `sharp`. Windows .ico / macOS .icns are produced by electron-builder
// automatically from a 1024px PNG placed at build/icon.png.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'assets', 'logo-map.png'));
(async () => {
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'icons', 'png'), { recursive: true });
  await sharp(svg, { density: 600 }).resize(1024, 1024).png().toFile(path.join(root, 'assets', 'icon.png'));
  await sharp(svg, { density: 600 }).resize(1024, 1024).png().toFile(path.join(root, 'build', 'icon.png'));
  for (const s of [16, 32, 48, 64, 128, 256, 512, 1024]) {
    await sharp(svg, { density: 600 }).resize(s, s).png().toFile(path.join(root, 'assets', 'icons', 'png', `${s}x${s}.png`));
  }
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
