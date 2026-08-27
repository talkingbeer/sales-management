/* CLOSER · tools/verify.js — headless check of every page.
 * Runs each HTML file in jsdom with its real scripts, then asserts the page
 * actually rendered: no thrown errors, no empty regions, no dead links, no
 * "undefined"/"NaN" leaking into the DOM.
 *
 *   node tools/verify.js            # all pages
 *   node tools/verify.js app/x.html # one page
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);

function listPages() {
  if (argv.length) return argv;
  const out = ['index.html'];
  fs.readdirSync(path.join(ROOT, 'app'))
    .filter(f => f.endsWith('.html')).sort()
    .forEach(f => out.push(path.join('app', f)));
  return out;
}

/** Block every non-local request; the pages must stand up without the network. */
const LOCAL_ONLY = {
  interceptors: [requestInterceptor(request => {
    if (/^https?:/i.test(request.url)) {
      return new Response('', { status: 204, headers: { 'Content-Type': 'text/css' } });
    }
  })]
};

function stub(window) {
  window.matchMedia = window.matchMedia || function (q) {
    return { matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} };
  };
  window.Element.prototype.scrollIntoView = function () {};
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = function (cb) {
      this.observe = function (el) { cb([{ isIntersecting: true, target: el }], this); };
      this.unobserve = function () {}; this.disconnect = function () {};
    };
  }
  // localStorage exists in jsdom; make sure a fresh page starts from seed
  try { window.localStorage.clear(); } catch (e) {}
}

const TEXT_SMELLS = [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /\bnull원\b/];

async function checkPage(rel) {
  const file = path.join(ROOT, rel);
  const errors = [], warns = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    const m = e.message || String(e);
    if (/Could not load link|Could not load script: "https?:/.test(m)) return; // 외부 폰트는 의도적으로 차단됨
    errors.push('JS: ' + m);
  });
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  vc.on('warn', (...a) => { if (!/Could not parse CSS|Error: Not implemented/.test(String(a[0]))) warns.push('console.warn: ' + a.join(' ')); });

  let dom;
  try {
    dom = await JSDOM.fromFile(file, {
      runScripts: 'dangerously',
      resources: LOCAL_ONLY,
      pretendToBeVisual: true,
      virtualConsole: vc,
      beforeParse: stub
    });
  } catch (e) {
    return { rel, errors: ['LOAD: ' + e.message], warns, stats: {} };
  }

  await new Promise(r => setTimeout(r, 260));
  const { window } = dom;
  const doc = window.document;

  /* the shell must have mounted */
  if (rel.startsWith('app') && !doc.querySelector('.app-rail')) errors.push('앱 셸(.app-rail)이 렌더되지 않음');
  if (rel.startsWith('app') && !doc.querySelector('.app-topbar')) errors.push('상단바(.app-topbar)가 렌더되지 않음');

  /* every region marked data-verify must have content */
  doc.querySelectorAll('[data-verify]').forEach(n => {
    if (!n.textContent.trim() && !n.children.length) errors.push('빈 영역: #' + (n.id || n.className));
  });

  /* panels that stayed empty are usually a rendering bug */
  doc.querySelectorAll('.panel__body, .app-page > section').forEach(n => {
    if (n.hidden || n.closest('[hidden]')) return;   // 탭 뒤에 접혀 있는 패널은 비어 있는 게 정상
    if (!n.textContent.trim() && !n.querySelector('svg,img,input,table')) {
      warns.push('빈 패널: ' + (n.id || n.parentElement && n.parentElement.querySelector('.panel__title') && n.parentElement.querySelector('.panel__title').textContent || n.className));
    }
  });

  /* dead local links */
  const dir = path.dirname(file);
  doc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    if (!href || /^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) return;
    const target = path.join(dir, href.split('?')[0].split('#')[0]);
    if (!fs.existsSync(target)) errors.push('깨진 링크: ' + href);
  });

  /* text smells — only what a reader actually sees, never script/style source */
  const visible = [...doc.body.querySelectorAll('*')]
    .filter(n => !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(n.tagName) && n.children.length === 0)
    .map(n => n.textContent)
    .join(' ');
  TEXT_SMELLS.forEach(re => {
    if (!re.test(visible)) return;
    const around = visible.match(new RegExp('.{0,40}' + re.source + '.{0,40}'));
    errors.push('텍스트 오염: ' + re.source + ' 노출 — “' + (around ? around[0].replace(/\s+/g, ' ').trim() : '') + '”');
  });

  /* duplicate ids */
  const ids = {};
  doc.querySelectorAll('[id]').forEach(n => { ids[n.id] = (ids[n.id] || 0) + 1; });
  Object.keys(ids).filter(k => ids[k] > 1).forEach(k => errors.push('중복 id: #' + k));

  /* a11y basics */
  doc.querySelectorAll('img').forEach(i => { if (!i.hasAttribute('alt')) errors.push('alt 없는 img: ' + i.getAttribute('src')); });
  let namelessBtn = 0;
  doc.querySelectorAll('button').forEach(b => {
    if (!b.textContent.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')) namelessBtn++;
  });
  if (namelessBtn) errors.push('이름 없는 버튼 ' + namelessBtn + '개');
  if (!doc.querySelector('h1')) warns.push('h1 없음');
  if (!doc.title) errors.push('title 없음');

  /* italic headers are banned by the design system */
  doc.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach(hn => {
    if (/font-style:\s*italic/i.test(hn.getAttribute('style') || '')) errors.push('이탤릭 제목: ' + hn.textContent.slice(0, 24));
    if (hn.querySelector('em:not([style*="normal"])')) warns.push('제목 안의 <em>: ' + hn.textContent.slice(0, 24));
  });

  /* inline colour values bypassing the token block */
  const html = fs.readFileSync(file, 'utf8');
  const inlineColor = html.match(/(?:^|[^-\w])(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|oklch\([^)]*\))/g) || [];
  const offenders = inlineColor.filter(m => !/var\(/.test(m));
  if (offenders.length) warns.push('토큰 밖 색상 값 ' + offenders.length + '개: ' + offenders.slice(0, 3).join(', '));

  const stats = {
    nodes: doc.querySelectorAll('*').length,
    links: doc.querySelectorAll('a[href]').length,
    tables: doc.querySelectorAll('table').length,
    charts: doc.querySelectorAll('svg.chart').length,
    interactive: doc.querySelectorAll('button,input,select,textarea').length
  };
  dom.window.close();
  return { rel, errors, warns, stats };
}

(async function () {
  const pages = listPages();
  let fail = 0, warnCount = 0;
  for (const p of pages) {
    if (!fs.existsSync(path.join(ROOT, p))) { console.log(`[33mSKIP[0m ${p} (없음)`); continue; }
    const r = await checkPage(p);
    const tag = r.errors.length ? '[31mFAIL[0m' : r.warns.length ? '[33mWARN[0m' : '[32m PASS[0m';
    console.log(`${tag} ${r.rel}  nodes=${r.stats.nodes || 0} links=${r.stats.links || 0} charts=${r.stats.charts || 0} ui=${r.stats.interactive || 0}`);
    r.errors.forEach(e => console.log('       ✗ ' + e));
    r.warns.slice(0, 6).forEach(e => console.log('       · ' + e));
    if (r.errors.length) fail++;
    warnCount += r.warns.length;
  }
  console.log(`\n${pages.length}개 페이지 · 실패 ${fail} · 경고 ${warnCount}`);
  process.exit(fail ? 1 : 0);
})();
