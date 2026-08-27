/* CLOSER · metrics.js — every number the app quotes, with one definition each.
 * A metric that two screens compute differently is a bug, so they all live here.
 */
(function (w) {
  'use strict';
  var C = w.CLOSER, U = C.util, db = C.db, D = C.domain;
  var M = {};

  /** 기본 스코프: 내가 볼 수 있는 사용자 + 이번 분기. */
  M.scope = function (over) {
    var ids = db.visibleUserIds();
    var t = C.today;
    var qStart = new Date(t.getFullYear(), Math.floor(t.getMonth() / 3) * 3, 1);
    var qEnd = new Date(t.getFullYear(), Math.floor(t.getMonth() / 3) * 3 + 3, 0);
    return Object.assign({ userIds: ids, from: qStart, to: qEnd, label: U.quarterOf(t) }, over || {});
  };
  function inScope(rec, s, dateField) {
    if (s.userIds && s.userIds.indexOf(rec.ownerId) === -1) return false;
    if (!dateField) return true;
    var v = rec[dateField];
    if (!v) return false;
    return U.days(s.from, v) >= 0 && U.days(v, s.to) >= 0;
  }

  M.opps = function (s) { return db.where('opportunities', function (o) { return !s.userIds || s.userIds.indexOf(o.ownerId) > -1; }); };
  M.open = function (s) { return M.opps(s).filter(D.isOpen); };
  M.won = function (s) { return M.opps(s).filter(function (o) { return D.isWon(o) && inScope(o, s, 'closeDate'); }); };
  M.lost = function (s) { return M.opps(s).filter(function (o) { return D.isLost(o) && inScope(o, s, 'closeDate'); }); };

  /* ── 파이프라인 ──────────────────────────────────────────────────── */
  M.pipelineValue = function (s) { return U.sum(M.open(s), 'amount'); };
  M.weightedPipeline = function (s) { return U.sum(M.open(s), D.weighted); };
  M.wonAmount = function (s) { return U.sum(M.won(s), 'amount'); };
  M.wonNet = function (s) { return U.sum(M.won(s), D.netRevenue); };

  /** 성사율 = 성사 건수 / (성사 + 실주). 진행 중 건은 분모에 넣지 않습니다. */
  M.winRate = function (s) {
    var wn = M.won(s).length, ls = M.lost(s).length;
    return wn + ls === 0 ? null : (wn / (wn + ls)) * 100;
  };
  /** 금액 기준 성사율 — 건수 기준과 벌어지면 큰 딜을 놓치고 있다는 신호. */
  M.winRateByAmount = function (s) {
    var a = U.sum(M.won(s), 'amount'), b = U.sum(M.lost(s), 'amount');
    return a + b === 0 ? null : (a / (a + b)) * 100;
  };
  M.avgDealSize = function (s) { var wn = M.won(s); return wn.length ? U.sum(wn, 'amount') / wn.length : null; };
  /** 영업 사이클 = 생성일 → 성사일 평균 일수. */
  M.salesCycle = function (s) {
    var wn = M.won(s).filter(function (o) { return o.createdAt && o.closeDate; });
    return wn.length ? U.avg(wn.map(function (o) { return U.days(o.createdAt, o.closeDate); })) : null;
  };
  /** 파이프라인 커버리지 = 진행 파이프라인 ÷ 남은 목표. 건강한 값은 3배 이상. */
  M.coverage = function (s) {
    var remain = M.quota(s) - M.wonAmount(s);
    if (remain <= 0) return Infinity;
    return M.pipelineValue(s) / remain;
  };
  M.quota = function (s) {
    var months = monthsBetween(s.from, s.to);
    return U.sum(db.where('targets', function (t) {
      return t.type === '매출' && (!s.userIds || s.userIds.indexOf(t.ownerId) > -1) && months.indexOf(t.period) > -1;
    }), 'amount');
  };
  function monthsBetween(a, b) {
    var out = [], x = new Date(a.getFullYear(), a.getMonth(), 1);
    while (x <= b) { out.push(U.ymOf(x)); x.setMonth(x.getMonth() + 1); }
    return out;
  }
  M.months = monthsBetween;
  M.attainment = function (s) { var q = M.quota(s); return q > 0 ? (M.wonAmount(s) / q) * 100 : null; };

  /* ── 단계별 전환 ─────────────────────────────────────────────────── */
  /** 각 단계를 '거쳐 간' 건수 — 현재 단계 이상이면 통과한 것으로 셉니다. */
  M.stageFunnel = function (s) {
    var all = M.opps(s).filter(function (o) { return U.days(s.from, o.createdAt) >= -180; });
    return D.STAGES.filter(function (st) { return !st.lost; }).map(function (st) {
      return {
        label: st.key,
        value: all.filter(function (o) { return D.stage(o.stage).order >= st.order || D.isWon(o); }).length
      };
    });
  };
  /** 단계 간 전환율 — 어디서 새는지 한 줄로. */
  M.stageConversion = function (s) {
    var f = M.stageFunnel(s), out = [];
    for (var i = 1; i < f.length; i++) {
      out.push({ from: f[i - 1].label, to: f[i].label, rate: f[i - 1].value ? (f[i].value / f[i - 1].value) * 100 : 0 });
    }
    return out;
  };
  /** 단계별 평균 체류일 — 병목 진단용. */
  M.stageDwell = function (s) {
    var out = {};
    D.OPEN_STAGES.forEach(function (st) {
      var here = M.open(s).filter(function (o) { return o.stage === st.key; });
      out[st.key] = here.length ? U.avg(here.map(D.daysInStage)) : 0;
    });
    return out;
  };

  /* ── 예측 ────────────────────────────────────────────────────────── */
  M.forecast = function (s) {
    var open = M.open(s).filter(function (o) { return U.days(o.closeDate, s.to) >= 0; });
    var by = {};
    D.FORECAST_CASTS.forEach(function (c) { by[c] = 0; });
    open.forEach(function (o) { by[D.stage(o.stage).cast] += o.amount || 0; });
    by.Closed = M.wonAmount(s);
    return {
      byCast: by,
      commit: by.Commit + by.Closed,
      bestCase: by.Commit + by.Closed + by['Best Case'],
      pipeline: by.Commit + by.Closed + by['Best Case'] + by.Pipeline,
      weighted: M.wonAmount(s) + U.sum(open, D.weighted)
    };
  };

  /* ── 실적(직접 입력) ─────────────────────────────────────────────── */
  M.actualsFor = function (userId, period) {
    return db.where('actuals', function (a) {
      return a.ownerId === userId && (!period || a.period === period) && a.status !== '임시저장';
    });
  };
  M.actualTotal = function (userId, period) { return U.sum(M.actualsFor(userId, period), 'amount'); };
  /** 제출하지 않고 임시저장으로 남아 있는 실적 — 달성률에는 아직 안 잡힙니다. */
  M.draftsFor = function (userId, period) {
    return db.where('actuals', function (a) {
      return a.ownerId === userId && (!period || a.period === period) && a.status === '임시저장';
    });
  };
  M.draftTotal = function (userId, period) { return U.sum(M.draftsFor(userId, period), 'amount'); };
  M.targetFor = function (userId, period, type) {
    var t = db.first('targets', function (x) { return x.ownerId === userId && x.period === period && x.type === (type || '매출'); });
    return t ? t.amount : 0;
  };
  /** 목표 대비 실적을 월별 배열로. 그래프와 문장이 같은 배열을 봅니다. */
  M.monthlySeries = function (userId, count) {
    var out = [], t = C.today;
    for (var i = (count || 6) - 1; i >= 0; i--) {
      var d = new Date(t.getFullYear(), t.getMonth() - i, 1);
      var p = U.ymOf(d);
      out.push({ period: p, label: (d.getMonth() + 1) + '월', actual: M.actualTotal(userId, p), target: M.targetFor(userId, p) });
    }
    return out;
  };

  /**
   * 성사된 딜의 평균 접촉 간격(일). 인사이트가 "접촉이 끊겼다"고 말하려면
   * 무엇과 비교해 끊긴 것인지 실제 수치로 댈 수 있어야 한다.
   */
  M.avgContactInterval = function (s) {
    var gaps = [];
    M.won(s).forEach(function (o) {
      var acts = U.sortBy(db.activitiesOf('opportunity', o.id), 'dueDate');
      for (var i = 1; i < acts.length; i++) {
        var g = U.days(acts[i - 1].dueDate, acts[i].dueDate);
        if (g >= 0 && g < 120) gaps.push(g);
      }
    });
    return gaps.length ? U.avg(gaps) : null;
  };
  /** 배정까지 걸린 평균 시간(일) — 미배정 경고의 근거. */
  M.avgAssignWait = function () {
    var waits = db.where('ticketHistory', function (h) { return h.field === 'status' && h.to === '배정됨'; })
      .map(function (h) {
        var t = db.get('tickets', h.ticketId);
        return t ? U.days(t.createdAt, h.at) : null;
      }).filter(function (x) { return x !== null && x >= 0; });
    return waits.length ? U.avg(waits) : null;
  };

  /* ── 광고주 ──────────────────────────────────────────────────────── */
  M.accountRevenue = function (accountId, sinceDays) {
    return U.sum(db.where('opportunities', function (o) {
      return o.accountId === accountId && D.isWon(o) &&
        (!sinceDays || U.days(o.closeDate, C.today) <= sinceDays);
    }), 'amount');
  };
  M.atRiskAccounts = function (s) {
    return db.all('accounts')
      .filter(function (a) { return !s.userIds || s.userIds.indexOf(a.ownerId) > -1; })
      .map(function (a) { return { account: a, health: D.accountHealth(a) }; })
      .filter(function (x) { return x.health.score < 55; })
      .sort(function (a, b) { return a.health.score - b.health.score; });
  };
  M.newVsExisting = function (s) {
    var wn = M.won(s);
    var neu = wn.filter(function (o) { return o.type === '신규'; });
    return { newAmount: U.sum(neu, 'amount'), existingAmount: U.sum(wn, 'amount') - U.sum(neu, 'amount'), newCount: neu.length, total: wn.length };
  };

  /* ── 제작 티켓 ───────────────────────────────────────────────────── */
  M.ticketStats = function (s) {
    var all = db.all('tickets');
    var mine = s && s.userIds ? all.filter(function (t) { return s.userIds.indexOf(t.requesterId) > -1 || s.userIds.indexOf(t.assigneeId) > -1; }) : all;
    var done = mine.filter(function (t) { return t.status === '완료'; });
    var open = mine.filter(function (t) { return D.TICKET_OPEN.indexOf(t.status) > -1; });
    var breach = open.filter(function (t) { return D.slaState(t) === 'breach'; });
    var late = done.filter(D.wasLate);
    var cycle = done.filter(function (t) { return t.createdAt && t.doneAt; })
      .map(function (t) { return U.days(t.createdAt, t.doneAt); });
    var judged = open.length + done.length;
    return {
      total: mine.length, open: open.length, done: done.length,
      breach: breach.length, late: late.length,
      /** 준수율 = (열린 건 중 미위반 + 완료 건 중 납기 내) ÷ 판정 대상 전체 */
      slaRate: judged ? ((judged - breach.length - late.length) / judged) * 100 : null,
      avgCycle: cycle.length ? U.avg(cycle) : null,
      unassigned: open.filter(function (t) { return !t.assigneeId; }).length,
      reworkRate: done.length ? (done.filter(function (t) { return (t.reworkCount || 0) > 0; }).length / done.length) * 100 : null
    };
  };

  /* ── 리소스 ──────────────────────────────────────────────────────── */
  M.resourceLoad = function (from, to) {
    var people = db.where('users', function (u) { return u.role === '제작인력' && u.active !== false; });
    return people.map(function (p) {
      var u = D.utilization(p.id, from || C.today, to || U.addDays(C.today, 28));
      return { user: p, hours: u.hours, capacity: u.capacity, rate: u.capacity ? (u.hours / u.capacity) * 100 : 0, jobs: u.count };
    }).sort(function (a, b) { return b.rate - a.rate; });
  };
  M.pendingRequests = function () { return db.where('resourceRequests', function (r) { return r.status === '대기'; }); };

  /* ── 캠페인 성과 ─────────────────────────────────────────────────── */
  M.campaignPerf = function (c) {
    var ctr = c.impressions ? (c.clicks / c.impressions) * 100 : null;
    var cpc = c.clicks ? c.spend / c.clicks : null;
    var cpa = c.conversions ? c.spend / c.conversions : null;
    var roas = c.spend ? (c.revenue / c.spend) * 100 : null;
    var pace = c.budget ? (c.spend / c.budget) * 100 : null;
    return { ctr: ctr, cpc: cpc, cpa: cpa, roas: roas, pace: pace };
  };

  C.metrics = M;
})(window);
