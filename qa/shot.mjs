// 对主要页面做 PC / H5 截图，并记录控制台报错、失败请求与第三方域名请求
// 用法：BASE=https://example.com node shot.mjs [页面名...]（不传则跑全部）
// 环境变量：DEVICES=pc,m 控制设备；TYPES=2,1,3 依次为剧集、电影、综艺的分类 ID（maccms 默认分类就是这三个）
// 页面地址按开启伪静态（后台：系统 → URL 地址设置）后的格式书写
import { chromium, webkit, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = (process.env.BASE || '').replace(/\/$/, '');
if (!BASE) {
  console.error('请用环境变量 BASE 指定站点地址，例如：BASE=https://example.com node shot.mjs');
  process.exit(1);
}
const HOST = new URL(BASE).host;
// 影片 ID 随采集数据变化，从分类页取第一部作为样本
const firstId = async (typeId) => {
  const html = await (await fetch(`${BASE}/vodtype/${typeId}.html`)).text();
  const m = html.match(/\/voddetail\/(\d+)\.html/);
  if (!m) throw new Error(`分类 ${typeId} 没有影片`);
  return m[1];
};
const [tvType, movieType, showType] = (process.env.TYPES || '2,1,3').split(',');
const [tv, movie, show] = [await firstId(tvType), await firstId(movieType), await firstId(showType)];
const PAGES = {
  home: '/',
  type: `/vodtype/${tvType}.html`,
  type_show: `/vodtype/${showType}.html`,
  show: `/vodshow/${movieType}-----------.html`,
  search: '/vodsearch/-------------.html?wd=%E4%B9%8B',
  search_none: '/vodsearch/-------------.html?wd=zzzzqqq',
  detail: `/voddetail/${tv}.html`,
  detail_movie: `/voddetail/${movie}.html`,
  play: `/vodplay/${tv}-1-1.html`,
  play_show: `/vodplay/${show}-1-1.html`,
  rank: '/label/rank.html',
  login: '/user/login.html',
  reg: '/user/reg.html',
  uc: '/user/index.html',
  gbook: '/gbook.html',
  notfound: '/voddetail/99999999.html',
  fallback: '/art/index.html',
};
const DEVS = {
  pc: { engine: chromium, ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  m: { engine: webkit, ctx: { ...devices['iPhone 13'] } },
};

const want = process.argv.slice(2);
const names = want.length ? want : Object.keys(PAGES);
const devList = (process.env.DEVICES || 'pc,m').split(',');
const report = {};

for (const d of devList) {
  const { engine, ctx } = DEVS[d];
  const browser = await engine.launch();
  const context = await browser.newContext({ ...ctx, locale: 'zh-CN', ignoreHTTPSErrors: false });
  mkdirSync(`out/${d}`, { recursive: true });
  for (const name of names) {
    const page = await context.newPage();
    const errs = [];
    const bad = [];
    const third = new Set();
    page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); });
    page.on('pageerror', (e) => errs.push('pageerror: ' + String(e.message || e).slice(0, 300)));
    page.on('response', (r) => {
      const u = new URL(r.url());
      if (u.host === HOST && r.status() >= 400 && !r.url().includes('/voddetail/99999999')) bad.push(`${r.status()} ${u.pathname}`);
    });
    page.on('request', (r) => {
      try { const h = new URL(r.url()).host; if (h && h !== HOST) third.add(h); } catch {}
    });
    const t0 = Date.now();
    try {
      await page.goto(BASE + PAGES[name], { waitUntil: 'load', timeout: 45000 });
    } catch (e) {
      errs.push('goto: ' + e.message.slice(0, 200));
    }
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `out/${d}/${name}.png` });
    await page.screenshot({ path: `out/${d}/${name}-full.png`, fullPage: true });
    report[`${d}/${name}`] = { ms: Date.now() - t0, errs, bad, third: [...third] };
    await page.close();
  }
  await browser.close();
}
writeFileSync('out/report.json', JSON.stringify(report, null, 2));
for (const [k, v] of Object.entries(report)) {
  const flags = [v.errs.length && `errs=${v.errs.length}`, v.bad.length && `bad=${v.bad.join('|')}`, v.third.length && `third=${v.third.join(',')}`].filter(Boolean).join(' ');
  console.log(`${k.padEnd(20)} ${String(v.ms).padStart(6)}ms ${flags}`);
  v.errs.forEach((e) => console.log('    ' + e));
}
