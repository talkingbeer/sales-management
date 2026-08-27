/* CLOSER · ui.js — the interaction primitives every page shares.
 * Motion discipline: silent success, optimistic delete + Undo, focus-managed
 * dialogs, no celebratory toasts, no confirmation modal for reversible actions.
 */
(function (w) {
  'use strict';
  var C = w.CLOSER, U = C.util, el = U.el, esc = U.esc;
  var ui = {};

  /* ── Toast — failures, async results and undoable actions only ───── */
  function stack() {
    var s = document.querySelector('.toast-stack');
    if (!s) { s = el('div', { class: 'toast-stack', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(s); }
    return s;
  }
  ui.toast = function (msg, opt) {
    opt = opt || {};
    var node = el('div', { class: 'toast' + (opt.kind === 'neg' ? ' toast--neg' : '') }, [
      el('span', { class: 'grow', text: msg })
    ]);
    if (opt.undo) {
      var b = el('button', { class: 'toast__undo', type: 'button', text: '되돌리기' });
      b.addEventListener('click', function () { opt.undo(); close(); });
      node.appendChild(b);
    }
    stack().appendChild(node);
    var t = setTimeout(close, opt.ms || (opt.undo ? 8000 : 3600));
    function close() {
      clearTimeout(t);
      node.classList.add('is-out');
      setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 160);
    }
    return { close: close };
  };

  /* ── Dialog base — backdrop, focus trap, Esc, restore focus ──────── */
  function openLayer(inner, opt) {
    opt = opt || {};
    var prev = document.activeElement;
    var back = el('div', { class: 'backdrop' }, [inner]);
    back.addEventListener('mousedown', function (e) { if (e.target === back && opt.dismissible !== false) close(); });
    document.body.appendChild(back);
    document.body.style.overflow = 'hidden';

    function keys(e) {
      if (e.key === 'Escape' && opt.dismissible !== false) { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = U.qsa('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', inner)
        .filter(function (n) { return n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    back.addEventListener('keydown', keys);

    var auto = inner.querySelector('[data-autofocus]') || inner.querySelector('input,textarea,select,button');
    if (auto) auto.focus();

    function close() {
      if (!back.parentNode) return;
      back.parentNode.removeChild(back);
      document.body.style.overflow = '';
      if (prev && prev.focus) prev.focus();
      if (opt.onClose) opt.onClose();
    }
    return { close: close, root: inner, backdrop: back };
  }

  /**
   * ui.modal({ title, body, actions:[{label,kind,onClick,close}], size })
   * `body` may be an HTML string or a node. Returns { close, root }.
   */
  ui.modal = function (o) {
    var body = typeof o.body === 'string' ? el('div', { html: o.body }) : (o.body || el('div'));
    var foot = el('div', { class: 'modal__foot' });
    var box = el('div', {
      class: 'modal' + (o.size === 'wide' ? ' modal--wide' : o.size === 'full' ? ' modal--full' : ''),
      role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || '대화상자'
    }, [
      el('div', { class: 'modal__head' }, [
        el('h2', { class: 'modal__title', text: o.title || '' }),
        el('button', { class: 'btn btn--ghost btn--icon btn--sm', type: 'button', 'aria-label': '닫기', text: '✕' })
      ]),
      el('div', { class: 'modal__body' }, [body])
    ]);
    var layer = openLayer(box, { onClose: o.onClose, dismissible: o.dismissible });
    box.querySelector('.modal__head button').addEventListener('click', layer.close);

    (o.actions || []).forEach(function (a) {
      var b = el('button', {
        class: 'btn' + (a.kind === 'primary' ? ' btn--primary' : a.kind === 'danger' ? ' btn--danger' : ''),
        type: 'button', text: a.label
      });
      b.addEventListener('click', function () {
        var keep = a.onClick && a.onClick(layer, b);
        if (a.close !== false && keep !== false) layer.close();
      });
      foot.appendChild(b);
    });
    if (o.actions && o.actions.length) box.appendChild(foot);
    return layer;
  };

  /** Irreversible only. Reversible actions get optimistic delete + Undo instead. */
  ui.confirmDestructive = function (o) {
    var input = el('input', { class: 'input', 'data-autofocus': '', placeholder: o.phrase, autocomplete: 'off' });
    var body = el('div', { class: 'stack gap-sm' }, [
      el('p', { class: 't-body', text: o.message }),
      el('label', { class: 'field' }, [
        el('span', { class: 'field__label', html: '확인을 위해 <strong>' + esc(o.phrase) + '</strong> 을(를) 입력하세요' }),
        input
      ])
    ]);
    var layer = ui.modal({
      title: o.title, body: body,
      actions: [
        { label: '취소' },
        { label: o.confirmLabel || '삭제', kind: 'danger', onClick: function () {
            if (input.value.trim() !== o.phrase) {
              input.closest('.field').classList.add('is-invalid');
              ui.toast('입력한 값이 일치하지 않습니다.', { kind: 'neg' });
              return false;
            }
            o.onConfirm();
          } }
      ]
    });
    return layer;
  };

  /* ── Drawer — a record peek without leaving the list ──────────────── */
  ui.drawer = function (o) {
    var prev = document.activeElement;
    var body = typeof o.body === 'string' ? el('div', { class: 'panel__body', html: o.body }) : o.body;
    var box = el('aside', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || '패널' }, [
      el('div', { class: 'panel__head' }, [
        el('div', {}, [
          o.kicker ? el('div', { class: 't-mono', text: o.kicker }) : null,
          el('h2', { class: 'panel__title', text: o.title || '' })
        ]),
        el('button', { class: 'btn btn--ghost btn--icon btn--sm', type: 'button', 'aria-label': '닫기', text: '✕' })
      ]),
      el('div', { class: 'grow', style: 'overflow-y:auto' }, [body])
    ]);
    var scrim = el('div', { class: 'backdrop', style: 'padding:0;display:block' });
    scrim.appendChild(box);
    scrim.addEventListener('mousedown', function (e) { if (e.target === scrim) close(); });
    scrim.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.body.appendChild(scrim);
    box.querySelector('button').addEventListener('click', close);
    var auto = box.querySelector('button');
    if (auto) auto.focus();
    function close() {
      if (scrim.parentNode) scrim.parentNode.removeChild(scrim);
      if (prev && prev.focus) prev.focus();
    }
    return { close: close, root: box };
  };

  /* ── Menu — anchored popover, click-outside and Esc close ─────────── */
  ui.menu = function (anchor, items) {
    var existing = document.querySelector('.menu[data-live]');
    if (existing) existing.remove();
    var m = el('div', { class: 'menu', role: 'menu', 'data-live': '1' });
    items.forEach(function (it) {
      if (it === '-') { m.appendChild(el('div', { class: 'menu__sep' })); return; }
      if (it.label && !it.onClick) { m.appendChild(el('div', { class: 'menu__label', text: it.label })); return; }
      var b = el('button', { class: 'menu__item' + (it.danger ? ' menu__item--danger' : ''), type: 'button', role: 'menuitem' }, [
        it.icon ? el('span', { class: 't-mono', text: it.icon }) : null,
        el('span', { text: it.label })
      ]);
      b.addEventListener('click', function () { close(); it.onClick(); });
      m.appendChild(b);
    });
    var r = anchor.getBoundingClientRect();
    m.style.position = 'fixed';
    m.style.zIndex = 'var(--z-nav)';
    m.style.top = Math.min(r.bottom + 4, w.innerHeight - 20) + 'px';
    m.style.left = Math.max(8, Math.min(r.left, w.innerWidth - 210)) + 'px';
    document.body.appendChild(m);
    setTimeout(function () {
      document.addEventListener('mousedown', outside);
      document.addEventListener('keydown', keyed);
    }, 0);
    function outside(e) { if (!m.contains(e.target)) close(); }
    function keyed(e) { if (e.key === 'Escape') close(); }
    function close() {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', keyed);
      if (m.parentNode) m.parentNode.removeChild(m);
    }
    return { close: close };
  };

  /* ── Table — the list view renderer ──────────────────────────────────
     cols: [{ key, label, align, width, cell(row) → HTML string, sortable }]
     opt:  { rows, onRow(row), empty, sort:{key,dir}, selectable, onSort }     */
  ui.table = function (cols, rows, opt) {
    opt = opt || {};
    var t = el('table', { class: 'table' + (opt.compact ? ' table--compact' : '') });
    var thead = el('thead'), tr = el('tr');
    if (opt.selectable) tr.appendChild(el('th', { class: 'cell-tight', html: '<span class="sr-only">선택</span>' }));
    cols.forEach(function (c) {
      var th = el('th', {
        class: (c.sortable === false ? '' : 'is-sortable') + (c.align === 'right' ? ' cell-num' : ''),
        text: c.label, scope: 'col'
      });
      if (c.width) th.style.width = c.width;
      if (opt.sort && opt.sort.key === c.key) th.setAttribute('aria-sort', opt.sort.dir === 'desc' ? 'descending' : 'ascending');
      if (c.sortable !== false && opt.onSort) {
        th.tabIndex = 0;
        th.addEventListener('click', function () { opt.onSort(c.key); });
        th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.onSort(c.key); } });
      }
      tr.appendChild(th);
    });
    thead.appendChild(tr); t.appendChild(thead);

    var tbody = el('tbody');
    if (!rows.length) {
      tbody.appendChild(el('tr', {}, [
        el('td', { colspan: cols.length + (opt.selectable ? 1 : 0) }, [
          el('div', { class: 'empty' }, [
            el('p', { class: 'empty__title', text: (opt.empty && opt.empty.title) || '표시할 레코드가 없습니다' }),
            el('p', { class: 'empty__body', text: (opt.empty && opt.empty.body) || '필터를 넓히거나 새 레코드를 만들어 보세요.' })
          ])
        ])
      ]));
    }
    rows.forEach(function (row) {
      var r = el('tr', { class: opt.onRow ? 'is-row-link' : '' });
      if (opt.selectable) {
        r.appendChild(el('td', { class: 'cell-tight' }, [
          el('label', { class: 'check' }, [el('input', { type: 'checkbox', 'data-id': row.id, 'aria-label': '행 선택' })])
        ]));
      }
      cols.forEach(function (c) {
        var td = el('td', { class: (c.align === 'right' ? 'cell-num ' : '') + (c.tight ? 'cell-tight' : '') });
        var v = c.cell ? c.cell(row) : row[c.key];
        if (v && v.nodeType) td.appendChild(v); else td.innerHTML = v === undefined || v === null || v === '' ? '<span class="t-faint">—</span>' : v;
        r.appendChild(td);
      });
      if (opt.onRow) {
        r.tabIndex = 0;
        r.addEventListener('click', function (e) {
          if (e.target.closest('a,button,input,label')) return;
          opt.onRow(row);
        });
        r.addEventListener('keydown', function (e) { if (e.key === 'Enter') opt.onRow(row); });
      }
      tbody.appendChild(r);
    });
    t.appendChild(tbody);
    var wrapEl = el('div', { class: 'table-wrap' }, [t]);
    return wrapEl;
  };

  /* ── Small render helpers shared by every page ───────────────────── */
  ui.chip = function (text, kind) {
    return '<span class="chip' + (kind ? ' chip--' + kind : '') + '">' + esc(text) + '</span>';
  };
  ui.avatar = function (user, size) {
    if (!user) return '<span class="avatar' + (size ? ' avatar--' + size : '') + '">?</span>';
    return '<span class="avatar' + (size ? ' avatar--' + size : '') + '" title="' + esc(user.name) + '">' + esc(U.initials(user.name)) + '</span>';
  };
  ui.personCell = function (user) {
    if (!user) return '<span class="t-faint">미지정</span>';
    return '<span class="row gap-xs">' + ui.avatar(user, 'sm') + '<span>' + esc(user.name) + '</span></span>';
  };
  ui.meter = function (value, max, kind) {
    var p = max > 0 ? U.clamp((value / max) * 100, 0, 100) : 0;
    return '<div class="meter' + (kind ? ' meter--' + kind : '') + '"><div class="meter__fill" style="width:' + p.toFixed(1) + '%"></div></div>';
  };
  ui.delta = function (n, fmt) {
    if (n === null || n === undefined || isNaN(n)) return '<span class="t-faint">—</span>';
    var cls = n > 0 ? 't-pos' : n < 0 ? 't-neg' : 't-muted';
    var arrow = n > 0 ? '▲' : n < 0 ? '▼' : '·';
    return '<span class="' + cls + ' t-num">' + arrow + ' ' + (fmt ? fmt(Math.abs(n)) : U.num(Math.abs(n))) + '</span>';
  };
  ui.empty = function (title, body, actionHTML) {
    return '<div class="empty"><p class="empty__title">' + esc(title) + '</p>' +
      '<p class="empty__body">' + esc(body) + '</p>' +
      (actionHTML ? '<div class="empty__act">' + actionHTML + '</div>' : '') + '</div>';
  };
  ui.insight = function (o) {
    return '<article class="insight insight--' + esc(o.kind || 'act') + '">' +
      '<div class="insight__spine" aria-hidden="true"></div><div>' +
      '<p class="insight__kind">' + esc(o.label || '관찰') + '</p>' +
      '<p class="insight__say">' + o.say + '</p>' +
      (o.why ? '<p class="insight__why">' + o.why + '</p>' : '') +
      (o.actions ? '<div class="insight__do">' + o.actions + '</div>' : '') +
      '</div></article>';
  };

  /* ── CSV 내보내기 ─────────────────────────────────────────────────────
     Salesforce 리스트뷰의 Export에 해당. 엑셀이 한글을 깨뜨리지 않도록 BOM을
     붙이고, 로컬 파일에서도 동작하도록 Blob → data: URI 순으로 시도한다. */
  ui.exportCSV = function (filename, rows) {
    var body = rows.map(function (r) {
      return r.map(function (c) {
        var v = c === null || c === undefined ? '' : String(c);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',');
    }).join('\r\n');
    var text = '﻿' + body;
    var url;
    try { url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); }
    catch (e) { url = 'data:text/csv;charset=utf-8,' + encodeURIComponent(text); }
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a); a.click();
    setTimeout(function () {
      if (a.parentNode) a.parentNode.removeChild(a);
      if (url.slice(0, 5) === 'blob:') URL.revokeObjectURL(url);
    }, 400);
  };
  /** 화면에 보이는 표를 그대로 CSV로. 정렬·필터가 반영된 상태가 그대로 나간다. */
  ui.tableToCSV = function (tableEl, filename) {
    if (!tableEl) { ui.toast('내보낼 표가 이 화면에 없습니다.', { kind: 'neg' }); return; }
    var rows = U.qsa('tr', tableEl).map(function (tr) {
      return U.qsa('th,td', tr).map(function (c) {
        var input = c.querySelector('input,select');
        if (input) return input.value;
        return c.textContent.replace(/\s+/g, ' ').trim();
      });
    }).filter(function (r) { return r.join('').trim(); });
    if (!rows.length) { ui.toast('표에 내보낼 행이 없습니다.', { kind: 'neg' }); return; }
    ui.exportCSV(filename || 'closer-export.csv', rows);
  };

  /* ── 키보드 단축키 ─────────────────────────────────────────────────── */
  ui.SHORTCUTS = [
    ['⌘K / Ctrl+K', '명령 팔레트 — 레코드 검색과 화면 이동'],
    ['/', '명령 팔레트 (입력 중이 아닐 때)'],
    ['g 그리고 h', '홈으로'],
    ['g 그리고 p', '파이프라인'],
    ['g 그리고 a', '광고주'],
    ['g 그리고 t', '제작 의뢰'],
    ['g 그리고 r', '내 실적'],
    ['g 그리고 i', '인사이트'],
    ['e', '현재 목록을 CSV로 내보내기'],
    ['?', '이 단축키 목록'],
    ['Esc', '열려 있는 대화상자·팔레트 닫기']
  ];
  ui.shortcutsHelp = function () {
    return ui.modal({
      title: '키보드 단축키',
      body: '<div class="kv">' + ui.SHORTCUTS.map(function (s) {
        return '<div class="kv__row"><span class="kv__k">' + s[0].split(/\s+/).map(function (k) {
          return /^(그리고|\/)$/.test(k) ? '<span class="t-faint">' + esc(k) + '</span>' : '<span class="kbd">' + esc(k) + '</span>';
        }).join(' ') + '</span><span class="kv__v">' + esc(s[1]) + '</span></div>';
      }).join('') + '</div>' +
      '<p class="t-micro mt-md">한글 입력 중에는 단축키가 동작하지 않습니다. 입력을 마치고 눌러 주세요.</p>',
      actions: [{ label: '닫기', kind: 'primary' }]
    });
  };

  /** Tab strip wiring: panes are [data-pane="<key>"] siblings. */
  ui.tabs = function (root, onChange) {
    U.live(root, 'click', '.tab', function (e, t) {
      U.qsa('.tab', root).forEach(function (x) { x.setAttribute('aria-selected', String(x === t)); });
      var key = t.dataset.tab;
      U.qsa('[data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== key; });
      if (onChange) onChange(key);
    });
    U.live(root, 'keydown', '.tab', function (e, t) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var tabs = U.qsa('.tab', root), i = tabs.indexOf(t);
      var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus(); next.click();
    });
  };

  C.ui = ui;
})(window);
