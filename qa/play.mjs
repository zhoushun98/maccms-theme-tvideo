// 真实播放验证：等播放器 iframe 内 video.currentTime > 2，截取播放器区域
// 用法：BASE=https://example.com node play.mjs /vodplay/1-1-1.html
// 需要本机安装 Google Chrome（Playwright 自带的 Chromium 不含 H.264 解码）
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = (process.env.BASE || '').replace(/\/$/, '');
if (!BASE) {
  console.error('请用环境变量 BASE 指定站点地址，例如：BASE=https://example.com node play.mjs /vodplay/1-1-1.html');
  process.exit(1);
}
if (!process.argv[2]) {
  console.error('请传入播放页路径，例如：/vodplay/1-1-1.html');
  process.exit(1);
}
const url = BASE + process.argv[2];
mkdirSync('out', { recursive: true });
const b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const hosts = new Set();
p.on('request', (r) => hosts.add(new URL(r.url()).host));
await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
let t = 0;
for (let i = 0; i < 60 && t <= 2; i++) {
  await p.waitForTimeout(500);
  for (const f of p.frames()) {
    const v = await f.evaluate(() => {
      const el = document.querySelector('video');
      if (!el) return -1;
      if (el.paused) el.play().catch(() => {});
      return el.currentTime;
    }).catch(() => -1);
    if (v > t) t = v;
  }
}
await p.locator('.tv-player').screenshot({ path: 'out/playing.png' });
console.log(JSON.stringify({ url, currentTime: t, ok: t > 2, hosts: [...hosts], maccmsLa: [...hosts].some((h) => /maccms\.la$/.test(h)) }));
await b.close();
