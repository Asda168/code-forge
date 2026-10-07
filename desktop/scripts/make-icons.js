// Generates assets/icon.png (1024) and per-platform icons from assets/logo-map.png (Cambodia map flag; see prep-logo.js).
// Requires devDependency `sharp`. Windows .ico / macOS .icns are produced by electron-builder
// automatically from a 1024px PNG placed at build/icon.png.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.join(__dirname, '..');
const mapSrc = path.join(root, 'assets', 'logo-map.png');
// Flat, watermark-free Cambodia map (silhouette = alpha of logo-map.png) with a stylised Angkor Wat, on a rounded app tile with a code badge.
const tower = (cx, top, w, h) => { let d = ''; const n = 5; for (let i = 0; i < n; i++) { const y = top + (h / n) * i, ww = w * (0.35 + 0.65 * (i + 1) / n); d += `<rect x="${cx - ww / 2}" y="${y}" width="${ww}" height="${h / n + 1}" rx="6"/>`; } return `<path d="M${cx} ${top - 40} L${cx + w * 0.2} ${top + 4} L${cx - w * 0.2} ${top + 4}z"/>` + d; };
const bandsSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#032ea1"/><rect y="285" width="1024" height="443" fill="#e00025"/>
  <g fill="#fff">${tower(492, 330, 110, 170)}${tower(325, 405, 80, 120)}${tower(657, 405, 80, 120)}
    <rect x="270" y="520" width="450" height="60" rx="8"/><rect x="250" y="585" width="490" height="30"/><rect x="232" y="618" width="526" height="30"/><rect x="205" y="651" width="545" height="38" rx="4"/></g></svg>`;
const tileSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e2a6b"/><stop offset="1" stop-color="#0a0f2c"/></linearGradient>
  <radialGradient id="gl" cx=".3" cy=".2" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
  <rect x="32" y="32" width="960" height="960" rx="220" fill="url(#bg)"/><rect x="32" y="32" width="960" height="960" rx="220" fill="url(#gl)"/>
  <rect x="34" y="34" width="956" height="956" rx="218" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="4"/></svg>`;
const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
  <rect x="610" y="650" width="320" height="230" rx="62" fill="#0a0f2c" stroke="#22d3ee" stroke-width="10"/>
  <g fill="none" stroke="#22d3ee" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"><path d="M705 706 L664 765 L705 824"/><path d="M835 706 L876 765 L835 824"/></g>
  <path d="M790 696 L750 834" stroke="#fff" stroke-width="22" stroke-linecap="round"/></svg>`;
async function render() {
  const flat = await sharp(Buffer.from(bandsSvg)).composite([{ input: await sharp(mapSrc).composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><path d="M600 560H770L760 640L700 700H600z"/></svg>') }]).png().toBuffer(), blend: 'dest-in' }]).png().toBuffer();
  // RGBA map layer shrunk and centred on the tile
  const map = await sharp(flat).extract({ left: 40, top: 100, width: 950, height: 810 }).resize({ width: 700 }).png().toBuffer();
  return sharp(Buffer.from(tileSvg)).composite([{ input: map, left: 162, top: 170 }, { input: Buffer.from(badgeSvg) }]).png().toBuffer();
}
(async () => {
  const svg = await render();
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
