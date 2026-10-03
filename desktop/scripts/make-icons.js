// Generates assets/icon.png (1024) and per-platform icons from assets/logo-dark.svg.
// Requires devDependency `sharp`. Windows .ico / macOS .icns are produced by electron-builder
// automatically from a 1024px PNG placed at build/icon.png.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'assets', 'logo-dark.svg'));
(async () => {
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  fs.mkdirSync(path.join(root, 'assets', 'icons', 'png'), { recursive: true });
  await sharp(svg, { density: 600 }).resize(1024, 1024).png().toFile(path.join(root, 'assets', 'icon.png'));
  await sharp(svg, { density: 600 }).resize(1024, 1024).png().toFile(path.join(root, 'build', 'icon.png'));
  for (const s of [16, 32, 48, 64, 128, 256, 512, 1024]) {
    await sharp(svg, { density: 600 }).resize(s, s).png().toFile(path.join(root, 'assets', 'icons', 'png', `${s}x${s}.png`));
  }
  // Windows .ico (PNG-compressed 256px entry, supported since Vista)
  const png = fs.readFileSync(path.join(root, 'assets', 'icons', 'png', '256x256.png'));
  const hdr = Buffer.alloc(22); hdr.writeUInt16LE(0, 0); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(1, 4);
  hdr[6] = 0; hdr[7] = 0; hdr.writeUInt16LE(1, 10); hdr.writeUInt16LE(32, 12); hdr.writeUInt32LE(png.length, 14); hdr.writeUInt32LE(22, 18);
  fs.writeFileSync(path.join(root, 'build', 'icon.ico'), Buffer.concat([hdr, png]));
  fs.copyFileSync(path.join(root, 'build', 'icon.ico'), path.join(root, 'assets', 'icon.ico'));
  console.log('Icons written.');
})();
