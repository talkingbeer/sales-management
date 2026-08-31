/* CLOSER · tools/shots.js — 화면을 실제로 렌더해 PNG 로 저장한다.
 * 디자인 판단은 코드가 아니라 화면을 보고 해야 한다. jsdom 은 레이아웃을
 * 계산하지 않으므로 진짜 브라우저가 필요하다.
 *
 *   node tools/shots.js                      # 기본 세트
 *   node tools/shots.js app/tickets.html     # 특정 화면
 *   node tools/shots.js --width 390          # 모바일 폭
 *
 * 브라우저는 시스템에 설치된 Edge/Chrome 을 그대로 쓴다(내려받지 않음).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.shots');
const PORT = 4321;

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'
];
function findBrowser() {
  for (const p of CANDIDATES) { try { if (p && fs.existsSync(p)) return p; } catch (e) {} }
  return null;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
function serve() {
  return new Promise(resolve => {
    const s = http.createServer((req, res) => {
      let rel = decodeURIComponent(req.url.split('?')[0]);
      if (rel === '/') rel = '/index.html';
      const f = path.join(ROOT, rel.replace(/^[/\\]+/, ''));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    s.listen(PORT, () => resolve(s));
  });
}

const args = process.argv.slice(2);
const wIdx = args.indexOf('--width');
const WIDTH = wIdx > -1 ? Number(args[wIdx + 1]) : 1440;
const pages = args.filter(a => a.endsWith('.html'));
const TARGETS = pages.length ? pages : [
  'landing.html', 'app/dashboard.html', 'app/pipeline.html', 'app/opportunities.html',
  'app/accounts.html', 'app/insights.html', 'app/tickets.html', 'app/resources.html',
  'app/performance.html', 'app/design.html'
];

(async () => {
  const exe = findBrowser();
  if (!exe) { console.error('Chrome/Edge 를 찾지 못했습니다. 경로를 CANDIDATES 에 추가하세요.'); process.exit(1); }
  fs.mkdirSync(OUT, { recursive: true });
  const server = await serve();
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 1000 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const problems = [];

  for (const t of TARGETS) {
    await page.goto(`http://localhost:${PORT}/${t}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    /* 가로 스크롤은 반응형 실패의 가장 확실한 신호다 */
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) problems.push(`${t}: 가로 넘침 ${overflow}px`);

    /* 실제로 그려진 라운드가 있는지 — 토큰을 우회한 곳을 잡는다 */
    const rounded = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('*').forEach(n => {
        const r = getComputedStyle(n).borderRadius;
        if (!r || r === '0px') return;
        if (/9999px|999px|50%/.test(r)) return;            // 아바타·도트는 예외
        out.push((n.className && String(n.className).slice(0, 40)) + ' → ' + r);
      });
      return [...new Set(out)].slice(0, 6);
    });
    rounded.forEach(r => problems.push(`${t}: 라운드 잔여 ${r}`));

    /* 12px 미만으로 실제 렌더된 글자 */
    const tiny = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('body *').forEach(n => {
        if (!n.textContent.trim() || n.children.length) return;
        // 아바타 이니셜과 레일 아이콘은 읽는 글이 아니라 표식이다
        if (n.closest('.avatar, .app-rail__icon, .prio, .dot')) return;
        const fs = parseFloat(getComputedStyle(n).fontSize);
        if (fs && fs < 12) out.push(fs + 'px · ' + n.textContent.trim().slice(0, 26));
      });
      return [...new Set(out)].slice(0, 5);
    });
    tiny.forEach(x => problems.push(`${t}: 작은 글자 ${x}`));

    const name = t.replace(/[/\\]/g, '_').replace('.html', '') + `_${WIDTH}.png`;
    await page.screenshot({ path: path.join(OUT, name), fullPage: false });
    console.log('shot', name, overflow > 1 ? `(가로 넘침 ${overflow}px)` : '');
  }

  await browser.close();
  server.close();
  console.log('\n' + (problems.length ? '발견된 문제:\n  ' + problems.join('\n  ') : '문제 없음'));
})();
