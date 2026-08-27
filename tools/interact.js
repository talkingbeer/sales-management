/* CLOSER · tools/interact.js — does the screen actually DO anything?
 * verify.js proves a page renders. This proves the primary interaction on the
 * key screens changes real data. Run: node tools/interact.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const LOCAL_ONLY = {
  interceptors: [requestInterceptor(r => (/^https?:/i.test(r.url) ? new Response('', { status: 204 }) : undefined))]
};

function stub(w) {
  w.matchMedia = q => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  w.Element.prototype.scrollIntoView = function () {};
  w.confirm = () => true;
  w.print = () => {};
  w.URL.createObjectURL = () => 'blob:stub';
  w.URL.revokeObjectURL = () => {};
}

async function open(page, query) {
  const file = path.join(ROOT, page);
  const html = fs.readFileSync(file, 'utf8');
  const url = 'file:///' + file.split(path.sep).join('/') + (query || '');
  const errs = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { const m = e.message || String(e); if (!/Could not load link|Could not load script: "https?:/.test(m)) errs.push(m); });
  vc.on('error', (...a) => errs.push(String(a[0])));
  const dom = new JSDOM(html, { url, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc, resources: LOCAL_ONLY, beforeParse: stub });
  await new Promise(r => setTimeout(r, 340));
  return { dom, doc: dom.window.document, w: dom.window, errs };
}

const results = [];
function check(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log((pass ? '\x1b[32m PASS\x1b[0m ' : '\x1b[31m FAIL\x1b[0m ') + name + (detail ? '  — ' + detail : ''));
}

/** A DataTransfer stand-in; jsdom does not implement one. */
function makeDT(w) {
  const store = {};
  return {
    setData(k, v) { store[k] = String(v); },
    getData(k) { return store[k] || ''; },
    effectAllowed: '', dropEffect: '', types: Object.keys(store)
  };
}
function fire(w, el, type, extra) {
  const ev = new w.Event(type, { bubbles: true, cancelable: true });
  Object.assign(ev, extra || {});
  el.dispatchEvent(ev);
  return ev;
}

(async () => {
  /* ── 1. 파이프라인 — 드래그로 단계가 실제로 바뀌는가 (요구사항 5) ── */
  if (fs.existsSync(path.join(ROOT, 'app/pipeline.html'))) {
    const { doc, w, dom } = await open('app/pipeline.html');
    const card = doc.querySelector('.kcard[draggable="true"]');
    const cols = [...doc.querySelectorAll('.kanban__col')];
    if (!card || cols.length < 2) {
      check('파이프라인 · 드래그로 단계 이동', false, '카드 또는 컬럼을 찾지 못함');
    } else {
      const id = card.dataset.id || card.getAttribute('data-id');
      const before = w.CLOSER.db.get('opportunities', id);
      const beforeStage = before && before.stage;
      // find a column whose stage differs and is a plain forward move
      const target = cols.find(c => {
        const st = c.dataset.stage || c.getAttribute('data-stage');
        return st && st !== beforeStage && st !== '실주' && st !== '계약체결';
      });
      if (!target) {
        check('파이프라인 · 드래그로 단계 이동', false, '이동할 다른 단계 컬럼이 없음');
      } else {
        const dt = makeDT(w);
        fire(w, card, 'dragstart', { dataTransfer: dt });
        fire(w, target, 'dragover', { dataTransfer: dt });
        fire(w, target, 'drop', { dataTransfer: dt });
        await new Promise(r => setTimeout(r, 120));
        const after = w.CLOSER.db.get('opportunities', id);
        const targetStage = target.dataset.stage || target.getAttribute('data-stage');
        check('파이프라인 · 드래그로 단계 이동', after && after.stage === targetStage,
          beforeStage + ' → ' + (after ? after.stage : '?') + ' (목표 ' + targetStage + ')');
      }
    }
    dom.window.close();
  }

  /* ── 2. 저장이 실제로 남는가 — store 레벨 왕복 ────────────────── */
  {
    const { w, dom } = await open('app/dashboard.html');
    const db = w.CLOSER.db;
    const n0 = db.count('activities');
    const rec = db.insert('activities', { type: 'task', subject: '검증용 활동', relatedType: 'account', relatedId: db.all('accounts')[0].id, ownerId: db.me().id, dueDate: '2026-08-25', status: '예정' });
    const n1 = db.count('activities');
    db.update('activities', rec.id, { subject: '검증용 활동(수정)' });
    const edited = db.get('activities', rec.id).subject === '검증용 활동(수정)';
    db.remove('activities', rec.id);
    const trashed = db.trashList().some(t => t.record.id === rec.id);
    db.untrash(db.trashList().find(t => t.record.id === rec.id).id);
    const restored = !!db.get('activities', rec.id);
    check('레코드 계층 · 생성/수정/삭제/휴지통 복원',
      n1 === n0 + 1 && edited && trashed && restored,
      `insert ${n0}→${n1} · update ${edited} · trash ${trashed} · restore ${restored}`);
    dom.window.close();
  }

  /* ── 3. ⌘K 팔레트가 실제로 열리고 검색되는가 ──────────────────── */
  {
    const { doc, w, dom } = await open('app/dashboard.html');
    const ev = new w.KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true });
    doc.dispatchEvent(ev);
    await new Promise(r => setTimeout(r, 60));
    const box = doc.querySelector('.palette');
    let rows = 0, hits = 0;
    if (box) {
      rows = doc.querySelectorAll('.palette__row').length;
      const input = box.querySelector('.palette__input');
      input.value = '노바';
      fire(w, input, 'input');
      await new Promise(r => setTimeout(r, 220));
      hits = doc.querySelectorAll('.palette__row').length;
    }
    check('⌘K 팔레트 · 열림 + 레코드 검색', !!box && rows > 0 && hits > 0,
      box ? `초기 ${rows}행 → "노바" 검색 ${hits}행` : '팔레트가 열리지 않음');
    dom.window.close();
  }

  /* ── 4. 인사이트 엔진이 근거 있는 문장을 내는가 (요구사항 3) ──── */
  {
    const { w, dom } = await open('app/dashboard.html');
    const out = w.CLOSER.insights.run(w.CLOSER.metrics.scope({ userIds: null }));
    const wellFormed = out.every(x => x.say && x.why && x.label && x.kind);
    const hasNumbers = out.filter(x => /\d/.test(x.why)).length;
    check('인사이트 엔진 · 문장 + 근거',
      out.length >= 5 && wellFormed && hasNumbers === out.length,
      `${out.length}건 발화 · 전부 근거 수치 포함 ${hasNumbers === out.length}`);
    dom.window.close();
  }

  /* ── 5. 권한 게이트가 실제로 막는가 ───────────────────────────── */
  {
    const { w, dom } = await open('app/dashboard.html');
    const D = w.CLOSER.domain, db = w.CLOSER.db;
    const maker = db.all('users').find(u => u.role === '제작인력');
    const rep = db.all('users').find(u => u.role === '영업사원');
    const ok = !D.can('quotes', 'C', maker) && D.can('quotes', 'C', rep) &&
               !D.can('admin', 'U', rep) && D.can('tickets', 'U', maker);
    check('권한 매트릭스 · 역할별 차단', ok,
      `제작인력 견적생성=${D.can('quotes', 'C', maker)} · 영업사원 견적생성=${D.can('quotes', 'C', rep)} · 영업사원 관리자설정=${D.can('admin', 'U', rep)}`);
    dom.window.close();
  }

  /* ── 6. CSV 내보내기가 실제 행을 만드는가 ─────────────────────── */
  {
    const { doc, w, dom } = await open('app/accounts.html');
    let captured = null;
    w.CLOSER.ui.exportCSV = function (name, rows) { captured = { name, rows }; };
    w.CLOSER.ui.tableToCSV(doc.querySelector('.table'), 'test.csv');
    check('CSV 내보내기 · 화면의 표를 그대로', !!captured && captured.rows.length > 1,
      captured ? `${captured.rows.length}행 · 헤더 ${captured.rows[0].slice(0, 3).join('/')}` : '캡처 실패');
    dom.window.close();
  }

  /* ── 7. 중복 탐지와 병합 (SPEC 12장 9·10번) ──────────────────── */
  {
    const { w, dom } = await open('app/accounts.html');
    const db = w.CLOSER.db;
    const groups = db.findDuplicates('accounts');
    let moved = 0, gone = false, inTrash = false;
    if (groups.length) {
      const g = groups[0];
      const master = g.records[0], loser = g.records[1];
      const res = db.merge('accounts', master.id, [loser.id], { name: master.name });
      moved = res.moved;
      gone = !db.get('accounts', loser.id);
      inTrash = db.trashList().some(t => t.record.id === loser.id);
    }
    check('중복 탐지 · 레코드 병합', groups.length >= 2 && moved > 0 && gone && inTrash,
      `${groups.length}개 묶음 · 자식 ${moved}건 이관 · 원본 휴지통 보관 ${inTrash}`);
    dom.window.close();
  }

  /* ── 8. 티켓 상태 전이가 전이표를 지키는가 (요구사항 6) ──────── */
  if (fs.existsSync(path.join(ROOT, 'app/ticket.html'))) {
    const { w, dom } = await open('app/ticket.html');
    const D = w.CLOSER.domain;
    const flowOK = D.TICKET_FLOW['진행중'].indexOf('검수') > -1 &&
                   D.TICKET_FLOW['진행중'].indexOf('완료') === -1 &&
                   D.TICKET_FLOW['완료'].length === 0;
    const actorOK = D.TICKET_ACTOR['완료'].indexOf('requester') > -1 &&
                    D.TICKET_ACTOR['완료'].indexOf('assignee') === -1;
    check('티켓 워크플로 · 전이표와 행위자 제약', flowOK && actorOK,
      `진행중→[${D.TICKET_FLOW['진행중'].join(',')}] · 완료 가능 주체=[${D.TICKET_ACTOR['완료'].join(',')}]`);
    dom.window.close();
  }

  /* ── 9. SLA 계산이 납기를 기준으로 도는가 ──────────────────────── */
  {
    const { w, dom } = await open('app/dashboard.html');
    const D = w.CLOSER.domain, db = w.CLOSER.db;
    const open1 = db.where('tickets', t => D.TICKET_OPEN.indexOf(t.status) > -1);
    const breach = open1.filter(t => D.slaState(t) === 'breach').length;
    const ok = open1.filter(t => D.slaState(t) === 'ok').length;
    const rate = w.CLOSER.metrics.ticketStats(w.CLOSER.metrics.scope({ userIds: null })).slaRate;
    check('SLA · 납기 기준 판정이 신호를 만드는가',
      open1.length > 10 && breach > 0 && ok > breach && rate > 50 && rate < 95,
      `진행 ${open1.length}건 · 초과 ${breach} · 정상 ${ok} · 준수율 ${Math.round(rate)}%`);
    dom.window.close();
  }

  const failed = results.filter(r => !r.pass).length;
  console.log(`\n${results.length}개 검사 · 실패 ${failed}`);
  process.exit(failed ? 1 : 0);
})();
