// Cover Coast editor — wires the controls, the preview canvas and the PNG
// exports. Preview and export share drawCover, so the file matches the screen.
import { drawCover, layoutRects, LAYOUTS, GRADES, SIZES } from './render.js';
import { defaultState, panelsFor, History, snapshot } from './state.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const statusEl = $('status');

// Surface page errors for automated checks.
window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message)));

let state = defaultState();
const history = new History();
const images = new Map(); // photo id -> HTMLImageElement
let pendingPhotoId = null; // library photo chosen, waiting for a panel click
let selectedPanel = 0;     // panel that drag / wheel edits
let exportSize = 'square';

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadLibrary() {
  for (const p of state.photos) {
    if (!images.has(p.id)) {
      try { images.set(p.id, await loadImage(p.src)); } catch { /* keep the slot empty */ }
    }
  }
}

function slug(s) {
  return (s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'cover-coast').replace(/^-+|-+$/g, '');
}

/** Preview canvas follows the chosen export aspect, capped at 720px. */
function fitPreview() {
  const size = SIZES[exportSize];
  const scale = Math.min(1, 720 / Math.max(size.w, size.h));
  canvas.width = Math.round(size.w * scale);
  canvas.height = Math.round(size.h * scale);
}

function draw() {
  fitPreview();
  drawCover(canvas, state, images);
  $('undo').disabled = !history.canUndo;
  $('redo').disabled = !history.canRedo;
}

function commit() {
  history.push(state);
  draw();
}

function setStatus(msg) { statusEl.textContent = msg; }

/** Which panel (if any) is under a canvas point, in canvas pixels. */
function panelAt(px, py) {
  const rects = layoutRects(state.layout, canvas.width, canvas.height);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (r.rot) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const dx = px - cx, dy = py - cy;
      const c = Math.cos(-r.rot), s = Math.sin(-r.rot);
      const lx = dx * c - dy * s, ly = dx * s + dy * c;
      if (Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2) return i;
    } else if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
      return i;
    }
  }
  return -1;
}

function renderPhotoStrip() {
  const strip = $('photos');
  strip.innerHTML = '';
  state.photos.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'thumb' + (pendingPhotoId === p.id ? ' pending' : '');
    b.title = p.name;
    const img = document.createElement('img');
    img.src = p.src;
    img.alt = p.name;
    b.appendChild(img);
    const cap = document.createElement('span');
    cap.textContent = p.name;
    b.appendChild(cap);
    b.addEventListener('click', () => {
      pendingPhotoId = pendingPhotoId === p.id ? null : p.id;
      renderPhotoStrip();
      setStatus(pendingPhotoId ? `${p.name} dipilih — klik panel untuk menaruhnya.` : 'Pilihan foto dibatalkan.');
    });
    strip.appendChild(b);
  });
}

function renderLayoutButtons() {
  const wrap = $('layouts');
  wrap.innerHTML = '';
  Object.entries(LAYOUTS).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (state.layout === key ? ' active' : '');
    b.textContent = def.label;
    b.addEventListener('click', () => {
      if (state.layout === key) return;
      history.push(state);
      state.layout = key;
      state.panels = panelsFor(key, state.panels, state.photos);
      selectedPanel = 0;
      renderLayoutButtons();
      draw();
    });
    wrap.appendChild(b);
  });
}

function renderGradeButtons() {
  const wrap = $('grades');
  wrap.innerHTML = '';
  Object.entries(GRADES).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (state.grade === key ? ' active' : '');
    b.title = def.label;
    b.style.background = `linear-gradient(135deg, ${def.stops.join(', ')})`;
    const cap = document.createElement('span');
    cap.textContent = def.label;
    b.appendChild(cap);
    b.addEventListener('click', () => {
      if (state.grade === key) return;
      history.push(state);
      state.grade = key;
      renderGradeButtons();
      draw();
    });
    wrap.appendChild(b);
  });
}

function renderSizeButtons() {
  const wrap = $('sizes');
  wrap.innerHTML = '';
  Object.entries(SIZES).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (exportSize === key ? ' active' : '');
    b.textContent = def.label;
    b.addEventListener('click', () => { exportSize = key; renderSizeButtons(); draw(); });
    wrap.appendChild(b);
  });
}

async function exportOne(key) {
  const size = SIZES[key];
  const off = document.createElement('canvas');
  off.width = size.w;
  off.height = size.h;
  drawCover(off, state, images);
  const name = `${slug(state.title)}-${size.w}x${size.h}.png`;
  await new Promise((resolve) => {
    off.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, 'image/png');
  });
  setStatus(`Tersimpan ${name}`);
}

async function exportAll() {
  for (const key of Object.keys(SIZES)) {
    // eslint-disable-next-line no-await-in-loop
    await exportOne(key);
  }
  setStatus('Keempat ukuran tersimpan.');
}

// --- canvas interaction: click to place, drag to pan, wheel to zoom --------
let dragging = null;
let dragSnapshot = null; // pre-drag state, pushed to history on first move
let lastWheelPush = 0;
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const i = panelAt(px, py);
  if (i === -1) return;
  if (pendingPhotoId) {
    history.push(state);
    state.panels[i] = { photoId: pendingPhotoId, ox: 0, oy: 0, zoom: 1 };
    pendingPhotoId = null;
    renderPhotoStrip();
    setStatus(`Foto ditaruh di panel ${i + 1}.`);
    draw();
    return;
  }
  selectedPanel = i;
  dragging = { x: px, y: py, ox: state.panels[i].ox, oy: state.panels[i].oy };
  dragSnapshot = JSON.parse(JSON.stringify(state));
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  if (dragSnapshot) { history.push(dragSnapshot); dragSnapshot = null; }
  const rect = canvas.getBoundingClientRect();
  const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
  const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
  const r = layoutRects(state.layout, canvas.width, canvas.height)[selectedPanel];
  const slot = state.panels[selectedPanel];
  slot.ox = Math.max(-0.6, Math.min(0.6, dragging.ox + (px - dragging.x) / r.w));
  slot.oy = Math.max(-0.6, Math.min(0.6, dragging.oy + (py - dragging.y) / r.h));
  draw();
});
canvas.addEventListener('pointerup', () => {
  if (dragging) { dragging = null; dragSnapshot = null; draw(); }
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const i = selectedPanel;
  if (!state.panels[i]) return;
  // One history entry per wheel burst, not one per tick.
  if (Date.now() - lastWheelPush > 600) { history.push(state); lastWheelPush = Date.now(); }
  const slot = state.panels[i];
  slot.zoom = Math.max(0.8, Math.min(3, slot.zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
  draw();
}, { passive: false });

// --- text + effect controls -------------------------------------------------
// History needs the PRE-edit snapshot: capture it on focus, push it on change.
function bindText(id, key) {
  let before = null;
  $(id).addEventListener('focus', () => { before = snapshot(state); });
  $(id).addEventListener('input', (e) => {
    if (!before) before = snapshot(state);
    state[key] = e.target.value;
    draw();
  });
  $(id).addEventListener('change', () => {
    if (before) { history.push(before); before = null; }
    draw();
  });
}
bindText('title', 'title');
bindText('subtitle', 'subtitle');
bindText('badge', 'badge');

let sliderBefore = null;
const captureSlider = () => { sliderBefore = snapshot(state); };
$('stars').addEventListener('focus', captureSlider);
$('stars').addEventListener('pointerdown', captureSlider);
$('strength').addEventListener('focus', captureSlider);
$('strength').addEventListener('pointerdown', captureSlider);
const pushSlider = () => {
  if (sliderBefore) { history.push(sliderBefore); sliderBefore = null; }
  draw();
};

$('stars').addEventListener('input', (e) => {
  if (!sliderBefore) sliderBefore = snapshot(state);
  state.stars = Number(e.target.value);
  $('starsOut').textContent = `${state.stars} / 5`;
  draw();
});
$('stars').addEventListener('change', pushSlider);

$('strength').addEventListener('input', (e) => {
  if (!sliderBefore) sliderBefore = snapshot(state);
  state.strength = Number(e.target.value) / 100;
  draw();
});
$('strength').addEventListener('change', pushSlider);

['sunburst', 'halftone', 'vignette', 'grain'].forEach((key) => {
  $(`fx-${key}`).addEventListener('change', (e) => {
    history.push(state);
    state.effects[key] = e.target.checked;
    draw();
  });
});

$('shuffle').addEventListener('click', () => {
  history.push(state);
  const ids = state.photos.map((p) => p.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  state.panels = state.panels.map((slot, i) => ({ ...slot, photoId: ids[i % ids.length], ox: 0, oy: 0, zoom: 1 }));
  draw();
  setStatus('Panel diacak.');
});

$('upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const id = `up-${Date.now()}`;
  const src = URL.createObjectURL(file);
  const img = await loadImage(src);
  images.set(id, img);
  state.photos.push({ id, src, name: file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'Upload' });
  pendingPhotoId = id;
  renderPhotoStrip();
  setStatus(`${file.name} ditambahkan — klik panel untuk menaruhnya.`);
  e.target.value = '';
});

$('undo').addEventListener('click', () => {
  const prev = history.undo(state);
  if (prev) { state = prev; renderLayoutButtons(); renderGradeButtons(); renderPhotoStrip(); draw(); }
});
$('redo').addEventListener('click', () => {
  const next = history.redo(state);
  if (next) { state = next; renderLayoutButtons(); renderGradeButtons(); renderPhotoStrip(); draw(); }
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    e.preventDefault(); $('undo').click();
  } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
    e.preventDefault(); $('redo').click();
  }
});

$('exportOne').addEventListener('click', () => exportOne(exportSize));
$('exportAll').addEventListener('click', exportAll);

// Test hook: lets automated checks render exports and read state.
window.__coverTest = {
  state: () => state,
  renderTo: (w, h) => {
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    drawCover(off, state, images);
    return off.toDataURL('image/png');
  },
};

// --- boot -------------------------------------------------------------------
const shot = new URLSearchParams(location.search).get('shot');
async function boot() {
  await Promise.all([
    document.fonts.load('80px Anton'),
    document.fonts.load('40px Pacifico'),
    document.fonts.ready,
  ]).catch(() => {});
  await loadLibrary();
  renderLayoutButtons();
  renderGradeButtons();
  renderSizeButtons();
  renderPhotoStrip();
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), state, images, draw);
    renderLayoutButtons();
    renderGradeButtons();
  } else {
    draw();
  }
  window.__shotReady = true;
}
boot();
