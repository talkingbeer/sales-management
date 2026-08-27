/* CLOSER · serve.js — a dependency-free static server.
 *
 *   node serve.js            → http://localhost:4173
 *   node serve.js 8080       → a different port
 *
 * Opening the site over http:// (rather than double-clicking the file) gives the
 * browser a real origin, so localStorage works and every edit you make in the
 * demo survives a reload. The site still runs from file:// — it just falls back
 * to in-memory state there.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (rel === '/') rel = '/index.html';

  // Never serve anything outside the project directory.
  const target = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!target.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 — 프로젝트 밖의 경로는 제공하지 않습니다.');
  }

  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end('<meta charset="utf-8"><p style="font-family:system-ui;padding:2rem">404 — ' +
        rel + ' 를 찾을 수 없습니다. <a href="/">홈으로</a></p>');
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(target).pipe(res);
  });
});

server.listen(PORT, () => {
  const url = 'http://localhost:' + PORT + '/';
  console.log('CLOSER 데모가 실행 중입니다 →  ' + url);
  console.log('중지하려면 Ctrl+C 를 누르세요.');
  const cmd = process.platform === 'win32' ? 'start ""' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  try { require('child_process').exec(cmd + ' ' + url); } catch (e) { /* 브라우저를 못 열면 위 주소를 직접 여세요 */ }
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(PORT + ' 포트가 이미 사용 중입니다.  node serve.js 8080  처럼 다른 포트를 지정하세요.');
    process.exit(1);
  }
  throw e;
});
