/* CLOSER · shell.js — the application chrome.
 * Renders the side rail, the topbar, the notification tray and a working ⌘K
 * command palette that searches real records and jumps to any screen.
 * Every app page includes this and calls CLOSER.shell.mount('<page-key>').
 */
(function (w) {
  'use strict';
  var C = w.CLOSER, U = C.util, db = C.db, ui = C.ui, el = U.el, esc = U.esc;

  /* ── Information architecture. One source of truth: the rail, the palette
        and the site map all read this. ────────────────────────────────── */
  var NAV = [
    { group: '영업', items: [
      { key: 'dashboard',     label: '홈',          icon: '◈', href: 'dashboard.html' },
      { key: 'pipeline',      label: '파이프라인',   icon: '▤', href: 'pipeline.html' },
      { key: 'opportunities', label: '영업기회',     icon: '◆', href: 'opportunities.html' },
      { key: 'accounts',      label: '광고주',       icon: '⬢', href: 'accounts.html' },
      { key: 'contacts',      label: '담당자',       icon: '◎', href: 'contacts.html' },
      { key: 'leads',         label: '리드',         icon: '✳', href: 'leads.html' }
    ] },
    { group: '실적·분석', items: [
      { key: 'performance', label: '내 실적',   icon: '▮', href: 'performance.html' },
      { key: 'forecast',    label: '매출 예측', icon: '◱', href: 'forecast.html' },
      { key: 'reports',     label: '리포트',    icon: '▦', href: 'reports.html' },
      { key: 'insights',    label: '인사이트',  icon: '✦', href: 'insights.html' }
    ] },
    { group: '거래', items: [
      { key: 'quotes',    label: '견적',      icon: '≡', href: 'quotes.html' },
      { key: 'contracts', label: '계약',      icon: '⌗', href: 'contracts.html' },
      { key: 'campaigns', label: '캠페인',    icon: '◐', href: 'campaigns.html' },
      { key: 'products',  label: '광고상품',  icon: '⊞', href: 'products.html' }
    ] },
    { group: '제작·리소스', items: [
      { key: 'tickets',   label: '제작 의뢰', icon: '⊚', href: 'tickets.html' },
      { key: 'resources', label: '공수 관리', icon: '⧉', href: 'resources.html' },
      { key: 'timesheet', label: '타임시트',  icon: '◷', href: 'timesheet.html' }
    ] },
    { group: '공통', items: [
      { key: 'activities', label: '활동',      icon: '◇', href: 'activities.html' },
      { key: 'approvals',  label: '승인함',    icon: '⊙', href: 'approvals.html' },
      { key: 'admin',      label: '설정·관리', icon: '⚙', href: 'admin.html' },
      { key: 'design',     label: '디자인 시스템', icon: '◧', href: 'design.html' }
    ] }
  ];

  function flatNav() {
    return NAV.reduce(function (a, g) { return a.concat(g.items.map(function (i) { return Object.assign({ group: g.group }, i); })); }, []);
  }

  /* ── Live counters shown against rail items ──────────────────────── */
  function counterFor(key) {
    var meId = db.me() && db.me().id;
    if (key === 'approvals') return db.where('approvals', function (a) { return a.status === '대기' && a.approverId === meId; }).length;
    if (key === 'tickets') return db.where('tickets', function (t) { return t.assigneeId === meId && t.status !== '완료' && t.status !== '취소'; }).length;
    if (key === 'activities') return db.where('activities', function (a) { return a.ownerId === meId && a.status !== '완료' && U.days(a.dueDate, C.today) >= 0; }).length;
    return 0;
  }

  /* ── Rail ────────────────────────────────────────────────────────── */
  function renderRail(active) {
    var rail = el('nav', { class: 'app-rail', id: 'appRail', 'aria-label': '주 메뉴' });
    rail.appendChild(el('a', { class: 'app-rail__brand', href: '../index.html', 'aria-label': 'CLOSER 홈' }, [
      el('span', { class: 'brand-mark', 'aria-hidden': 'true' }),
      el('span', { class: 'brand-word', html: 'CLOS<em>E</em>R' })
    ]));
    NAV.forEach(function (g) {
      var box = el('div', { class: 'app-rail__group' }, [el('p', { class: 'app-rail__label', text: g.group })]);
      g.items.forEach(function (it) {
        var n = counterFor(it.key);
        var a = el('a', { class: 'app-rail__link', href: db.linkAs(it.href) }, [
          el('span', { class: 'app-rail__icon', 'aria-hidden': 'true', text: it.icon }),
          el('span', { text: it.label }),
          n ? el('span', { class: 'app-rail__count', text: String(n) }) : null
        ]);
        if (it.key === active) a.setAttribute('aria-current', 'page');
        box.appendChild(a);
      });
      rail.appendChild(box);
    });
    var u = db.me();
    rail.appendChild(el('div', { class: 'app-rail__foot' }, [
      el('button', { class: 'app-rail__link', type: 'button', id: 'userSwitch', style: 'width:100%' }, [
        el('span', { class: 'avatar avatar--sm', text: U.initials(u && u.name) }),
        el('span', { class: 'grow', style: 'min-width:0;text-align:left' }, [
          el('span', { style: 'display:block;line-height:1.2', text: (u && u.name) || '—' }),
          el('span', { class: 't-mono', style: 'display:block;font-size:var(--text-2xs)', text: (u && u.role) || '' })
        ]),
        el('span', { class: 'app-rail__icon', text: '⇅' })
      ])
    ]));
    return rail;
  }

  /* ── Topbar ──────────────────────────────────────────────────────── */
  function renderTopbar(pageTitle) {
    var unread = db.unreadCount();
    return el('header', { class: 'app-topbar' }, [
      el('button', { class: 'btn btn--ghost btn--icon btn--sm rail-toggle', type: 'button', id: 'railToggle', 'aria-label': '메뉴 열기', text: '☰' }),
      el('button', { class: 'omni', type: 'button', id: 'omni', 'aria-label': '검색 및 명령 팔레트 열기' }, [
        el('span', { class: 't-mono', style: 'font-size:var(--text-xs)', text: '⌕' }),
        el('span', { class: 'grow', style: 'text-align:left', text: '광고주 · 영업기회 · 티켓 검색, 또는 명령 실행' }),
        el('span', { class: 'omni__hint' }, [el('span', { class: 'kbd', text: '⌘' }), el('span', { class: 'kbd', text: 'K' })])
      ]),
      el('div', { class: 'grow' }),
      el('button', { class: 'btn btn--ghost btn--sm', type: 'button', id: 'bell', 'aria-label': '알림 ' + unread + '건' }, [
        el('span', { text: '알림' }),
        unread ? el('span', { class: 'chip chip--accent', text: String(unread) }) : null
      ]),
      el('a', { class: 'btn btn--sm', href: db.linkAs('activities.html'), text: '오늘 할 일' })
    ]);
  }

  /* ── ⌘K palette — records + commands, arrow-driven ───────────────── */
  function paletteRows(q) {
    var rows = [], term = q.trim().toLowerCase();
    function push(kind, label, meta, go) {
      rows.push({ kind: kind, label: label, meta: meta || '', go: go });
    }
    flatNav().forEach(function (n) {
      if (!term || n.label.toLowerCase().indexOf(term) > -1 || n.group.toLowerCase().indexOf(term) > -1) {
        push('이동', n.label, n.group, function () { w.location.href = db.linkAs(n.href); });
      }
    });
    if (term.length >= 1) {
      db.all('accounts').filter(function (a) { return a.name.toLowerCase().indexOf(term) > -1; }).slice(0, 6).forEach(function (a) {
        push('광고주', a.name, a.industry, function () { w.location.href = db.linkAs('account.html?id=' + encodeURIComponent(a.id)); });
      });
      db.all('opportunities').filter(function (o) { return o.name.toLowerCase().indexOf(term) > -1; }).slice(0, 6).forEach(function (o) {
        push('영업기회', o.name, o.stage + ' · ' + U.won(o.amount), function () { w.location.href = db.linkAs('opportunity.html?id=' + encodeURIComponent(o.id)); });
      });
      db.all('tickets').filter(function (t) {
        return t.title.toLowerCase().indexOf(term) > -1 || String(t.key).toLowerCase().indexOf(term) > -1;
      }).slice(0, 6).forEach(function (t) {
        push('티켓', t.key + ' · ' + t.title, t.status, function () { w.location.href = db.linkAs('ticket.html?id=' + encodeURIComponent(t.id)); });
      });
      db.all('contacts').filter(function (c) { return c.name.toLowerCase().indexOf(term) > -1; }).slice(0, 4).forEach(function (c) {
        var acc = db.get('accounts', c.accountId);
        push('담당자', c.name, (acc ? acc.name + ' · ' : '') + (c.title || ''), function () { w.location.href = db.linkAs('contacts.html?focus=' + encodeURIComponent(c.id)); });
      });
    }
    /* 전역 액션 — Salesforce의 Global Actions에 해당한다.
       화면마다 버튼을 심는 대신 팔레트 한 곳에 모았다. */
    push('명령', '이 목록을 CSV로 내보내기', '화면에 보이는 표를 그대로', function () {
      ui.tableToCSV(document.querySelector('.table'), 'closer-' + (document.title.split(' ·')[0] || 'list') + '.csv');
    });
    push('명령', '이 화면 인쇄', '레일과 상단바는 인쇄되지 않습니다', function () { w.print(); });
    push('명령', '휴지통 열기', db.trashList().length + '건 보관 중', openTrash);
    push('명령', '광고주 중복 찾기', db.findDuplicates('accounts').length + '개 후보 묶음', function () { openDupes('accounts'); });
    push('명령', '리드 중복 찾기', db.findDuplicates('leads').length + '개 후보 묶음', function () { openDupes('leads'); });
    push('명령', '키보드 단축키', '? 키로도 열립니다', function () { ui.shortcutsHelp(); });
    push('명령', '데모 데이터 초기화', '시드 상태로 되돌립니다', function () {
      db.reset(); ui.toast('데모 데이터를 초기 상태로 되돌렸습니다.'); setTimeout(function () { w.location.reload(); }, 400);
    });
    return rows.slice(0, 40);
  }

  function openPalette() {
    var input = el('input', { class: 'palette__input', placeholder: '무엇을 찾으시나요?', 'data-autofocus': '', 'aria-label': '검색', autocomplete: 'off' });
    var list = el('div', { class: 'palette__list', role: 'listbox' });
    var box = el('div', { class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': '명령 팔레트' }, [
      input, list,
      el('div', { class: 'palette__foot' }, [
        el('span', {}, [el('span', { class: 'kbd', text: '↑↓' }), el('span', { text: ' 이동' })]),
        el('span', {}, [el('span', { class: 'kbd', text: '↵' }), el('span', { text: ' 열기' })]),
        el('span', {}, [el('span', { class: 'kbd', text: 'esc' }), el('span', { text: ' 닫기' })])
      ])
    ]);
    var idx = 0, rows = [];
    function paint() {
      rows = paletteRows(input.value);
      idx = Math.min(idx, Math.max(0, rows.length - 1));
      list.innerHTML = '';
      if (!rows.length) { list.appendChild(el('p', { class: 'empty__body', style: 'padding:24px', text: '일치하는 항목이 없습니다.' })); return; }
      rows.forEach(function (r, i) {
        var b = el('button', { class: 'palette__row' + (i === idx ? ' is-active' : ''), type: 'button', role: 'option' }, [
          el('span', { class: 'palette__kind', text: r.kind }),
          el('span', { class: 'grow', text: r.label }),
          r.meta ? el('span', { class: 'palette__meta', text: r.meta }) : null
        ]);
        b.addEventListener('click', function () { layer.close(); r.go(); });
        list.appendChild(b);
      });
    }
    input.addEventListener('input', U.debounce(function () { idx = 0; paint(); }, 90));
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, rows.length - 1); paint(); scrollIn(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); paint(); scrollIn(); }
      else if (e.key === 'Enter' && rows[idx]) { e.preventDefault(); layer.close(); rows[idx].go(); }
    });
    function scrollIn() {
      var n = list.children[idx];
      if (n && n.scrollIntoView) n.scrollIntoView({ block: 'nearest' });
    }
    paint();
    var layer = openBare(box);
    return layer;
  }

  function openBare(inner) {
    var prev = document.activeElement;
    var back = el('div', { class: 'backdrop', style: 'align-items:flex-start;padding-top:12vh' }, [inner]);
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    back.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    document.body.appendChild(back);
    var a = inner.querySelector('[data-autofocus]'); if (a) a.focus();
    function close() {
      if (back.parentNode) back.parentNode.removeChild(back);
      if (prev && prev.focus) prev.focus();
    }
    return { close: close };
  }

  /* ── Notification tray ───────────────────────────────────────────── */
  function openBell(anchor) {
    var meId = db.me() && db.me().id;
    var list = U.sortBy(db.where('notifications', function (n) { return n.userId === meId; }), 'at', 'desc').slice(0, 12);
    var body = el('div', { class: 'stack' });
    if (!list.length) body.innerHTML = ui.empty('알림이 없습니다', '승인 요청, 티켓 배정, 단계 변경이 여기에 쌓입니다.');
    list.forEach(function (n) {
      var a = el('a', { class: 'menu__item', href: n.link || '#', style: 'align-items:flex-start' }, [
        el('span', { class: 'dot ' + (n.read ? '' : 'dot--accent'), style: 'margin-top:6px' }),
        el('span', { class: 'grow' }, [
          el('span', { style: 'display:block;font-size:var(--text-sm)', text: n.text }),
          el('span', { class: 't-mono', style: 'font-size:var(--text-2xs)', text: U.ago(n.at) })
        ])
      ]);
      body.appendChild(a);
    });
    var d = ui.drawer({ kicker: '알림', title: '내 알림', body: el('div', { class: 'panel__body' }, [body]) });
    db.markAllRead();
    return d;
  }

  /* ── 휴지통 — 삭제는 되돌릴 수 있어야 한다 ───────────────────────── */
  function openTrash() {
    var body = el('div', { class: 'panel__body' });
    function paint() {
      var list = db.trashList();
      if (!list.length) { body.innerHTML = ui.empty('휴지통이 비어 있습니다', '삭제한 레코드는 여기에 보관되며 언제든 되살릴 수 있습니다.'); return; }
      body.innerHTML = '';
      body.appendChild(el('div', { class: 'row row--between mb-sm' }, [
        el('span', { class: 't-mono', text: list.length + '건 보관 중' }),
        el('button', { class: 'btn btn--sm btn--danger', type: 'button', text: '휴지통 비우기', onclick: function () {
          ui.confirmDestructive({
            title: '휴지통 비우기', phrase: '비우기', confirmLabel: '영구 삭제',
            message: list.length + '건이 영구히 삭제됩니다. 이 동작은 되돌릴 수 없습니다.',
            onConfirm: function () { var n = db.emptyTrash(); ui.toast(n + '건을 영구 삭제했습니다.'); paint(); }
          });
        } })
      ]));
      list.forEach(function (t) {
        body.appendChild(el('div', { class: 'row gap-sm', style: 'padding:var(--space-xs) 0;border-bottom:1px solid var(--color-rule)' }, [
          el('span', { class: 'chip', text: t.entity }),
          el('span', { class: 'grow', style: 'min-width:0', text: t.label || t.record.id }),
          el('span', { class: 't-mono', style: 'font-size:var(--text-2xs)', text: U.ago(t.at) }),
          el('button', { class: 'btn btn--sm', type: 'button', text: '복원', onclick: function () {
            db.untrash(t.id); ui.toast('복원했습니다. 화면을 새로 고치면 반영됩니다.'); paint();
          } })
        ]));
      });
    }
    paint();
    return ui.drawer({ kicker: '휴지통', title: '삭제한 레코드', body: body });
  }

  /* ══ 중복 찾기와 병합 ═══════════════════════════════════════════════
     Salesforce의 Duplicate Rules + Merge Records. 상호 표기가 갈린 광고주와
     같은 회사가 두 번 들어온 리드를 찾아 하나로 합친다. */
  var MERGE_LABELS = {
    name: '이름', company: '회사', industry: '산업', tier: '등급', ownerId: '담당자',
    website: '웹사이트', phone: '전화', email: '이메일', address: '주소',
    employees: '임직원 수', annualBudget: '연간 예산', status: '상태', title: '직함',
    source: '유입 경로', score: '점수', estBudget: '예상 예산',
    firstDealDate: '최초 거래일', lastActivityDate: '최근 활동', memo: '메모'
  };
  var MERGE_SKIP = { id: 1, createdAt: 1, updatedAt: 1, parentId: 1, convertedOppId: 1 };

  function openDupes(entity) {
    var label = entity === 'accounts' ? '광고주' : '리드';
    var groups = db.findDuplicates(entity);
    var body = el('div', { class: 'panel__body' });
    function paint() {
      groups = db.findDuplicates(entity);
      body.innerHTML = '';
      if (!groups.length) {
        body.innerHTML = ui.empty('중복 후보가 없습니다', label + ' 상호와 도메인을 정규화해 비교했지만 겹치는 건이 없습니다.');
        return;
      }
      body.appendChild(el('p', { class: 't-micro mb-md', text:
        '상호에서 공백·(주)·법인 접미어를 걷어내고, 웹사이트·이메일 도메인을 함께 비교했습니다. ' +
        '병합은 되돌릴 수 없지만, 합쳐진 레코드는 휴지통에 남습니다.' }));
      groups.forEach(function (g) {
        var box = el('div', { style: 'padding:var(--space-sm) 0;border-bottom:1px solid var(--color-rule)' }, [
          el('p', { class: 't-mono', text: g.reason }),
          el('p', { class: 't-body mt-2xs', text: g.records.map(function (r) { return r.name || r.company; }).join('  ·  ') }),
          el('div', { class: 'row gap-xs mt-xs' }, [
            el('button', { class: 'btn btn--sm btn--primary', type: 'button', text: '병합 검토', onclick: function () {
              openMerge(entity, g.records, paint);
            } })
          ])
        ]);
        body.appendChild(box);
      });
    }
    paint();
    return ui.drawer({ kicker: '중복 관리', title: label + ' 중복 후보', body: body });
  }

  function openMerge(entity, records, onDone) {
    var keys = [];
    records.forEach(function (r) {
      Object.keys(r).forEach(function (k) {
        if (MERGE_SKIP[k] || typeof r[k] === 'object') return;
        if (keys.indexOf(k) === -1) keys.push(k);
      });
    });
    var masterId = records[0].id;
    var choice = {};
    keys.forEach(function (k) { choice[k] = records[0][k]; });

    var form = el('div');
    function show(v, k) {
      if (v === null || v === undefined || v === '') return '(없음)';
      if (k === 'ownerId') return db.userName(v);
      if (typeof v === 'number' && v > 100000) return U.won(v);
      return String(v);
    }
    function paint() {
      form.innerHTML = '';
      form.appendChild(el('div', { class: 'row gap-sm mb-md row--wrap' }, [
        el('span', { class: 't-mono', text: '남길 레코드' })
      ].concat(records.map(function (r) {
        return el('label', { class: 'check' }, [
          el('input', { type: 'radio', name: 'master', checked: r.id === masterId, onchange: function () {
            masterId = r.id;
            keys.forEach(function (k) { choice[k] = r[k]; });
            paint();
          } }),
          el('span', { text: r.name || r.company })
        ]);
      }))));
      var table = el('table', { class: 'table table--compact' });
      var head = el('tr', {}, [el('th', { text: '필드', scope: 'col' })].concat(
        records.map(function (r) { return el('th', { text: (r.name || r.company) + (r.id === masterId ? ' (남김)' : ''), scope: 'col' }); })
      ));
      table.appendChild(el('thead', {}, [head]));
      var tb = el('tbody');
      keys.forEach(function (k) {
        var vals = records.map(function (r) { return r[k]; });
        var same = vals.every(function (v) { return String(v) === String(vals[0]); });
        var tr = el('tr', {}, [el('td', {}, [el('span', { class: 'kv__k', text: MERGE_LABELS[k] || k })])]);
        records.forEach(function (r) {
          var td = el('td');
          if (same) td.appendChild(el('span', { class: 't-muted', text: show(r[k], k) }));
          else td.appendChild(el('label', { class: 'check' }, [
            el('input', { type: 'radio', name: 'f_' + k, checked: String(choice[k]) === String(r[k]),
              onchange: function () { choice[k] = r[k]; } }),
            el('span', { text: show(r[k], k) })
          ]));
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      form.appendChild(el('div', { class: 'table-wrap' }, [table]));
      var kids = records.filter(function (r) { return r.id !== masterId; }).length;
      form.appendChild(el('p', { class: 't-micro mt-sm', text:
        '병합하면 남기지 않은 ' + kids + '건의 자식 레코드(담당자·영업기회·캠페인·계약·티켓·활동)가 남길 레코드로 옮겨지고, ' +
        '원본은 휴지통으로 이동합니다. 감사 로그에 기록됩니다.' }));
    }
    paint();

    return ui.modal({
      title: '레코드 병합', size: 'wide', body: form,
      actions: [
        { label: '취소' },
        { label: '병합 실행', kind: 'danger', onClick: function () {
            var losers = records.filter(function (r) { return r.id !== masterId; }).map(function (r) { return r.id; });
            var res = db.merge(entity, masterId, losers, choice);
            ui.toast(losers.length + '건을 병합했습니다. 자식 레코드 ' + (res ? res.moved : 0) + '건이 이관됐습니다.');
            if (onDone) onDone();
          } }
      ]
    });
  }

  /* ── User switcher — proves the permission matrix is real ─────────── */
  function openUserSwitch(anchor) {
    var items = [{ label: '역할 전환 (데모)' }];
    db.all('users').filter(function (u) { return u.active !== false; }).slice(0, 9).forEach(function (u) {
      items.push({
        icon: db.me() && db.me().id === u.id ? '●' : '○',
        label: u.name + ' · ' + u.role,
        onClick: function () { if (db.switchUser(u.id) !== false) w.location.reload(); }
      });
    });
    items.push('-');
    items.push({ icon: '↺', label: '데모 데이터 초기화', danger: true, onClick: function () {
      db.reset(); setTimeout(function () { w.location.reload(); }, 200);
    } });
    return ui.menu(anchor, items);
  }

  /* ── Mount ───────────────────────────────────────────────────────── */
  function mount(activeKey) {
    db.boot();
    var host = document.body;
    var main = U.qs('.app-main');
    host.insertBefore(renderRail(activeKey), host.firstChild);
    if (main) main.insertBefore(renderTopbar(), main.firstChild);

    U.on(U.qs('#omni'), 'click', openPalette);
    U.on(U.qs('#bell'), 'click', function () { openBell(this); });
    U.on(U.qs('#userSwitch'), 'click', function () { openUserSwitch(this); });
    U.on(U.qs('#railToggle'), 'click', function () {
      var r = U.qs('#appRail');
      var open = r.classList.toggle('is-open');
      this.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    });

    /* 키보드 — Salesforce Lightning의 단축키 관례를 따른다.
       한글 입력 중(IME 조합)에는 절대 가로채지 않는다. */
    var GOTO = { h: 'dashboard.html', p: 'pipeline.html', a: 'accounts.html', t: 'tickets.html', r: 'performance.html', i: 'insights.html' };
    var awaitingG = false, gTimer = null;
    document.addEventListener('keydown', function (e) {
      var typing = /input|textarea|select/i.test(document.activeElement.tagName) || document.activeElement.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPalette(); return; }
      if (typing || e.isComposing || e.keyCode === 229 || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === '/') { e.preventDefault(); openPalette(); return; }
      if (e.key === '?') { e.preventDefault(); ui.shortcutsHelp(); return; }
      if (e.key === 'e') { e.preventDefault(); ui.tableToCSV(document.querySelector('.table'), 'closer-' + activeKey + '.csv'); return; }
      if (awaitingG && GOTO[e.key]) { e.preventDefault(); awaitingG = false; w.location.href = db.linkAs(GOTO[e.key]); return; }
      if (e.key === 'g') { awaitingG = true; clearTimeout(gTimer); gTimer = setTimeout(function () { awaitingG = false; }, 1400); }
      else awaitingG = false;
    });

    if (!db.storageOK) {
      ui.toast('브라우저 저장소를 쓸 수 없어 변경 사항이 이 탭에서만 유지됩니다.', { kind: 'neg', ms: 6000 });
    }
    U.revealAll();
  }

  C.shell = { mount: mount, NAV: NAV, flatNav: flatNav, openPalette: openPalette };
})(window);
