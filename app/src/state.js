// Cover Coast state: the poster model plus undo/redo history (up to 60 steps).
// Photos live in a small library; panels point at library ids and carry their
// own pan/zoom, so shuffling or re-assigning never loses a photo's framing.

import { LAYOUTS } from './render.js';

export const SAMPLES = [
  { id: 'pier',      src: 'samples/pier.jpg',      name: 'Pier' },
  { id: 'boulevard', src: 'samples/boulevard.jpg', name: 'Boulevard' },
  { id: 'palms',     src: 'samples/palms.jpg',     name: 'Palms' },
  { id: 'neon',      src: 'samples/neon.jpg',      name: 'Neon Street' },
  { id: 'ocean',     src: 'samples/ocean.jpg',     name: 'Ocean Drive' },
  { id: 'skyline',   src: 'samples/skyline.jpg',   name: 'Skyline' },
];

/** A fresh poster: Hero + Three over the sunset grade, ready on first paint. */
export function defaultState() {
  return {
    layout: 'hero3',
    grade: 'sunset',
    strength: 0.7,
    title: 'Cover Coast',
    subtitle: 'welcome to leonida',
    badge: 'Vice City',
    stars: 5,
    seed: 7,
    effects: { sunburst: true, halftone: false, vignette: true, grain: true },
    photos: SAMPLES.map((s) => ({ ...s })),
    panels: [
      { photoId: 'pier', ox: 0, oy: 0, zoom: 1 },
      { photoId: 'boulevard', ox: 0, oy: 0, zoom: 1 },
      { photoId: 'palms', ox: 0, oy: 0, zoom: 1 },
      { photoId: 'neon', ox: 0, oy: 0, zoom: 1 },
    ],
  };
}

/** Panels for the current layout, keeping assignments where the count allows. */
export function panelsFor(layout, oldPanels, photos) {
  const n = LAYOUTS[layout].panels;
  const out = [];
  for (let i = 0; i < n; i++) {
    const old = oldPanels[i];
    const photoId = old?.photoId ?? photos[i % photos.length].id;
    out.push({ photoId, ox: old?.ox ?? 0, oy: old?.oy ?? 0, zoom: old?.zoom ?? 1 });
  }
  return out;
}

/** Plain snapshot for history (photos are plain data, images stay outside). */
export function snapshot(s) {
  return JSON.parse(JSON.stringify(s));
}

export class History {
  constructor() {
    this.past = [];
    this.future = [];
  }
  push(s) {
    this.past.push(snapshot(s));
    if (this.past.length > 60) this.past.shift();
    this.future.length = 0;
  }
  undo(current) {
    if (!this.past.length) return null;
    this.future.push(snapshot(current));
    return this.past.pop();
  }
  redo(current) {
    if (!this.future.length) return null;
    this.past.push(snapshot(current));
    return this.future.pop();
  }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}
