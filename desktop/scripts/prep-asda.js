// One-off: cut the gold "asda" mark out of its dark textured background and write assets/asda.png (transparent, square).
// Usage: node scripts/prep-asda.js [source image, default assets/asda.jpg]
// The mark is gold (clearly coloured) while the background and the drop shadow are neutral dark grey, so the alpha comes from colour
// saturation or brightness; edge pixels are un-mixed from the background so no dark fringe is left around the letter.
const sharp = require('sharp');
const path = require('path');

const src = process.argv[2] || path.join(__dirname, '..', 'assets', 'asda.jpg');
const out = process.argv[3] || path.join(__dirname, '..', 'assets', 'asda.png');
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

(async () => {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const a = new Float32Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4, r = data[i], g = data[i + 1], b = data[i + 2];
    // saturated gold, or a clearly bright cream highlight (almost colourless but far brighter than the dark background)
    a[p] = Math.max(smooth(26, 70, Math.max(r, g, b) - Math.min(r, g, b)), smooth(100, 150, (r + g + b) / 3));
  }
  // keep only real shapes: drop specks (label connected regions, keep those that are not tiny next to the largest)
  const lab = new Int32Array(w * h), areas = [0]; let n = 0;
  for (let s = 0; s < w * h; s++) {
    if (a[s] < 0.25 || lab[s]) continue;
    n++; let count = 0; const st = [s]; lab[s] = n;
    while (st.length) { const p = st.pop(); count++; const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) if (q >= 0 && !lab[q] && a[q] >= 0.25) { lab[q] = n; st.push(q); } }
    areas.push(count);
  }
  const big = Math.max(...areas);
  const keep = new Set(areas.map((c, k) => (c >= big * 0.02 ? k : -1)).filter((k) => k > 0));
  const BG = 38;                                              // typical background grey, used to un-mix edge pixels
  const rgba = Buffer.alloc(w * h * 4); let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let p = 0; p < w * h; p++) {
    let al = a[p]; if (al > 0 && !keep.has(lab[p])) { let near = false; /* soft edge pixels next to a kept region stay */ for (const q of [p - 1, p + 1, p - w, p + w]) if (q >= 0 && q < w * h && keep.has(lab[q])) near = true; if (!near) al = 0; }
    if (al < 0.08) continue;                                   // faint warm pixels are the drop shadow, not the letter
    const i = p * 4, o = p * 4;
    for (let c = 0; c < 3; c++) rgba[o + c] = Math.min(255, Math.max(0, Math.round((data[i + c] - (1 - al) * BG) / al)));
    rgba[o + 3] = Math.round(al * 255);
    const x = p % w, y = (p / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = Math.max(bw, bh), pad = Math.round(side * 0.1);
  const cropped = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).extract({ left: x0, top: y0, width: bw, height: bh }).png().toBuffer();
  // pad to a square canvas first (sharp always resizes before extending, so doing both in one pipeline would crop the mark)
  const square = await sharp(cropped).extend({ top: Math.floor((side - bh) / 2) + pad, bottom: Math.ceil((side - bh) / 2) + pad, left: Math.floor((side - bw) / 2) + pad, right: Math.ceil((side - bw) / 2) + pad, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp(square).resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out);
  console.log(`${path.relative(process.cwd(), out)} written (mark ${bw}x${bh}px in ${w}x${h}, ${keep.size} shape(s))`);
})();
