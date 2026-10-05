// One-off: turn the downloaded Cambodia map-flag image into assets/logo-map.png (transparent background, square canvas).
// Usage: node scripts/prep-logo.js <source image>
const sharp = require('sharp');
const path = require('path');
(async () => {
  const { data, info } = await sharp(process.argv[2]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const near = (i) => data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235;
  const seen = new Uint8Array(w * h), stack = [];
  const push = (x, y) => { const p = y * w + x; if (!seen[p] && near(p * 4)) { seen[p] = 1; stack.push(p); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); } for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) { const p = stack.pop(), x = p % w, y = (p / w) | 0; data[p * 4 + 3] = 0; if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y); if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1); }
  const side = Math.max(w, h), pad = Math.round(side * 0.06);
  await sharp(data, { raw: { width: w, height: h, channels: 4 } }).extend({ top: Math.floor((side - h) / 2) + pad, bottom: Math.ceil((side - h) / 2) + pad, left: Math.floor((side - w) / 2) + pad, right: Math.ceil((side - w) / 2) + pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(1024, 1024).png().toFile(path.join(__dirname, '..', 'assets', 'logo-map.png'));
  console.log('assets/logo-map.png written');
})();
