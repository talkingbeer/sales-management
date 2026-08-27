/* CLOSER · util.js — DOM, formatting and small helpers.
 * Classic script (no ES modules): the site must run from file:// by double-click.
 * Everything hangs off window.CLOSER.
 */
(function (w) {
  'use strict';
  var C = (w.CLOSER = w.CLOSER || {});

  /* ── DOM ─────────────────────────────────────────────────────────── */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function on(el, ev, fn, opt) { if (el) el.addEventListener(ev, fn, opt); return el; }

  /** Delegated listener — survives re-renders. */
  function live(root, ev, sel, fn) {
    on(root, ev, function (e) {
      var t = e.target.closest ? e.target.closest(sel) : null;
      if (t && root.contains(t)) fn.call(t, e, t);
    });
  }

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'dataset') Object.keys(v).forEach(function (d) { n.dataset[d] = v[d]; });
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (Array.isArray(kids) ? kids : kids ? [kids] : []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      n.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return n;
  }

  /** Escape for safe innerHTML interpolation. Every user/seed string goes through this. */
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function setHTML(node, html) { if (node) node.innerHTML = html; return node; }

  function debounce(fn, ms) {
    var t; return function () {
      var a = arguments, s = this;
      clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms || 180);
    };
  }

  /* ── Numbers & money ─────────────────────────────────────────────── */
  /** 원 단위 정수 → 사람이 읽는 한국식 축약. 12_340_000 → "1,234만" */
  function won(n, opt) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var o = opt || {};
    var neg = n < 0; var v = Math.abs(Math.round(n));
    var out;
    if (o.exact) out = v.toLocaleString('ko-KR');
    else if (v >= 100000000) out = trimZero(v / 100000000, 2) + '억';
    else if (v >= 10000) out = trimZero(v / 10000, v >= 1000000 ? 0 : 1) + '만';
    else out = v.toLocaleString('ko-KR');
    return (neg ? '−' : '') + out + (o.unit === false ? '' : '원');
  }
  function trimZero(x, d) {
    var s = x.toFixed(d);
    if (s.indexOf('.') > -1) s = s.replace(/\.?0+$/, '');
    return Number(s).toLocaleString('ko-KR');
  }
  function num(n, d) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  }
  function pct(n, d) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    return (Math.round(n * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toLocaleString('ko-KR') + '%';
  }
  function signed(n, fmt) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    var f = fmt || num;
    return (n > 0 ? '+' : n < 0 ? '−' : '') + f(Math.abs(n));
  }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function sum(arr, key) {
    return (arr || []).reduce(function (a, x) {
      var v = typeof key === 'function' ? key(x) : key ? x[key] : x;
      return a + (Number(v) || 0);
    }, 0);
  }
  function avg(arr, key) { return arr && arr.length ? sum(arr, key) / arr.length : 0; }

  /* ── Dates — the app's clock is fixed so the demo reads the same
        every time it is opened. CLOSER.today is the reference date. ── */
  function d(v) { return v instanceof Date ? new Date(v.getTime()) : new Date(v); }
  function iso(v) {
    var x = d(v);
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(v, style) {
    if (!v) return '—';
    var x = d(v);
    if (isNaN(x.getTime())) return '—';
    if (style === 'md') return (x.getMonth() + 1) + '/' + x.getDate();
    if (style === 'ym') return x.getFullYear() + '.' + pad(x.getMonth() + 1);
    if (style === 'long') return x.getFullYear() + '년 ' + (x.getMonth() + 1) + '월 ' + x.getDate() + '일';
    return x.getFullYear() + '.' + pad(x.getMonth() + 1) + '.' + pad(x.getDate());
  }
  function fmtDateTime(v) {
    if (!v) return '—';
    var x = d(v);
    return fmtDate(x) + ' ' + pad(x.getHours()) + ':' + pad(x.getMinutes());
  }
  function days(a, b) { return Math.round((d(b) - d(a)) / 86400000); }
  function addDays(v, n) { var x = d(v); x.setDate(x.getDate() + n); return x; }
  function ymOf(v) { var x = d(v); return x.getFullYear() + '-' + pad(x.getMonth() + 1); }
  function ago(v) {
    if (!v) return '—';
    var n = days(v, C.today);
    if (n === 0) return '오늘';
    if (n === 1) return '어제';
    if (n < 0) return Math.abs(n) + '일 후';
    if (n < 30) return n + '일 전';
    if (n < 365) return Math.floor(n / 30) + '개월 전';
    return Math.floor(n / 365) + '년 전';
  }
  function quarterOf(v) { var x = d(v); return x.getFullYear() + '-Q' + (Math.floor(x.getMonth() / 3) + 1); }

  /* ── Collections ─────────────────────────────────────────────────── */
  function groupBy(arr, key) {
    return (arr || []).reduce(function (m, x) {
      var k = typeof key === 'function' ? key(x) : x[key];
      (m[k] = m[k] || []).push(x); return m;
    }, {});
  }
  function sortBy(arr, key, dir) {
    var f = typeof key === 'function' ? key : function (x) { return x[key]; };
    var s = dir === 'desc' ? -1 : 1;
    return (arr || []).slice().sort(function (a, b) {
      var A = f(a), B = f(b);
      if (A === B) return 0;
      if (A === null || A === undefined) return 1;
      if (B === null || B === undefined) return -1;
      return (A > B ? 1 : -1) * s;
    });
  }
  function uniq(arr) { return arr.filter(function (x, i) { return arr.indexOf(x) === i; }); }
  function initials(name) {
    if (!name) return '?';
    var s = String(name).trim();
    return /[가-힣]/.test(s) ? s.slice(-2) : s.split(/\s+/).map(function (p) { return p[0]; }).join('').slice(0, 2);
  }
  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 46656).toString(36);
  }

  /* ── URL ─────────────────────────────────────────────────────────── */
  function param(k, fallback) {
    var m = new RegExp('[?&]' + k + '=([^&#]*)').exec(w.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : (fallback === undefined ? null : fallback);
  }

  /* ── Reveal — one orchestrated entrance, then the page settles ────── */
  function revealAll(root) {
    var nodes = qsa('.reveal', root || document);
    if (!nodes.length) return;
    if (!('IntersectionObserver' in w) || w.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach(function (n) { n.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  C.util = {
    qs: qs, qsa: qsa, on: on, live: live, el: el, esc: esc, setHTML: setHTML, debounce: debounce,
    won: won, num: num, pct: pct, signed: signed, clamp: clamp, sum: sum, avg: avg,
    iso: iso, fmtDate: fmtDate, fmtDateTime: fmtDateTime, days: days, addDays: addDays,
    ymOf: ymOf, ago: ago, quarterOf: quarterOf, date: d,
    groupBy: groupBy, sortBy: sortBy, uniq: uniq, initials: initials, uid: uid,
    param: param, revealAll: revealAll
  };
  /* Terse aliases used constantly in page code. */
  C.$ = qs; C.$$ = qsa; C.h = esc;
})(window);
