// Builds artifact/cybcell.html: the production build with CSS and JS inlined
// into one self-contained page (used for shareable previews).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist';
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/g, (_, file) =>
  `<style>\n${readFileSync(join(dist, file), 'utf8').replace(/url\((['\"]?)(?:\.\/)?([^)'\"]+\.woff2)\1\)/g, (_match, _quote, font) => `url(data:font/woff2;base64,${readFileSync(join(dist, 'assets', font)).toString('base64')})`)}\n</style>`,
);
html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/g, (_, file) =>
  `<script type="module">\n${readFileSync(join(dist, file), 'utf8').replace(/<\/script/g, '<\\/script')}\n</script>`,
);
html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<\/?html[^>]*>\s*/gi, '')
  .replace(/<\/?head>\s*/gi, '')
  .replace(/<\/?body>\s*/gi, '')
  .replace(/<meta charset="UTF-8" \/>\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<link rel="icon"[^>]*>\s*/i, '');

mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/cybcell.html', html);
console.log(`artifact/cybcell.html  ${(html.length / 1024).toFixed(1)} kB`);
