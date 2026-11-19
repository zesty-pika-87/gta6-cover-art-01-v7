# Cover Coast — GTA 6 style poster maker

[![make.fun bounty](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/c/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/zesty-pika-87/gta6-cover-art-01-v7/rank.svg)](https://make.fun/c/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/zesty-pika-87/gta6-cover-art-01-v7/reward.svg)](https://make.fun/c/gta6-cover-art-01)

Turn any photo + caption into a GTA 6 style poster, then export it as a PNG.

## What it does

- **7 layouts** — Full Bleed, Four Panel, Hero + Three, Nine Panel, Mosaic Nine,
  Tilted Snapshots (tilted polaroids over a dimmed backdrop), Story Stack.
- **6 colour grades** — Vice Sunset, Neon Nights, Palm Dusk, Magenta Heat, Teal Noir,
  Golden Hour. Each is a five-stop gradient map blended over the photos, with a
  strength slider.
- **Photo handling** — 6 built-in sample photos (2 from the starter kit + 4 drawn
  procedurally for this entry) or add your own. Click a photo, then click a panel
  to place it; drag a panel to pan, scroll to zoom, shuffle to randomise.
- **Poster lettering** — Anton title with a gold-to-pink gradient (balanced two-line
  wrap), neon Pacifico subtitle, tilted ribbon badge, five-star meter.
- **Deterministic effects** — seeded film grain, vignette, halftone dots and
  sunburst rays. Identical in the preview and in every export.
- **Export PNG in 4 sizes** — Square 1080×1080, Portrait 1080×1350,
  Landscape 1920×1080, Story 1080×1920 — one at a time or all four at once.
  File names come from the title.
- **Undo / redo** — snapshot history up to 60 steps (buttons or Ctrl+Z / Ctrl+Y).
- **Offline fonts** — Anton and Pacifico ship as local woff2 files under
  `app/fonts/`; the app loads with no network at all.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## Submit locally

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `app/` and `screenshots/` into `out/` and writes `out/dossier.json`.

## Screenshots

`?shot=` scenes drive the contact sheet:

- `?shot=cover` — the finished poster alone (e.g. `?shot=cover&photo=pier&caption=Sunset%20Heist`)
- `?shot=editor` — the full editor
- `?shot=grid` — Nine Panel layout
- `?shot=story` — Story Stack, portrait poster

## Layout

- `app/index.html`, `app/style.css` — editor UI
- `app/src/render.js` — the poster renderer (layouts, grades, effects, lettering)
- `app/src/state.js` — poster state + undo/redo history
- `app/src/main.js` — editor wiring, pan/zoom, exports
- `app/src/shots.js` — fixed screenshot scenes
- `app/samples/` — 6 sample photos
- `app/fonts/` — Anton + Pacifico (woff2, offline)
- `main.ts` — entrypoint: copies the app and writes the dossier
- `serve.ts` — tiny static server for local development
- `shots.json` — screenshot list

## License

MIT — see [LICENSE](LICENSE).
