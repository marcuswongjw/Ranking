#!/usr/bin/env node
/**
 * Copy the ranking SPA (repo root) into web/public/ranking-app
 * so SailorPath can host it at same origin: /ranking-app/
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'web', 'public', 'ranking-app');

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dest, ent.name);
    if (ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

rmrf(DEST);
fs.mkdirSync(DEST, { recursive: true });
fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(DEST, 'index.html'));
copyDir(path.join(ROOT, 'css'), path.join(DEST, 'css'));
copyDir(path.join(ROOT, 'js'), path.join(DEST, 'js'));
console.log('Synced ranking SPA → web/public/ranking-app/');
