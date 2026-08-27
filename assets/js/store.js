/* CLOSER · store.js — the record layer.
 * A tiny object database over localStorage, seeded from window.CLOSER_SEED.
 * Mirrors the Salesforce record model: typed objects, owners, field history,
 * an audit trail, and a "reset to seed" escape hatch.
 *
 * localStorage is best-effort: on file:// in a private window it can throw, so
 * every read and write is guarded and the app degrades to in-memory state.
 */
(function (w) {
  'use strict';
  var C = (w.CLOSER = w.CLOSER || {});
  var KEY = 'closer.db.v1';
  var U = C.util;

  /** The demo clock. Fixed so every open of the site reads the same. */
  C.today = new Date(2026, 7, 24, 10, 30, 0);

  /** Every object type the app stores. Order matters only for the reset dump. */
  var ENTITIES = [
    'teams', 'users', 'accounts', 'contacts', 'leads', 'opportunities', 'opportunityLines',
    'products', 'quotes', 'quoteLines', 'contracts', 'campaigns', 'activities',
    'tickets', 'ticketComments', 'ticketHistory', 'resourceRequests', 'assignments',
    'timesheets', 'targets', 'actuals', 'approvals', 'notes', 'notifications',
    'auditLogs', 'competitors', 'mediaChannels', 'listViews', 'emailTemplates', 'trash'
  ];

  var mem = null;          // in-memory copy of the whole database
  var storageOK = true;

  function readStore() {
    try {
      var raw = w.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { storageOK = false; return null; }
  }
  function writeStore() {
    if (!storageOK) return;
    try { w.localStorage.setItem(KEY, JSON.stringify(mem)); }
    catch (e) { storageOK = false; }
  }

  function freshFromSeed() {
    var seed = w.CLOSER_SEED || {};
    var out = { __v: 1, __seededAt: new Date().toISOString() };
    ENTITIES.forEach(function (e) {
      out[e] = Array.isArray(seed[e]) ? JSON.parse(JSON.stringify(seed[e])) : [];
    });
    out.session = { userId: (seed.session && seed.session.userId) || (out.users[0] && out.users[0].id) || null };
    return out;
  }

  function boot() {
    var saved = readStore();
    if (saved && saved.__v === 1 && Array.isArray(saved.opportunities) && saved.opportunities.length) {
      mem = saved;
      // A seed that grew new entity types after the user's copy was written.
      ENTITIES.forEach(function (e) { if (!Array.isArray(mem[e])) mem[e] = []; });
      if (!mem.session) mem.session = { userId: (mem.users[0] || {}).id };
    } else {
      mem = freshFromSeed();
      writeStore();
    }
    /* 어떤 브라우저는 file:// 에서 localStorage를 막는다. 그때도 역할 전환이
       유지되도록 ?as=<userId> 를 세션의 두 번째 경로로 인정한다. */
    var as = U.param('as');
    if (as && get('users', as)) mem.session.userId = as;
  }

  /** 현재 세션 사용자를 유지한 채 다른 화면으로 이동할 때 쓰는 URL 헬퍼. */
  function linkAs(href) {
    if (storageOK) return href;
    var id = mem.session && mem.session.userId;
    if (!id) return href;
    return href + (href.indexOf('?') > -1 ? '&' : '?') + 'as=' + encodeURIComponent(id);
  }

  /* ── Reads ───────────────────────────────────────────────────────── */
  function all(entity) { return (mem[entity] || []).slice(); }
  function raw(entity) { return mem[entity] || (mem[entity] = []); }
  function get(entity, id) {
    var list = mem[entity] || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function where(entity, fn) { return (mem[entity] || []).filter(fn); }
  function first(entity, fn) { var r = where(entity, fn); return r.length ? r[0] : null; }
  function count(entity, fn) { return fn ? where(entity, fn).length : (mem[entity] || []).length; }

  /* ── Writes ──────────────────────────────────────────────────────── */
  function insert(entity, obj, opts) {
    var rec = Object.assign({}, obj);
    if (!rec.id) rec.id = U.uid(entity.slice(0, 3));
    if (!rec.createdAt) rec.createdAt = new Date().toISOString();
    raw(entity).push(rec);
    if (!(opts && opts.silent)) audit('생성', entity, rec.id, rec.name || rec.title || rec.subject || rec.id);
    writeStore();
    return rec;
  }

  function update(entity, id, patch, opts) {
    var rec = get(entity, id);
    if (!rec) return null;
    var changed = [];
    Object.keys(patch).forEach(function (k) {
      if (JSON.stringify(rec[k]) !== JSON.stringify(patch[k])) {
        changed.push({ field: k, from: rec[k], to: patch[k] });
        rec[k] = patch[k];
      }
    });
    rec.updatedAt = new Date().toISOString();
    if (changed.length && !(opts && opts.silent)) {
      changed.forEach(function (c) {
        audit('변경', entity, id, c.field + ': ' + shortVal(c.from) + ' → ' + shortVal(c.to));
      });
    }
    writeStore();
    return rec;
  }

  /** 삭제는 휴지통을 거친다 — Salesforce의 Recycle Bin과 같은 안전장치.
      opts.noTrash 는 휴지통 자체를 비울 때만 쓴다. */
  function remove(entity, id, opts) {
    var list = raw(entity);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) {
        var gone = list.splice(i, 1)[0];
        if (entity !== 'trash' && !(opts && opts.noTrash)) {
          raw('trash').unshift({
            id: U.uid('trs'), entity: entity, at: new Date().toISOString(),
            actorId: mem.session && mem.session.userId,
            label: gone.name || gone.title || gone.subject || gone.no || gone.id,
            record: gone
          });
          if (mem.trash.length > 200) mem.trash.length = 200;
          audit('삭제', entity, id, gone.name || gone.title || id);
        }
        writeStore();
        return gone;
      }
    }
    return null;
  }

  function trashList() { return all('trash'); }
  /** 휴지통에서 되살린다. 15일이 지난 항목은 목록에서만 흐리게 보이고 복원은 가능하다. */
  function untrash(trashId) {
    var t = get('trash', trashId);
    if (!t) return null;
    raw(t.entity).push(t.record);
    remove('trash', trashId, { noTrash: true });
    audit('복원', t.entity, t.record.id, t.label);
    writeStore();
    return t.record;
  }
  function emptyTrash() {
    var n = raw('trash').length;
    mem.trash = [];
    audit('비움', 'trash', '-', n + '건 영구 삭제');
    writeStore();
    return n;
  }

  /** Put a record back exactly as it was — powers the Undo toast. */
  function restore(entity, rec, index) {
    var list = raw(entity);
    if (typeof index === 'number' && index >= 0 && index <= list.length) list.splice(index, 0, rec);
    else list.push(rec);
    writeStore();
    return rec;
  }

  function shortVal(v) {
    if (v === null || v === undefined || v === '') return '(없음)';
    var s = String(v);
    return s.length > 34 ? s.slice(0, 34) + '…' : s;
  }

  function audit(action, objectType, objectId, detail) {
    raw('auditLogs').unshift({
      id: U.uid('log'), at: new Date().toISOString(),
      actorId: mem.session && mem.session.userId, action: action,
      objectType: objectType, objectId: objectId, detail: detail
    });
    if (mem.auditLogs.length > 600) mem.auditLogs.length = 600;
  }

  function reset() {
    mem = freshFromSeed();
    writeStore();
    return mem;
  }

  /* ══ 중복 탐지와 레코드 병합 ═══════════════════════════════════════
     같은 광고주가 “노바커머스”와 “(주)노바 커머스”로 두 번 들어오는 일은
     모든 CRM에서 벌어진다. 이름을 정규화해 후보를 찾고, 필드 단위로 고른
     값으로 하나를 남긴 뒤 자식 레코드를 새 부모에 붙인다. */
  function normalizeName(s) {
    return String(s || '')
      .replace(/\(주\)|주식회사|㈜|Inc\.?|Corp\.?|Co\.?,?\s?Ltd\.?/gi, '')
      .replace(/[\s\-_.]/g, '')
      .toLowerCase();
  }
  function domainOf(v) {
    var m = String(v || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[\/?#]/)[0];
    return m.indexOf('.') > -1 ? m : '';
  }

  /** 중복 후보 묶음 배열을 돌려준다. 각 묶음은 2건 이상. */
  function findDuplicates(entity) {
    var list = all(entity);
    var byKey = {};
    list.forEach(function (r) {
      var keys = [];
      var name = r.name || r.company || '';
      if (name) keys.push('n:' + normalizeName(name));
      var dom = domainOf(r.website || r.email);
      if (dom) keys.push('d:' + dom);
      keys.forEach(function (k) { (byKey[k] = byKey[k] || []).push(r); });
    });
    var seen = {}, groups = [];
    Object.keys(byKey).forEach(function (k) {
      var g = byKey[k];
      if (g.length < 2) return;
      var sig = g.map(function (r) { return r.id; }).sort().join('|');
      if (seen[sig]) return;
      seen[sig] = true;
      groups.push({ reason: k.charAt(0) === 'n' ? '상호가 사실상 동일' : '웹사이트 도메인이 같음', records: g });
    });
    return groups;
  }

  /** 자식 레코드가 부모를 가리키는 방식 — 병합 시 재부모화에 쓴다. */
  var CHILD_LINKS = {
    accounts: [['contacts', 'accountId'], ['opportunities', 'accountId'], ['campaigns', 'accountId'],
               ['contracts', 'accountId'], ['quotes', 'accountId'], ['tickets', 'accountId'],
               ['actuals', 'accountId'], ['notes', 'relatedId'], ['activities', 'relatedId']],
    contacts: [['opportunities', 'contactId']],
    leads: []
  };

  /**
   * 병합. master 를 남기고 losers 를 휴지통으로 보낸다.
   * choices 는 {필드명: 값} — 화면에서 사람이 고른 값이 그대로 들어온다.
   * 옮겨진 자식 레코드 수를 돌려준다.
   */
  function merge(entity, masterId, loserIds, choices) {
    var master = get(entity, masterId);
    if (!master) return null;
    if (choices) update(entity, masterId, choices, { silent: true });
    var moved = 0;
    (CHILD_LINKS[entity] || []).forEach(function (pair) {
      var child = pair[0], field = pair[1];
      raw(child).forEach(function (r) {
        if (loserIds.indexOf(r[field]) > -1) { r[field] = masterId; moved++; }
      });
    });
    loserIds.forEach(function (id) {
      var loser = get(entity, id);
      if (loser) remove(entity, id);
    });
    audit('병합', entity, masterId,
      loserIds.length + '건을 병합 · 자식 레코드 ' + moved + '건 이관');
    writeStore();
    return { master: get(entity, masterId), moved: moved };
  }

  /* ── Session & people ────────────────────────────────────────────── */
  function me() { return get('users', mem.session && mem.session.userId) || (mem.users || [])[0] || null; }
  /** 역할 전환. 저장소가 막힌 환경에서는 URL로 세션을 넘겨 새로고침해도 유지되게 한다. */
  function switchUser(id) {
    mem.session.userId = id;
    writeStore();
    if (!storageOK && typeof w !== 'undefined' && w.location) {
      var url = w.location.pathname + w.location.search.replace(/([?&])as=[^&]*/, '$1').replace(/[?&]$/, '');
      url += (url.indexOf('?') > -1 ? '&' : '?') + 'as=' + encodeURIComponent(id);
      w.location.href = url;
      return false;   // caller should not reload again
    }
    return true;
  }
  function userName(id) { var u = get('users', id); return u ? u.name : '—'; }
  function isManager(u) { var x = u || me(); return !!x && (x.role === '영업관리자' || x.role === '리소스매니저' || x.role === '관리자'); }

  /** Records this user may see: own + (for a manager) their team's. */
  function visibleUserIds(u) {
    var x = u || me();
    if (!x) return [];
    if (x.role === '관리자') return all('users').map(function (v) { return v.id; });
    if (x.role === '영업관리자') {
      return all('users').filter(function (v) { return v.teamId === x.teamId; }).map(function (v) { return v.id; });
    }
    return [x.id];
  }

  /* ── Notifications ───────────────────────────────────────────────── */
  function notify(userId, kind, text, link) {
    raw('notifications').unshift({
      id: U.uid('ntf'), userId: userId, kind: kind, text: text,
      link: link || null, at: new Date().toISOString(), read: false
    });
    writeStore();
  }
  function unreadCount(userId) {
    var uid = userId || (me() && me().id);
    return where('notifications', function (n) { return n.userId === uid && !n.read; }).length;
  }
  function markAllRead(userId) {
    var uid = userId || (me() && me().id);
    raw('notifications').forEach(function (n) { if (n.userId === uid) n.read = true; });
    writeStore();
  }

  /* ── Joins used on nearly every page ─────────────────────────────── */
  function accountOf(opp) { return opp ? get('accounts', opp.accountId) : null; }
  function ownerOf(rec) { return rec ? get('users', rec.ownerId || rec.assigneeId || rec.requesterId) : null; }
  function linesOf(oppId) { return where('opportunityLines', function (l) { return l.oppId === oppId; }); }
  function ticketsOf(oppId) { return where('tickets', function (t) { return t.oppId === oppId; }); }
  function activitiesOf(type, id) {
    return U.sortBy(where('activities', function (a) { return a.relatedType === type && a.relatedId === id; }), 'dueDate', 'desc');
  }

  C.db = {
    entities: ENTITIES,
    boot: boot, all: all, get: get, where: where, first: first, count: count,
    insert: insert, update: update, remove: remove, restore: restore, reset: reset,
    trashList: trashList, untrash: untrash, emptyTrash: emptyTrash,
    findDuplicates: findDuplicates, merge: merge, normalizeName: normalizeName,
    audit: audit, notify: notify, unreadCount: unreadCount, markAllRead: markAllRead,
    me: me, switchUser: switchUser, linkAs: linkAs, userName: userName, isManager: isManager, visibleUserIds: visibleUserIds,
    accountOf: accountOf, ownerOf: ownerOf, linesOf: linesOf, ticketsOf: ticketsOf, activitiesOf: activitiesOf,
    get session() { return mem.session; },
    get storageOK() { return storageOK; },
    dump: function () { return mem; }
  };
})(window);
