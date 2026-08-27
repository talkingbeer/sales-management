/* CLOSER · tools/role-check.js
 * Renders one page as several users (?as=<userId>) and prints what each role
 * actually sees. The permission story is only real if it survives this.
 *
 *   node tools/role-check.js app/dashboard.html u11 u14 u13 u02
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const page = process.argv[2] || 'app/dashboard.html';
const users = process.argv.slice(3);
const USERS = users.length ? users : ['u11', 'u14', 'u13', 'u02', 'u01'];

const file = path.join(ROOT, page);
const html = fs.readFileSync(file, 'utf8');
const base = 'file:///' + file.split(path.sep).join('/');

const LOCAL_ONLY = {
  interceptors: [requestInterceptor(r => (/^https?:/i.test(r.url) ? new Response('', { status: 204 }) : undefined))]
};

function stub(w) {
  w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  w.Element.prototype.scrollIntoView = function () {};
}

async function render(uid) {
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { const m = e.message || String(e); if (!/Could not load link|Could not load script: "https?:/.test(m)) errs.push(m); });
  vc.on('error', (...a) => errs.push(String(a[0])));
  const dom = new JSDOM(html, {
    url: base + '?as=' + uid,
    runScripts: 'dangerously', pretendToBeVisual: true,
    virtualConsole: vc, resources: LOCAL_ONLY, beforeParse: stub
  });
  await new Promise(r => setTimeout(r, 340));
  const doc = dom.window.document;
  const t = s => { const n = doc.querySelector(s); return n ? n.textContent.replace(/\s+/g, ' ').trim() : null; };
  const out = {
    user: uid,
    who: t('#hello') || t('h1'),
    actions: [...doc.querySelectorAll('#headActs a, .page-head__acts a, .page-head__acts button')].map(a => a.textContent.trim()),
    tiles: [...doc.querySelectorAll('.stat')].map(s => {
      const l = s.querySelector('.stat__label'), v = s.querySelector('.stat__value');
      return (l ? l.textContent.trim() : '?') + '=' + (v ? v.textContent.replace(/\s+/g, '') : '?');
    }),
    panelTitles: [...doc.querySelectorAll('.panel__title')].map(p => p.textContent.trim()),
    rows: doc.querySelectorAll('tbody tr').length,
    buttons: doc.querySelectorAll('button').length,
    errors: errs
  };
  dom.window.close();
  return out;
}

(async () => {
  console.log('page:', page, '\n');
  for (const u of USERS) {
    const r = await render(u);
    console.log('── ' + r.user + ' — ' + (r.who || '(렌더 실패)'));
    if (r.actions.length) console.log('   액션 : ' + r.actions.join(' | '));
    if (r.tiles.length) console.log('   타일 : ' + r.tiles.join(' | '));
    console.log('   패널 : ' + r.panelTitles.slice(0, 8).join(' / '));
    console.log('   행 ' + r.rows + ' · 버튼 ' + r.buttons);
    r.errors.slice(0, 3).forEach(e => console.log('   ✗ ' + e.slice(0, 160)));
    console.log('');
  }
})();
