/**
 * Gom file tĩnh PWA vào dist/ để upload Cloudflare Pages.
 * Không đưa apps-script, docs, Python, node_modules lên CDN.
 */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const files = ['index.html', 'manifest.json', 'service-worker.js'];
for (const file of files) {
  await cp(join(root, file), join(dist, file));
}

for (const dir of ['css', 'js', 'data']) {
  await cp(join(root, dir), join(dist, dir), { recursive: true });
}

await mkdir(join(dist, 'icons'), { recursive: true });
for (const icon of [
  'icon.svg',
  'icon-192.png',
  'icon-512.png',
  'icon-192-maskable.png',
  'icon-512-maskable.png',
]) {
  await cp(join(root, 'icons', icon), join(dist, 'icons', icon));
}

await cp(join(root, 'public', '_headers'), join(dist, '_headers'));
await writeFile(join(dist, '.assetsignore'), 'Thumbs.db\n.DS_Store\n', 'utf8');

console.log('Built dist/ for Cloudflare Pages');
