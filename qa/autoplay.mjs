// 自动播放验收：注入脚本模拟 Safari 策略（无用户手势时拒绝有声 play()），验证
// 1) 静音起播 + 提示；2) 点父页任意处恢复声音；3) 点画面恢复声音且不暂停；4) 点提示恢复声音
// 另截手机端播放页，确认底部导航在
// 用法：BASE=https://example.com node autoplay.mjs；TYPE=2 指定取样影片的分类 ID
// 需要本机安装 Google Chrome，并先用 tools/patch-dplayer.php 给 dplayer.html 打补丁
import { chromium, webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = (process.env.BASE || '').replace(/\/$/, '');
if (!BASE) {
  console.error('请用环境变量 BASE 指定站点地址，例如：BASE=https://example.com node autoplay.mjs');
  process.exit(1);
}
mkdirSync('out/autoplay', { recursive: true });
const html = await (await fetch(`${BASE}/vodtype/${process.env.TYPE || 2}.html`)).text();
const id = (html.match(/\/voddetail\/(\d+)\.html/) || [])[1];
const url = `${BASE}/vodplay/${id}-1-1.html`;
console.log('url', url);

// Playwright 下 navigator.userActivation 一开始就是激活态，改为只认真实（isTrusted）的点击/按键
const MOCK = () => {
  const mark = (e) => { if (e.isTrusted) window.__gesture = true; };
  addEventListener('click', mark, true);
  addEventListener('keydown', mark, true);
  const gestured = () => { try { return !!(window.__gesture || window.parent.__gesture); } catch (e) { return !!window.__gesture; } };
  const orig = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (!this.muted && !gestured()) return Promise.reject(new DOMException('mock: 需要用户手势', 'NotAllowedError'));
    return orig.apply(this, arguments);
  };
};

const b = await chromium.launch({ channel: 'chrome' });
async function open() {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  await ctx.addInitScript(MOCK);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  const fr = await (await p.waitForSelector('.tv-player iframe[src*="dplayer.html"]', { timeout: 20000 })).contentFrame();
  const state = () => fr.evaluate(() => {
    const v = document.querySelector('video');
    return { t: +v.currentTime.toFixed(1), paused: v.paused, muted: v.muted, tip: !!document.getElementById('tvUnmute') };
  });
  let s;
  for (let i = 0; i < 30; i++) { await p.waitForTimeout(1000); s = await state(); if (s.t > 2) break; }
  return { ctx, p, fr, state, s, errs };
}
const after = async (o, label) => { await o.p.waitForTimeout(1500); console.log(label, await o.state()); };

let o = await open();
console.log('1 起播', o.s);
await o.p.screenshot({ path: 'out/autoplay/1_muted.png' });
await o.p.click('h2:has-text("相关推荐")');
await after(o, '2 点父页“相关推荐”标题后');
console.log('  url', o.p.url());
console.log('  errors', o.errs);
await o.ctx.close();

o = await open();
await o.fr.click('.dplayer-video-wrap', { position: { x: 600, y: 300 } });
await after(o, '3 点画面后');
await o.ctx.close();

o = await open();
await o.fr.click('#tvUnmute');
await after(o, '4 点提示后');
await o.ctx.close();
await b.close();

const w = await webkit.launch();
const m = await (await w.newContext({ ...devices['iPhone 13'], locale: 'zh-CN' })).newPage();
await m.goto(url, { waitUntil: 'domcontentloaded' });
await m.waitForTimeout(3000);
console.log('m tabbar', await m.locator('.tv-tabbar').isVisible());
await m.screenshot({ path: 'out/autoplay/m_play.png' });
await w.close();
