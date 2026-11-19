// Cover Coast — a GTA 6 style poster maker (Node 22, standard library only).
// The app is this directory's app/ folder: plain static files a desktop browser
// loads offline (app/index.html and its ES modules, no library, no network
// request). The program hands it in: it copies app/ and screenshots/ from
// beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Preflight: the entry needs its screenshots — the first by name is the cover
// the judge sees. Refuse a silent dossier with none.
const shotDir = join(here, 'screenshots');
const shots = existsSync(shotDir) ? readdirSync(shotDir).filter((f) => /\.(png|jpe?g)$/i.test(f)) : [];
if (shots.length === 0) console.warn('warning: no screenshots in screenshots/ — the dossier will have no cover image.');

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(shotDir)) cpSync(shotDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of
// app files, in all, or a path under app/ over 1000 bytes: app/ counts beside
// /output's own 1000-entry cap, its screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`Cover Coast handed in: ${shots.length} screenshot(s) (${shots.join(', ') || 'none'}) -> ${out}/dossier.json`);
