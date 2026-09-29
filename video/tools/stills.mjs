// Renders single frames: node tools/stills.mjs OUTDIR t1 t2 ...
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [out, ...times] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('ERR', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
await p.goto('http://127.0.0.1:8766/index.html?render', { waitUntil: 'networkidle' });
await p.evaluate(() => window.ready);
for (const t of times) {
  const t0 = Date.now();
  await p.evaluate((t) => window.seek(Number(t)), t);
  await p.screenshot({ path: `${out}/s-${String(t).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 85 });
  console.log(t, Date.now() - t0, 'ms');
}
await b.close();
