// Fixed scenes for screenshots: ?shot=cover shows the finished poster alone,
// ?shot=editor shows the full editor, ?shot=grid and ?shot=story show other
// layouts. window.__shotReady is set once the scene has painted.
import { drawCover } from './render.js';
import { panelsFor } from './state.js';

function ready() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      window.__shotReady = true;
      resolve();
    }));
  });
}

export async function runShot(shot, query, state, images, draw) {
  const caption = query.get('caption') ?? 'Sunset Heist';
  const photo = query.get('photo') ?? 'pier';
  const grade = query.get('grade');
  if (grade) state.grade = grade;
  state.title = caption;
  state.subtitle = query.get('subtitle') ?? 'welcome to leonida';
  state.badge = query.get('badge') ?? 'Vice City';

  const canvas = document.getElementById('cover');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    state.layout = query.get('layout') ?? 'full';
    state.panels = panelsFor(state.layout, [{ photoId: photo, ox: 0, oy: 0, zoom: 1 }], state.photos);
    canvas.width = 1080;
    canvas.height = 1080;
    drawCover(canvas, state, images);
    return ready();
  }
  if (shot === 'story') {
    document.body.classList.add('shot-cover');
    state.layout = 'stack';
    state.panels = panelsFor('stack', state.panels, state.photos);
    canvas.width = 540;
    canvas.height = 960;
    drawCover(canvas, state, images);
    return ready();
  }
  if (shot === 'grid') {
    state.layout = 'nine';
    state.panels = panelsFor('nine', state.panels, state.photos);
    draw();
    return ready();
  }
  // editor (default): full UI with a sample scene.
  state.layout = query.get('layout') ?? 'hero3';
  state.panels = panelsFor(state.layout, state.panels, state.photos);
  draw();
  return ready();
}
