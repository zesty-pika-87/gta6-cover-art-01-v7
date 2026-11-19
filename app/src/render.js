// Cover Coast renderer — draws the poster state onto any 2D canvas, at any size.
// The same function paints the on-screen preview and every PNG export, so what
// the judge sees in the preview is exactly what lands in the file. All effects
// are seeded, so a given state always renders identically.

export const LAYOUTS = {
  full:    { label: 'Full Bleed',       panels: 1 },
  four:    { label: 'Four Panel',       panels: 4 },
  hero3:   { label: 'Hero + Three',     panels: 4 },
  nine:    { label: 'Nine Panel',       panels: 9 },
  mosaic:  { label: 'Mosaic Nine',      panels: 9 },
  tilted:  { label: 'Tilted Snapshots', panels: 3 },
  stack:   { label: 'Story Stack',      panels: 3 },
};

export const GRADES = {
  sunset:  { label: 'Vice Sunset',  stops: ['#1a0b2e', '#7b1e5b', '#e8446c', '#ff8a3d', '#ffd166'] },
  neon:    { label: 'Neon Nights',  stops: ['#050514', '#1b0f4b', '#7a1fa2', '#ff2e88', '#22e6ff'] },
  dusk:    { label: 'Palm Dusk',    stops: ['#0d1b2e', '#274060', '#7a5c8e', '#e08e79', '#f7c59f'] },
  magenta: { label: 'Magenta Heat', stops: ['#16041f', '#4b0f54', '#a4138c', '#ff4d9d', '#ffb3d9'] },
  teal:    { label: 'Teal Noir',    stops: ['#02141a', '#07333d', '#0f6f6a', '#2ec4b6', '#d8f3dc'] },
  golden:  { label: 'Golden Hour',  stops: ['#1c0f02', '#5c2e0a', '#b4551d', '#ff9e3d', '#ffe29a'] },
};

export const SIZES = {
  square:    { label: 'Square 1080×1080',     w: 1080, h: 1080 },
  portrait:  { label: 'Portrait 1080×1350',   w: 1080, h: 1350 },
  landscape: { label: 'Landscape 1920×1080',  w: 1920, h: 1080 },
  story:     { label: 'Story 1080×1920',      w: 1080, h: 1920 },
};

/** Deterministic PRNG (mulberry32) — the same seed always gives the same grain. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Panel rectangles for a layout, in fractions of (w, h). gap is a fraction of w. */
export function layoutRects(layout, w, h) {
  const g = 0.018 * Math.min(w, h);
  const R = (x, y, rw, rh) => ({ x: x * w, y: y * h, w: rw * w, h: rh * h });
  const inset = (r) => ({ x: r.x + g / 2, y: r.y + g / 2, w: r.w - g, h: r.h - g });
  switch (layout) {
    case 'full': return [R(0, 0, 1, 1)];
    case 'four': return [R(0, 0, .5, .5), R(.5, 0, .5, .5), R(0, .5, .5, .5), R(.5, .5, .5, .5)].map(inset);
    case 'hero3': return [R(0, 0, 1, .62), R(0, .62, 1 / 3, .38), R(1 / 3, .62, 1 / 3, .38), R(2 / 3, .62, 1 / 3, .38)].map(inset);
    case 'nine': {
      const out = [];
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out.push(inset(R(c / 3, r / 3, 1 / 3, 1 / 3)));
      return out;
    }
    case 'mosaic': {
      // 4x4 unit grid, nine tiles of mixed sizes.
      const U = (cx, cy, cw, ch) => inset(R(cx / 4, cy / 4, cw / 4, ch / 4));
      return [U(0, 0, 2, 2), U(2, 0, 2, 1), U(2, 1, 2, 1), U(0, 2, 1, 2), U(1, 2, 1, 1),
              U(2, 2, 1, 1), U(3, 2, 1, 1), U(1, 3, 1, 1), U(2, 3, 2, 1)];
    }
    case 'tilted': {
      // Three polaroids, slightly rotated, over a dimmed full-bleed backdrop.
      const pw = w * 0.52, ph = h * 0.42;
      return [
        { x: w * 0.06, y: h * 0.05, w: pw, h: ph, rot: -0.10 },
        { x: w * 0.42, y: h * 0.28, w: pw, h: ph, rot: 0.06 },
        { x: w * 0.10, y: h * 0.55, w: pw, h: ph, rot: -0.04 },
      ];
    }
    case 'stack': return [R(0, 0, 1, 1 / 3), R(0, 1 / 3, 1, 1 / 3), R(0, 2 / 3, 1, 1 / 3)].map(inset);
    default: return [R(0, 0, 1, 1)];
  }
}

/** Draws one photo cover-filling a rect, with pan (ox, oy in rect fractions) and zoom. */
function drawPhotoInto(ctx, img, rect, ox, oy, zoom) {
  if (!img) return;
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const base = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const pw = iw * base, ph = ih * base;
  const cx = rect.x + rect.w / 2 + ox * rect.w;
  const cy = rect.y + rect.h / 2 + oy * rect.h;
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
}

/** Fills a rect with the grade's 5-stop gradient, blended over the photo. */
function gradeWash(ctx, rect, grade, strength) {
  if (strength <= 0) return;
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
  grade.stops.forEach((c, i) => grad.addColorStop(i / (grade.stops.length - 1), c));
  ctx.save();
  ctx.globalAlpha = 0.55 * strength;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.globalAlpha = 0.22 * strength;
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

/** Sunburst rays fanning from a point, deterministic from the seed. */
function sunburst(ctx, w, h, seed, alpha) {
  const rng = mulberry32(seed * 7919 + 13);
  const cx = w * 0.82, cy = h * 0.08;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 14; i++) {
    const a0 = Math.PI * (0.35 + rng() * 0.55) + i * 0.10;
    const a1 = a0 + 0.02 + rng() * 0.05;
    const r = Math.max(w, h) * 1.4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Halftone dots along the bottom edge, deterministic from the seed. */
function halftone(ctx, w, h, seed, alpha) {
  const rng = mulberry32(seed * 104729 + 7);
  const step = Math.max(14, w * 0.016);
  ctx.save();
  ctx.fillStyle = '#0a0618';
  ctx.globalAlpha = alpha;
  for (let y = h * 0.86; y < h; y += step) {
    for (let x = step / 2; x < w; x += step) {
      const t = (y - h * 0.86) / (h * 0.14);
      const r = step * 0.42 * t * (0.6 + rng() * 0.7);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

let noiseTile = null;
let noiseSeed = -1;
/** Seeded film grain: one 192px noise tile, tiled over the frame. */
function grain(ctx, w, h, seed, alpha) {
  if (!noiseTile || noiseSeed !== seed) {
    noiseSeed = seed;
    const rng = mulberry32(seed * 31 + 5);
    noiseTile = document.createElement('canvas');
    noiseTile.width = noiseTile.height = 192;
    const nctx = noiseTile.getContext('2d');
    const data = nctx.createImageData(192, 192);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = Math.floor(rng() * 255);
      data.data[i] = v; data.data[i + 1] = v; data.data[i + 2] = v; data.data[i + 3] = 255;
    }
    nctx.putImageData(data, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'overlay';
  const pat = ctx.createPattern(noiseTile, 'repeat');
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function vignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(8,2,18,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Splits a title into one or two balanced lines. */
export function wrapTitle(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [text];
  if (ctx.measureText(text).width <= maxWidth) return [text];
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const wa = ctx.measureText(a).width, wb = ctx.measureText(b).width;
    if (wa > maxWidth || wb > maxWidth) continue;
    const diff = Math.abs(wa - wb);
    if (!best || diff < best.diff) best = { lines: [a, b], diff };
  }
  return best ? best.lines : [text];
}

function drawStar(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Poster lettering: gradient Anton title, neon Pacifico subtitle, ribbon, stars. */
function lettering(ctx, w, h, s) {
  const pad = w * 0.045;
  const bottom = h * 0.965;
  // Scrim so the title always reads over any photo.
  const scrim = ctx.createLinearGradient(0, h * 0.62, 0, h);
  scrim.addColorStop(0, 'rgba(10,4,24,0)');
  scrim.addColorStop(1, 'rgba(10,4,24,0.72)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);

  // Star meter, top-left.
  if (s.stars > 0) {
    const r = Math.max(10, w * 0.016);
    for (let i = 0; i < 5; i++) {
      drawStar(ctx, pad + r + i * r * 2.4, h * 0.055, r,
        i < s.stars ? '#ffd166' : 'rgba(255,255,255,0.28)');
    }
  }

  // Ribbon badge, top-right, tilted.
  if (s.badge.trim()) {
    ctx.save();
    const bw = w * 0.24, bh = h * 0.045;
    ctx.translate(w - pad - bw / 2, h * 0.055);
    ctx.rotate(-0.09);
    const bg = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
    bg.addColorStop(0, '#ff2e88'); bg.addColorStop(1, '#ff8a3d');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `${Math.round(bh * 0.52)}px Anton, 'Arial Narrow', sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.badge.trim().toUpperCase(), 0, bh * 0.03);
    ctx.restore();
  }

  // Subtitle in neon script, just above the title.
  const sub = s.subtitle.trim();
  const title = s.title.trim().toUpperCase() || 'COVER COAST';
  let size = Math.min(w * 0.115, h * 0.115);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const fitTitle = (sz) => {
    ctx.font = `${sz}px Anton, 'Arial Narrow', sans-serif`;
    return wrapTitle(ctx, title, w - pad * 2);
  };
  let lines = fitTitle(size);
  while (lines.some((l) => ctx.measureText(l).width > w - pad * 2) && size > 18) {
    size -= 4;
    lines = fitTitle(size);
  }
  const titleH = size * 1.02 * lines.length;
  const subSize = Math.max(18, w * 0.032);
  let y = bottom - titleH;
  if (sub) {
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.fillStyle = '#7df9ff';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = subSize * 0.55;
    ctx.fillText(sub, pad, y - subSize * 0.35);
    ctx.shadowBlur = 0;
  }
  // Title with a gold-to-pink gradient and a dark outline.
  const grad = ctx.createLinearGradient(0, y, 0, bottom);
  grad.addColorStop(0, '#ffe29a');
  grad.addColorStop(0.5, '#ffb347');
  grad.addColorStop(1, '#ff5e8a');
  ctx.font = `${size}px Anton, 'Arial Narrow', sans-serif`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(16,4,28,0.92)';
  ctx.lineWidth = Math.max(3, size * 0.07);
  ctx.fillStyle = grad;
  lines.forEach((line) => {
    ctx.strokeText(line, pad, y + size);
    ctx.fillText(line, pad, y + size);
    y += size * 1.02;
  });
}

/** Main entry: paint state `s` onto `canvas` (its width/height decide the output). */
export function drawCover(canvas, s, images) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const grade = GRADES[s.grade] || GRADES.sunset;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#14082a';
  ctx.fillRect(0, 0, w, h);

  const rects = layoutRects(s.layout, w, h);
  const photoAt = (i) => {
    const slot = s.panels[i];
    if (!slot) return null;
    return images.get(slot.photoId) || null;
  };

  if (s.layout === 'tilted') {
    // Dimmed backdrop first, then the polaroids on top.
    const back = photoAt(0);
    if (back) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      drawPhotoInto(ctx, back, { x: 0, y: 0, w, h }, 0, 0, 1);
      ctx.restore();
      ctx.fillStyle = 'rgba(10,4,24,0.45)';
      ctx.fillRect(0, 0, w, h);
    }
    rects.forEach((r, i) => {
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate(r.rot || 0);
      ctx.fillStyle = '#fdf6ec';
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = w * 0.02;
      ctx.shadowOffsetY = h * 0.008;
      const bw = w * 0.018;
      ctx.fillRect(-r.w / 2 - bw, -r.h / 2 - bw, r.w + bw * 2, r.h + bw * 2 + h * 0.055);
      ctx.shadowColor = 'transparent';
      ctx.beginPath();
      ctx.rect(-r.w / 2, -r.h / 2, r.w, r.h);
      ctx.clip();
      const slot = s.panels[i];
      const img = photoAt(i);
      if (img) drawPhotoInto(ctx, img, { x: -r.w / 2, y: -r.h / 2, w: r.w, h: r.h }, slot.ox, slot.oy, slot.zoom);
      gradeWash(ctx, { x: -r.w / 2, y: -r.h / 2, w: r.w, h: r.h }, grade, s.strength);
      ctx.restore();
    });
  } else {
    rects.forEach((r, i) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      const slot = s.panels[i];
      const img = photoAt(i);
      if (img) drawPhotoInto(ctx, img, r, slot.ox, slot.oy, slot.zoom);
      else {
        ctx.fillStyle = '#241243';
        ctx.fillRect(r.x, r.y, r.w, r.h);
      }
      gradeWash(ctx, r, grade, s.strength);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = Math.max(1, w * 0.002);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    });
  }

  // Deterministic effects, identical in preview and every export.
  if (s.effects.sunburst) sunburst(ctx, w, h, s.seed, 0.10);
  if (s.effects.halftone) halftone(ctx, w, h, s.seed, 0.16);
  if (s.effects.vignette) vignette(ctx, w, h);
  if (s.effects.grain) grain(ctx, w, h, s.seed, 0.10);

  lettering(ctx, w, h, s);
}
